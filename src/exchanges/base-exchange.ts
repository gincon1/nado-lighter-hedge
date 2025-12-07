/**
 * 交易所基类
 */

import { PerpExchange, OrderBook, SimplifiedBook, PlaceOrderParams, Order, Position, AccountInfo, Balance } from '../types';
import { createLogger } from '../utils/logger';
import { calculateSpread } from '../utils/helpers';

export abstract class BaseExchange implements PerpExchange {
  public readonly name: string;
  protected logger: ReturnType<typeof createLogger>;

  constructor(name: string) {
    this.name = name;
    this.logger = createLogger(`exchange:${name}`);
  }

  // ============ 抽象方法（子类必须实现） ============

  abstract getOrderBook(symbol: string): Promise<OrderBook>;
  abstract placeOrder(params: PlaceOrderParams): Promise<Order>;
  abstract cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  abstract getOrder(orderId: string, symbol: string): Promise<Order>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;
  abstract getPosition(symbol: string): Promise<Position | null>;
  abstract getPositions(): Promise<Position[]>;
  abstract getAccountInfo(): Promise<AccountInfo>;
  abstract getBalance(asset?: string): Promise<Balance[]>;

  // ============ 通用方法 ============

  /**
   * 获取简化的订单簿
   */
  async getSimplifiedBook(symbol: string): Promise<SimplifiedBook> {
    const book = await this.getOrderBook(symbol);

    if (book.bids.length === 0 || book.asks.length === 0) {
      throw new Error(`Empty order book for ${symbol}`);
    }

    const bid = book.bids[0].price;
    const ask = book.asks[0].price;
    const { spread, spreadPercent, mid } = calculateSpread(bid, ask);

    return {
      bid,
      ask,
      mid,
      spread,
      spreadPercent,
    };
  }

  /**
   * 获取标记价格
   */
  async getMarkPrice(symbol: string): Promise<number> {
    const book = await this.getSimplifiedBook(symbol);
    return book.mid;
  }

  /**
   * 限价买入
   */
  async limitBuy(symbol: string, size: number, price: number): Promise<Order> {
    return this.placeOrder({
      symbol,
      side: 'buy',
      type: 'limit',
      size,
      price,
    });
  }

  /**
   * 限价卖出
   */
  async limitSell(symbol: string, size: number, price: number): Promise<Order> {
    return this.placeOrder({
      symbol,
      side: 'sell',
      type: 'limit',
      size,
      price,
    });
  }

  /**
   * 市价买入
   */
  async marketBuy(symbol: string, size: number): Promise<Order> {
    return this.placeOrder({
      symbol,
      side: 'buy',
      type: 'market',
      size,
    });
  }

  /**
   * 市价卖出
   */
  async marketSell(symbol: string, size: number): Promise<Order> {
    return this.placeOrder({
      symbol,
      side: 'sell',
      type: 'market',
      size,
    });
  }

  /**
   * 取消所有订单
   */
  async cancelAllOrders(symbol?: string): Promise<number> {
    const orders = await this.getOpenOrders(symbol);
    let cancelled = 0;

    for (const order of orders) {
      try {
        const success = await this.cancelOrder(order.orderId, order.symbol);
        if (success) cancelled++;
      } catch (error) {
        this.logger.error(`Failed to cancel order ${order.orderId}`, error);
      }
    }

    return cancelled;
  }

  /**
   * 获取总持仓价值
   */
  async getTotalPositionValue(): Promise<number> {
    const positions = await this.getPositions();
    return positions.reduce((total, pos) => {
      return total + Math.abs(pos.size * pos.markPrice);
    }, 0);
  }

  /**
   * 检查是否有持仓
   */
  async hasPosition(symbol: string): Promise<boolean> {
    const position = await this.getPosition(symbol);
    return position !== null && Math.abs(position.size) > 0.0001;
  }
}
