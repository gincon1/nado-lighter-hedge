/**
 * 配置管理模块
 */

import dotenv from 'dotenv';
import { BotConfig, ExchangeConfig, RiskConfig, StrategyConfig, TradingPairConfig } from '../types';

dotenv.config();

/**
 * 从环境变量加载配置
 */
export function loadConfig(): BotConfig {
  // 主交易所配置（Nado）
  const primary: ExchangeConfig = {
    name: 'nado',
    privateKey: process.env.NADO_PRIVATE_KEY || '',
    network: process.env.NADO_NETWORK || 'inkMainnet',
  };

  // 对冲交易所配置（Lighter）
  // 支持两种环境变量命名：API_KEY_PRIVATE_KEY (perp-dex-tools) 或 LIGHTER_PRIVATE_KEY
  const hedge: ExchangeConfig = {
    name: 'lighter',
    privateKey: process.env.API_KEY_PRIVATE_KEY || process.env.LIGHTER_PRIVATE_KEY || '',
    accountIndex: parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
    apiKeyIndex: parseInt(process.env.LIGHTER_API_KEY_INDEX || '0'),
  };

  // 交易对配置
  const pairs: TradingPairConfig[] = [
    {
      coin: 'BTC',
      primarySymbol: 'BTC-PERP',
      hedgeSymbol: 'BTCUSD',
      minOrderSize: 0.001,
      maxOrderSize: 1.0,
      sizeStep: 0.001,
      priceStep: 0.01,
    },
    {
      coin: 'ETH',
      primarySymbol: 'ETH-PERP',
      hedgeSymbol: 'ETHUSD',
      minOrderSize: 0.01,
      maxOrderSize: 10.0,
      sizeStep: 0.01,
      priceStep: 0.01,
    },
    {
      coin: 'SOL',
      primarySymbol: 'SOL-PERP',
      hedgeSymbol: 'SOLUSD',
      minOrderSize: 0.1,
      maxOrderSize: 100.0,
      sizeStep: 0.1,
      priceStep: 0.01,
    },
  ];

  // 风控配置
  const risk: RiskConfig = {
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'),
    maxTotalExposure: parseFloat(process.env.MAX_TOTAL_EXPOSURE || '1.0'),
    maxOpenOrders: parseInt(process.env.MAX_OPEN_ORDERS || '10'),
    maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.005'),
    maxLossPerTrade: parseFloat(process.env.MAX_LOSS_PER_TRADE || '100'),
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '1000'),
    emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '5000'),
  };

  // 策略配置
  const strategies: StrategyConfig[] = [
    {
      name: 'default',
      enabled: true,
      coin: process.env.HEDGE_COIN || 'BTC',
      size: parseFloat(process.env.HEDGE_SIZE || '0.002'),
      slippage: parseFloat(process.env.HEDGE_SLIPPAGE || '0.001'),
      orderType: (process.env.HEDGE_ORDER_TYPE as any) || 'ioc',
      loopCount: parseInt(process.env.HEDGE_LOOP_COUNT || '1'),
      loopInterval: parseInt(process.env.HEDGE_LOOP_INTERVAL || '0'),
      loopHoldTime: parseInt(process.env.HEDGE_LOOP_HOLD_TIME || '0'),
      stopOnError: process.env.HEDGE_LOOP_STOP_ON_ERROR === 'true',
    },
  ];

  // Telegram 配置
  const telegram = {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  };

  // 日志配置
  const logging = {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY !== 'false',
  };

  return {
    primary,
    hedge,
    pairs,
    risk,
    strategies,
    telegram,
    logging,
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: BotConfig): void {
  const errors: string[] = [];

  // 验证主交易所
  if (!config.primary.privateKey) {
    errors.push('NADO_PRIVATE_KEY is required');
  }

  // 验证对冲交易所
  if (!config.hedge.privateKey) {
    errors.push('API_KEY_PRIVATE_KEY or LIGHTER_PRIVATE_KEY is required');
  }

  // 验证交易对
  if (config.pairs.length === 0) {
    errors.push('At least one trading pair is required');
  }

  // 验证 Telegram（如果启用）
  if (config.telegram?.enabled) {
    if (!config.telegram.botToken) {
      errors.push('TELEGRAM_BOT_TOKEN is required when Telegram is enabled');
    }
    if (!config.telegram.chatId) {
      errors.push('TELEGRAM_CHAT_ID is required when Telegram is enabled');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * 获取交易对配置
 */
export function getPairConfig(config: BotConfig, coin: string): TradingPairConfig | undefined {
  return config.pairs.find(p => p.coin.toUpperCase() === coin.toUpperCase());
}

/**
 * 获取策略配置
 */
export function getStrategyConfig(config: BotConfig, name: string): StrategyConfig | undefined {
  return config.strategies.find(s => s.name === name);
}
