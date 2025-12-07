/**
 * 风险管理模块
 */

import { RiskConfig, Position, Order } from '../types';
import { createLogger } from '../utils/logger';
import { getTelegram } from '../utils/telegram';

const logger = createLogger('risk-manager');

export class RiskManager {
  private config: RiskConfig;
  private dailyLoss: number = 0;
  private dailyLossResetTime: number = 0;
  private emergencyStop: boolean = false;

  constructor(config: RiskConfig) {
    this.config = config;
    this.resetDailyLossIfNeeded();
  }

  /**
   * 检查是否可以开仓
   */
  canOpenPosition(
    coin: string,
    size: number,
    price: number,
    currentPositions: Position[]
  ): { allowed: boolean; reason?: string } {
    // 检查紧急停止
    if (this.emergencyStop) {
      return { allowed: false, reason: 'Emergency stop activated' };
    }

    // 检查单笔订单大小
    const orderValue = size * price;
    if (size > this.config.maxPositionSize) {
      return {
        allowed: false,
        reason: `Order size ${size} exceeds max position size ${this.config.maxPositionSize}`,
      };
    }

    // 检查总敞口
    const totalExposure = this.calculateTotalExposure(currentPositions);
    const newExposure = totalExposure + Math.abs(size);
    
    if (newExposure > this.config.maxTotalExposure) {
      return {
        allowed: false,
        reason: `New exposure ${newExposure.toFixed(4)} exceeds max ${this.config.maxTotalExposure}`,
      };
    }

    // 检查每日亏损
    this.resetDailyLossIfNeeded();
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit reached: $${this.dailyLoss.toFixed(2)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * 检查滑点是否可接受
   */
  checkSlippage(
    expectedPrice: number,
    actualPrice: number,
    side: 'buy' | 'sell'
  ): { acceptable: boolean; slippage: number; reason?: string } {
    let slippage: number;
    
    if (side === 'buy') {
      // 买入：实际价格高于预期是负面滑点
      slippage = (actualPrice - expectedPrice) / expectedPrice;
    } else {
      // 卖出：实际价格低于预期是负面滑点
      slippage = (expectedPrice - actualPrice) / expectedPrice;
    }

    const acceptable = Math.abs(slippage) <= this.config.maxSlippage;

    if (!acceptable) {
      return {
        acceptable: false,
        slippage,
        reason: `Slippage ${(slippage * 100).toFixed(2)}% exceeds max ${(this.config.maxSlippage * 100).toFixed(2)}%`,
      };
    }

    return { acceptable: true, slippage };
  }

  /**
   * 记录交易损失
   */
  recordLoss(loss: number): void {
    this.resetDailyLossIfNeeded();
    
    if (loss > 0) {
      this.dailyLoss += loss;
      logger.warn('Loss recorded', {
        loss: loss.toFixed(2),
        dailyLoss: this.dailyLoss.toFixed(2),
        maxDailyLoss: this.config.maxDailyLoss,
      });

      // 检查是否触发紧急止损
      if (this.dailyLoss >= this.config.emergencyStopLoss) {
        this.activateEmergencyStop('Daily loss exceeded emergency threshold');
      }

      // 检查单笔亏损
      if (loss >= this.config.maxLossPerTrade) {
        logger.error('Single trade loss exceeded limit', {
          loss: loss.toFixed(2),
          maxLossPerTrade: this.config.maxLossPerTrade,
        });
        
        getTelegram().notifyRiskAlert(
          'Large Single Trade Loss',
          `Loss: $${loss.toFixed(2)}\nLimit: $${this.config.maxLossPerTrade}`,
          'high'
        );
      }
    }
  }

  /**
   * 激活紧急停止
   */
  activateEmergencyStop(reason: string): void {
    if (this.emergencyStop) return;

    this.emergencyStop = true;
    logger.error('Emergency stop activated', { reason });
    
    getTelegram().notifyRiskAlert(
      'Emergency Stop Activated',
      reason,
      'high'
    );
  }

  /**
   * 解除紧急停止
   */
  deactivateEmergencyStop(): void {
    this.emergencyStop = false;
    logger.info('Emergency stop deactivated');
  }

  /**
   * 检查持仓不平衡
   */
  checkPositionImbalance(
    primaryPosition: number,
    hedgePosition: number,
    threshold: number = 0.05
  ): { balanced: boolean; imbalance: number; reason?: string } {
    const imbalance = Math.abs(primaryPosition + hedgePosition);
    const balanced = imbalance <= threshold;

    if (!balanced) {
      const reason = `Position imbalance detected: ${imbalance.toFixed(6)} (threshold: ${threshold})`;
      logger.warn(reason, {
        primaryPosition,
        hedgePosition,
        imbalance,
      });

      getTelegram().notifyRiskAlert(
        'Position Imbalance',
        `Primary: ${primaryPosition.toFixed(6)}\nHedge: ${hedgePosition.toFixed(6)}\nImbalance: ${imbalance.toFixed(6)}`,
        'medium'
      );
    }

    return { balanced, imbalance, reason: balanced ? undefined : `Imbalance: ${imbalance.toFixed(6)}` };
  }

  /**
   * 计算总敞口
   */
  private calculateTotalExposure(positions: Position[]): number {
    return positions.reduce((total, pos) => total + Math.abs(pos.size), 0);
  }

  /**
   * 重置每日亏损（如果需要）
   */
  private resetDailyLossIfNeeded(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - this.dailyLossResetTime > oneDayMs) {
      logger.info('Resetting daily loss counter', {
        previousLoss: this.dailyLoss.toFixed(2),
      });
      this.dailyLoss = 0;
      this.dailyLossResetTime = now;
    }
  }

  /**
   * 获取风险状态
   */
  getRiskStatus(): {
    emergencyStop: boolean;
    dailyLoss: number;
    maxDailyLoss: number;
    dailyLossPercent: number;
  } {
    this.resetDailyLossIfNeeded();
    
    return {
      emergencyStop: this.emergencyStop,
      dailyLoss: this.dailyLoss,
      maxDailyLoss: this.config.maxDailyLoss,
      dailyLossPercent: (this.dailyLoss / this.config.maxDailyLoss) * 100,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Risk config updated', config);
  }
}
