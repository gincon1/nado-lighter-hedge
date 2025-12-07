/**
 * 运行被动对冲策略
 * 
 * 逻辑：
 * 1. Nado 限价挂单 → 等待成交
 * 2. Nado 成交后 → Lighter 市价开反向仓
 * 3. 等待 30秒/1分钟
 * 4. Nado 限价挂平仓单 → 等待成交
 * 5. Nado 平仓成交后 → Lighter 市价平仓
 */

import dotenv from 'dotenv';
dotenv.config();

import { NadoAdapter } from './exchanges/nado-adapter';
import { LighterAdapter } from './exchanges/lighter-adapter';
import { PassiveHedgeEngine, PassiveHedgeConfig } from './core/passive-hedge-engine';
import { loadConfig } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('passive-hedge-runner');

async function main() {
  const config = loadConfig();
  
  console.log('\n========================================');
  console.log('  被动对冲策略');
  console.log('========================================\n');

  // 初始化交易所
  const nado = new NadoAdapter(config.primary.privateKey);
  const lighter = new LighterAdapter(
    config.hedge.privateKey,
    config.hedge.accountIndex,
    config.hedge.apiKeyIndex
  );

  // 初始化被动对冲引擎
  const engine = new PassiveHedgeEngine(nado, lighter);

  // 对冲配置
  const coin = process.env.HEDGE_COIN || 'BTC';
  const hedgeConfig: PassiveHedgeConfig = {
    coin: `${coin}-PERP`,  // Nado 需要 BTC-PERP 格式
    size: parseFloat(process.env.HEDGE_SIZE || '0.01'),
    holdTime: parseInt(process.env.HEDGE_HOLD_TIME || '30'),  // 持仓 30 秒
    openSlippage: parseFloat(process.env.HEDGE_SLIPPAGE || '0.005'),
    closeSlippage: parseFloat(process.env.HEDGE_SLIPPAGE || '0.005'),
    orderTimeout: parseInt(process.env.ORDER_TIMEOUT || '60'),  // 订单超时 60 秒
    pollInterval: 1000,  // 每秒检查一次
  };

  console.log('配置信息:');
  console.log(`  币种: ${hedgeConfig.coin}`);
  console.log(`  数量: ${hedgeConfig.size}`);
  console.log(`  持仓时间: ${hedgeConfig.holdTime} 秒`);
  console.log(`  订单超时: ${hedgeConfig.orderTimeout} 秒`);
  console.log(`  滑点: ${hedgeConfig.openSlippage * 100}%`);
  console.log('');

  // 显示当前价格
  console.log('获取当前价格...');
  try {
    const [nadoBook, lighterBook] = await Promise.all([
      nado.getSimplifiedBook(hedgeConfig.coin),
      lighter.getSimplifiedBook(hedgeConfig.coin),
    ]);
    
    console.log(`\n当前价格:`);
    console.log(`  Nado:    Bid ${nadoBook.bid} / Ask ${nadoBook.ask}`);
    console.log(`  Lighter: Bid ${lighterBook.bid?.toFixed(1)} / Ask ${lighterBook.ask?.toFixed(1)}`);
    console.log(`  价差: ${(nadoBook.mid - lighterBook.mid).toFixed(2)} USD`);
    console.log('');
  } catch (e) {
    console.log('获取价格失败:', (e as Error).message);
  }

  // 轮数
  const rounds = parseInt(process.env.HEDGE_ROUNDS || '1');
  
  console.log(`开始运行 ${rounds} 轮...\n`);
  console.log('----------------------------------------');

  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n收到停止信号，正在安全退出...');
    engine.stop();
  });

  // 运行
  await engine.runLoop(hedgeConfig, rounds);

  console.log('----------------------------------------');
  console.log('\n策略运行结束');
}

main().catch(error => {
  logger.error('Fatal error', error);
  process.exit(1);
});
