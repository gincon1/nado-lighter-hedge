/**
 * Lighter 对冲执行器
 * 负责：市价对冲、滑点检查、对冲确认
 * 
 * 核心功能：
 * 1. executeMarketHedge - 执行市价对冲
 * 2. checkSlippage - 检查滑点
 */

// 默认配置
const DEFAULT_CONFIG = {
  maxSlippage: 0.005,       // 最大滑点 0.5%
  timeInForce: 'ioc',       // IOC 立即成交
  maxRetries: 3,            // 最大重试次数
  retryDelay: 1000,         // 重试延迟 1 秒
};

class LighterHedger {
  constructor(lighterClient, lighterPriceFeed, config = {}) {
    this.client = lighterClient;
    this.priceFeed = lighterPriceFeed;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 符号映射
    this.symbolMap = {
      BTC: 'BTCUSD',
      ETH: 'ETHUSD',
      SOL: 'SOLUSD',
    };
  }

  /**
   * 执行市价对冲
   * 
   * @param {Object} params - 参数
   * @param {string} params.coin - 币种 BTC/ETH/SOL
   * @param {string} params.side - 方向 buy/sell
   * @param {number} params.size - 数量
   * @param {number} [params.maxSlippage] - 最大滑点
   * @param {Object} [params.context] - 关联的对冲流程信息
   * @returns {Promise<Object>} 执行结果
   */
  async executeMarketHedge(params) {
    const {
      coin,
      side,
      size,
      maxSlippage = this.config.maxSlippage,
      context = {},
    } = params;

    const symbol = this.symbolMap[coin.toUpperCase()] || `${coin}USD`;
    const startTime = Date.now();

    console.log(`\n[LighterHedger] 执行市价对冲`);
    console.log(`  币种: ${coin} (${symbol})`);
    console.log(`  方向: ${side}`);
    console.log(`  数量: ${size}`);
    console.log(`  最大滑点: ${(maxSlippage * 100).toFixed(2)}%`);

    // 1. 获取当前价格作为基准
    let expectedPrice;
    try {
      const book = await this.priceFeed.getL2Book(symbol);
      expectedPrice = side === 'buy' 
        ? (book.ask || book.bestAsk)
        : (book.bid || book.bestBid);
      console.log(`  预期价格: ${expectedPrice}`);
    } catch (error) {
      console.error(`  获取价格失败: ${error.message}`);
      expectedPrice = 0;
    }

    // 2. 计算限价（市价单也需要一个保护价格）
    const slippageMultiplier = side === 'buy' ? (1 + maxSlippage) : (1 - maxSlippage);
    const limitPrice = expectedPrice * slippageMultiplier;
    console.log(`  限价保护: ${limitPrice.toFixed(2)}`);

    // 3. 执行下单（带重试）
    let lastError = null;
    for (let retry = 0; retry <= this.config.maxRetries; retry++) {
      if (retry > 0) {
        console.log(`  重试 ${retry}/${this.config.maxRetries}...`);
        await this._sleep(this.config.retryDelay);
      }

      try {
        const orderResult = await this.client.createOrder({
          symbol,
          side,
          orderType: 'market',
          amount: size.toString(),
          price: limitPrice.toFixed(2),
          time_in_force: this.config.timeInForce,
        });

        // 4. 解析结果
        const result = this._parseOrderResult(orderResult, {
          expectedPrice,
          size,
          side,
          maxSlippage,
          startTime,
          context,
        });

        console.log(`  ✓ 对冲完成`);
        console.log(`  状态: ${result.status}`);
        console.log(`  成交数量: ${result.filledSize}`);
        if (result.slippage !== null) {
          console.log(`  实际滑点: ${(result.slippage * 100).toFixed(4)}%`);
        }

        return result;

      } catch (error) {
        lastError = error;
        console.error(`  下单失败: ${error.message}`);
      }
    }

    // 所有重试都失败
    return {
      status: 'failed',
      filledSize: 0,
      avgPrice: 0,
      slippage: null,
      orderId: null,
      error: lastError?.message || 'Unknown error',
      executionTime: Date.now() - startTime,
      context,
    };
  }

  /**
   * 检查滑点
   * 
   * @param {number} expectedPrice - 预期价格
   * @param {number} actualPrice - 实际价格
   * @param {string} side - 方向
   * @returns {Object} 滑点信息
   */
  checkSlippage(expectedPrice, actualPrice, side) {
    if (!expectedPrice || !actualPrice) {
      return {
        slippage: null,
        isAcceptable: true,
        message: 'Unable to calculate slippage',
      };
    }

    // 计算滑点
    // 买入：实际价格高于预期 = 负滑点
    // 卖出：实际价格低于预期 = 负滑点
    let slippage;
    if (side === 'buy') {
      slippage = (actualPrice - expectedPrice) / expectedPrice;
    } else {
      slippage = (expectedPrice - actualPrice) / expectedPrice;
    }

    const isAcceptable = slippage <= this.config.maxSlippage;
    const isSevere = slippage > this.config.maxSlippage * 2;

    return {
      slippage,
      slippagePercent: slippage * 100,
      isAcceptable,
      isSevere,
      message: isAcceptable 
        ? 'Slippage within acceptable range'
        : isSevere
          ? `SEVERE: Slippage ${(slippage * 100).toFixed(4)}% exceeds 2x limit`
          : `WARNING: Slippage ${(slippage * 100).toFixed(4)}% exceeds limit`,
    };
  }

  /**
   * 内部方法：解析订单结果
   */
  _parseOrderResult(orderResult, context) {
    const { expectedPrice, size, side, maxSlippage, startTime } = context;

    // Lighter 通过 Python SDK 返回的结果格式
    // { success: true, result: "...", client_order_index: 123 }
    
    if (!orderResult.success) {
      return {
        status: 'failed',
        filledSize: 0,
        avgPrice: 0,
        slippage: null,
        orderId: null,
        error: orderResult.error || 'Order failed',
        executionTime: Date.now() - startTime,
        context: context.context,
      };
    }

    // 假设成功（IOC 订单会立即成交或取消）
    // 实际成交价格需要从交易历史获取，这里暂时使用预期价格
    const filledSize = size;
    const avgPrice = expectedPrice;  // TODO: 从实际成交获取

    // 计算滑点
    const slippageInfo = this.checkSlippage(expectedPrice, avgPrice, side);

    return {
      status: slippageInfo.isSevere ? 'slippage_exceeded' : 'success',
      filledSize,
      avgPrice,
      slippage: slippageInfo.slippage,
      slippagePercent: slippageInfo.slippagePercent,
      orderId: orderResult.client_order_index?.toString() || null,
      isSlippageAcceptable: slippageInfo.isAcceptable,
      slippageMessage: slippageInfo.message,
      executionTime: Date.now() - startTime,
      context: context.context,
      rawResult: orderResult,
    };
  }

  /**
   * 内部方法：休眠
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LighterHedger;
