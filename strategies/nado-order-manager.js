/**
 * Nado 订单管理器
 * 负责：下单、等待成交、超时撤单、重新挂单
 * 
 * 核心功能：
 * 1. placeAndWaitWithRetry - 下限价单并等待成交（带超时重挂）
 * 2. cancelAndConfirm - 撤销订单并确认
 * 3. calculateLimitPrice - 计算限价单价格
 */

const { coinToSymbol } = require('../nado-sdk/src/types');

// 默认配置
const DEFAULT_CONFIG = {
  orderTimeout: 60000,      // 单次等待超时 60 秒
  maxRetries: 3,            // 最大重试次数
  pollInterval: 500,        // 轮询间隔 500ms
  priceStrategy: 'best',    // 价格策略: 'best' | 'mid' | 'aggressive'
  minFillRatio: 0.5,        // 最小成交比例
};

class NadoOrderManager {
  constructor(nadoClient, nadoPriceFeed, config = {}) {
    this.client = nadoClient;
    this.priceFeed = nadoPriceFeed;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 产品 ID 映射
    this.productIdMap = { BTC: 2, ETH: 4, SOL: 8 };
  }

  /**
   * 下限价单并等待成交（带超时重挂）
   * 
   * @param {Object} params - 参数
   * @param {string} params.coin - 币种 BTC/ETH/SOL
   * @param {string} params.side - 方向 buy/sell
   * @param {number} params.size - 数量
   * @param {number} [params.timeout] - 单次等待超时（毫秒）
   * @param {number} [params.maxRetries] - 最大重试次数
   * @param {string} [params.priceStrategy] - 价格策略
   * @returns {Promise<Object>} 执行结果
   */
  async placeAndWaitWithRetry(params) {
    const {
      coin,
      side,
      size,
      timeout = this.config.orderTimeout,
      maxRetries = this.config.maxRetries,
      priceStrategy = this.config.priceStrategy,
    } = params;

    const productId = this.productIdMap[coin.toUpperCase()];
    if (!productId) {
      throw new Error(`不支持的币种: ${coin}`);
    }

    const result = {
      status: 'failed',
      filledSize: 0,
      avgPrice: 0,
      retries: 0,
      orders: [],
      totalTime: 0,
    };

    const startTime = Date.now();
    let currentRetry = 0;
    let totalFilledSize = 0;
    let totalFilledValue = 0;

    while (currentRetry <= maxRetries) {
      result.retries = currentRetry;
      
      // 1. 获取最新价格
      console.log(`\n[NadoOrderManager] 第 ${currentRetry + 1}/${maxRetries + 1} 次尝试`);
      const book = await this._getOrderBook(coin);
      const price = this.calculateLimitPrice(book, side, priceStrategy);
      
      console.log(`  价格策略: ${priceStrategy}`);
      console.log(`  计算价格: ${price} (bid: ${book.bid}, ask: ${book.ask})`);

      // 2. 下单
      const remainingSize = size - totalFilledSize;
      console.log(`  下单数量: ${remainingSize} (已成交: ${totalFilledSize})`);
      
      let orderResult;
      try {
        orderResult = await this.client.placePerpOrder({
          productId,
          price,
          size: remainingSize,
          side,
          orderType: 'default',  // GTC 限价单
        });
        
        const digest = orderResult.digest || orderResult.order_id;
        console.log(`  ✓ 订单已提交: ${digest}`);
        
        result.orders.push({
          digest,
          price,
          size: remainingSize,
          side,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`  ✗ 下单失败: ${error.message}`);
        currentRetry++;
        continue;
      }

      // 3. 等待成交
      const digest = orderResult.digest || orderResult.order_id;
      const waitResult = await this._waitForFill(productId, digest, remainingSize, timeout);
      
      console.log(`  等待结果: ${waitResult.status}`);
      console.log(`  成交数量: ${waitResult.filledSize}`);

      // 4. 处理结果
      if (waitResult.status === 'filled') {
        totalFilledSize += waitResult.filledSize;
        totalFilledValue += waitResult.filledSize * price;
        
        result.status = 'filled';
        result.filledSize = totalFilledSize;
        result.avgPrice = totalFilledValue / totalFilledSize;
        result.totalTime = Date.now() - startTime;
        
        console.log(`  ✓ 订单完全成交！`);
        return result;
      }
      
      if (waitResult.status === 'partial') {
        totalFilledSize += waitResult.filledSize;
        totalFilledValue += waitResult.filledSize * price;
        
        // 检查是否达到最小成交比例
        const fillRatio = totalFilledSize / size;
        console.log(`  部分成交比例: ${(fillRatio * 100).toFixed(1)}%`);
        
        if (fillRatio >= this.config.minFillRatio) {
          // 达到最小比例，继续等待或接受
          console.log(`  达到最小成交比例，继续等待...`);
        }
      }
      
      if (waitResult.status === 'timeout') {
        // 5. 超时，撤单
        console.log(`  ⚠️ 等待超时，尝试撤单...`);
        const cancelSuccess = await this.cancelAndConfirm(productId, digest);
        
        if (!cancelSuccess) {
          console.log(`  撤单失败，可能已成交，重新检查...`);
          // 重新检查订单状态
          const recheckResult = await this._checkOrderStatus(productId, digest, remainingSize);
          if (recheckResult.status === 'filled') {
            totalFilledSize += recheckResult.filledSize;
            totalFilledValue += recheckResult.filledSize * price;
            result.status = 'filled';
            result.filledSize = totalFilledSize;
            result.avgPrice = totalFilledValue / totalFilledSize;
            result.totalTime = Date.now() - startTime;
            return result;
          }
        }
        
        currentRetry++;
        console.log(`  准备重新挂单...`);
        
        // 短暂等待后重试
        await this._sleep(1000);
      }
    }

    // 超过最大重试次数
    result.status = totalFilledSize > 0 ? 'partial' : 'failed';
    result.filledSize = totalFilledSize;
    result.avgPrice = totalFilledSize > 0 ? totalFilledValue / totalFilledSize : 0;
    result.totalTime = Date.now() - startTime;
    
    console.log(`\n[NadoOrderManager] 最终结果: ${result.status}`);
    console.log(`  总成交: ${result.filledSize}/${size}`);
    console.log(`  重试次数: ${result.retries}`);
    console.log(`  总耗时: ${result.totalTime}ms`);
    
    return result;
  }

  /**
   * 计算限价单价格
   * 
   * @param {Object} book - 订单簿 { bid, ask, mid }
   * @param {string} side - 方向 buy/sell
   * @param {string} strategy - 价格策略
   * @returns {number} 价格（整数）
   */
  calculateLimitPrice(book, side, strategy = 'best') {
    const { bid, ask, mid } = book;
    
    // Nado 价格必须是整数
    if (side === 'buy') {
      switch (strategy) {
        case 'aggressive':
          // 激进：挂在卖一价（立即成交，但是 taker）
          return Math.ceil(ask);
        case 'mid':
          // 中间：挂在中间价
          return Math.floor(mid);
        case 'best':
        default:
          // 最优：挂在买一价（maker，等待成交）
          return Math.floor(bid);
      }
    } else {
      switch (strategy) {
        case 'aggressive':
          // 激进：挂在买一价（立即成交，但是 taker）
          return Math.floor(bid);
        case 'mid':
          // 中间：挂在中间价
          return Math.ceil(mid);
        case 'best':
        default:
          // 最优：挂在卖一价（maker，等待成交）
          return Math.ceil(ask);
      }
    }
  }

  /**
   * 撤销订单并确认
   * 注意：getSubaccountOrders 返回对象 {orders: []}, 需要特殊处理
   * 
   * @param {number} productId - 产品 ID
   * @param {string} digest - 订单摘要
   * @returns {Promise<boolean>} 是否成功撤销
   */
  async cancelAndConfirm(productId, digest) {
    try {
      // 发起撤单请求
      await this.client.cancelOrder(productId, digest);
      console.log(`  撤单请求已发送: ${digest}`);
      
      // 等待一小段时间
      await this._sleep(500);
      
      // 确认订单状态
      const ordersData = await this.client.getSubaccountOrders(productId);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      const order = orders.find(o => o.digest === digest);
      
      if (!order) {
        // 订单不在列表中，说明已撤销或已成交
        console.log(`  ✓ 订单已从列表移除`);
        return true;
      }
      
      // 检查订单状态
      if (order.status === 'canceled' || order.status === 'cancelled') {
        console.log(`  ✓ 订单已撤销`);
        return true;
      }
      
      console.log(`  订单仍在列表中，状态: ${order.status || 'unknown'}`);
      return false;
      
    } catch (error) {
      console.error(`  撤单异常: ${error.message}`);
      return false;
    }
  }

  /**
   * 内部方法：获取订单簿
   */
  async _getOrderBook(coin) {
    const symbol = coinToSymbol(coin);
    const book = await this.priceFeed.getL2Book(symbol);
    
    return {
      bid: book.bestBid || book.bid,
      ask: book.bestAsk || book.ask,
      mid: book.midPrice || book.mid,
    };
  }

  /**
   * 内部方法：等待订单成交
   */
  async _waitForFill(productId, digest, expectedSize, timeout) {
    const startTime = Date.now();
    const pollInterval = this.config.pollInterval;
    
    while (Date.now() - startTime < timeout) {
      try {
        const ordersData = await this.client.getSubaccountOrders(productId);
        const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
        const order = orders.find(o => o.digest === digest);
        
        if (!order) {
          // 订单不在列表中，可能已完全成交
          return {
            status: 'filled',
            filledSize: expectedSize,
            message: 'Order removed from list (assumed filled)',
          };
        }
        
        // 解析成交数量
        const filledSize = parseFloat(order.filled_size || order.filledSize || 0);
        const remainingSize = parseFloat(order.remaining_size || order.remainingSize || expectedSize);
        
        if (remainingSize === 0 || filledSize >= expectedSize * 0.99) {
          return {
            status: 'filled',
            filledSize: filledSize || expectedSize,
            message: 'Order fully filled',
          };
        }
        
        if (filledSize > 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`  部分成交: ${filledSize}/${expectedSize} (${elapsed}s)`);
        } else {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          if (elapsed % 5 === 0) {  // 每 5 秒打印一次
            console.log(`  等待成交中... (${elapsed}s)`);
          }
        }
        
      } catch (error) {
        console.log(`  查询失败: ${error.message}`);
      }
      
      await this._sleep(pollInterval);
    }
    
    // 超时，检查最终状态
    return await this._checkOrderStatus(productId, digest, expectedSize);
  }

  /**
   * 内部方法：检查订单最终状态
   */
  async _checkOrderStatus(productId, digest, expectedSize) {
    try {
      const ordersData = await this.client.getSubaccountOrders(productId);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      const order = orders.find(o => o.digest === digest);
      
      if (!order) {
        return {
          status: 'filled',
          filledSize: expectedSize,
          message: 'Order not found (assumed filled)',
        };
      }
      
      const filledSize = parseFloat(order.filled_size || order.filledSize || 0);
      
      if (filledSize >= expectedSize * 0.99) {
        return {
          status: 'filled',
          filledSize,
          message: 'Order filled',
        };
      }
      
      if (filledSize > 0) {
        return {
          status: 'partial',
          filledSize,
          message: `Partial fill: ${filledSize}/${expectedSize}`,
        };
      }
      
      return {
        status: 'timeout',
        filledSize: 0,
        message: 'Order not filled within timeout',
      };
      
    } catch (error) {
      return {
        status: 'timeout',
        filledSize: 0,
        message: `Check failed: ${error.message}`,
      };
    }
  }

  /**
   * 内部方法：休眠
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NadoOrderManager;
