/**
 * 测试对冲交易执行
 */
require('dotenv').config();

const { NadoAdapter } = require('./dist/exchanges/nado-adapter');
const { LighterAdapter } = require('./dist/exchanges/lighter-adapter');
const { loadConfig } = require('./dist/config');

async function testHedgeExecution() {
  console.log('=== 对冲交易执行测试 ===\n');
  
  const config = loadConfig();
  
  // 初始化适配器
  const nado = new NadoAdapter(config.primary.privateKey);
  const lighter = new LighterAdapter(
    config.hedge.privateKey,
    config.hedge.accountIndex,
    config.hedge.apiKeyIndex
  );
  
  // 获取两边价格
  console.log('1. 获取两边价格...');
  const [nadoBook, lighterBook] = await Promise.all([
    nado.getSimplifiedBook('BTC-PERP'),
    lighter.getSimplifiedBook('BTC-PERP')
  ]);
  
  console.log('   Nado:   Bid', nadoBook.bid, '/ Ask', nadoBook.ask);
  console.log('   Lighter: Bid', lighterBook.bid, '/ Ask', lighterBook.ask);
  console.log('   价差:', (nadoBook.mid - lighterBook.mid).toFixed(2), 'USD');
  
  // 计算下单价格（加滑点）
  const slippage = 0.005;  // 0.5%
  const nadoBuyPrice = nadoBook.ask * (1 + slippage);
  const lighterSellPrice = lighterBook.bid * (1 - slippage);
  
  console.log('\n2. 下单参数:');
  console.log('   Nado 买入价:', nadoBuyPrice.toFixed(1));
  console.log('   Lighter 卖出价:', lighterSellPrice.toFixed(1));
  console.log('   数量: 0.01 BTC');
  
  // 执行对冲
  console.log('\n3. 执行对冲交易...');
  
  try {
    const [nadoResult, lighterResult] = await Promise.all([
      nado.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        type: 'ioc',
        size: 0.01,
        price: nadoBuyPrice
      }),
      lighter.placeOrder({
        symbol: 'BTC-PERP',
        side: 'sell',
        type: 'market',
        size: 0.01,
        price: lighterSellPrice
      })
    ]);
    
    console.log('\n✅ Nado 订单:', nadoResult.orderId);
    console.log('✅ Lighter 订单:', lighterResult.orderId);
    
  } catch (err) {
    console.log('\n❌ 对冲执行失败:', err.message);
  }
  
  // 等待并查询持仓
  console.log('\n4. 等待 3 秒后查询持仓...');
  await new Promise(r => setTimeout(r, 3000));
  
  const [nadoPositions, lighterPositions] = await Promise.all([
    nado.getPositions(),
    lighter.getPositions()
  ]);
  
  console.log('\n=== 当前持仓 ===');
  console.log('Nado:', nadoPositions.length > 0 ? nadoPositions : '无');
  console.log('Lighter:', lighterPositions.length > 0 ? lighterPositions : '无');
  
  console.log('\n测试完成!');
}

testHedgeExecution().catch(console.error);
