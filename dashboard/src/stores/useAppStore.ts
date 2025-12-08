/**
 * 全局状态管理
 * Global state management using Zustand
 */

import { create } from 'zustand';
import type {
  CoinType,
  RunningStatus,
  PriceInfo,
  LoopStatus,
  LogEntry,
  TodayStats,
  HedgeConfig,
} from '../types';

interface AppState {
  // 当前选中币种 Current selected coin
  selectedCoin: CoinType;
  setSelectedCoin: (coin: CoinType) => void;

  // 运行状态 Running status
  runningStatus: RunningStatus;
  setRunningStatus: (status: RunningStatus) => void;

  // 价格信息 Price info
  priceInfo: PriceInfo | null;
  setPriceInfo: (info: PriceInfo | null) => void;

  // Loop 状态 Loop status
  loopStatus: LoopStatus;
  setLoopStatus: (status: Partial<LoopStatus>) => void;

  // 配置 Config
  config: HedgeConfig;
  setConfig: (config: Partial<HedgeConfig>) => void;

  // 日志 Logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // 今日统计 Today's stats
  todayStats: TodayStats;
  updateStats: (stats: Partial<TodayStats>) => void;

  // Loading 状态 Loading states
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;

  // WebSocket 连接状态
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // 币种
  selectedCoin: 'BTC',
  setSelectedCoin: (coin) => set({ selectedCoin: coin }),

  // 运行状态
  runningStatus: 'idle',
  setRunningStatus: (status) => set({ runningStatus: status }),

  // 价格
  priceInfo: null,
  setPriceInfo: (info) => set({ priceInfo: info }),

  // Loop 状态
  loopStatus: {
    isRunning: false,
    currentRound: 0,
    totalRounds: 0,
    startTime: null,
  },
  setLoopStatus: (status) => set((state) => ({
    loopStatus: { ...state.loopStatus, ...status },
  })),

  // 配置
  config: {
    coin: 'BTC',
    size: 0.0013,
    nadoOrderTimeout: 60000,
    nadoMaxRetries: 3,
    nadoPriceStrategy: 'best',
    lighterMaxSlippage: 0.005,
    holdTime: 10,
    interval: 10,
  },
  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  // 日志
  logs: [],
  addLog: (log) => set((state) => ({
    logs: [log, ...state.logs.slice(0, 499)], // 最多保留 500 条
  })),
  clearLogs: () => set({ logs: [] }),

  // 今日统计
  todayStats: {
    totalRounds: 0,
    successCount: 0,
    failCount: 0,
    totalVolume: 0,
  },
  updateStats: (stats) => set((state) => ({
    todayStats: { ...state.todayStats, ...stats },
  })),

  // Loading
  loadingStates: {},
  setLoading: (key, loading) => set((state) => ({
    loadingStates: { ...state.loadingStates, [key]: loading },
  })),

  // WebSocket
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}));
