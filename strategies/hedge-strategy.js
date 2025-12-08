/**
 * Nado-Lighter 对冲策略主类
 * 实现完整的状态机和对冲流程
 * 
 * 核心流程：
 * 1. Nado 限价买单 → 等待成交（60s 超时重挂）→ Lighter 市价卖出对冲
 * 2. Nado 限价卖单 → 等待成交（60s 超时重挂）→ Lighter 市价买入平仓
 */

const NadoOrderManager = require('./nado-order-manager');
const LighterHedger = require('./lighter-hedger');

// 状态定义
const HedgeState = {
  IDLE: 'IDLE',
  PLACING_NADO: 'PLACING_NADO',
  WAITING_NADO_FILL: 'WAITING_NADO_FILL',
  HEDGING_ON_LIGHTER: 'HEDGING_ON_LIGHTER',
  POSITION_OPENED: 'POSITION_OPENED',
  CLOSING_NADO: 'CLOSING_NADO',
  CLOSING_LIGHTER: 'CLOSING_LIGHTER',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED',
};

// 默认配置
const DEFAULT_CONFIG = {
  // Nado 参数
  nadoOrderTimeout: 60000,    // 60 秒超时
  nadoMaxRetries: 3,          // 最大重试 3 次
  nadoPriceStrategy: 'best',  // 价格策略
  
  // Lighter 参数
  lighterMaxSlippage: 0.005,  // 0.5% 滑点
  
  // 持仓参数
  holdTime: 0,                // 持仓时间（毫秒），0 = 立即平仓
  
  // 风险控制
  maxExposure: 0.1,           // 最大敞口
  stopOnError: true,          // 错误时停止
};

class HedgeStrategy {
  constructor(nadoClient, lighterClient, nadoPriceFeed, lighterPriceFeed, config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化子模块
    this.nadoManager = new NadoOrderManager(nadoClient, nadoPriceFeed, {
      orderTimeout: this.config.nadoOrderTimeout,
      maxRetries: this.config.nadoMaxRetries,
      priceStrategy: this.config.nadoPriceStrategy,
    });
    
    this.lighterHedger = new LighterHedger(lighterClient, lighterPriceFeed, {
      maxSlippage: this.config.lighterMaxSlippage,
    });
    
    // 状态
    this.state = HedgeState.IDLE;
    this.currentHedge = null;
    this.hedgeHistory = [];
    
    // 统计
    this.stats = {
      totalRounds: 0,
      successRounds: 0,
      failedRounds: 0,
      totalVolume: 0,
      totalPnl: 0,
    };
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      state: this.state,
      currentHedge: this.currentHedge,
      stats: this.stats,
    };
  }

  /**
   * 执行一次完整的对冲（开仓 + 平仓）
   * 
   * @param {string} coin - 币种
   * @param {number} size - 数量
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 执行结果
   */
  async runOnce(coin, size, options = {}) {
    const hedgeId = `HEDGE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    console.log('\n' + '═'.repeat(60));
    console.log(`  对冲任务开始: ${hedgeId}`);
    console.log('═'.repeat(60));
    console.log(`  币种: ${coin}`);
    console.log(`  数量: ${size}`);
    console.log(`  超时: ${this.config.nadoOrderTimeout / 1000}s`);
    console.log(`  最大重试: ${this.config.nadoMaxRetries}`);
    
    this.currentHedge = {
      id: hedgeId,
      coin,
      size,
      startTime,
      state: HedgeState.IDLE,
      openResult: null,
      closeResult: null,
    };

    try {
      // ========== 开仓阶段 ==========
      console.log('\n' + '─'.repeat(40));
      console.log('  阶段 1: 开仓');
      console.log('─'.repeat(40));
      
      // 1. Nado 限价买单
      this._setState(HedgeState.PLACING_NADO);
      console.log('\n[1.1] Nado 限价买单...');
      
      const nadoOpenResult = await this.nadoManager.placeAndWaitWithRetry({
        coin,
        side: 'buy',
        size,
        timeout: this.config.nadoOrderTimeout,
        maxRetries: this.config.nadoMaxRetries,
      });
      
      if (nadoOpenResult.status !== 'filled') {
        throw new Error(`Nado 开仓失败: ${nadoOpenResult.status}`);
      }
      
      console.log(`\n  ✓ Nado 买单成交: ${nadoOpenResult.filledSize} @ ${nadoOpenResult.avgPrice}`);
      
      // 2. Lighter 市价卖出对冲
      this._setState(HedgeState.HEDGING_ON_LIGHTER);
      console.log('\n[1.2] Lighter 市价卖出对冲...');
      
      const lighterHedgeResult = await this.lighterHedger.executeMarketHedge({
        coin,
        side: 'sell',
        size: nadoOpenResult.filledSize,
        context: { hedgeId, phase: 'open' },
      });
      
      if (lighterHedgeResult.status === 'failed') {
        throw new Error(`Lighter 对冲失败: ${lighterHedgeResult.error}`);
      }
      
      console.log(`\n  ✓ Lighter 卖出成交: ${lighterHedgeResult.filledSize}`);
      
      this.currentHedge.openResult = {
        nado: nadoOpenResult,
        lighter: lighterHedgeResult,
      };
      
      // 3. 持仓等待
      this._setState(HedgeState.POSITION_OPENED);
      if (this.config.holdTime > 0) {
        console.log(`\n[1.3] 持仓等待 ${this.config.holdTime / 1000}s...`);
        await this._sleep(this.config.holdTime);
      }
      
      // ========== 平仓阶段 ==========
      console.log('\n' + '─'.repeat(40));
      console.log('  阶段 2: 平仓');
      console.log('─'.repeat(40));
      
      // 4. Nado 限价卖单
      this._setState(HedgeState.CLOSING_NADO);
      console.log('\n[2.1] Nado 限价卖单...');
      
      const nadoCloseResult = await this.nadoManager.placeAndWaitWithRetry({
        coin,
        side: 'sell',
        size: nadoOpenResult.filledSize,
        timeout: this.config.nadoOrderTimeout,
        maxRetries: this.config.nadoMaxRetries,
      });
      
      if (nadoCloseResult.status !== 'filled') {
        throw new Error(`Nado 平仓失败: ${nadoCloseResult.status}`);
      }
      
      console.log(`\n  ✓ Nado 卖单成交: ${nadoCloseResult.filledSize} @ ${nadoCloseResult.avgPrice}`);
      
      // 5. Lighter 市价买入平仓
      this._setState(HedgeState.CLOSING_LIGHTER);
      console.log('\n[2.2] Lighter 市价买入平仓...');
      
      const lighterCloseResult = await this.lighterHedger.executeMarketHedge({
        coin,
        side: 'buy',
        size: nadoCloseResult.filledSize,
        context: { hedgeId, phase: 'close' },
      });
      
      if (lighterCloseResult.status === 'failed') {
        throw new Error(`Lighter 平仓失败: ${lighterCloseResult.error}`);
      }
      
      console.log(`\n  ✓ Lighter 买入成交: ${lighterCloseResult.filledSize}`);
      
      this.currentHedge.closeResult = {
        nado: nadoCloseResult,
        lighter: lighterCloseResult,
      };
      
      // ========== 完成 ==========
      this._setState(HedgeState.COMPLETED);
      
      const totalTime = Date.now() - startTime;
      const result = this._buildResult(true, totalTime);
      
      // 更新统计
      this.stats.totalRounds++;
      this.stats.successRounds++;
      this.stats.totalVolume += size * 2;
      
      this.hedgeHistory.push(result);
      
      console.log('\n' + '═'.repeat(60));
      console.log('  ✅ 对冲任务完成');
      console.log('═'.repeat(60));
      console.log(`  总耗时: ${totalTime}ms`);
      console.log(`  Nado 重试: 开仓 ${nadoOpenResult.retries} 次, 平仓 ${nadoCloseResult.retries} 次`);
      
      this._setState(HedgeState.IDLE);
      this.currentHedge = null;
      
      return result;
      
    } catch (error) {
      this._setState(HedgeState.ERROR);
      
      const totalTime = Date.now() - startTime;
      const result = this._buildResult(false, totalTime, error.message);
      
      this.stats.totalRounds++;
      this.stats.failedRounds++;
      
      this.hedgeHistory.push(result);
      
      console.log('\n' + '═'.repeat(60));
      console.log('  ❌ 对冲任务失败');
      console.log('═'.repeat(60));
      console.log(`  错误: ${error.message}`);
      console.log(`  总耗时: ${totalTime}ms`);
      
      // 检查是否有未对冲敞口
      if (this.currentHedge?.openResult?.nado && !this.currentHedge?.openResult?.lighter) {
        console.log('\n  ⚠️ 警告: 存在未对冲敞口！');
        console.log(`  Nado 已成交: ${this.currentHedge.openResult.nado.filledSize}`);
        console.log('  请手动处理或等待自动恢复');
      }
      
      this._setState(HedgeState.IDLE);
      this.currentHedge = null;
      
      return result;
    }
  }

  /**
   * 执行循环对冲
   * 
   * @param {Object} params - 参数
   * @param {string} params.coin - 币种
   * @param {number} params.size - 数量
   * @param {number} params.rounds - 轮数
   * @param {number} params.interval - 间隔（毫秒）
   * @param {boolean} params.stopOnError - 错误时停止
   * @returns {Promise<Object>} 执行结果
   */
  async runLoop(params) {
    const {
      coin,
      size,
      rounds,
      interval = 0,
      holdTime = 0,
      stopOnError = this.config.stopOnError,
    } = params;

    console.log('\n' + '╔' + '═'.repeat(58) + '╗');
    console.log('║' + '  循环对冲开始'.padEnd(56) + '  ║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log(`  币种: ${coin}`);
    console.log(`  数量: ${size}`);
    console.log(`  轮数: ${rounds}`);
    console.log(`  间隔: ${interval}ms`);
    console.log(`  持仓时间: ${holdTime}ms`);

    // 临时修改配置
    const originalHoldTime = this.config.holdTime;
    this.config.holdTime = holdTime;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i <= rounds; i++) {
      console.log(`\n${'▓'.repeat(60)}`);
      console.log(`  第 ${i}/${rounds} 轮`);
      console.log(`${'▓'.repeat(60)}`);

      const result = await this.runOnce(coin, size);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (stopOnError) {
          console.log('\n⚠️ 错误停止模式，中止循环');
          break;
        }
      }

      // 间隔等待
      if (i < rounds && interval > 0) {
        console.log(`\n⏳ 等待 ${interval / 1000}s 后开始下一轮...`);
        await this._sleep(interval);
      }
    }

    // 恢复配置
    this.config.holdTime = originalHoldTime;

    // 统计
    console.log('\n' + '╔' + '═'.repeat(58) + '╗');
    console.log('║' + '  循环对冲完成'.padEnd(56) + '  ║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log(`  成功: ${successCount} 轮`);
    console.log(`  失败: ${failCount} 轮`);
    console.log(`  成功率: ${(successCount / (successCount + failCount) * 100).toFixed(1)}%`);

    return {
      success: failCount === 0,
      totalRounds: successCount + failCount,
      successCount,
      failCount,
      results,
    };
  }

  /**
   * 紧急停止
   */
  async emergencyStop() {
    console.log('\n🚨 紧急停止！');
    this._setState(HedgeState.ERROR);
    // TODO: 实现紧急平仓逻辑
  }

  /**
   * 内部方法：设置状态
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;
    if (this.currentHedge) {
      this.currentHedge.state = newState;
    }
    console.log(`  [状态] ${oldState} → ${newState}`);
  }

  /**
   * 内部方法：构建结果
   */
  _buildResult(success, totalTime, error = null) {
    return {
      success,
      hedgeId: this.currentHedge?.id,
      coin: this.currentHedge?.coin,
      size: this.currentHedge?.size,
      openResult: this.currentHedge?.openResult,
      closeResult: this.currentHedge?.closeResult,
      totalTime,
      error,
      timestamp: Date.now(),
    };
  }

  /**
   * 内部方法：休眠
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { HedgeStrategy, HedgeState };
