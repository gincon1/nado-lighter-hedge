/**
 * 主应用组件
 * Main application component - Dashboard layout
 */

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { StatusPanel } from './components/StatusPanel';
import { LogConsole } from './components/LogConsole';
import { connectSocket, disconnectSocket } from './api/socket';
import { getConfig, getStatus } from './api';
import { useAppStore } from './stores/useAppStore';

export default function App() {
  const { setConfig, setRunningStatus, updateStats } = useAppStore();

  // 初始化：连接 WebSocket 和获取初始数据
  useEffect(() => {
    // 连接 WebSocket
    connectSocket();

    // 获取初始配置
    getConfig().then(res => {
      if (res.success && res.data) {
        setConfig(res.data);
      }
    });

    // 获取初始状态
    getStatus().then(res => {
      if (res.success && res.data) {
        if (res.data.isRunning) {
          setRunningStatus('looping');
        }
        if (res.data.stats) {
          updateStats(res.data.stats);
        }
      }
    });

    // 清理
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast 通知 */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* 顶部状态栏 */}
      <Header />

      {/* 主内容区 */}
      <main className="p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          {/* 上半部分：控制面板 + 状态面板 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 mb-4 lg:mb-6">
            {/* 左侧：交易控制面板 (3/5 宽度) */}
            <div className="lg:col-span-3">
              <ControlPanel />
            </div>

            {/* 右侧：实时状态面板 (2/5 宽度) */}
            <div className="lg:col-span-2">
              <StatusPanel />
            </div>
          </div>

          {/* 下半部分：日志终端 */}
          <div className="h-[320px]">
            <LogConsole />
          </div>
        </div>
      </main>

      {/* 底部版权信息 */}
      <footer className="text-center py-4 text-xs text-gray-600">
        Nado-Lighter Hedge Bot Dashboard v2.0.0
      </footer>
    </div>
  );
}
