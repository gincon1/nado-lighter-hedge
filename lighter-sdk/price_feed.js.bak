/**
 * Lighter Price Feed
 * 提供市场数据和价格信息
 */

class LighterPriceFeed {
  constructor(client) {
    this.client = client;
  }

  /**
   * 获取订单簿数据
   */
  async getL2Book(symbol, depth = 20) {
    try {
      const orderBook = await this.client.getOrderBook(symbol, depth);
      
      if (!orderBook || !orderBook.bids || !orderBook.asks) {
        throw new Error('Invalid order book data');
      }

      // 转换为统一格式
      const bids = orderBook.bids.map(([price, size]) => ({
        price: parseFloat(price),
        size: parseFloat(size)
      }));

      const asks = orderBook.asks.map(([price, size]) => ({
        price: parseFloat(price),
        size: parseFloat(size)
      }));

      // 获取最优价格
      const bestBid = bids.length > 0 ? bids[0] : null;
      const bestAsk = asks.length > 0 ? asks[0] : null;

      return {
        symbol,
        bids,
        asks,
        bid: bestBid ? bestBid.price : null,
        ask: bestAsk ? bestAsk.price : null,
        mid: bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get L2 book: ${error.message}`);
    }
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
    if (!book.bid || !book.ask) {
      return null;
    }
    return book.ask - book.bid;
  }

  /**
   * 获取价差百分比
   */
  async getSpreadPercent(symbol) {
    const book = await this.getL2Book(symbol, 1);
    if (!book.bid || !book.ask || !book.mid) {
      return null;
    }
    return ((book.ask - book.bid) / book.mid) * 100;
  }
}

module.exports = LighterPriceFeed;
