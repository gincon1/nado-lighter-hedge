/**
 * 被动对冲引擎
 * 
 * 逻辑：
 * 1. Nado 限价挂单（开仓）→ 等待成交
 * 2. Nado 成交后 → Lighter 市价开反向仓位
 * 3. 等待指定时间（30秒/1分钟）
 * 4. Nado 限价挂平仓单 → 等待成交
 * 5. Nado 平仓成交后 → Lighter 市价平仓
 */

import { PerpExchange, OrderSide } from '../types';
import { createLogger } from '../utils/logger';
import { getTelegram } from '../utils/telegram';

const logger = createLogger('passive-hedge');

export interface PassiveHedgeConfig {
  coin: string;
  size: number;
  holdTime: number;        // 持仓时间（秒）
  openSlippage: number;    // 开仓滑点
  closeSlippage: number;   // 平仓滑点
  orderTimeout: number;    // 订单超时（秒）
  pollInterval: number;    // 轮询间隔（毫秒）
}

export interface HedgeState {
  phase: 'idle' | 'waiting_nado_open' | 'opening_lighter' | 'holding' | 'waiting_nado_close' | 'closing_lighter' | 'completed' | 'error';
  nadoOpenOrderId?: string;
  nadoCloseOrderId?: string;
  lighterOpenOrderId?: string;
  lighterCloseOrderId?: string;
  nadoSide?: OrderSide;
  lighterSide?: OrderSide;
  openPrice?: number;
  closePrice?: number;
  startTime?: number;
  error?: string;
}

export class PassiveHedgeEngine {
  private nado: PerpExchange;
  private lighter: PerpExchange;
  private state: HedgeState = { phase: 'idle' };
  private stopFlag = false;

  constructor(nado: PerpExchange, lighter: PerpExchange) {
    this.nado = nado;
    this.lighter = lighter;
    logger.info('Passive hedge engine initialized');
  }

  /**
   * 停止引擎
   */
  stop() {
    this.stopFlag = true;
    logger.info('Stopping passive hedge engine');
  }

  /**
   * 获取当前状态
   */
  getState(): HedgeState {
    return { ...this.state };
  }

  /**
   * 执行一轮完整的被动对冲
   */
  async executeRound(config: PassiveHedgeConfig): Promise<HedgeState> {
    const { coin, size, holdTime, openSlippage, closeSlippage, orderTimeout, pollInterval } = config;
    
    this.state = { phase: 'idle', startTime: Date.now() };
    this.stopFlag = false;

    try {
      // 1. 获取价格，确定方向
      const [nadoBook, lighterBook] = await Promise.all([
        this.nado.getSimplifiedBook(coin),
        this.lighter.getSimplifiedBook(coin),
      ]);

      logger.info('Price fetched', {
        nado: { bid: nadoBook.bid, ask: nadoBook.ask },
        lighter: { bid: lighterBook.bid, ask: lighterBook.ask },
      });

      // 决定方向：Nado 买入（挂在 bid），Lighter 卖出
      // 或者：Nado 卖出（挂在 ask），Lighter 买入
      // 这里简单选择 Nado 买入方向
      const nadoSide: OrderSide = 'buy';
      const lighterSide: OrderSide = nadoSide === 'buy' ? 'sell' : 'buy';
      
      this.state.nadoSide = nadoSide;
      this.state.lighterSide = lighterSide;

      // 2. Nado 开仓限价单（挂在 bid 价格，等待成交）
      const nadoOpenPrice = nadoSide === 'buy' ? nadoBook.bid : nadoBook.ask;
      
      logger.info('Phase 1: Placing Nado limit order', {
        side: nadoSide,
        price: nadoOpenPrice,
        size,
      });

      this.state.phase = 'waiting_nado_open';
      
      const nadoOpenOrder = await this.nado.placeOrder({
        symbol: coin,
        side: nadoSide,
        type: 'post_only',  // 只做 maker
        size,
        price: nadoOpenPrice,
      });
      
      this.state.nadoOpenOrderId = nadoOpenOrder.orderId;
      logger.info('Nado open order placed', { orderId: nadoOpenOrder.orderId });

      // 3. 等待 Nado 开仓订单成交
      const nadoOpenFilled = await this.waitForNadoFill(coin, nadoOpenOrder.orderId, orderTimeout, pollInterval);
      
      if (!nadoOpenFilled) {
        // 超时未成交，取消订单
        await this.nado.cancelOrder(nadoOpenOrder.orderId, coin);
        this.state.phase = 'idle';
        this.state.error = 'Nado open order timeout';
        logger.warn('Nado open order timeout, cancelled');
        return this.state;
      }

      this.state.openPrice = nadoOpenPrice;
      logger.info('Nado open order filled!', { price: nadoOpenPrice });

      // 4. Lighter 市价开反向仓位
      this.state.phase = 'opening_lighter';
      
      const lighterOpenPrice = this.state.lighterSide === 'buy' 
        ? lighterBook.ask * (1 + openSlippage)
        : lighterBook.bid * (1 - openSlippage);

      logger.info('Phase 2: Opening Lighter position', {
        side: lighterSide,
        price: lighterOpenPrice,
        size,
      });

      const lighterOpenOrder = await this.lighter.placeOrder({
        symbol: coin,
        side: lighterSide,
        type: 'market',
        size,
        price: lighterOpenPrice,
      });
      
      this.state.lighterOpenOrderId = lighterOpenOrder.orderId;
      logger.info('Lighter open order placed', { orderId: lighterOpenOrder.orderId });

      // 发送通知
      await getTelegram().notifyTrade(coin, 'Open', size, nadoOpenPrice, true);

      // 5. 持仓等待
      this.state.phase = 'holding';
      logger.info(`Phase 3: Holding position for ${holdTime} seconds...`);
      
      await this.sleep(holdTime * 1000);

      if (this.stopFlag) {
        this.state.error = 'Stopped by user';
        return this.state;
      }

      // 6. 获取最新价格，Nado 挂平仓限价单
      const [nadoBook2, lighterBook2] = await Promise.all([
        this.nado.getSimplifiedBook(coin),
        this.lighter.getSimplifiedBook(coin),
      ]);

      // 平仓方向相反
      const nadoCloseSide: OrderSide = nadoSide === 'buy' ? 'sell' : 'buy';
      const lighterCloseSide: OrderSide = this.state.lighterSide === 'buy' ? 'sell' : 'buy';
      
      const nadoClosePrice = nadoCloseSide === 'buy' ? nadoBook2.bid : nadoBook2.ask;

      logger.info('Phase 4: Placing Nado close order', {
        side: nadoCloseSide,
        price: nadoClosePrice,
        size,
      });

      this.state.phase = 'waiting_nado_close';
      
      const nadoCloseOrder = await this.nado.placeOrder({
        symbol: coin,
        side: nadoCloseSide,
        type: 'post_only',
        size,
        price: nadoClosePrice,
      });
      
      this.state.nadoCloseOrderId = nadoCloseOrder.orderId;
      logger.info('Nado close order placed', { orderId: nadoCloseOrder.orderId });

      // 7. 等待 Nado 平仓订单成交
      const nadoCloseFilled = await this.waitForNadoFill(coin, nadoCloseOrder.orderId, orderTimeout, pollInterval);
      
      if (!nadoCloseFilled) {
        // 超时未成交，可以选择取消或用市价平
        logger.warn('Nado close order timeout, forcing market close');
        await this.nado.cancelOrder(nadoCloseOrder.orderId, coin);
        
        // 市价平仓
        await this.nado.placeOrder({
          symbol: coin,
          side: nadoCloseSide,
          type: 'ioc',
          size,
          price: nadoCloseSide === 'buy' ? nadoBook2.ask * 1.01 : nadoBook2.bid * 0.99,
        });
      }

      this.state.closePrice = nadoClosePrice;
      logger.info('Nado close order filled!', { price: nadoClosePrice });

      // 8. Lighter 市价平仓
      this.state.phase = 'closing_lighter';
      
      const lighterClosePrice = lighterCloseSide === 'buy'
        ? lighterBook2.ask * (1 + closeSlippage)
        : lighterBook2.bid * (1 - closeSlippage);

      logger.info('Phase 5: Closing Lighter position', {
        side: lighterCloseSide,
        price: lighterClosePrice,
        size,
      });

      const lighterCloseOrder = await this.lighter.placeOrder({
        symbol: coin,
        side: lighterCloseSide,
        type: 'market',
        size,
        price: lighterClosePrice,
      });
      
      this.state.lighterCloseOrderId = lighterCloseOrder.orderId;
      logger.info('Lighter close order placed', { orderId: lighterCloseOrder.orderId });

      // 发送通知
      await getTelegram().notifyTrade(coin, 'Close', size, nadoClosePrice, true);

      // 完成
      this.state.phase = 'completed';
      
      const pnl = nadoSide === 'buy'
        ? (nadoClosePrice - nadoOpenPrice) * size
        : (nadoOpenPrice - nadoClosePrice) * size;
      
      logger.info('Round completed', {
        openPrice: nadoOpenPrice,
        closePrice: nadoClosePrice,
        estimatedPnL: pnl,
      });

      return this.state;

    } catch (error) {
      this.state.phase = 'error';
      this.state.error = (error as Error).message;
      logger.error('Passive hedge error', error);
      
      await getTelegram().notifyError(error as Error, 'Passive hedge');
      
      return this.state;
    }
  }

  /**
   * 等待 Nado 订单成交
   */
  private async waitForNadoFill(
    coin: string,
    orderId: string,
    timeoutSec: number,
    pollMs: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = timeoutSec * 1000;

    while (Date.now() - startTime < timeoutMs) {
      if (this.stopFlag) return false;

      try {
        // 检查持仓变化来判断是否成交
        const position = await this.nado.getPosition(coin);
        
        if (position && position.size > 0) {
          // 有持仓说明成交了
          return true;
        }

        // 也可以检查订单状态
        // const order = await this.nado.getOrder(orderId, coin);
        // if (order.status === 'filled') return true;

      } catch (error) {
        logger.debug('Poll error', error);
      }

      await this.sleep(pollMs);
    }

    return false;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 运行多轮
   */
  async runLoop(config: PassiveHedgeConfig, rounds: number = 100): Promise<void> {
    logger.info('Starting passive hedge loop', { rounds, config });

    for (let i = 1; i <= rounds && !this.stopFlag; i++) {
      logger.info(`=== Round ${i}/${rounds} ===`);
      
      const result = await this.executeRound(config);
      
      if (result.phase === 'error') {
        logger.error(`Round ${i} failed: ${result.error}`);
        // 可以选择继续或停止
        await this.sleep(5000);
      } else {
        logger.info(`Round ${i} completed successfully`);
      }

      // 轮次间隔
      if (i < rounds && !this.stopFlag) {
        await this.sleep(2000);
      }
    }

    logger.info('Passive hedge loop finished');
  }
}
