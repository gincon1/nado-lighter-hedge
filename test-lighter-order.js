require('dotenv').config();
const LighterClient = require('./lighter-sdk/client');
const axios = require('axios');

async function test() {
  const apiKey = process.env.API_KEY_PRIVATE_KEY;
  const accountIndex = parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '221138');
  const apiKeyIndex = parseInt(process.env.LIGHTER_API_KEY_INDEX || '2');

  console.log('=== 测试 Lighter 下单 ===');
  console.log('API Key:', apiKey ? apiKey.slice(0,10) + '...' : 'NOT SET');
  console.log('Account Index:', accountIndex);
  console.log('API Key Index:', apiKeyIndex);

  const client = new LighterClient(apiKey, accountIndex, apiKeyIndex);

  // 获取 BTC 市场信息
  const marketsRes = await axios.get('https://mainnet.zklighter.elliot.ai/api/v1/orderBooks');
  const btcMarket = marketsRes.data.order_books.find(m => m.symbol === 'BTC');
  
  if (!btcMarket) {
    console.log('❌ 找不到 BTC 市场');
    return;
  }

  // 获取当前价格（通过 recentTrades）
  const tradesRes = await axios.get('https://mainnet.zklighter.elliot.ai/api/v1/recentTrades?market_id=1&limit=1');
  const lastPrice = parseFloat(tradesRes.data.trades[0].price);

  console.log('\nBTC 市场信息:');
  console.log('  market_id:', btcMarket.market_id);
  console.log('  size_decimals:', btcMarket.supported_size_decimals);
  console.log('  price_decimals:', btcMarket.supported_price_decimals);
  console.log('  当前价格:', lastPrice);
  
  const orderPrice = Math.floor(lastPrice * 1.005);  // 加 0.5% 滑点
  
  console.log('\n下单参数:');
  console.log('  价格:', lastPrice, '→ 下单价:', orderPrice);
  console.log('  数量: 0.01 BTC');
  
  try {
    const result = await client.createOrder({
      symbol: 'BTC',
      side: 'buy',
      amount: '0.01',
      price: orderPrice.toString(),
      time_in_force: 'ioc'
    });
    console.log('\n✅ 下单结果:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('\n❌ 下单失败:', err.message);
  }
  
  // 等待 2 秒后查询最近订单
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('\n=== 查询最近订单 ===');
  const ordersRes = await axios.get(`https://mainnet.zklighter.elliot.ai/api/v1/accountInactiveOrders?account_index=${accountIndex}&order_book_id=1&limit=5`);
  if (ordersRes.data.orders && ordersRes.data.orders.length > 0) {
    for (const o of ordersRes.data.orders) {
      const side = o.is_ask ? 'SELL' : 'BUY';
      const size = (parseFloat(o.base_amount) / 1e5).toFixed(5);
      const price = parseFloat(o.price) / 10;
      console.log(`${o.created_at} | ${side} | ${size} BTC @ ${price} | ${o.order_state}`);
    }
  } else {
    console.log('无历史订单');
  }
}

test().catch(console.error);
