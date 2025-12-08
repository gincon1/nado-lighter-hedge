/**
 * 类型定义文件
 * Type definitions for Nado-Lighter Hedge Bot Dashboard
 */

// 支持的币种 Supported coins
export type CoinType = 'BTC' | 'ETH' | 'SOL';

// 币种到 product_id 的映射 Coin to product_id mapping
export const COIN_PRODUCT_MAP: Record<CoinType, number> = {
  BTC: 2,
  ETH: 4,
  SOL: 8,
};

// 运行状态 Running status
export type RunningStatus = 
  | 'idle'           // 空闲中
  | 'executing'      // 单次执行中
  | 'looping'        // 循环对冲中
  | 'stopping';      // 停止中

// 价格信息 Price info
export interface PriceInfo {
  coin: CoinType;
  nado: {
    bid: number;
    ask: number;
    mid: number;
  };
  lighter: {
    bid: number;
    ask: number;
    mid: number;
  };
  spread: number;
  spreadPercent: string;
  timestamp: number;
}

// 持仓信息 Position info
export interface PositionInfo {
  exchange: 'nado' | 'lighter';
  coin: CoinType;
  side: 'long' | 'short' | 'none';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

// 配置信息 Config info
export interface HedgeConfig {
  coin: CoinType;
  size: number;              // 每次交易数量
  nadoOrderTimeout: number;  // Nado 订单超时（毫秒）
  nadoMaxRetries: number;    // Nado 最大重试次数
  nadoPriceStrategy: 'best' | 'mid' | 'aggressive';  // 价格策略
  lighterMaxSlippage: number; // Lighter 最大滑点
  holdTime: number;          // 持仓时间（秒）
  interval: number;          // 循环间隔（秒）
}

// Loop 参数 Loop parameters
export interface LoopParams {
  coin: CoinType;
  size: number;
  rounds: number;
  interval: number;
  holdTime: number;
}

// Loop 状态 Loop status
export interface LoopStatus {
  isRunning: boolean;
  currentRound: number;
  totalRounds: number;
  startTime: number | null;
}

// 日志级别 Log level
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

// 日志条目 Log entry
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  details?: string;
}

// 今日统计 Today's statistics
export interface TodayStats {
  totalRounds: number;
  successCount: number;
  failCount: number;
  totalVolume: number;
}

// API 响应基础结构 Base API response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 状态响应 Status response
export interface StatusResponse {
  isRunning: boolean;
  shouldStop: boolean;
  state: string;
  currentHedge: any;
  stats: any;
  config: HedgeConfig;
}
