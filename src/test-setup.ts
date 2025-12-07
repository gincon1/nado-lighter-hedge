/**
 * 测试安装和配置
 */

import { loadConfig, validateConfig } from './config';
import { logger } from './utils/logger';

async function testSetup() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Nado-Lighter 配置测试工具          ║');
  console.log('╚════════════════════════════════════════╝\n');

  let hasErrors = false;

  // 1. 测试配置加载
  console.log('📋 测试 1: 加载配置...');
  try {
    const config = loadConfig();
    console.log('✅ 配置加载成功\n');

    // 2. 测试配置验证
    console.log('📋 测试 2: 验证配置...');
    try {
      validateConfig(config);
      console.log('✅ 配置验证通过\n');
    } catch (error) {
      console.error('❌ 配置验证失败:');
      console.error((error as Error).message);
      console.log('');
      hasErrors = true;
    }

    // 3. 显示配置摘要
    console.log('📊 配置摘要:');
    console.log('─────────────────────────────────────');
    console.log(`主交易所: ${config.primary.name}`);
    console.log(`  网络: ${config.primary.network}`);
    console.log(`  私钥: ${config.primary.privateKey ? '已设置 (' + config.primary.privateKey.substring(0, 10) + '...)' : '未设置'}`);
    
    console.log(`\n对冲交易所: ${config.hedge.name}`);
    console.log(`  账户索引: ${config.hedge.accountIndex}`);
    console.log(`  私钥: ${config.hedge.privateKey ? '已设置 (' + config.hedge.privateKey.substring(0, 10) + '...)' : '未设置'}`);
    
    console.log(`\n交易对: ${config.pairs.length} 个`);
    config.pairs.forEach(pair => {
      console.log(`  - ${pair.coin}: ${pair.primarySymbol} ↔ ${pair.hedgeSymbol}`);
    });

    console.log(`\n风控配置:`);
    console.log(`  最大持仓: ${config.risk.maxPositionSize}`);
    console.log(`  最大敞口: ${config.risk.maxTotalExposure}`);
    console.log(`  最大滑点: ${(config.risk.maxSlippage * 100).toFixed(2)}%`);
    console.log(`  每日最大亏损: $${config.risk.maxDailyLoss}`);

    console.log(`\n策略配置: ${config.strategies.length} 个`);
    config.strategies.forEach(strategy => {
      console.log(`  - ${strategy.name}: ${strategy.coin} ${strategy.size} (${strategy.enabled ? '启用' : '禁用'})`);
    });

    console.log(`\nTelegram 通知: ${config.telegram?.enabled ? '启用' : '禁用'}`);
    if (config.telegram?.enabled) {
      console.log(`  Bot Token: ${config.telegram.botToken ? '已设置' : '未设置'}`);
      console.log(`  Chat ID: ${config.telegram.chatId || '未设置'}`);
    }

    console.log(`\n日志配置:`);
    console.log(`  级别: ${config.logging?.level || 'info'}`);
    console.log(`  美化输出: ${config.logging?.pretty ? '是' : '否'}`);
    console.log('─────────────────────────────────────\n');

    // 4. 测试日志系统
    console.log('📋 测试 3: 日志系统...');
    logger.info('测试 info 级别日志');
    logger.debug('测试 debug 级别日志');
    logger.warn('测试 warn 级别日志');
    console.log('✅ 日志系统正常\n');

    // 5. 测试 Telegram（如果启用）
    if (config.telegram?.enabled) {
      console.log('📋 测试 4: Telegram 通知...');
      try {
        const { initTelegram } = await import('./utils/telegram');
        const telegram = initTelegram(config.telegram.botToken, config.telegram.chatId);
        await telegram.send('🧪 测试消息：Nado-Lighter 配置测试');
        console.log('✅ Telegram 通知发送成功\n');
      } catch (error) {
        console.error('❌ Telegram 通知失败:');
        console.error((error as Error).message);
        console.log('');
        hasErrors = true;
      }
    } else {
      console.log('⏭️  跳过测试 4: Telegram 未启用\n');
    }

    // 6. 测试交易所连接（可选）
    console.log('📋 测试 5: 交易所连接（可选）...');
    console.log('提示: 此测试需要有效的私钥和网络连接');
    console.log('如需测试，请运行: npm run dev\n');

  } catch (error) {
    console.error('❌ 配置加载失败:');
    console.error((error as Error).message);
    console.log('');
    hasErrors = true;
  }

  // 总结
  console.log('╔════════════════════════════════════════╗');
  if (hasErrors) {
    console.log('║     ⚠️  测试完成（有错误）              ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('请检查上述错误并修复配置。\n');
    console.log('常见问题：');
    console.log('1. 确保 .env 文件存在并包含所有必需配置');
    console.log('2. 检查私钥格式是否正确（应以 0x 开头）');
    console.log('3. 如果启用 Telegram，确保 Bot Token 和 Chat ID 正确\n');
    process.exit(1);
  } else {
    console.log('║     ✅ 所有测试通过！                   ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('配置正确！你可以开始使用机器人了。\n');
    console.log('下一步：');
    console.log('1. 查看价差: npm run dev');
    console.log('2. 运行示例: ts-node src/examples/simple-hedge.ts');
    console.log('3. 查看文档: cat README-TS.md\n');
    process.exit(0);
  }
}

// 运行测试
if (require.main === module) {
  testSetup().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}

export { testSetup };
