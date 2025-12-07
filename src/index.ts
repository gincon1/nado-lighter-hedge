/**
 * Nado-Lighter 对冲机器人主入口
 */

import { loadConfig, validateConfig } from './config';
import { NadoAdapter } from './exchanges/nado-adapter';
import { LighterAdapter } from './exchanges/lighter-adapter';
import { HedgeEngine } from './core/hedge-engine';
import { RiskManager } from './risk/risk-manager';
import { logger } from './utils/logger';
import { initTelegram } from './utils/telegram';

/**
 * 初始化机器人
 */
export async function initBot() {
  try {
    // 1. 加载配置
    logger.info('Loading configuration...');
    const config = loadConfig();
    validateConfig(config);
    
    logger.info('Configuration loaded', {
      primary: config.primary.name,
      hedge: config.hedge.name,
      pairs: config.pairs.length,
      strategies: config.strategies.length,
    });

    // 2. 初始化 Telegram
    if (config.telegram?.enabled) {
      logger.info('Initializing Telegram notifier...');
      initTelegram(config.telegram.botToken, config.telegram.chatId);
    }

    // 3. 初始化交易所适配器
    logger.info('Initializing exchange adapters...');
    
    const primaryExchange = new NadoAdapter(
      config.primary.privateKey,
      config.primary.network
    );

    const hedgeExchange = new LighterAdapter(
      config.hedge.privateKey,
      config.hedge.accountIndex,
      config.hedge.apiKeyIndex
    );

    // 4. 初始化风控管理器
    logger.info('Initializing risk manager...');
    const riskManager = new RiskManager(config.risk);

    // 5. 初始化对冲引擎
    logger.info('Initializing hedge engine...');
    const hedgeEngine = new HedgeEngine(
      primaryExchange,
      hedgeExchange,
      riskManager
    );

    logger.info('Bot initialized successfully');

    return {
      config,
      primaryExchange,
      hedgeExchange,
      hedgeEngine,
      riskManager,
    };

  } catch (error) {
    logger.error('Failed to initialize bot', error);
    throw error;
  }
}

/**
 * 主函数
 */
export async function main() {
  logger.info('Starting Nado-Lighter Hedge Bot...');

  try {
    const bot = await initBot();

    // 发送启动通知
    const telegram = initTelegram(
      bot.config.telegram?.botToken,
      bot.config.telegram?.chatId
    );
    await telegram.notifyStart('Nado-Lighter Hedge Bot');

    // 交易配置 (从 .env 读取)
    const coin = process.env.HEDGE_COIN || 'BTC';
    const symbol = `${coin}-PERP`;
    const size = parseFloat(process.env.HEDGE_SIZE || '0.001');
    const loopCount = parseInt(process.env.HEDGE_LOOP_COUNT || '10');
    const holdTime = parseInt(process.env.HEDGE_LOOP_HOLD_TIME || '10') * 1000;
    const loopInterval = parseInt(process.env.HEDGE_LOOP_INTERVAL || '10') * 1000;
    const slippage = parseFloat(process.env.HEDGE_SLIPPAGE || '0.001');
    const orderType = (process.env.HEDGE_ORDER_TYPE || 'ioc') as 'ioc' | 'limit' | 'market';
    const stopOnError = process.env.HEDGE_LOOP_STOP_ON_ERROR === 'true';

    logger.info('Trading config', {
      symbol,
      size,
      loopCount,
      holdTime: `${holdTime/1000}s`,
      loopInterval: `${loopInterval/1000}s`,
      slippage,
      orderType,
    });

    // 显示初始价差
    const spreadInfo = await bot.hedgeEngine.getSpreadInfo(symbol);
    logger.info('Initial spread info', spreadInfo);

    // 交易循环
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i <= loopCount; i++) {
      logger.info(`\n========== 第 ${i}/${loopCount} 轮 ==========`);

      try {
        // 1. 开仓
        logger.info('→ 开仓...');
        const openResult = await bot.hedgeEngine.execute(symbol, size, {
          slippage,
          orderType,
          checkFill: false,
        });

        if (!openResult.success) {
          throw new Error(`开仓失败: ${openResult.error}`);
        }

        logger.info('✓ 开仓成功', {
          direction: openResult.direction,
          prices: openResult.prices,
          executionTime: `${openResult.executionTime}ms`,
        });

        // 2. 持仓等待
        logger.info(`→ 持仓 ${holdTime/1000} 秒...`);
        await sleep(holdTime);

        // 3. 平仓
        logger.info('→ 平仓...');
        const closeResult = await bot.hedgeEngine.execute(symbol, size, {
          slippage,
          orderType,
          checkFill: false,
          reverse: true,
        });

        if (!closeResult.success) {
          throw new Error(`平仓失败: ${closeResult.error}`);
        }

        logger.info('✓ 平仓成功', {
          direction: closeResult.direction,
          prices: closeResult.prices,
          executionTime: `${closeResult.executionTime}ms`,
        });

        successCount++;
        logger.info(`✓ 第 ${i} 轮完成 (成功: ${successCount}, 失败: ${errorCount})`);

      } catch (error) {
        errorCount++;
        logger.error(`✗ 第 ${i} 轮失败: ${(error as Error).message}`);
        
        if (stopOnError) {
          logger.error('配置了错误时停止，退出循环');
          break;
        }
      }

      // 下一轮前等待
      if (i < loopCount) {
        logger.info(`→ 等待 ${loopInterval/1000} 秒后开始下一轮...`);
        await sleep(loopInterval);
      }
    }

    // 统计
    logger.info('\n========== 交易统计 ==========');
    logger.info(`总计: ${loopCount} 轮`);
    logger.info(`成功: ${successCount} 轮`);
    logger.info(`失败: ${errorCount} 轮`);
    logger.info(`成功率: ${((successCount / loopCount) * 100).toFixed(1)}%`);

    await telegram.notifyStop('Nado-Lighter Hedge Bot', `完成 ${successCount}/${loopCount} 轮`);
    
    logger.info('Bot finished.');

  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

/**
 * 等待函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}
