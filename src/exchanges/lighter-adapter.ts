/**
 * Lighter 交易所适配器
 */

import { BaseExchange } from './base-exchange';
import { OrderBook, SimplifiedBook, PlaceOrderParams, Order, Position, AccountInfo, Balance } from '../types';
import { generateId } from '../utils/helpers';

// 导入现有的 Lighter SDK
const { LighterClient, LighterPriceFeed } = require('../../lighter-sdk/index');

export class LighterAdapter extends BaseExchange {
  private client: any;
  private priceFeed: any;
  private symbolMap: Map<string, string> = new Map([
    ['BTC-PERP', 'BTCUSD'],
    ['ETH-PERP', 'ETHUSD'],
    ['SOL-PERP', 'SOLUSD'],
  ]);

  // market index 映射 (根据 Lighter 官方)
  private marketIndexMap: Map<string, number> = new Map([
    ['ETH-PERP', 0], ['ETHUSD', 0],
    ['BTC-PERP', 1], ['BTCUSD', 1],
    ['SOL-PERP', 2], ['SOLUSD', 2],
  ]);

  constructor(privateKey: string, accountIndex: number = 0, apiKeyIndex: number = 0) {
    super('lighter');
    this.client = new LighterClient(privateKey, accountIndex, apiKeyIndex);
    this.priceFeed = new LighterPriceFeed(this.client);
    this.logger.info('Lighter adapter initialized', { accountIndex, apiKeyIndex });
  }

  /**
   * 获取订单簿
   */
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      const lighterSymbol = this.toLighterSymbol(symbol);
      const book = await this.priceFeed.getL2Book(lighterSymbol);
      
      return {
        symbol,
        bids: [{ price: book.bid, size: 0 }],
        asks: [{ price: book.ask, size: 0 }],
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Failed to get order book for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * 下单
   */
  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    try {
      const lighterSymbol = this.toLighterSymbol(params.symbol);
      
      const order = {
        symbol: lighterSymbol,
        side: params.side,
        // Lighter 非 limit 统一按 market 处理，确保市价即时成交
        orderType: params.type === 'market' ? 'market' : 'limit',
        amount: params.size.toString(),
        price: params.price?.toString() || '0',
      };

      const result = await this.client.createOrder(order);
      const orderId = result.order_id || generateId();

      this.logger.info('Order placed', {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        size: params.size,
        price: params.price,
      });

      return {
        orderId,
        clientOrderId: params.clientOrderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        status: 'pending',
        price: params.price || 0,
        size: params.size,
        filled: 0,
        remaining: params.size,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to place order', error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    try {
      const lighterSymbol = this.toLighterSymbol(symbol);
      await this.client.cancelOrder(orderId, lighterSymbol);
      this.logger.info('Order cancelled', { orderId, symbol });
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel order', error);
      return false;
    }
  }

  /**
   * 获取订单状态
   */
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    // Lighter SDK 可能没有直接的查询单个订单接口
    return {
      orderId,
      symbol,
      side: 'buy',
      type: 'limit',
      status: 'pending',
      price: 0,
      size: 0,
      filled: 0,
      remaining: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取未成交订单
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    // Lighter SDK 需要实现这个方法
    return [];
  }

  /**
   * 获取持仓
   */
  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const positions = await this.client.getPositions();
      const lighterSymbol = this.toLighterSymbol(symbol);
      const orderBookId = this.client.getOrderBookId(lighterSymbol);

      const position = positions.find((p: any) => p.order_book_id === orderBookId);
      
      if (!position || parseFloat(position.size) === 0) {
        return null;
      }

      const size = parseFloat(position.size);
      const markPrice = await this.getMarkPrice(symbol);

      return {
        symbol,
        side: size > 0 ? 'long' : size < 0 ? 'short' : 'none',
        size: Math.abs(size),
        entryPrice: parseFloat(position.entry_price || 0),
        markPrice,
        unrealizedPnl: parseFloat(position.unrealized_pnl || 0),
        realizedPnl: 0,
        leverage: 1,
        margin: parseFloat(position.margin || 0),
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Failed to get position for ${symbol}`, error);
      return null;
    }
  }

  /**
   * 获取所有持仓
   */
  async getPositions(): Promise<Position[]> {
    try {
      const rawPositions = await this.client.getPositions();
      const positions: Position[] = [];

      for (const pos of rawPositions) {
        const size = parseFloat(pos.size || 0);
        
        if (size !== 0) {
          // 从 Lighter symbol 转换回标准 symbol
          const symbol = this.fromLighterSymbol(pos.symbol);
          const markPrice = await this.getMarkPrice(symbol);

          positions.push({
            symbol,
            side: size > 0 ? 'long' : 'short',
            size: Math.abs(size),
            entryPrice: parseFloat(pos.entry_price || 0),
            markPrice,
            unrealizedPnl: parseFloat(pos.unrealized_pnl || 0),
            realizedPnl: 0,
            leverage: 1,
            margin: parseFloat(pos.margin || 0),
            timestamp: Date.now(),
          });
        }
      }

      return positions;
    } catch (error) {
      this.logger.error('Failed to get positions', error);
      return [];
    }
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const positions = await this.getPositions();

      return {
        balances: [],
        positions,
        totalEquity: 0,
        availableBalance: 0,
        usedMargin: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to get account info', error);
      throw error;
    }
  }

  /**
   * 获取余额
   */
  async getBalance(asset?: string): Promise<Balance[]> {
    // Lighter 的余额查询需要根据实际 SDK 实现
    return [];
  }

  /**
   * 转换为 Lighter symbol
   */
  private toLighterSymbol(symbol: string): string {
    return this.symbolMap.get(symbol) || symbol;
  }

  /**
   * 从 Lighter symbol 转换回标准 symbol
   */
  private fromLighterSymbol(lighterSymbol: string): string {
    for (const [standard, lighter] of this.symbolMap.entries()) {
      if (lighter === lighterSymbol) {
        return standard;
      }
    }
    return lighterSymbol;
  }

  /**
   * 获取原始客户端（用于向后兼容）
   */
  getRawClient(): any {
    return this.client;
  }

  /**
   * 获取价格服务（用于向后兼容）
   */
  getPriceFeed(): any {
    return this.priceFeed;
  }
}
