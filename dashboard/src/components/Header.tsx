/**
 * 顶部状态栏
 * Header component with status display
 */

import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export function Header() {
  const { runningStatus, loopStatus, isConnected, selectedCoin } = useAppStore();

  // 状态文本和颜色
  const getStatusDisplay = () => {
    switch (runningStatus) {
      case 'idle':
        return { text: '空闲中', color: 'text-gray-400', bg: 'bg-gray-700' };
      case 'executing':
        return { text: '单次对冲执行中', color: 'text-blue-400', bg: 'bg-blue-900/50' };
      case 'looping':
        return { 
          text: `循环对冲中 (${loopStatus.currentRound}/${loopStatus.totalRounds})`, 
          color: 'text-green-400', 
          bg: 'bg-green-900/50' 
        };
      case 'stopping':
        return { text: '停止中...', color: 'text-yellow-400', bg: 'bg-yellow-900/50' };
      default:
        return { text: '未知', color: 'text-gray-400', bg: 'bg-gray-700' };
    }
  };

  const status = getStatusDisplay();

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* 左侧：项目名 */}
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg font-bold">Nado-Lighter 对冲机器人</h1>
        </div>

        {/* 中间：当前币种 */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-gray-400">当前币种:</span>
          <span className="text-xl font-bold text-white">{selectedCoin}</span>
        </div>

        {/* 右侧：连接状态 + 运行状态 */}
        <div className="flex items-center gap-4">
          {/* WebSocket 连接状态 */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>

          {/* 运行状态标签 */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.color}`}>
            {runningStatus !== 'idle' && (
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-2 animate-pulse" />
            )}
            {status.text}
          </div>
        </div>
      </div>
    </header>
  );
}
