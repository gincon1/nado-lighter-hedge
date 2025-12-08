/**
 * 日志控制台
 * Log console with filtering
 */

import { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Filter } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import type { LogLevel } from '../types';

export function LogConsole() {
  const { logs, clearLogs } = useAppStore();
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // 过滤日志
  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  // 日志级别样式
  const getLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // 日志级别标签
  const getLevelLabel = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'INFO';
      case 'success':
        return '成功';
      case 'warning':
        return '警告';
      case 'error':
        return '错误';
      default:
        return level;
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium">交易日志</span>
          <span className="text-xs text-gray-500">({filteredLogs.length})</span>
        </div>

        <div className="flex items-center gap-3">
          {/* 过滤器 */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="all">全部</option>
              <option value="info">信息</option>
              <option value="success">成功</option>
              <option value="warning">警告</option>
              <option value="error">错误</option>
            </select>
          </div>

          {/* 自动滚动 */}
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            自动滚动
          </label>

          {/* 清空按钮 */}
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="清空日志"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* 日志内容 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            暂无日志
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id}
              className={`flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-800/50 ${
                log.level === 'error' ? 'bg-red-900/20' : 
                log.level === 'warning' ? 'bg-yellow-900/20' : ''
              }`}
            >
              {/* 时间 */}
              <span className="text-gray-500 shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              
              {/* 级别 */}
              <span className={`shrink-0 w-12 ${getLevelStyle(log.level)}`}>
                [{getLevelLabel(log.level)}]
              </span>
              
              {/* 消息 */}
              <span className="text-gray-300 flex-1">
                {log.message}
                {log.details && (
                  <span className="text-gray-500 ml-2">
                    ({log.details})
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
