/**
 * 对冲引擎核心
 */

import { PerpExchange, HedgeDirection, HedgeExecutionResult, OrderSide, OrderType } from '../types';
import { RiskManager } from '../risk/risk-manager';
import { createLogger } from '../utils/logger';
import { getTelegram } from '../utils/telegram';
import { calculateSlippagePrice, now } from '../utils/helpers';

const logger = createLogger('hedge-engine');

export interface HedgeOptions {
  slippage?: number;
  orderType?: OrderType;
  checkFill?: boolean;
  reverse?: boolean;
}

export class HedgeEngine {
  private primary: PerpExchange;
  private hedge: PerpExchange;
  private riskManager: RiskManager;

  // 手续费配置
  private readonly fees = {
    primaryTaker: 0.0015,
    primaryMaker: -0.0008,
    hedgeTaker: 0.001,
    hedgeMaker: 0,
  };

  constructor(
    primary: PerpExchange,
    hedge: PerpExchange,
    riskManager: RiskManager
  ) {
    this.primary = primary;
    this.hedge = hedge;
    this.riskManager = riskManager;
    
    logger.info('Hedge engine initialized', {
      primary: primary.name,
      hedge: hedge.name,
    });
  }

  /**
   * 执行对冲
   */
  async execute(
    coin: string,
    size: number,
    options: HedgeOptions = {}
  ): Promise<HedgeExecutionResult> {
    const {
      slippage = 0.001,
      orderType = 'ioc',
      checkFill = true,
      reverse = false,
    } = options;

    const startTime = now();

    logger.info('Starting hedge execution', {
      coin,
      size,
      slippage,
      orderType,
      reverse,
    });

    try {
      // 1. 获取两边价格
      const [primaryBook, hedgeBook] = await Promise.all([
        this.primary.getSimplifiedBook(coin),
        this.hedge.getSimplifiedBook(coin),
      ]);

      logger.debug('Price books fetched', {
        primary: primaryBook,
        hedge: hedgeBook,
      });
      
      // 临时调试：打印两边价格
      console.log('\n=== 两边价格对比 ===');
      console.log(`Nado (Primary): bid=${primaryBook.bid}, ask=${primaryBook.ask}, mid=${primaryBook.mid}`);
      console.log(`Lighter (Hedge): bid=${hedgeBook.bid}, ask=${hedgeBook.ask}, mid=${hedgeBook.mid}`);
      console.log(`价差: ${primaryBook.mid - hedgeBook.mid} USD (${((primaryBook.mid - hedgeBook.mid) / primaryBook.mid * 100).toFixed(2)}%)\n`);

      // 2. 确定最优方向
      const direction = this.determineBestDirection(
        primaryBook,
        hedgeBook,
        size,
        reverse
      );

      logger.info('Direction determined', direction);

      // 3. 风控检查
      const positions = await Promise.all([
        this.primary.getPositions(),
        this.hedge.getPositions(),
      ]);
      const allPositions = [...positions[0], ...positions[1]];

      const riskCheck = this.riskManager.canOpenPosition(
        coin,
        size,
        primaryBook.mid,
        allPositions
      );

      if (!riskCheck.allowed) {
        throw new Error(`Risk check failed: ${riskCheck.reason}`);
      }

      // 4. 计算订单价格
      const prices = {
        primary: this.calculateOrderPrice(
          primaryBook,
          direction.primarySide,
          slippage
        ),
        hedge: this.calculateOrderPrice(
          hedgeBook,
          direction.hedgeSide,
          slippage
        ),
      };

      logger.info('Order prices calculated', prices);

      // 5. 同时下单
      const [primaryOrder, hedgeOrder] = await Promise.all([
        this.primary.placeOrder({
          symbol: coin,
          side: direction.primarySide,
          type: orderType,
          size,
          price: prices.primary,
        }),
        this.hedge.placeOrder({
          symbol: coin,
          side: direction.hedgeSide,
          type: orderType === 'limit' ? 'limit' : 'market',
          size,
          price: prices.hedge,
        }),
      ]);

      logger.info('Orders placed', {
        primary: primaryOrder.orderId,
        hedge: hedgeOrder.orderId,
      });

      // 6. 检查成交状态（如果需要）
      const fillStatus = checkFill
        ? await this.checkFillStatus(primaryOrder, hedgeOrder)
        : { primary: 'pending' as const, hedge: 'pending' as const };

      const executionTime = now() - startTime;

      // 7. 通知
      await getTelegram().notifyTrade(
        coin,
        reverse ? 'Close' : 'Open',
        size,
        primaryBook.mid,
        true
      );

      const result: HedgeExecutionResult = {
        success: true,
        coin,
        size,
        direction,
        prices,
        orders: {
          primary: primaryOrder,
          hedge: hedgeOrder,
        },
        fillStatus,
        executionTime,
        timestamp: now(),
      };

      logger.info('Hedge execution completed', {
        executionTime,
        fillStatus,
      });

      return result;

    } catch (error) {
      const executionTime = now() - startTime;
      
      logger.error('Hedge execution failed', error);
      
      await getTelegram().notifyError(
        error as Error,
        `Hedge execution for ${coin}`
      );

      return {
        success: false,
        coin,
        size,
        error: (error as Error).message,
        executionTime,
        timestamp: now(),
      };
    }
  }

  /**
   * 获取价差信息
   */
  async getSpreadInfo(coin: string) {
    const [primaryBook, hedgeBook] = await Promise.all([
      this.primary.getSimplifiedBook(coin),
      this.hedge.getSimplifiedBook(coin),
    ]);

    const priceDiff = primaryBook.mid - hedgeBook.mid;
    const priceDiffPercent = (priceDiff / primaryBook.mid) * 100;

    // 计算含手续费的实际利润
    const profitA = hedgeBook.bid * (1 - this.fees.hedgeTaker) - 
                    primaryBook.ask * (1 + this.fees.primaryTaker);
    
    const profitB = primaryBook.bid * (1 - this.fees.primaryTaker) - 
                    hedgeBook.ask * (1 + this.fees.hedgeTaker);

    const bestProfit = Math.max(profitA, profitB);
    const direction = profitA > profitB
      ? `${this.primary.name} 买入 + ${this.hedge.name} 卖出`
      : `${this.primary.name} 卖出 + ${this.hedge.name} 买入`;

    return {
      coin,
      primary: primaryBook,
      hedge: hedgeBook,
      priceDiff,
      priceDiffPercent,
      direction: bestProfit > 0 ? direction : '⚠️ 无套利空间',
      feeAnalysis: {
        primaryFee: `${(this.fees.primaryTaker * 100).toFixed(2)}%`,
        hedgeFee: `${(this.fees.hedgeTaker * 100).toFixed(2)}%`,
        profitA,
        profitB,
        bestProfit,
        bestProfitPercent: (bestProfit / primaryBook.mid) * 100,
      },
    };
  }

  /**
   * 确定最优对冲方向
   */
  private determineBestDirection(
    primaryBook: any,
    hedgeBook: any,
    size: number,
    reverse: boolean
  ): HedgeDirection {
    // 方案 A: Primary 买 + Hedge 卖
    const costA = primaryBook.ask * (1 + this.fees.primaryTaker);
    const revenueA = hedgeBook.bid * (1 - this.fees.hedgeTaker);
    const profitA = revenueA - costA;
    
    // 方案 B: Primary 卖 + Hedge 买
    const revenueB = primaryBook.bid * (1 - this.fees.primaryTaker);
    const costB = hedgeBook.ask * (1 + this.fees.hedgeTaker);
    const profitB = revenueB - costB;

    let primarySide: OrderSide;
    let hedgeSide: OrderSide;
    let expectedProfit: number;

    if (!reverse) {
      // 开仓：选择利润更高的方向
      if (profitA > profitB) {
        primarySide = 'buy';
        hedgeSide = 'sell';
        expectedProfit = profitA;
      } else {
        primarySide = 'sell';
        hedgeSide = 'buy';
        expectedProfit = profitB;
      }
    } else {
      // 平仓：反向操作
      if (profitA > profitB) {
        primarySide = 'sell';
        hedgeSide = 'buy';
        expectedProfit = profitB;
      } else {
        primarySide = 'buy';
        hedgeSide = 'sell';
        expectedProfit = profitA;
      }
    }

    return {
      primarySide,
      hedgeSide,
      expectedProfit,
      expectedProfitUsd: expectedProfit * size,
    };
  }

  /**
   * 计算订单价格
   */
  private calculateOrderPrice(
    book: any,
    side: OrderSide,
    slippage: number
  ): number {
    const basePrice = side === 'buy' ? book.ask : book.bid;
    return calculateSlippagePrice(basePrice, slippage, side);
  }

  /**
   * 检查成交状态
   */
  private async checkFillStatus(primaryOrder: any, hedgeOrder: any) {
    // 简化版本，实际应该轮询检查
    return {
      primary: 'pending' as const,
      hedge: 'pending' as const,
    };
  }
}
