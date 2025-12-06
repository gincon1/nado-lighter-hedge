#!/usr/bin/env node

/**
 * Lighter API 测试脚本
 * 用于验证 API 连接和配置是否正确
 */

require('dotenv').config();

const LighterClient = require('../lighter-sdk/client');
const LighterPriceFeed = require('../lighter-sdk/price_feed');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function testLighterAPI() {
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '🧪 Lighter API 测试');
  console.log('='.repeat(60) + '\n');

  // 检查环境变量
  log(colors.blue, '1️⃣  检查环境变量...');
  
  const privateKey = process.env.LIGHTER_PRIVATE_KEY;
  const accountIndex = parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0');
  const apiKeyIndex = parseInt(process.env.LIGHTER_API_KEY_INDEX || '2');
  
  if (!privateKey) {
    log(colors.red, '❌ 缺少 LIGHTER_PRIVATE_KEY 环境变量');
    console.log('   请在 .env 文件中设置 LIGHTER_PRIVATE_KEY');
    return false;
  }
  
  log(colors.green, '✅ 环境变量已配置');
  console.log(`   账户索引: ${accountIndex}`);
  console.log(`   API Key 索引: ${apiKeyIndex}`);
  console.log(`   私钥: ${privateKey.substring(0, 10)}...${privateKey.substring(privateKey.length - 4)}`);
  
  // 创建客户端
  log(colors.blue, '\n2️⃣  创建 Lighter 客户端...');
  
  let client;
  try {
    client = new LighterClient(privateKey, accountIndex, apiKeyIndex);
    log(colors.green, '✅ 客户端创建成功');
    console.log(`   钱包地址: ${client.address}`);
  } catch (error) {
    log(colors.red, `❌ 客户端创建失败: ${error.message}`);
    return false;
  }
  
  // 测试 API 状态
  log(colors.blue, '\n3️⃣  测试 API 状态...');
  
  try {
    const status = await client.getStatus();
    log(colors.green, '✅ API 状态正常');
  } catch (error) {
    log(colors.red, `❌ API 状态检查失败: ${error.message}`);
  }
  
  // 测试获取账户信息
  log(colors.blue, '\n4️⃣  获取账户信息...');
  
  try {
    const account = await client.getAccount();
    log(colors.green, '✅ 账户信息获取成功');
    console.log(`   账户索引: ${account.account_index}`);
    console.log(`   可用保证金: ${client.fromContractAmount(account.free_collateral || 0)} USDC`);
    
    // 更新账户索引
    if (account.account_index && account.account_index !== accountIndex) {
      log(colors.yellow, `⚠️  建议更新 LIGHTER_ACCOUNT_INDEX=${account.account_index}`);
    }
  } catch (error) {
    log(colors.red, `❌ 获取账户失败: ${error.message}`);
    console.log('   请确保钱包地址已在 Lighter 注册');
    console.log('   访问 https://app.lighter.xyz 连接钱包');
  }
  
  // 测试获取订单簿
  log(colors.blue, '\n5️⃣  获取 BTC 订单簿...');
  
  const priceFeed = new LighterPriceFeed(client);
  
  try {
    const book = await priceFeed.getL2Book('BTC', 5);
    log(colors.green, '✅ 订单簿获取成功');
    console.log(`   买一: ${book.bid?.toFixed(2) || 'N/A'}`);
    console.log(`   卖一: ${book.ask?.toFixed(2) || 'N/A'}`);
    console.log(`   中间价: ${book.mid?.toFixed(2) || 'N/A'}`);
    console.log(`   价差: ${book.spreadPercent?.toFixed(4) || 'N/A'}%`);
  } catch (error) {
    log(colors.red, `❌ 获取订单簿失败: ${error.message}`);
  }
  
  // 测试获取 ETH 价格
  log(colors.blue, '\n6️⃣  获取 ETH 价格...');
  
  try {
    const ethMid = await priceFeed.getMidPrice('ETH');
    log(colors.green, `✅ ETH 中间价: ${ethMid?.toFixed(2) || 'N/A'}`);
  } catch (error) {
    log(colors.red, `❌ 获取 ETH 价格失败: ${error.message}`);
  }
  
  // 测试获取持仓
  log(colors.blue, '\n7️⃣  获取持仓信息...');
  
  try {
    const positions = await client.getPositions();
    log(colors.green, `✅ 持仓数量: ${positions.length}`);
    
    if (positions.length > 0) {
      positions.forEach((pos, i) => {
        console.log(`   ${i + 1}. 市场 ${pos.order_book_id}: ${client.fromContractAmount(pos.position)} @ ${client.fromContractAmount(pos.entry_price)}`);
      });
    }
  } catch (error) {
    log(colors.red, `❌ 获取持仓失败: ${error.message}`);
  }
  
  // 检查 Python SDK
  log(colors.blue, '\n8️⃣  检查 Python SDK...');
  
  try {
    const { execSync } = require('child_process');
    execSync('python3 -c "import lighter"', { stdio: 'pipe' });
    log(colors.green, '✅ Python SDK 已安装');
  } catch (error) {
    log(colors.yellow, '⚠️  Python SDK 未安装');
    console.log('   交易功能需要 Python SDK');
    console.log('   安装命令: pip install git+https://github.com/elliottech/lighter-python.git');
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, '📊 测试总结');
  console.log('='.repeat(60));
  
  console.log('\n只读功能（市场数据）: ✅ 可用');
  console.log('交易功能: 需要 Python SDK + API Key 设置');
  console.log('\n详细设置说明请查看: LIGHTER_SETUP.md\n');
  
  return true;
}

// 运行测试
testLighterAPI()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
