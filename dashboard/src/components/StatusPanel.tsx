/**
 * 实时状态面板
 * Status panel with real-time prices and stats
 */

import { TrendingUp, BarChart3 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export function StatusPanel() {
  const { priceInfo, todayStats, loopStatus, runningStatus } = useAppStore();

  // 格式化价格
  const formatPrice = (price: number | undefined) => {
    if (!price) return '--';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4">
      {/* 实时价格 */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          实时价格
        </h3>
        
        {priceInfo ? (
          <div className="space-y-3">
            {/* Nado 价格 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Nado</span>
              <div className="text-right">
                <div className="text-lg font-mono text-white">
                  ${formatPrice(priceInfo.nado.mid)}
                </div>
                <div className="text-xs text-gray-500">
                  买: {formatPrice(priceInfo.nado.bid)} / 卖: {formatPrice(priceInfo.nado.ask)}
                </div>
              </div>
            </div>

            {/* Lighter 价格 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Lighter</span>
              <div className="text-right">
                <div className="text-lg font-mono text-white">
                  ${formatPrice(priceInfo.lighter.mid)}
                </div>
                <div className="text-xs text-gray-500">
                  买: {formatPrice(priceInfo.lighter.bid)} / 卖: {formatPrice(priceInfo.lighter.ask)}
                </div>
              </div>
            </div>

            {/* 价差 */}
            <div className="pt-2 border-t border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">价差</span>
                <div className="text-right">
                  <span className={`text-lg font-mono ${priceInfo.spread >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {priceInfo.spread >= 0 ? '+' : ''}{priceInfo.spread.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({priceInfo.spreadPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 更新时间 */}
            <div className="text-xs text-gray-600 text-right">
              更新于 {new Date(priceInfo.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            等待价格数据...
          </div>
        )}
      </div>

      {/* 运行统计 */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          运行统计
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-400">总轮数</div>
            <div className="text-xl font-bold text-white">{todayStats.totalRounds}</div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-400">成功率</div>
            <div className="text-xl font-bold text-green-400">
              {todayStats.totalRounds > 0 
                ? ((todayStats.successCount / todayStats.totalRounds) * 100).toFixed(1) 
                : '0'}%
            </div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-400">成功/失败</div>
            <div className="text-lg font-bold">
              <span className="text-green-400">{todayStats.successCount}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-red-400">{todayStats.failCount}</span>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-400">总成交量</div>
            <div className="text-lg font-bold text-white">
              {todayStats.totalVolume.toFixed(4)}
            </div>
          </div>
        </div>

        {/* 当前循环进度 */}
        {runningStatus === 'looping' && loopStatus.totalRounds > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">当前进度</span>
              <span className="text-white">{loopStatus.currentRound} / {loopStatus.totalRounds}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(loopStatus.currentRound / loopStatus.totalRounds) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
