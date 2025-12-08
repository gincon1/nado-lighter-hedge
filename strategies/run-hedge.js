#!/usr/bin/env node
/**
 * 新版对冲策略 CLI
 * 使用重构后的状态机和 60 秒超时重挂机制
 */

require('dotenv').config();

const { NadoClient, NadoPriceFeed } = require('../nado-sdk/src/index');
const { LighterClient, LighterPriceFeed } = require('../lighter-sdk/index');
const { HedgeStrategy } = require('./hedge-strategy');

// 配置
const CONFIG = {
  coin: process.env.HEDGE_COIN || 'BTC',
  size: parseFloat(process.env.HEDGE_SIZE || '0.0013'),
  
  // Nado 参数
  nadoOrderTimeout: parseInt(process.env.NADO_ORDER_TIMEOUT || '60000'),  // 60 秒
  nadoMaxRetries: parseInt(process.env.NADO_MAX_RETRIES || '3'),
  nadoPriceStrategy: process.env.NADO_PRICE_STRATEGY || 'best',
  
  // Lighter 参数
  lighterMaxSlippage: parseFloat(process.env.LIGHTER_MAX_SLIPPAGE || '0.005'),
  
  // 循环参数
  holdTime: parseInt(process.env.HEDGE_LOOP_HOLD_TIME || '0') * 1000,
  interval: parseInt(process.env.HEDGE_LOOP_INTERVAL || '3') * 1000,
};

/**
 * 初始化客户端
 */
function initClients() {
  // 检查环境变量
  if (!process.env.NADO_PRIVATE_KEY) {
    console.error('错误: 请设置 NADO_PRIVATE_KEY 环境变量');
    process.exit(1);
  }
  
  const lighterPrivateKey = process.env.API_KEY_PRIVATE_KEY || process.env.LIGHTER_PRIVATE_KEY;
  if (!lighterPrivateKey) {
    console.error('错误: 请设置 API_KEY_PRIVATE_KEY 或 LIGHTER_PRIVATE_KEY 环境变量');
    process.exit(1);
  }

  // 初始化 Nado 客户端
  const nadoClient = new NadoClient(process.env.NADO_PRIVATE_KEY, {
    network: process.env.NADO_NETWORK || 'inkMainnet',
  });
  const nadoPriceFeed = new NadoPriceFeed(nadoClient);

  // 初始化 Lighter 客户端
  const lighterClient = new LighterClient(
    lighterPrivateKey,
    parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
    parseInt(process.env.LIGHTER_API_KEY_INDEX || '0')
  );
  const lighterPriceFeed = new LighterPriceFeed(lighterClient);

  return { nadoClient, lighterClient, nadoPriceFeed, lighterPriceFeed };
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Nado-Lighter 对冲策略 v2.0 (状态机版)                 ║
╚══════════════════════════════════════════════════════════╝

用法: node strategies/run-hedge.js <command> [options]

命令:
  once [coin] [size]       执行一次完整对冲（开仓+平仓）
  loop [coin] [size] [n]   循环对冲 n 轮
  help                     显示此帮助

示例:
  # 执行一次 BTC 对冲
  node strategies/run-hedge.js once BTC 0.0013

  # 循环对冲 5 轮
  node strategies/run-hedge.js loop BTC 0.0013 5

配置（通过 .env 或环境变量）:
  HEDGE_COIN=BTC              默认币种
  HEDGE_SIZE=0.0013           默认数量
  NADO_ORDER_TIMEOUT=60000    Nado 订单超时（毫秒）
  NADO_MAX_RETRIES=3          Nado 最大重试次数
  NADO_PRICE_STRATEGY=best    价格策略 (best/mid/aggressive)
  LIGHTER_MAX_SLIPPAGE=0.005  Lighter 最大滑点
  HEDGE_LOOP_HOLD_TIME=0      持仓时间（秒）
  HEDGE_LOOP_INTERVAL=3       循环间隔（秒）
`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help') {
    showHelp();
    return;
  }

  const command = args[0];
  const coin = (args[1] || CONFIG.coin).toUpperCase();
  const size = parseFloat(args[2] || CONFIG.size);
  const rounds = parseInt(args[3] || '1');

  // 初始化
  const { nadoClient, lighterClient, nadoPriceFeed, lighterPriceFeed } = initClients();
  
  const strategy = new HedgeStrategy(
    nadoClient,
    lighterClient,
    nadoPriceFeed,
    lighterPriceFeed,
    {
      nadoOrderTimeout: CONFIG.nadoOrderTimeout,
      nadoMaxRetries: CONFIG.nadoMaxRetries,
      nadoPriceStrategy: CONFIG.nadoPriceStrategy,
      lighterMaxSlippage: CONFIG.lighterMaxSlippage,
      holdTime: CONFIG.holdTime,
    }
  );

  try {
    switch (command) {
      case 'once':
        console.log(`\n执行单次对冲: ${coin} ${size}`);
        await strategy.runOnce(coin, size);
        break;

      case 'loop':
        console.log(`\n执行循环对冲: ${coin} ${size} x ${rounds} 轮`);
        await strategy.runLoop({
          coin,
          size,
          rounds,
          interval: CONFIG.interval,
          holdTime: CONFIG.holdTime,
          stopOnError: true,
        });
        break;

      default:
        console.error(`未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n致命错误:', error.message);
    process.exit(1);
  }
}

// 运行
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
