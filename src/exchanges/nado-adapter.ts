/**
 * Nado 交易所适配器
 */

import { BaseExchange } from './base-exchange';
import { OrderBook, SimplifiedBook, PlaceOrderParams, Order, Position, AccountInfo, Balance, OrderSide, OrderType, OrderStatus } from '../types';
import { generateId } from '../utils/helpers';

// 导入现有的 Nado SDK
const { NadoClient, NadoPriceFeed } = require('../../nado-sdk/src/index');
const { coinToSymbol } = require('../../nado-sdk/src/types');

export class NadoAdapter extends BaseExchange {
  private client: any;
  private priceFeed: any;
  private productIdCache: Map<string, number> = new Map();

  constructor(privateKey: string, network: string = 'inkMainnet') {
    super('nado');
    this.client = new NadoClient(privateKey, { network });
    this.priceFeed = new NadoPriceFeed(this.client);
    this.logger.info('Nado adapter initialized', { network });
  }

  /**
   * 获取订单簿
   */
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      const book = await this.priceFeed.getL2Book(symbol);
      
      return {
        symbol,
        bids: [{ price: book.bestBid, size: 0 }],
        asks: [{ price: book.bestAsk, size: 0 }],
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
      const productId = await this.getProductId(params.symbol);
      
      // 转换订单类型
      let orderType: string;
      switch (params.type) {
        case 'ioc':
          orderType = 'ioc';
          break;
        case 'fok':
          orderType = 'fok';
          break;
        case 'post_only':
          orderType = 'post_only';
          break;
        default:
          orderType = 'default';
      }

      // Nado 需要价格是整数 (根据 price_increment_x18 = 1e18，价格必须是整数)
      const price = Math.round(params.price || 0);

      const result = await this.client.placePerpOrder({
        productId,
        price,
        size: params.size,
        side: params.side,
        orderType,
      });

      const orderId = result.digest || result.order_id || generateId();

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
      const productId = await this.getProductId(symbol);
      await this.client.cancelPerpOrder(productId, orderId);
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
    // Nado SDK 可能没有直接的查询单个订单接口
    // 这里返回一个基本的订单对象
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
    // Nado SDK 可能需要实现这个方法
    return [];
  }

  /**
   * 获取持仓
   */
  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const info = await this.client.getSubaccountInfo();
      const productId = await this.getProductId(symbol);

      if (!info.perp_balances) {
        return null;
      }

      const balance = info.perp_balances.find((b: any) => b.product_id === productId);
      
      if (!balance || balance.balance.amount === '0') {
        return null;
      }

      const size = parseFloat(balance.balance.amount) / 1e18;
      const markPrice = await this.getMarkPrice(symbol);

      return {
        symbol,
        side: size > 0 ? 'long' : size < 0 ? 'short' : 'none',
        size: Math.abs(size),
        entryPrice: 0,
        markPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        leverage: 1,
        margin: 0,
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
      const info = await this.client.getSubaccountInfo();
      
      if (!info.perp_balances) {
        return [];
      }

      const positions: Position[] = [];

      for (const balance of info.perp_balances) {
        const amount = parseFloat(balance.balance.amount) / 1e18;
        
        if (amount !== 0) {
          // 需要从 productId 反查 symbol
          const symbol = await this.getSymbolFromProductId(balance.product_id);
          const markPrice = await this.getMarkPrice(symbol);

          positions.push({
            symbol,
            side: amount > 0 ? 'long' : 'short',
            size: Math.abs(amount),
            entryPrice: 0,
            markPrice,
            unrealizedPnl: 0,
            realizedPnl: 0,
            leverage: 1,
            margin: 0,
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
      const info = await this.client.getSubaccountInfo();
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
    // Nado 的余额查询需要根据实际 SDK 实现
    return [];
  }

  /**
   * 获取 productId
   */
  private async getProductId(symbol: string): Promise<number> {
    if (this.productIdCache.has(symbol)) {
      return this.productIdCache.get(symbol)!;
    }

    // 使用 getSymbols() 获取符号到 product_id 的映射
    const symbolsData = await this.client.getSymbols();
    const symbols = symbolsData.symbols || symbolsData;
    
    if (symbols[symbol]) {
      const productId = symbols[symbol].product_id;
      this.productIdCache.set(symbol, productId);
      return productId;
    }

    throw new Error(`Product not found for symbol: ${symbol}. Available: ${Object.keys(symbols).join(', ')}`);
  }

  /**
   * 从 productId 获取 symbol
   */
  private async getSymbolFromProductId(productId: number): Promise<string> {
    // 检查缓存
    for (const [symbol, id] of this.productIdCache.entries()) {
      if (id === productId) {
        return symbol;
      }
    }

    // 查询产品列表
    const productsData = await this.client.getAllProducts();
    const allProducts = [
      ...(productsData.spot_products || []),
      ...(productsData.perp_products || []),
    ];
    
    const product = allProducts.find((p: any) => p.product_id === productId);
    
    if (product) {
      const symbol = product.market_id || product.symbol || product.name;
      this.productIdCache.set(symbol, productId);
      return symbol;
    }

    return `UNKNOWN-${productId}`;
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
