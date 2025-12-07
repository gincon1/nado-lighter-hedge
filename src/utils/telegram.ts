/**
 * Telegram 通知模块
 */

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from './logger';

const logger = createLogger('telegram');

export class TelegramNotifier {
  private bot: TelegramBot | null = null;
  private chatId: string = '';
  private enabled: boolean = false;

  constructor(botToken?: string, chatId?: string) {
    if (botToken && chatId) {
      try {
        this.bot = new TelegramBot(botToken, { polling: false });
        this.chatId = chatId;
        this.enabled = true;
        logger.info('Telegram notifier initialized');
      } catch (error) {
        logger.error('Failed to initialize Telegram bot', error);
        this.enabled = false;
      }
    } else {
      logger.info('Telegram notifier disabled (no credentials)');
    }
  }

  /**
   * 发送消息
   */
  async send(message: string): Promise<void> {
    if (!this.enabled || !this.bot) {
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
      });
      logger.debug('Telegram message sent', { message });
    } catch (error) {
      logger.error('Failed to send Telegram message', error);
    }
  }

  /**
   * 发送启动通知
   */
  async notifyStart(botName: string): Promise<void> {
    const message = `🚀 *${botName} Started*\n\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Status: Running`;
    await this.send(message);
  }

  /**
   * 发送停止通知
   */
  async notifyStop(botName: string, reason?: string): Promise<void> {
    const message = `🛑 *${botName} Stopped*\n\n` +
      `Time: ${new Date().toISOString()}\n` +
      (reason ? `Reason: ${reason}` : '');
    await this.send(message);
  }

  /**
   * 发送交易通知
   */
  async notifyTrade(
    coin: string,
    action: string,
    size: number,
    price: number,
    success: boolean
  ): Promise<void> {
    const emoji = success ? '✅' : '❌';
    const message = `${emoji} *Trade ${action}*\n\n` +
      `Coin: ${coin}\n` +
      `Size: ${size}\n` +
      `Price: $${price.toFixed(2)}\n` +
      `Status: ${success ? 'Success' : 'Failed'}\n` +
      `Time: ${new Date().toISOString()}`;
    await this.send(message);
  }

  /**
   * 发送风险警告
   */
  async notifyRiskAlert(
    alertType: string,
    message: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    const emoji = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';
    const msg = `${emoji} *Risk Alert: ${alertType}*\n\n` +
      `${message}\n\n` +
      `Severity: ${severity.toUpperCase()}\n` +
      `Time: ${new Date().toISOString()}`;
    await this.send(msg);
  }

  /**
   * 发送错误通知
   */
  async notifyError(error: Error, context?: string): Promise<void> {
    const message = `❌ *Error Occurred*\n\n` +
      (context ? `Context: ${context}\n` : '') +
      `Error: ${error.message}\n` +
      `Time: ${new Date().toISOString()}`;
    await this.send(message);
  }

  /**
   * 发送持仓报告
   */
  async notifyPositionReport(
    coin: string,
    primaryPosition: number,
    hedgePosition: number,
    imbalance: number
  ): Promise<void> {
    const emoji = Math.abs(imbalance) < 0.01 ? '✅' : '⚠️';
    const message = `${emoji} *Position Report: ${coin}*\n\n` +
      `Primary (Nado): ${primaryPosition > 0 ? '+' : ''}${primaryPosition.toFixed(6)}\n` +
      `Hedge (Lighter): ${hedgePosition > 0 ? '+' : ''}${hedgePosition.toFixed(6)}\n` +
      `Imbalance: ${imbalance > 0 ? '+' : ''}${imbalance.toFixed(6)}\n` +
      `Time: ${new Date().toISOString()}`;
    await this.send(message);
  }

  /**
   * 发送每日总结
   */
  async notifyDailySummary(
    totalTrades: number,
    successRate: number,
    totalPnl: number,
    volume: number
  ): Promise<void> {
    const emoji = totalPnl >= 0 ? '📈' : '📉';
    const message = `${emoji} *Daily Summary*\n\n` +
      `Total Trades: ${totalTrades}\n` +
      `Success Rate: ${(successRate * 100).toFixed(1)}%\n` +
      `Total PnL: $${totalPnl.toFixed(2)}\n` +
      `Volume: $${volume.toFixed(2)}\n` +
      `Date: ${new Date().toISOString().split('T')[0]}`;
    await this.send(message);
  }
}

// 单例实例
let notifierInstance: TelegramNotifier | null = null;

/**
 * 初始化 Telegram 通知器
 */
export function initTelegram(botToken?: string, chatId?: string): TelegramNotifier {
  if (!notifierInstance) {
    notifierInstance = new TelegramNotifier(botToken, chatId);
  }
  return notifierInstance;
}

/**
 * 获取 Telegram 通知器实例
 */
export function getTelegram(): TelegramNotifier {
  if (!notifierInstance) {
    notifierInstance = new TelegramNotifier();
  }
  return notifierInstance;
}
