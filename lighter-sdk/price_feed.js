/**
 * Lighter Price Feed - 修复版本
 * 基于 Lighter 官方 API (https://apidocs.lighter.xyz)
 */

class LighterPriceFeed {
  constructor(client) {
    this.client = client;
  }

  /**
   * 获取订单簿数据
   * Lighter API 返回格式与其他交易所不同，需要适配
   */
  async getL2Book(symbol, depth = 20) {
    try {
      const orderBookData = await this.client.getOrderBookDetails(symbol, depth);
      
      // Lighter 返回的数据结构：
      // {
      //   order_book_id: number,
      //   bids: [[price, size], ...],  // 价格降序
      //   asks: [[price, size], ...],  // 价格升序
      //   ...
      // }
      
      // 检查数据有效性
      if (!orderBookData) {
        throw new Error('Empty order book data');
      }

      // 处理 bids
      let bids = [];
      if (orderBookData.bids && Array.isArray(orderBookData.bids)) {
        bids = orderBookData.bids.map(item => {
          // 可能是数组格式 [price, size] 或对象格式 {price, size}
          if (Array.isArray(item)) {
            return {
              price: this._parsePrice(item[0]),
              size: this._parseSize(item[1])
            };
          } else if (item.price !== undefined) {
            return {
              price: this._parsePrice(item.price),
              size: this._parseSize(item.size || item.amount || item.quantity)
            };
          }
          return null;
        }).filter(Boolean);
      }

      // 处理 asks
      let asks = [];
      if (orderBookData.asks && Array.isArray(orderBookData.asks)) {
        asks = orderBookData.asks.map(item => {
          if (Array.isArray(item)) {
            return {
              price: this._parsePrice(item[0]),
              size: this._parseSize(item[1])
            };
          } else if (item.price !== undefined) {
            return {
              price: this._parsePrice(item.price),
              size: this._parseSize(item.size || item.amount || item.quantity)
            };
          }
          return null;
        }).filter(Boolean);
      }

      // 获取最优价格
      const bestBid = bids.length > 0 ? bids[0] : null;
      const bestAsk = asks.length > 0 ? asks[0] : null;

      // 计算中间价
      let mid = null;
      if (bestBid && bestAsk) {
        mid = (bestBid.price + bestAsk.price) / 2;
      }

      return {
        symbol,
        orderBookId: orderBookData.order_book_id,
        bids,
        asks,
        bid: bestBid ? bestBid.price : null,
        ask: bestAsk ? bestAsk.price : null,
        bidSize: bestBid ? bestBid.size : null,
        askSize: bestAsk ? bestAsk.size : null,
        mid: mid,
        spread: bestBid && bestAsk ? bestAsk.price - bestBid.price : null,
        spreadPercent: mid ? ((bestAsk.price - bestBid.price) / mid) * 100 : null,
        timestamp: Date.now(),
        raw: orderBookData
      };
    } catch (error) {
      throw new Error(`Failed to get L2 book for ${symbol}: ${error.message}`);
    }
  }

  /**
   * 解析价格（Lighter 使用 8 位小数）
   */
  _parsePrice(value) {
    if (typeof value === 'string') {
      // 检查是否是大整数格式（合约格式）
      if (value.length > 10 && !value.includes('.')) {
        return parseFloat(value) / 1e8;
      }
      return parseFloat(value);
    }
    if (typeof value === 'number') {
      // 检查是否是合约格式（大于 1e10 说明是合约格式）
      if (value > 1e10) {
        return value / 1e8;
      }
      return value;
    }
    return 0;
  }

  /**
   * 解析数量（Lighter 使用 8 位小数）
   */
  _parseSize(value) {
    if (typeof value === 'string') {
      if (value.length > 10 && !value.includes('.')) {
        return parseFloat(value) / 1e8;
      }
      return parseFloat(value);
    }
    if (typeof value === 'number') {
      if (value > 1e10) {
        return value / 1e8;
      }
      return value;
    }
    return 0;
  }

  /**
   * 获取中间价
   */
  async getMidPrice(symbol) {
    const book = await this.getL2Book(symbol, 1);
    return book.mid;
  }

  /**
   * 获取买一价
   */
  async getBestBid(symbol) {
    const book = await this.getL2Book(symbol, 1);
    return book.bid;
  }

  /**
   * 获取卖一价
   */
  async getBestAsk(symbol) {
    const book = await this.getL2Book(symbol, 1);
    return book.ask;
  }

  /**
   * 获取价差
   */
  async getSpread(symbol) {
    const book = await this.getL2Book(symbol, 1);
    return book.spread;
  }

  /**
   * 获取价差百分比
   */
  async getSpreadPercent(symbol) {
    const book = await this.getL2Book(symbol, 1);
    return book.spreadPercent;
  }

  /**
   * 获取多个币种的价格信息
   */
  async getPrices(symbols) {
    const results = {};
    
    for (const symbol of symbols) {
      try {
        const book = await this.getL2Book(symbol, 1);
        results[symbol] = {
          bid: book.bid,
          ask: book.ask,
          mid: book.mid,
          spread: book.spread,
          spreadPercent: book.spreadPercent
        };
      } catch (error) {
        results[symbol] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * 获取最近成交价
   */
  async getLastPrice(symbol) {
    try {
      const trades = await this.client.getRecentTrades(symbol, 1);
      if (trades && trades.trades && trades.trades.length > 0) {
        return this._parsePrice(trades.trades[0].price);
      }
      // 如果没有最近成交，返回中间价
      return await this.getMidPrice(symbol);
    } catch (error) {
      throw new Error(`Failed to get last price for ${symbol}: ${error.message}`);
    }
  }
}

module.exports = LighterPriceFeed;
