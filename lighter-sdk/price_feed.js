/**
 * Lighter Price Feed - WebSocket 版本
 * 使用 WebSocket 获取实时订单簿数据
 * 参考 perp-dex-tools 实现
 */

const WebSocket = require('ws');
const axios = require('axios');

class LighterPriceFeed {
  constructor(client) {
    this.client = client;
    this.wsUrl = 'wss://mainnet.zklighter.elliot.ai/stream';
    this.apiUrl = 'https://mainnet.zklighter.elliot.ai/api/v1';
    
    // 订单簿状态 (按 marketIndex 存储)
    this.orderBooks = {};
    this.wsConnections = {};
    this.snapshotLoaded = {};
    
    // 价格缓存 (避免频繁 REST 请求)
    this.priceCache = {};
    this.priceCacheTTL = 3000;  // 缓存有效期 3 秒
    
    // 优先使用 WebSocket
    this.preferWebSocket = true;
    
    // 市场索引映射 (Lighter 官方)
    this.marketIndexMap = {
      'ETH': 0, 'ETHUSD': 0,
      'BTC': 1, 'BTCUSD': 1,
      'SOL': 2, 'SOLUSD': 2,
      'DOGE': 3, 'DOGEUSD': 3,
      'PEPE': 4, 'PEPEUSD': 4,
      'WLD': 5, 'WLDUSD': 5,
      'LINK': 6, 'LINKUSD': 6,
      'AVAX': 7, 'AVAXUSD': 7,
      'NEAR': 8, 'NEARUSD': 8,
      'DOT': 9, 'DOTUSD': 9,
      'TON': 10, 'TONUSD': 10,
      'TAO': 11, 'TAOUSD': 11,
      'POL': 12, 'POLUSD': 12,
    };
  }

  /**
   * 获取市场索引
   */
  getMarketIndex(symbol) {
    const normalized = symbol.toUpperCase().replace('-PERP', '').replace('USD', '');
    const index = this.marketIndexMap[normalized] ?? this.marketIndexMap[symbol.toUpperCase()];
    if (index === undefined) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    return index;
  }

  /**
   * 连接 WebSocket 并订阅订单簿
   */
  async connectAndSubscribe(symbol) {
    const marketIndex = this.getMarketIndex(symbol);
    
    // 如果已经连接，直接返回
    if (this.wsConnections[marketIndex] && this.snapshotLoaded[marketIndex]) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      
      // 初始化订单簿
      this.orderBooks[marketIndex] = { bids: {}, asks: {} };
      this.snapshotLoaded[marketIndex] = false;
      
      const timeout = setTimeout(() => {
        if (!this.snapshotLoaded[marketIndex]) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
      
      ws.on('open', () => {
        // 订阅订单簿
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: `order_book/${marketIndex}`
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'subscribed/order_book') {
            // 初始快照
            const orderBook = msg.order_book || {};
            this.orderBooks[marketIndex] = { bids: {}, asks: {} };
            
            // 处理 bids
            if (orderBook.bids) {
              for (const item of orderBook.bids) {
                const price = parseFloat(item.price);
                const size = parseFloat(item.size);
                if (price > 0 && size > 0) {
                  this.orderBooks[marketIndex].bids[price] = size;
                }
              }
            }
            
            // 处理 asks
            if (orderBook.asks) {
              for (const item of orderBook.asks) {
                const price = parseFloat(item.price);
                const size = parseFloat(item.size);
                if (price > 0 && size > 0) {
                  this.orderBooks[marketIndex].asks[price] = size;
                }
              }
            }
            
            this.snapshotLoaded[marketIndex] = true;
            clearTimeout(timeout);
            resolve();
            
          } else if (msg.type === 'update/order_book' && this.snapshotLoaded[marketIndex]) {
            // 增量更新
            const orderBook = msg.order_book || {};
            
            if (orderBook.bids) {
              for (const item of orderBook.bids) {
                const price = parseFloat(item.price);
                const size = parseFloat(item.size);
                if (size === 0) {
                  delete this.orderBooks[marketIndex].bids[price];
                } else if (price > 0) {
                  this.orderBooks[marketIndex].bids[price] = size;
                }
              }
            }
            
            if (orderBook.asks) {
              for (const item of orderBook.asks) {
                const price = parseFloat(item.price);
                const size = parseFloat(item.size);
                if (size === 0) {
                  delete this.orderBooks[marketIndex].asks[price];
                } else if (price > 0) {
                  this.orderBooks[marketIndex].asks[price] = size;
                }
              }
            }
            
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      });
      
      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clearTimeout(timeout);
        reject(err);
      });
      
      ws.on('close', () => {
        this.snapshotLoaded[marketIndex] = false;
        delete this.wsConnections[marketIndex];
      });
      
      this.wsConnections[marketIndex] = ws;
    });
  }

  /**
   * 获取订单簿数据 - 优先使用 WebSocket（避免 429 限流）
   */
  async getL2Book(symbol, depth = 20) {
    const marketIndex = this.getMarketIndex(symbol);
    
    // 检查缓存
    const cacheKey = `${symbol}_${marketIndex}`;
    const cached = this.priceCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < this.priceCacheTTL) {
      return cached.data;
    }
    
    // 优先尝试 WebSocket（避免 REST API 429 限流）
    if (this.preferWebSocket || this.snapshotLoaded[marketIndex]) {
      try {
        if (!this.snapshotLoaded[marketIndex]) {
          await this.connectAndSubscribe(symbol);
        }
        
        const wsResult = this._getFromWebSocket(marketIndex, symbol);
        if (wsResult) {
          this.priceCache[cacheKey] = { data: wsResult, timestamp: Date.now() };
          return wsResult;
        }
      } catch (wsError) {
        // WebSocket 失败，回退到 REST
      }
    }
    
    // 回退：使用 REST API（有速率限制风险）
    try {
      const tradesRes = await axios.get(`${this.apiUrl}/recentTrades?market_id=${marketIndex}&limit=1`);
      
      if (tradesRes.data.code === 200 && tradesRes.data.trades && tradesRes.data.trades.length > 0) {
        const lastTrade = tradesRes.data.trades[0];
        const lastPrice = parseFloat(lastTrade.price);
        
        const spread = lastPrice * 0.0001;
        const bid = lastPrice - spread / 2;
        const ask = lastPrice + spread / 2;
        const mid = lastPrice;
        
        const result = {
          symbol,
          marketIndex,
          bids: [{ price: bid, size: 0 }],
          asks: [{ price: ask, size: 0 }],
          bid,
          ask,
          bidSize: 0,
          askSize: 0,
          mid,
          spread,
          spreadPercent: (spread / mid) * 100,
          timestamp: Date.now()
        };
        
        this.priceCache[cacheKey] = { data: result, timestamp: Date.now() };
        return result;
      }
    } catch (restError) {
      // 静默处理，不频繁打印日志
      if (!this.snapshotLoaded[marketIndex]) {
        console.warn('REST API 获取价格失败，尝试 WebSocket');
      }
    }
    
    // 最后尝试：使用 WebSocket 获取
    if (!this.snapshotLoaded[marketIndex]) {
      await this.connectAndSubscribe(symbol);
    }
    
    const ob = this.orderBooks[marketIndex];
    if (!ob) {
      throw new Error(`No order book data for ${symbol}`);
    }
    
    // 获取排序后的 bids (降序) 和 asks (升序)
    const sortedBids = Object.entries(ob.bids)
      .map(([price, size]) => ({ price: parseFloat(price), size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, depth);
    
    const sortedAsks = Object.entries(ob.asks)
      .map(([price, size]) => ({ price: parseFloat(price), size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, depth);
    
    const bestBid = sortedBids.length > 0 ? sortedBids[0] : null;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0] : null;
    
    let mid = null;
    if (bestBid && bestAsk) {
      mid = (bestBid.price + bestAsk.price) / 2;
    }
    
    return {
      symbol,
      marketIndex,
      bids: sortedBids,
      asks: sortedAsks,
      bid: bestBid ? bestBid.price : null,
      ask: bestAsk ? bestAsk.price : null,
      bidSize: bestBid ? bestBid.size : null,
      askSize: bestAsk ? bestAsk.size : null,
      mid,
      spread: bestBid && bestAsk ? bestAsk.price - bestBid.price : null,
      spreadPercent: mid ? ((bestAsk.price - bestBid.price) / mid) * 100 : null,
      timestamp: Date.now()
    };
  }

  /**
   * 从 WebSocket 缓存获取订单簿
   */
  _getFromWebSocket(marketIndex, symbol, depth = 20) {
    const ob = this.orderBooks[marketIndex];
    if (!ob || (Object.keys(ob.bids).length === 0 && Object.keys(ob.asks).length === 0)) {
      return null;
    }
    
    const sortedBids = Object.entries(ob.bids)
      .map(([price, size]) => ({ price: parseFloat(price), size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, depth);
    
    const sortedAsks = Object.entries(ob.asks)
      .map(([price, size]) => ({ price: parseFloat(price), size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, depth);
    
    const bestBid = sortedBids.length > 0 ? sortedBids[0] : null;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0] : null;
    
    let mid = null;
    if (bestBid && bestAsk) {
      mid = (bestBid.price + bestAsk.price) / 2;
    }
    
    return {
      symbol,
      marketIndex,
      bids: sortedBids,
      asks: sortedAsks,
      bid: bestBid ? bestBid.price : null,
      ask: bestAsk ? bestAsk.price : null,
      bidSize: bestBid ? bestBid.size : null,
      askSize: bestAsk ? bestAsk.size : null,
      mid,
      spread: bestBid && bestAsk ? bestAsk.price - bestBid.price : null,
      spreadPercent: mid ? ((bestAsk.price - bestBid.price) / mid) * 100 : null,
      timestamp: Date.now()
    };
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
   * 获取最近成交价 (使用中间价)
   */
  async getLastPrice(symbol) {
    return await this.getMidPrice(symbol);
  }

  /**
   * 关闭所有 WebSocket 连接
   */
  close() {
    for (const ws of Object.values(this.wsConnections)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.wsConnections = {};
    this.orderBooks = {};
    this.snapshotLoaded = {};
  }
}

module.exports = LighterPriceFeed;
