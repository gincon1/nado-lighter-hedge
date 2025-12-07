/**
 * 简单对冲示例
 */

import { initBot } from '../index';
import { logger } from '../utils/logger';

async function main() {
  try {
    // 初始化机器人
    logger.info('Initializing bot...');
    const bot = await initBot();

    // 1. 查看价差
    logger.info('Checking spread...');
    const spread = await bot.hedgeEngine.getSpreadInfo('BTC-PERP');
    
    console.log('\n=== BTC-PERP 价差信息 ===');
    console.log(`Primary (${bot.primaryExchange.name}): Bid ${spread.primary.bid} / Ask ${spread.primary.ask}`);
    console.log(`Hedge (${bot.hedgeExchange.name}): Bid ${spread.hedge.bid} / Ask ${spread.hedge.ask}`);
    console.log(`价差: ${spread.priceDiff.toFixed(2)} (${spread.priceDiffPercent.toFixed(4)}%)`);
    console.log(`推荐方向: ${spread.direction}`);
    
    if (spread.feeAnalysis) {
      console.log(`\n含手续费分析:`);
      console.log(`  最佳利润: ${spread.feeAnalysis.bestProfit.toFixed(4)}/单位`);
      console.log(`  利润率: ${spread.feeAnalysis.bestProfitPercent.toFixed(4)}%`);
    }

    // 2. 检查风险状态
    logger.info('Checking risk status...');
    const riskStatus = bot.riskManager.getRiskStatus();
    
    console.log('\n=== 风险状态 ===');
    console.log(`紧急停止: ${riskStatus.emergencyStop ? '是' : '否'}`);
    console.log(`每日亏损: $${riskStatus.dailyLoss.toFixed(2)} / $${riskStatus.maxDailyLoss}`);
    console.log(`亏损比例: ${riskStatus.dailyLossPercent.toFixed(2)}%`);

    // 3. 查看持仓
    logger.info('Checking positions...');
    const [primaryPositions, hedgePositions] = await Promise.all([
      bot.primaryExchange.getPositions(),
      bot.hedgeExchange.getPositions(),
    ]);

    console.log('\n=== 当前持仓 ===');
    console.log(`Primary (${bot.primaryExchange.name}):`);
    if (primaryPositions.length === 0) {
      console.log('  无持仓');
    } else {
      primaryPositions.forEach(pos => {
        console.log(`  ${pos.symbol}: ${pos.side} ${pos.size}`);
      });
    }

    console.log(`\nHedge (${bot.hedgeExchange.name}):`);
    if (hedgePositions.length === 0) {
      console.log('  无持仓');
    } else {
      hedgePositions.forEach(pos => {
        console.log(`  ${pos.symbol}: ${pos.side} ${pos.size}`);
      });
    }

    // 4. 执行对冲（取消注释以实际执行）
    /*
    logger.info('Executing hedge...');
    const result = await bot.hedgeEngine.execute('BTC-PERP', 0.001, {
      slippage: 0.001,
      orderType: 'ioc',
    });

    if (result.success) {
      console.log('\n=== 对冲成功 ===');
      console.log(`执行时间: ${result.executionTime}ms`);
      console.log(`方向: Primary ${result.direction?.primarySide} / Hedge ${result.direction?.hedgeSide}`);
      console.log(`价格: Primary ${result.prices?.primary} / Hedge ${result.prices?.hedge}`);
    } else {
      console.log('\n=== 对冲失败 ===');
      console.log(`错误: ${result.error}`);
    }
    */

    logger.info('Example completed');

  } catch (error) {
    logger.error('Example failed', error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main();
}

export { main };
