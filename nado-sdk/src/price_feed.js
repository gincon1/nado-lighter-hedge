// 简单的 logger
const logger = {
  error: (...args) => console.error('[Nado]', ...args),
  info: (...args) => console.log('[Nado]', ...args),
};
const { removeDecimals } = require('./orders');

/**
 * Nado 价格服务
 * 使用 REST API 获取市场数据
 */
class NadoPriceFeed {
  constructor(nadoClient) {
    this.client = nadoClient;
  }

  /**
   * 将 X18 格式价格转换为人类可读格式
   * @param {string|number} priceX18
   * @returns {number}
   */
  _formatPrice(priceX18) {
    return removeDecimals(priceX18).toNumber();
  }

  /**
   * 将 X18 格式数量转换为人类可读格式
   * @param {string|number} amountX18
   * @returns {number}
   */
  _formatSize(amountX18) {
    return removeDecimals(amountX18).toNumber();
  }

  /**
   * 获取 L2 订单簿
   * @param {string} symbol - 交易对符号，如 'BTC-PERP'
   * @param {number} depth - 深度，默认 20
   * @returns {Promise<Object>}
   */
  async getL2Book(symbol, depth = 20) {
    try {
      // 先获取产品 ID
      const productId = await this._getProductId(symbol);

      // 获取订单簿流动性
      const liquidity = await this.client.getMarketLiquidity(productId, depth);

      // 格式化为统一格式（与 Hyperliquid 兼容）
      // 注意: API 返回的价格和数量是 X18 格式，需要转换
      const bids = liquidity.bids || [];
      const asks = liquidity.asks || [];

      const bestBid = bids.length > 0 ? this._formatPrice(bids[0][0]) : 0;
      const bestAsk = asks.length > 0 ? this._formatPrice(asks[0][0]) : 0;
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const spreadPercent = midPrice > 0 ? ((spread / midPrice) * 100).toFixed(4) : '0';

      return {
        symbol,
        productId,
        bids: bids.map(([price, size]) => ({
          price: this._formatPrice(price),
          size: this._formatSize(size),
        })),
        asks: asks.map(([price, size]) => ({
          price: this._formatPrice(price),
          size: this._formatSize(size),
        })),
        bestBid,
        bestAsk,
        bidSize: bids.length > 0 ? this._formatSize(bids[0][1]) : 0,
        askSize: asks.length > 0 ? this._formatSize(asks[0][1]) : 0,
        midPrice,
        spread,
        spreadPercent,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('获取 Nado 订单簿失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取最新成交价（使用买卖中间价）
   * @param {string} symbol - 交易对符号
   * @returns {Promise<number>}
   */
  async getLastPrice(symbol) {
    try {
      const productId = await this._getProductId(symbol);
      const priceData = await this.client.getMarketPrice(productId);

      // API 返回 bid_x18 和 ask_x18，计算中间价
      const bid = this._formatPrice(priceData.bid_x18 || 0);
      const ask = this._formatPrice(priceData.ask_x18 || 0);
      const midPrice = (bid + ask) / 2;

      return midPrice;
    } catch (error) {
      logger.error('获取 Nado 最新价格失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取所有产品信息
   * @returns {Promise<Object>}
   */
  async getAllProducts() {
    try {
      return await this.client.getAllProducts();
    } catch (error) {
      logger.error('获取 Nado 产品信息失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取交易对列表
   * @returns {Promise<Object>}
   */
  async getSymbols() {
    try {
      const symbolsData = await this.client.getSymbols();
      // 返回 symbols 对象
      return symbolsData.symbols || symbolsData;
    } catch (error) {
      logger.error('获取 Nado 交易对列表失败:', error.message);
      throw error;
    }
  }

  /**
   * 根据交易对符号获取产品 ID
   * @private
   * @param {string} symbol - 交易对符号，如 'BTC-PERP'
   * @returns {Promise<number>} 产品 ID
   */
  async _getProductId(symbol) {
    // 缓存符号到产品 ID 的映射
    if (!this._symbolCache) {
      this._symbolCache = {};
    }

    if (this._symbolCache[symbol]) {
      return this._symbolCache[symbol];
    }

    try {
      const symbolsData = await this.getSymbols();

      // API 返回的是 { symbols: { "BTC-PERP": { product_id: 2, ... }, ... } }
      if (symbolsData && symbolsData[symbol]) {
        this._symbolCache[symbol] = symbolsData[symbol].product_id;
        return this._symbolCache[symbol];
      }

      // 如果找不到，抛出错误
      throw new Error(`找不到符号 ${symbol} 的产品 ID`);
    } catch (error) {
      logger.error(`无法获取产品 ID for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取多个交易对的价格
   * @param {Array<string>} symbols - 交易对符号数组
   * @returns {Promise<Array<Object>>}
   */
  async getBatchPrices(symbols) {
    try {
      const promises = symbols.map(symbol => this.getLastPrice(symbol));
      const prices = await Promise.all(promises);

      return symbols.map((symbol, index) => ({
        symbol,
        price: prices[index],
      }));
    } catch (error) {
      logger.error('批量获取 Nado 价格失败:', error.message);
      throw error;
    }
  }

  /**
   * 打印订单簿信息（调试用）
   * @param {Object} bookData - 订单簿数据
   */
  printOrderbook(bookData) {
    console.log(`\n=== ${bookData.symbol} 订单簿 ===`);
    console.log(`时间: ${new Date(bookData.timestamp).toLocaleString()}`);
    console.log(`产品 ID: ${bookData.productId || 'N/A'}`);
    console.log(`\n卖单 (Asks):`);

    // 只显示前 5 档
    const topAsks = bookData.asks.slice(0, 5).reverse();
    topAsks.forEach(ask => {
      console.log(`  ${ask.price.toFixed(2)} | ${ask.size.toFixed(4)}`);
    });

    console.log(`\n中间价: ${bookData.midPrice.toFixed(2)}`);
    console.log(`价差: ${bookData.spread.toFixed(2)} (${bookData.spreadPercent}%)\n`);

    console.log(`买单 (Bids):`);
    const topBids = bookData.bids.slice(0, 5);
    topBids.forEach(bid => {
      console.log(`  ${bid.price.toFixed(2)} | ${bid.size.toFixed(4)}`);
    });
    console.log('');
  }
}

module.exports = NadoPriceFeed;
