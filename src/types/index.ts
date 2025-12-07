/**
 * 核心类型定义
 */

// ============ 交易所通用类型 ============

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'ioc' | 'fok' | 'post_only';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
export type PositionSide = 'long' | 'short' | 'none';

// ============ 订单簿 ============

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface SimplifiedBook {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPercent: number;
}

// ============ 订单 ============

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  price?: number;
  timeInForce?: string;
  clientOrderId?: string;
}

export interface Order {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: number;
  size: number;
  filled: number;
  remaining: number;
  timestamp: number;
  updateTime?: number;
}

// ============ 持仓 ============

export interface Position {
  symbol: string;
  side: PositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice?: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  margin: number;
  timestamp: number;
}

// ============ 账户 ============

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface AccountInfo {
  balances: Balance[];
  positions: Position[];
  totalEquity: number;
  availableBalance: number;
  usedMargin: number;
  timestamp: number;
}

// ============ 交易所接口 ============

export interface PerpExchange {
  name: string;
  
  // 行情
  getOrderBook(symbol: string): Promise<OrderBook>;
  getSimplifiedBook(symbol: string): Promise<SimplifiedBook>;
  getMarkPrice(symbol: string): Promise<number>;
  
  // 订单
  placeOrder(params: PlaceOrderParams): Promise<Order>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  getOrder(orderId: string, symbol: string): Promise<Order>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  
  // 持仓
  getPosition(symbol: string): Promise<Position | null>;
  getPositions(): Promise<Position[]>;
  
  // 账户
  getAccountInfo(): Promise<AccountInfo>;
  getBalance(asset?: string): Promise<Balance[]>;
}

// ============ 对冲相关 ============

export interface HedgeDirection {
  primarySide: OrderSide;    // 主交易所方向
  hedgeSide: OrderSide;      // 对冲交易所方向
  expectedProfit: number;    // 预期利润（每单位）
  expectedProfitUsd: number; // 预期利润（美元）
}

export interface HedgeExecutionResult {
  success: boolean;
  coin: string;
  size: number;
  direction?: HedgeDirection;
  prices?: {
    primary: number;
    hedge: number;
  };
  orders?: {
    primary: Order;
    hedge: Order;
  };
  fillStatus?: {
    primary: OrderStatus;
    hedge: OrderStatus;
  };
  executionTime: number;
  timestamp: number;
  error?: string;
}

export interface SpreadInfo {
  coin: string;
  primary: SimplifiedBook;
  hedge: SimplifiedBook;
  priceDiff: number;
  priceDiffPercent: number;
  direction: string;
  feeAnalysis?: {
    primaryFee: string;
    hedgeFee: string;
    profitA: number;
    profitB: number;
    bestProfit: number;
    bestProfitPercent: number;
  };
}

// ============ 配置 ============

export interface ExchangeConfig {
  name: string;
  privateKey: string;
  network?: string;
  accountIndex?: number;
  apiKeyIndex?: number;
  rpcUrl?: string;
}

export interface TradingPairConfig {
  coin: string;
  primarySymbol: string;
  hedgeSymbol: string;
  minOrderSize: number;
  maxOrderSize: number;
  sizeStep: number;
  priceStep: number;
  leverage?: number;
}

export interface RiskConfig {
  maxPositionSize: number;        // 最大单边持仓
  maxTotalExposure: number;       // 最大总敞口
  maxOpenOrders: number;          // 最大挂单数
  maxSlippage: number;            // 最大滑点（百分比）
  maxLossPerTrade: number;        // 单笔最大亏损
  maxDailyLoss: number;           // 每日最大亏损
  emergencyStopLoss: number;      // 紧急止损阈值
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  coin: string;
  size: number;
  slippage: number;
  orderType: OrderType;
  // 循环配置
  loopCount?: number;
  loopInterval?: number;
  loopHoldTime?: number;
  stopOnError?: boolean;
}

export interface BotConfig {
  primary: ExchangeConfig;        // 主交易所（Nado）
  hedge: ExchangeConfig;          // 对冲交易所（Lighter）
  pairs: TradingPairConfig[];     // 交易对配置
  risk: RiskConfig;               // 风控配置
  strategies: StrategyConfig[];   // 策略配置
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  logging?: {
    level: string;
    pretty: boolean;
  };
}

// ============ 事件 ============

export type EventType = 
  | 'order_placed'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_rejected'
  | 'position_opened'
  | 'position_closed'
  | 'risk_alert'
  | 'error';

export interface BotEvent {
  type: EventType;
  timestamp: number;
  data: any;
  message?: string;
}
