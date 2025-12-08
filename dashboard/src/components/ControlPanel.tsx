/**
 * 交易控制面板
 * Control panel for hedge operations
 */

import { useState } from 'react';
import { Play, Square, RotateCcw, Settings, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { hedgeOnce, hedgeLoop, stopHedge, updateConfig } from '../api';
import { ConfirmModal } from './ConfirmModal';
import toast from 'react-hot-toast';
import type { CoinType } from '../types';

export function ControlPanel() {
  const { config, setConfig, runningStatus, loadingStates, setLoading } = useAppStore();
  
  // 本地表单状态
  const [localConfig, setLocalConfig] = useState(config);
  const [rounds, setRounds] = useState(5);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isRunning = runningStatus !== 'idle';
  const isLoading = loadingStates['hedge'] || false;

  // 更新本地配置
  const handleConfigChange = (key: string, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  // 保存配置到后端
  const handleSaveConfig = async () => {
    setLoading('config', true);
    try {
      const result = await updateConfig(localConfig);
      if (result.success) {
        setConfig(localConfig);
        toast.success('配置已保存');
      } else {
        toast.error(result.error || '保存失败');
      }
    } finally {
      setLoading('config', false);
    }
  };

  // 单次对冲
  const handleOnce = async () => {
    setLoading('hedge', true);
    try {
      const result = await hedgeOnce(localConfig.coin, localConfig.size);
      if (result.success) {
        toast.success('单次对冲已启动');
      } else {
        toast.error(result.error || '启动失败');
      }
    } finally {
      setLoading('hedge', false);
    }
  };

  // 循环对冲
  const handleLoop = async () => {
    setShowConfirm(false);
    setLoading('hedge', true);
    try {
      const result = await hedgeLoop({
        coin: localConfig.coin,
        size: localConfig.size,
        rounds,
        interval: localConfig.interval,
        holdTime: localConfig.holdTime,
      });
      if (result.success) {
        toast.success('循环对冲已启动');
      } else {
        toast.error(result.error || '启动失败');
      }
    } finally {
      setLoading('hedge', false);
    }
  };

  // 停止
  const handleStop = async () => {
    setLoading('stop', true);
    try {
      const result = await stopHedge();
      if (result.success) {
        toast.success('停止指令已发送');
      } else {
        toast.error(result.error || '停止失败');
      }
    } finally {
      setLoading('stop', false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">交易控制</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* 基础参数 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* 币种选择 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">币种</label>
          <select
            value={localConfig.coin}
            onChange={(e) => handleConfigChange('coin', e.target.value as CoinType)}
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
          </select>
        </div>

        {/* 交易数量 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">数量</label>
          <input
            type="number"
            step="0.0001"
            value={localConfig.size}
            onChange={(e) => handleConfigChange('size', parseFloat(e.target.value))}
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* 循环轮数 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">循环轮数</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={rounds}
            onChange={(e) => setRounds(parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* 持仓时间 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">持仓时间(秒)</label>
          <input
            type="number"
            min="0"
            value={localConfig.holdTime}
            onChange={(e) => handleConfigChange('holdTime', parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* 高级设置 */}
      {showSettings && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div>
            <label className="block text-xs text-gray-400 mb-1">订单超时(秒)</label>
            <input
              type="number"
              min="10"
              max="300"
              value={localConfig.nadoOrderTimeout / 1000}
              onChange={(e) => handleConfigChange('nadoOrderTimeout', parseInt(e.target.value) * 1000)}
              disabled={isRunning}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">最大重试</label>
            <input
              type="number"
              min="0"
              max="10"
              value={localConfig.nadoMaxRetries}
              onChange={(e) => handleConfigChange('nadoMaxRetries', parseInt(e.target.value))}
              disabled={isRunning}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">价格策略</label>
            <select
              value={localConfig.nadoPriceStrategy}
              onChange={(e) => handleConfigChange('nadoPriceStrategy', e.target.value)}
              disabled={isRunning}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="best">最优(Maker)</option>
              <option value="mid">中间价</option>
              <option value="aggressive">激进(Taker)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">最大滑点(%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="5"
              value={localConfig.lighterMaxSlippage * 100}
              onChange={(e) => handleConfigChange('lighterMaxSlippage', parseFloat(e.target.value) / 100)}
              disabled={isRunning}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">循环间隔(秒)</label>
            <input
              type="number"
              min="0"
              value={localConfig.interval}
              onChange={(e) => handleConfigChange('interval', parseInt(e.target.value))}
              disabled={isRunning}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="col-span-2 md:col-span-3 flex items-end">
            <button
              onClick={handleSaveConfig}
              disabled={isRunning || loadingStates['config']}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStates['config'] ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        {!isRunning ? (
          <>
            <button
              onClick={handleOnce}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              单次对冲
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              循环对冲
            </button>
          </>
        ) : (
          <button
            onClick={handleStop}
            disabled={loadingStates['stop'] || runningStatus === 'stopping'}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loadingStates['stop'] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            停止
          </button>
        )}
      </div>

      {/* 确认弹窗 */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleLoop}
        title="确认开始循环对冲"
        content={
          <div className="space-y-2 text-sm">
            <p>币种: <span className="text-white font-medium">{localConfig.coin}</span></p>
            <p>每次数量: <span className="text-white font-medium">{localConfig.size}</span></p>
            <p>循环轮数: <span className="text-white font-medium">{rounds}</span></p>
            <p>预估总成交量: <span className="text-white font-medium">{(localConfig.size * 2 * rounds).toFixed(4)} {localConfig.coin}</span></p>
            <p>持仓时间: <span className="text-white font-medium">{localConfig.holdTime}s</span></p>
            <p>循环间隔: <span className="text-white font-medium">{localConfig.interval}s</span></p>
          </div>
        }
      />
    </div>
  );
}
