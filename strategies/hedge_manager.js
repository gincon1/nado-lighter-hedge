#!/usr/bin/env node
/**
 * Nado-Lighter 对冲管理器 CLI
 * 用于执行和管理 Nado 与 Lighter 之间的对冲操作
 */

require('dotenv').config();

const { NadoClient, NadoPriceFeed } = require('../nado-sdk/src/index');
const { LighterClient, LighterPriceFeed } = require('../lighter-sdk/index');
const HedgeOperations = require('./hedge_operations');

// 配置
const CONFIG = {
  // 默认参数
  coin: process.env.HEDGE_COIN || 'BTC',
  size: parseFloat(process.env.HEDGE_SIZE || '0.002'),
  slippage: parseFloat(process.env.HEDGE_SLIPPAGE || '0.001'),
  orderType: process.env.HEDGE_ORDER_TYPE || 'ioc',
  // 循环配置
  loopCount: parseInt(process.env.HEDGE_LOOP_COUNT || '1'),
  loopHoldTime: parseInt(process.env.HEDGE_LOOP_HOLD_TIME || '0'),
  loopInterval: parseInt(process.env.HEDGE_LOOP_INTERVAL || '0'),
  loopStopOnError: process.env.HEDGE_LOOP_STOP_ON_ERROR === 'true',
};

/**
 * Nado-Lighter 对冲管理器
 */
class HedgeManagerCLI {
  constructor() {
    this.config = CONFIG;
    this.clients = null;
    this.operations = null;
  }

  /**
   * 初始化客户端
   */
  initClients() {
    if (this.clients) return this.clients;

    // 检查环境变量
    if (!process.env.NADO_PRIVATE_KEY) {
      console.error('错误: 请设置 NADO_PRIVATE_KEY 环境变量');
      process.exit(1);
    }
    if (!process.env.API_KEY_PRIVATE_KEY) {
      console.error('错误: 请设置 API_KEY_PRIVATE_KEY 环境变量');
      process.exit(1);
    }

    // 初始化 Nado 客户端
    const nadoClient = new NadoClient(process.env.NADO_PRIVATE_KEY, {
      network: process.env.NADO_NETWORK || 'inkMainnet',
    });
    const nadoPriceFeed = new NadoPriceFeed(nadoClient);

    // 初始化 Lighter 客户端
    const lighterClient = new LighterClient(
      process.env.API_KEY_PRIVATE_KEY,
      parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
      parseInt(process.env.LIGHTER_API_KEY_INDEX || '0')
    );
    const lighterPriceFeed = new LighterPriceFeed(lighterClient);

    this.clients = { nadoClient, lighterClient, nadoPriceFeed, lighterPriceFeed };

    // 初始化操作类
    this.operations = new HedgeOperations(
      nadoClient,
      lighterClient,
      nadoPriceFeed,
      lighterPriceFeed
    );

    return this.clients;
  }

  /**
   * 显示使用帮助
   */
  showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         Nado-Lighter 对冲管理器 - 使用说明                ║
╚══════════════════════════════════════════════════════════╝

用法: node strategies/hedge_manager.js <command> [options]

命令:
  open [coin]              开仓（使用配置文件或指定币种）
  close <coin>             平仓指定币种
  roundtrip [coin]         往返对冲（开仓后立即平仓）
  loop [coin]              循环对冲（重复开平仓N次）
  spread [coin]            查看两边价差
  status                   查看两边持仓
  config                   显示当前配置
  list                     列出支持的币种
  help                     显示此帮助

选项:
  --coin, -c <coin>        币种（BTC/ETH/SOL等）
  --size, -s <size>        交易数量（覆盖配置）
  --count, -n <number>     循环次数（loop命令使用）
  --hold-time <seconds>    持仓时间（loop命令，开仓后等待多久再平仓）
  --interval, -i <seconds> 循环间隔（loop命令，每轮之间的间隔）
  --stop-on-error          失败时停止循环
  --auto-close <seconds>   自动平仓延迟（秒）
  --dry-run                模拟执行（不实际交易）
  --force, -f              强制执行（跳过确认）

示例:
  # 使用配置文件开仓
  node strategies/hedge_manager.js open

  # 指定币种和数量开仓
  node strategies/hedge_manager.js open --coin BTC --size 0.002

  # 开仓并在1小时后自动平仓
  node strategies/hedge_manager.js open --auto-close 3600

  # 往返对冲（立即往返）
  node strategies/hedge_manager.js roundtrip BTC

  # 循环对冲10次
  node strategies/hedge_manager.js loop BTC --count 10

  # 循环10次，每次间隔3秒
  node strategies/hedge_manager.js loop BTC -n 10 -i 3

  # 循环10次，持仓30秒后平仓，每轮间隔5秒
  node strategies/hedge_manager.js loop BTC -n 10 --hold-time 30 -i 5

  # 查看价差
  node strategies/hedge_manager.js spread BTC

  # 平仓
  node strategies/hedge_manager.js close BTC

  # 查看两边持仓
  node strategies/hedge_manager.js status

  # 显示配置
  node strategies/hedge_manager.js config
`);
  }

  /**
   * 解析命令行参数
   */
  parseArgs() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      return { command: 'help' };
    }

    const command = args[0];
    const params = {};

    // 解析选项
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.substring(2);
        const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : true;
        params[key] = value;
        if (value !== true) i++;
      } else if (arg.startsWith('-')) {
        const key = arg.substring(1);
        const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : true;

        // 短选项映射
        const shortMap = {
          'c': 'coin',
          's': 'size',
          'n': 'count',
          'i': 'interval',
          'f': 'force'
        };

        params[shortMap[key] || key] = value;
        if (value !== true) i++;
      } else if (!params.coin) {
        // 第一个非选项参数作为币种
        params.coin = arg;
      }
    }

    return { command, params };
  }

  /**
   * 用户确认
   */
  async confirm(message) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(`${message} [y/N]: `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * 等待指定秒数
   */
  sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * 执行命令
   */
  async execute() {
    const { command, params } = this.parseArgs();

    try {
      switch (command) {
        case 'open':
          await this.handleOpen(params);
          break;

        case 'close':
          await this.handleClose(params);
          break;

        case 'roundtrip':
          await this.handleRoundtrip(params);
          break;

        case 'loop':
          await this.handleLoop(params);
          break;

        case 'spread':
          await this.handleSpread(params);
          break;

        case 'status':
          await this.handleStatus();
          break;

        case 'config':
          this.showConfig();
          break;

        case 'list':
          this.listCoins();
          break;

        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(`\n❌ 错误: ${error.message}\n`);
      process.exit(1);
    }
  }

  /**
   * 处理开仓命令
   */
  async handleOpen(params) {
    const coin = (params.coin || this.config.coin).toUpperCase();
    const size = parseFloat(params.size || this.config.size);
    const autoClose = params['auto-close'];
    const dryRun = params['dry-run'];
    const force = params.force;

    // 确认
    if (!force && !dryRun) {
      console.log(`\n准备开仓:`);
      console.log(`  币种: ${coin}`);
      console.log(`  数量: ${size}`);
      console.log(`  滑点: ${(this.config.slippage * 100).toFixed(2)}%`);
      if (autoClose) {
        console.log(`  自动平仓: ${autoClose}秒后`);
      }
      console.log('');

      const confirmed = await this.confirm('确认执行?');
      if (!confirmed) {
        console.log('已取消\n');
        return;
      }
    }

    if (dryRun) {
      console.log('\n[模拟模式] 不会实际交易\n');
      return;
    }

    this.initClients();

    const options = {
      slippage: this.config.slippage,
      orderType: this.config.orderType,
    };

    const result = await this.operations.open(coin, size, options);

    // 自动平仓
    if (autoClose && result.success) {
      console.log(`\n⏰ ${autoClose}秒后自动平仓...`);
      await this.sleep(autoClose);
      await this.operations.close(coin, { ...options, size });
    }
  }

  /**
   * 处理平仓命令
   */
  async handleClose(params) {
    const coin = (params.coin || this.config.coin).toUpperCase();
    const size = params.size ? parseFloat(params.size) : undefined;
    const force = params.force;

    // 确认
    if (!force) {
      console.log(`\n准备平仓:`);
      console.log(`  币种: ${coin}`);
      if (size) {
        console.log(`  数量: ${size}`);
      } else {
        console.log(`  数量: 全部持仓`);
      }
      console.log('');

      const confirmed = await this.confirm('确认执行?');
      if (!confirmed) {
        console.log('已取消\n');
        return;
      }
    }

    this.initClients();

    const options = {
      slippage: this.config.slippage,
      orderType: this.config.orderType,
    };

    if (size) {
      options.size = size;
    }

    await this.operations.close(coin, options);
  }

  /**
   * 处理往返对冲命令
   */
  async handleRoundtrip(params) {
    const coin = (params.coin || this.config.coin).toUpperCase();
    const size = parseFloat(params.size || this.config.size);
    const force = params.force;

    // 确认
    if (!force) {
      console.log(`\n准备往返对冲:`);
      console.log(`  币种: ${coin}`);
      console.log(`  数量: ${size}`);
      console.log(`  模式: 立即开仓 → 立即平仓`);
      console.log('');

      const confirmed = await this.confirm('确认执行?');
      if (!confirmed) {
        console.log('已取消\n');
        return;
      }
    }

    this.initClients();

    const options = {
      slippage: this.config.slippage,
      orderType: this.config.orderType,
    };

    await this.operations.roundtrip(coin, size, options);
  }

  /**
   * 处理循环对冲命令
   */
  async handleLoop(params) {
    const coin = (params.coin || this.config.coin).toUpperCase();
    const size = parseFloat(params.size || this.config.size);
    const count = parseInt(params.count || this.config.loopCount);
    const holdTime = parseInt(params['hold-time'] || this.config.loopHoldTime);
    const interval = parseInt(params.interval || this.config.loopInterval);
    const stopOnError = params['stop-on-error'] || this.config.loopStopOnError;
    const force = params.force;

    // 验证循环次数
    if (!count || count < 1) {
      throw new Error('请指定循环次数: --count <number> 或 -n <number>');
    }

    if (count > 100) {
      throw new Error('循环次数不能超过100次');
    }

    // 确认
    if (!force) {
      console.log(`\n准备循环对冲:`);
      console.log(`  币种: ${coin}`);
      console.log(`  数量: ${size}`);
      console.log(`  循环次数: ${count}`);
      if (holdTime > 0) {
        console.log(`  持仓时间: ${holdTime}秒`);
      }
      if (interval > 0) {
        console.log(`  循环间隔: ${interval}秒`);
      }
      console.log(`  失败停止: ${stopOnError ? '是' : '否'}`);
      console.log('');

      const confirmed = await this.confirm('确认执行?');
      if (!confirmed) {
        console.log('已取消\n');
        return;
      }
    }

    this.initClients();

    const options = {
      slippage: this.config.slippage,
      orderType: this.config.orderType,
    };

    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i <= count; i++) {
      console.log(`\n╔════════════════════════════════════════╗`);
      console.log(`║           第 ${i}/${count} 轮对冲              ║`);
      console.log(`╚════════════════════════════════════════╝`);

      try {
        // 开仓
        console.log('\n--- 开仓 ---');
        const openResult = await this.operations.open(coin, size, options);

        if (!openResult.success) {
          throw new Error('开仓失败');
        }

        // 持仓等待
        if (holdTime > 0) {
          console.log(`\n⏰ 持仓等待 ${holdTime} 秒...`);
          await this.sleep(holdTime);
        }

        // 平仓
        console.log('\n--- 平仓 ---');
        const closeResult = await this.operations.close(coin, { ...options, size });

        if (!closeResult.success) {
          throw new Error('平仓失败');
        }

        successCount++;
        console.log(`\n✅ 第 ${i} 轮完成`);

      } catch (error) {
        failCount++;
        console.error(`\n❌ 第 ${i} 轮失败: ${error.message}`);

        if (stopOnError) {
          console.log('\n⚠️ 失败停止模式，中止循环');
          break;
        }
      }

      // 循环间隔
      if (i < count && interval > 0) {
        console.log(`\n⏳ 等待 ${interval} 秒后开始下一轮...`);
        await this.sleep(interval);
      }
    }

    // 统计
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║              循环对冲完成               ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`  成功: ${successCount} 轮`);
    console.log(`  失败: ${failCount} 轮`);
    console.log(`  成功率: ${(successCount / (successCount + failCount) * 100).toFixed(1)}%\n`);
  }

  /**
   * 处理价差查询命令
   */
  async handleSpread(params) {
    const coin = (params.coin || this.config.coin).toUpperCase();

    this.initClients();

    const spread = await this.operations.executor.getSpreadInfo(coin);

    console.log(`\n=== ${coin} 价差信息 ===`);
    console.log('┌────────────┬────────────────┬────────────────┐');
    console.log('│            │     Nado       │    Lighter     │');
    console.log('├────────────┼────────────────┼────────────────┤');
    console.log(`│ 买一 (Bid) │ ${spread.nado.bid.toFixed(2).padStart(14)} │ ${spread.lighter.bid.toFixed(2).padStart(14)} │`);
    console.log(`│ 卖一 (Ask) │ ${spread.nado.ask.toFixed(2).padStart(14)} │ ${spread.lighter.ask.toFixed(2).padStart(14)} │`);
    console.log(`│ 中间价     │ ${spread.nado.mid.toFixed(2).padStart(14)} │ ${spread.lighter.mid.toFixed(2).padStart(14)} │`);
    console.log('└────────────┴────────────────┴────────────────┘');
    console.log(`\n价差: ${spread.priceDiff.toFixed(2)} (${spread.priceDiffPercent.toFixed(4)}%)`);
    
    // 显示手续费分析
    if (spread.feeAnalysis) {
      console.log(`\n=== 含手续费分析 ===`);
      console.log(`Nado 手续费: ${spread.feeAnalysis.nadoFee} | Lighter 手续费: ${spread.feeAnalysis.lighterFee}`);
      console.log(`方案A (Nado买+Lighter卖): ${spread.feeAnalysis.profitA.toFixed(4)}/单位`);
      console.log(`方案B (Nado卖+Lighter买): ${spread.feeAnalysis.profitB.toFixed(4)}/单位`);
      console.log(`最佳利润: ${spread.feeAnalysis.bestProfit.toFixed(4)}/单位 (${spread.feeAnalysis.bestProfitPercent.toFixed(4)}%)`);
    }
    
    console.log(`\n推荐方向: ${spread.direction}\n`);
  }

  /**
   * 处理持仓查询命令
   */
  async handleStatus() {
    this.initClients();

    console.log('\n=== 账户持仓状态 ===\n');

    // Nado 持仓
    console.log('--- Nado ---');
    try {
      const nadoInfo = await this.clients.nadoClient.getSubaccountInfo();
      if (nadoInfo.perp_balances) {
        const positions = nadoInfo.perp_balances.filter(b => b.balance.amount !== '0');
        if (positions.length === 0) {
          console.log('无持仓');
        } else {
          positions.forEach(pos => {
            const amount = parseFloat(pos.balance.amount) / 1e18;
            console.log(`  Product ${pos.product_id}: ${amount > 0 ? '+' : ''}${amount.toFixed(6)}`);
          });
        }
      }
    } catch (error) {
      console.log(`  获取失败: ${error.message}`);
    }

    // Lighter 持仓
    console.log('\n--- Lighter ---');
    try {
      const lighterPositions = await this.clients.lighterClient.getPositions();
      if (!lighterPositions || lighterPositions.length === 0) {
        console.log('无持仓');
      } else {
        let hasPosition = false;
        lighterPositions.forEach(pos => {
          const size = parseFloat(pos.size || 0);
          if (size !== 0) {
            hasPosition = true;
            const symbol = Object.keys(this.operations.executor.symbolMap).find(
              key => this.operations.executor.symbolMap[key] === pos.symbol
            ) || pos.symbol;
            console.log(`  ${symbol}: ${size > 0 ? '+' : ''}${size.toFixed(6)}`);
          }
        });
        if (!hasPosition) {
          console.log('无持仓');
        }
      }
    } catch (error) {
      console.log(`  获取失败: ${error.message}`);
    }

    console.log('');
  }

  /**
   * 显示配置
   */
  showConfig() {
    console.log('\n=== 当前配置 ===');
    console.log(`默认币种: ${this.config.coin}`);
    console.log(`默认数量: ${this.config.size}`);
    console.log(`默认滑点: ${(this.config.slippage * 100).toFixed(2)}%`);
    console.log(`默认订单类型: ${this.config.orderType}`);
    console.log(`\n循环配置:`);
    console.log(`  循环次数: ${this.config.loopCount}`);
    console.log(`  持仓时间: ${this.config.loopHoldTime}秒`);
    console.log(`  循环间隔: ${this.config.loopInterval}秒`);
    console.log(`  失败停止: ${this.config.loopStopOnError ? '是' : '否'}`);
    console.log(`\n环境变量:`);
    console.log(`  Nado 网络: ${process.env.NADO_NETWORK || 'inkMainnet'}`);
    console.log(`  Nado 私钥: ${process.env.NADO_PRIVATE_KEY ? '已设置' : '未设置'}`);
    console.log(`  Lighter 私钥: ${process.env.API_KEY_PRIVATE_KEY ? '已设置' : '未设置'}`);
    console.log(`  Lighter 账户索引: ${process.env.LIGHTER_ACCOUNT_INDEX || '0'}\n`);
  }

  /**
   * 列出支持的币种
   */
  listCoins() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    支持的币种                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const coins = ['BTC', 'ETH', 'SOL'];

    console.log('两边都支持的币种:');
    console.log(`  ${coins.join(', ')}\n`);
  }
}

// 主函数
async function main() {
  const cli = new HedgeManagerCLI();
  await cli.execute();
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = HedgeManagerCLI;
