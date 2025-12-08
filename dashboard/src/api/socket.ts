/**
 * WebSocket 连接管理
 * 实时接收价格、日志、状态更新
 */

import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../stores/useAppStore';
import type { LogEntry, PriceInfo, TodayStats } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return;

  const store = useAppStore.getState();
  
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket 已连接');
    store.setConnected(true);
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket 已断开');
    store.setConnected(false);
  });

  // 接收价格更新
  socket.on('prices', (data: PriceInfo) => {
    store.setPriceInfo(data);
  });

  // 接收日志
  socket.on('log', (log: LogEntry) => {
    store.addLog(log);
  });

  // 接收状态更新
  socket.on('status', (status: { isRunning: boolean; shouldStop?: boolean; type?: string; totalRounds?: number }) => {
    if (status.isRunning) {
      if (status.type === 'loop') {
        store.setRunningStatus('looping');
        store.setLoopStatus({ 
          isRunning: true, 
          totalRounds: status.totalRounds || 0,
          currentRound: 0,
          startTime: Date.now(),
        });
      } else {
        store.setRunningStatus('executing');
      }
    } else {
      store.setRunningStatus('idle');
      store.setLoopStatus({ isRunning: false, currentRound: 0, totalRounds: 0 });
    }

    if (status.shouldStop) {
      store.setRunningStatus('stopping');
    }
  });

  // 接收循环进度
  socket.on('loopProgress', (progress: { currentRound: number; totalRounds: number }) => {
    store.setLoopStatus({
      currentRound: progress.currentRound,
      totalRounds: progress.totalRounds,
    });
  });

  // 接收统计更新
  socket.on('stats', (stats: TodayStats) => {
    store.updateStats(stats);
  });

  // 对冲完成
  socket.on('hedgeComplete', (data: { type: string; result: any }) => {
    console.log('对冲完成:', data);
  });

  // 对冲错误
  socket.on('hedgeError', (data: { type: string; error: string }) => {
    console.error('对冲错误:', data);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
