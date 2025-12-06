/**
 * Nado-Lighter 对冲策略执行器
 * 在 Nado 和 Lighter 两个交易所之间执行对冲下单
 */

const { coinToSymbol } = require('../nado-sdk/src/types');

// 手续费配置（可通过环境变量覆盖）
const FEE_CONFIG = {
  NADO_TAKER_FEE: parseFloat(process.env.NADO_TAKER_FEE || '0.0015'),      // 0.15%
  NADO_MAKER_FEE: parseFloat(process.env.NADO_MAKER_FEE || '-0.0008'),     // -0.08% rebate
  LIGHTER_TAKER_FEE: parseFloat(process.env.LIGHTER_TAKER_FEE || '0.001'), // 0.1%
  LIGHTER_MAKER_FEE: parseFloat(process.env.LIGHTER_MAKER_FEE || '0'),     // 0%
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0'), // 最小利润阈值（美元）
};

/**
 * Nado-Lighter 对冲执行器
 */
class NadoLighterHedgeExecutor {
  /**
   * @param {Object} nadoClient - Nado 客户端
   * @param {Object} lighterClient - Lighter 客户端
   * @param {Object} nadoPriceFeed - Nado 价格服务
   * @param {Object} lighterPriceFeed - Lighter 价格服务
   */
  constructor(nadoClient, lighterClient, nadoPriceFeed, lighterPriceFeed) {
    this.nadoClient = nadoClient;
    this.lighterClient = lighterClient;
    this.nadoPriceFeed = nadoPriceFeed;
    this.lighterPriceFeed = lighterPriceFeed;

    // 缓存 productId 映射
    this._productIdCache = {};
    
    // 币种符号映射
    this.symbolMap = {
      'BTC': 'BTCUSD',
      'ETH': 'ETHUSD',
      'SOL': 'SOLUSD'
    };
  }

  /**
   * 执行对冲下单
   * @param {string} coin - 币种，如 'BTC'
   * @param {number|string} size - 数量
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 执行结果
   */
  async executeHedge(coin, size, options = {}) {
    const {
      slippage = 0.001,       // 默认 0.1% 滑点
      orderType = 'ioc',      // 'ioc' 或 'limit'
      checkFill = true,       // 是否检查成交
      reverse = false,        // 是否反向（平仓时使用）
    } = options;

    const sizeNum = parseFloat(size);

    console.log('\n=== 开始执行 Nado-Lighter 对冲 ===');
    console.log(`币种: ${coin}`);
    console.log(`数量: ${sizeNum}`);
    console.log(`滑点: ${(slippage * 100).toFixed(2)}%`);
    console.log(`订单类型: ${orderType.toUpperCase()}`);
    console.log(`模式: ${reverse ? '平仓' : '开仓'}`);

    const startTime = Date.now();

    try {
      // 1. 获取两边价格
      console.log('\n步骤 1: 获取两边市场价格...');
      const lighterSymbol = this.symbolMap[coin] || `${coin}USD`;
      
      const [nadoBook, lighterBook] = await Promise.all([
        this.nadoPriceFeed.getL2Book(coinToSymbol(coin)),
        this.lighterPriceFeed.getL2Book(lighterSymbol),
      ]);

      this._logPriceComparison(nadoBook, lighterBook, coin);

      // 2. 获取 Nado productId
      const productId = await this._getProductId(coin);
      console.log(`\nNado productId: ${productId}`);

      // 3. 确定最优方向
      console.log('\n步骤 2: 确定最优对冲方向...');
      const direction = this._determineBestDirection(nadoBook, lighterBook, reverse, sizeNum);
      console.log(`Nado: ${direction.nadoSide.toUpperCase()}`);
      console.log(`Lighter: ${direction.lighterSide.toUpperCase()}`);
      if (direction.expectedProfitUsd !== undefined) {
        console.log(`预期利润: $${direction.expectedProfitUsd.toFixed(4)}`);
      }

      // 4. 计算订单价格（加滑点确保成交）
      console.log('\n步骤 3: 计算订单价格...');
      const prices = this._calculatePrices(nadoBook, lighterBook, direction, slippage);
      console.log(`Nado ${direction.nadoSide} 价格: ${prices.nadoPrice}`);
      console.log(`Lighter ${direction.lighterSide} 价格: ${prices.lighterPrice}`);

      // 5. 验证最小订单金额
      this._validateMinOrderSize(coin, sizeNum, prices.nadoPrice, prices.lighterPrice);

      // 6. 构建订单
      console.log('\n步骤 4: 构建订单...');
      const nadoOrder = {
        productId,
        price: prices.nadoPrice,
        size: sizeNum,
        side: direction.nadoSide,
        orderType: orderType === 'ioc' ? 'ioc' : 'default',
      };

      const lighterOrder = {
        symbol: lighterSymbol,
        side: direction.lighterSide,
        orderType: orderType === 'limit' ? 'limit' : 'market',
        amount: sizeNum.toString(),
        price: prices.lighterPrice.toString()
      };

      // 7. 同时下单
      console.log('\n步骤 5: 提交订单...');
      const [nadoResult, lighterResult] = await Promise.all([
        this._executeNadoOrder(nadoOrder),
        this._executeLighterOrder(lighterOrder)
      ]);

      const executionTime = Date.now() - startTime;

      // 8. 检查成交（如果需要）
      const fillStatus = checkFill 
        ? await this._checkOrderFills(nadoResult, lighterResult, coin)
        : { nado: 'unknown', lighter: 'unknown' };

      // 9. 返回结果
      const result = {
        success: true,
        coin,
        size: sizeNum,
        direction: direction,
        prices: prices,
        orders: {
          nado: nadoResult,
          lighter: lighterResult
        },
        fillStatus: fillStatus,
        executionTime: executionTime,
        timestamp: Date.now()
      };

      console.log('\n✅ 对冲执行完成');
      console.log(`执行时间: ${executionTime}ms`);
      console.log(`\n成交状态:`);
      console.log(`  Nado: ${fillStatus.nado}`);
      console.log(`  Lighter: ${fillStatus.lighter}`);

      return result;

    } catch (error) {
      console.error('\n❌ 对冲执行失败:', error.message);
      
      return {
        success: false,
        coin,
        size: sizeNum,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取价差信息（含手续费分析）
   */
  async getSpreadInfo(coin) {
    const lighterSymbol = this.symbolMap[coin] || `${coin}USD`;
    
    const [nadoBook, lighterBook] = await Promise.all([
      this.nadoPriceFeed.getL2Book(coinToSymbol(coin)),
      this.lighterPriceFeed.getL2Book(lighterSymbol),
    ]);

    const priceDiff = nadoBook.mid - lighterBook.mid;
    const priceDiffPercent = (priceDiff / nadoBook.mid) * 100;

    // 计算含手续费的实际利润
    const nadoFee = FEE_CONFIG.NADO_TAKER_FEE;
    const lighterFee = FEE_CONFIG.LIGHTER_TAKER_FEE;
    
    // 方案 A: Nado 买 + Lighter 卖
    const profitA = lighterBook.bid * (1 - lighterFee) - nadoBook.ask * (1 + nadoFee);
    
    // 方案 B: Nado 卖 + Lighter 买
    const profitB = nadoBook.bid * (1 - nadoFee) - lighterBook.ask * (1 + lighterFee);

    // 判断推荐方向
    let direction, bestProfit;
    if (profitA > profitB && profitA > 0) {
      direction = 'Nado 买入 + Lighter 卖出';
      bestProfit = profitA;
    } else if (profitB > 0) {
      direction = 'Nado 卖出 + Lighter 买入';
      bestProfit = profitB;
    } else {
      direction = '⚠️ 无套利空间（扣除手续费后亏损）';
      bestProfit = Math.max(profitA, profitB);
    }

    return {
      coin,
      nado: {
        bid: nadoBook.bid,
        ask: nadoBook.ask,
        mid: nadoBook.mid
      },
      lighter: {
        bid: lighterBook.bid,
        ask: lighterBook.ask,
        mid: lighterBook.mid
      },
      priceDiff,
      priceDiffPercent,
      direction,
      // 含手续费分析
      feeAnalysis: {
        nadoFee: `${(nadoFee * 100).toFixed(2)}%`,
        lighterFee: `${(lighterFee * 100).toFixed(2)}%`,
        profitA: profitA,  // Nado买+Lighter卖
        profitB: profitB,  // Nado卖+Lighter买
        bestProfit: bestProfit,
        bestProfitPercent: (bestProfit / nadoBook.mid) * 100
      }
    };
  }

  /**
   * 内部方法：获取 Nado productId
   */
  async _getProductId(coin) {
    if (this._productIdCache[coin]) {
      return this._productIdCache[coin];
    }

    const symbol = coinToSymbol(coin);
    const products = await this.nadoClient.getAllProducts();  // 修复：使用正确的方法名
    
    // Nado 返回的产品列表可能使用不同的字段名
    const product = products.find(p => 
      p.market_id === symbol || 
      p.symbol === symbol ||
      p.name === symbol
    );
    if (!product) {
      throw new Error(`Product not found for ${coin} (symbol: ${symbol})`);
    }

    this._productIdCache[coin] = product.product_id;
    return product.product_id;
  }

  /**
   * 内部方法：输出价格对比
   */
  _logPriceComparison(nadoBook, lighterBook, coin) {
    console.log('\n价格对比:');
    console.log('┌─────────┬──────────────┬──────────────┐');
    console.log('│         │     Nado     │   Lighter    │');
    console.log('├─────────┼──────────────┼──────────────┤');
    console.log(`│ 买一    │ ${nadoBook.bid.toFixed(2).padStart(12)} │ ${lighterBook.bid.toFixed(2).padStart(12)} │`);
    console.log(`│ 卖一    │ ${nadoBook.ask.toFixed(2).padStart(12)} │ ${lighterBook.ask.toFixed(2).padStart(12)} │`);
    console.log(`│ 中间价  │ ${nadoBook.mid.toFixed(2).padStart(12)} │ ${lighterBook.mid.toFixed(2).padStart(12)} │`);
    console.log('└─────────┴──────────────┴──────────────┘');
    
    const priceDiff = nadoBook.mid - lighterBook.mid;
    const priceDiffPercent = (priceDiff / nadoBook.mid) * 100;
    console.log(`\n价差: ${priceDiff.toFixed(2)} (${priceDiffPercent.toFixed(4)}%)`);
  }

  /**
   * 内部方法：确定最优对冲方向
   * 优化：基于实际成交价并考虑手续费来判断
   */
  _determineBestDirection(nadoBook, lighterBook, reverse, size = 1) {
    // 获取手续费配置
    const nadoFee = FEE_CONFIG.NADO_TAKER_FEE;
    const lighterFee = FEE_CONFIG.LIGHTER_TAKER_FEE;
    
    // 方案 A: Nado 买入 + Lighter 卖出
    // 成本：Nado 的卖一价（ask）+ 手续费
    // 收益：Lighter 的买一价（bid）- 手续费
    const costA = nadoBook.ask * (1 + nadoFee);
    const revenueA = lighterBook.bid * (1 - lighterFee);
    const profitA = revenueA - costA;
    const profitAUsd = profitA * size;
    
    // 方案 B: Nado 卖出 + Lighter 买入
    // 收益：Nado 的买一价（bid）- 手续费
    // 成本：Lighter 的卖一价（ask）+ 手续费
    const revenueB = nadoBook.bid * (1 - nadoFee);
    const costB = lighterBook.ask * (1 + lighterFee);
    const profitB = revenueB - costB;
    const profitBUsd = profitB * size;

    let nadoSide, lighterSide, expectedProfit, expectedProfitUsd;

    if (!reverse) {
      // 开仓：选择利润更高的方向
      if (profitA > profitB) {
        nadoSide = 'buy';
        lighterSide = 'sell';
        expectedProfit = profitA;
        expectedProfitUsd = profitAUsd;
      } else {
        nadoSide = 'sell';
        lighterSide = 'buy';
        expectedProfit = profitB;
        expectedProfitUsd = profitBUsd;
      }
      
      console.log(`\n方向分析 (含 ${(nadoFee * 100).toFixed(2)}%/${(lighterFee * 100).toFixed(2)}% 手续费):`);
      console.log(`  方案A (Nado买+Lighter卖): 预期利润 ${profitA.toFixed(4)}/单位 = $${profitAUsd.toFixed(4)}`);
      console.log(`  方案B (Nado卖+Lighter买): 预期利润 ${profitB.toFixed(4)}/单位 = $${profitBUsd.toFixed(4)}`);
      console.log(`  选择: ${profitA > profitB ? '方案A' : '方案B'}`);
      
      // 检查是否有套利空间
      if (expectedProfit <= 0) {
        console.log(`\n⚠️ 警告: 当前无正向套利空间`);
        console.log(`  最大利润: ${expectedProfit.toFixed(4)}/单位 = $${expectedProfitUsd.toFixed(4)}`);
        // 可选：抛出错误阻止执行
        // throw new Error(`无套利空间: ${expectedProfit.toFixed(4)}/单位`);
      }
      
      // 检查最小利润阈值
      if (FEE_CONFIG.MIN_PROFIT_THRESHOLD > 0 && expectedProfitUsd < FEE_CONFIG.MIN_PROFIT_THRESHOLD) {
        console.log(`\n⚠️ 警告: 利润低于阈值 ($${FEE_CONFIG.MIN_PROFIT_THRESHOLD})`);
      }
      
    } else {
      // 平仓：反向操作（与开仓相反）
      if (profitA > profitB) {
        // 开仓是 Nado买+Lighter卖，平仓就是 Nado卖+Lighter买
        nadoSide = 'sell';
        lighterSide = 'buy';
        expectedProfit = profitB;
        expectedProfitUsd = profitBUsd;
      } else {
        // 开仓是 Nado卖+Lighter买，平仓就是 Nado买+Lighter卖
        nadoSide = 'buy';
        lighterSide = 'sell';
        expectedProfit = profitA;
        expectedProfitUsd = profitAUsd;
      }
    }

    return { nadoSide, lighterSide, expectedProfit, expectedProfitUsd };
  }

  /**
   * 内部方法：计算订单价格
   */
  _calculatePrices(nadoBook, lighterBook, direction, slippage) {
    let nadoPrice, lighterPrice;

    // Nado 价格
    if (direction.nadoSide === 'buy') {
      // 买入：用卖一价加滑点
      nadoPrice = nadoBook.ask * (1 + slippage);
    } else {
      // 卖出：用买一价减滑点
      nadoPrice = nadoBook.bid * (1 - slippage);
    }

    // Lighter 价格
    if (direction.lighterSide === 'buy') {
      lighterPrice = lighterBook.ask * (1 + slippage);
    } else {
      lighterPrice = lighterBook.bid * (1 - slippage);
    }

    return {
      nadoPrice: parseFloat(nadoPrice.toFixed(2)),
      lighterPrice: parseFloat(lighterPrice.toFixed(2))
    };
  }

  /**
   * 内部方法：验证最小订单金额
   */
  _validateMinOrderSize(coin, size, nadoPrice, lighterPrice) {
    const MIN_ORDER_USD = 10; // 最小 10 USD

    const nadoValue = size * nadoPrice;
    const lighterValue = size * lighterPrice;

    if (nadoValue < MIN_ORDER_USD) {
      throw new Error(
        `Nado 订单金额太小: ${nadoValue.toFixed(2)} USD (最小 ${MIN_ORDER_USD} USD)`
      );
    }

    if (lighterValue < MIN_ORDER_USD) {
      throw new Error(
        `Lighter 订单金额太小: ${lighterValue.toFixed(2)} USD (最小 ${MIN_ORDER_USD} USD)`
      );
    }
  }

  /**
   * 内部方法：执行 Nado 订单
   */
  async _executeNadoOrder(order) {
    console.log(`  Nado ${order.side.toUpperCase()}: ${order.size} @ ${order.price}`);
    
    // 使用正确的方法名 placePerpOrder 和参数格式
    const result = await this.nadoClient.placePerpOrder({
      productId: order.productId,     // 数字类型
      price: order.price,             // 数字类型
      size: order.size,               // 数字类型
      side: order.side,               // 'buy' | 'sell'
      orderType: order.orderType,     // 'default' | 'ioc' | 'fok' | 'post_only'
    });

    console.log(`  ✓ Nado 订单已提交: ${result.digest || result.order_id || 'OK'}`);
    return result;
  }

  /**
   * 内部方法：执行 Lighter 订单
   */
  async _executeLighterOrder(order) {
    console.log(`  Lighter ${order.side.toUpperCase()}: ${order.amount} @ ${order.price}`);
    
    const result = await this.lighterClient.createOrder(order);

    console.log(`  ✓ Lighter 订单已提交: ${result.order_id || 'OK'}`);
    return result;
  }

  /**
   * 内部方法：检查订单成交状态
   */
  async _checkOrderFills(nadoResult, lighterResult, coin) {
    console.log('\n步骤 6: 检查成交状态...');
    
    // 简化版本，实际应该轮询检查
    return {
      nado: 'pending',
      lighter: 'pending'
    };
  }
}

module.exports = NadoLighterHedgeExecutor;
