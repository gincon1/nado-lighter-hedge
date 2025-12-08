# Nado 取消订单指南

## 问题背景

在使用 Nado 交易所时，限价单下单后无法取消的问题。

## 原因分析

### 1. 订单类型问题

Nado 支持以下订单类型：

| 类型 | 说明 | 能否取消 |
|------|------|----------|
| `default` | GTC (Good Till Cancel) | ✅ 可以取消 |
| `ioc` | Immediate or Cancel | ❌ 立即成交或取消，无法手动取消 |
| `fok` | Fill or Kill | ❌ 全部成交或取消，无法手动取消 |
| `post_only` | 只做 Maker | ✅ 可以取消 |

**重要**：如果使用 `ioc` 订单类型，订单会立即尝试成交，未成交部分会自动取消，所以无法再手动取消。

### 2. API 返回格式

Nado API 返回的格式和预期不同：

```javascript
// getAllProducts() 返回
{
  spot_products: [...],
  perp_products: [...]  // 我们需要的是这个
}

// getSubaccountOrders() 返回
{
  sender: "0x...",
  product_id: 2,
  orders: [...]  // 我们需要的是这个
}
```

SDK 已修复，现在会自动提取正确的数组。

### 3. 最小订单金额

Nado 的最小订单金额是 **100 USD**。

```javascript
// 计算最小订单数量
const minNotional = 100;  // USD
const minSize = minNotional / price;
```

## 正确的取消订单流程

### 1. 下单时使用 GTC 类型

```javascript
const orderResult = await client.placePerpOrder({
  productId: 2,  // BTC-PERP
  price: 85000,
  size: 0.002,
  side: 'buy',
  orderType: 'default',  // 使用 GTC，不是 ioc
  expirationSeconds: 0,  // 0 = GTC
});

const digest = orderResult.digest;
console.log('订单 digest:', digest);
```

### 2. 取消单个订单

```javascript
const cancelResult = await client.cancelOrder(productId, digest);
console.log('取消结果:', cancelResult);
```

### 3. 取消某个产品的所有订单

```javascript
const cancelResult = await client.cancelProductOrders([productId]);
console.log('取消结果:', cancelResult);
```

## 产品 ID 映射

Nado 的产品 ID 是固定的：

| 币种 | Product ID |
|------|------------|
| BTC | 2 |
| ETH | 4 |
| SOL | 8 |
| ... | ... |

## 完整示例

```javascript
const { NadoClient, NadoPriceFeed } = require('./nado-sdk/src/index');

async function example() {
  const client = new NadoClient(process.env.NADO_PRIVATE_KEY, {
    network: 'inkMainnet',
  });
  const priceFeed = new NadoPriceFeed(client);

  const productId = 2;  // BTC-PERP
  const symbol = 'BTC-PERP';

  // 1. 获取价格
  const book = await priceFeed.getL2Book(symbol);
  console.log('当前价格:', book.bestBid, '/', book.bestAsk);

  // 2. 下单（使用 GTC 类型）
  const testPrice = Math.floor(book.bestBid * 0.95);  // 低于市场价 5%
  const testSize = 0.002;  // 确保 > 100 USD

  const orderResult = await client.placePerpOrder({
    productId,
    price: testPrice,
    size: testSize,
    side: 'buy',
    orderType: 'default',  // GTC
  });

  const digest = orderResult.digest;
  console.log('下单成功, digest:', digest);

  // 3. 查看挂单
  const orders = await client.getSubaccountOrders(productId);
  console.log('当前挂单:', orders.length);

  // 4. 取消订单
  const cancelResult = await client.cancelOrder(productId, digest);
  console.log('取消成功:', cancelResult.cancelled_orders?.length);

  // 5. 确认取消
  const ordersAfter = await client.getSubaccountOrders(productId);
  console.log('取消后挂单:', ordersAfter.length);
}

example().catch(console.error);
```

## 常见错误

### 1. "Order not found"

订单可能已经成交或被取消。检查：
- 订单类型是否是 `ioc` 或 `fok`
- 订单是否已经成交
- digest 是否正确

### 2. "Invalid order size"

订单金额太小。确保：
- `size * price >= 100 USD`

### 3. "Invalid signature"

签名问题。检查：
- 私钥是否正确
- 网络是否匹配（inkMainnet vs inkTestnet）

## 测试脚本

运行测试脚本验证取消订单功能：

```bash
cd nado-lighter-hedge
node test-cancel-order.js
```

## SDK 修复记录

### 修复 1: getAllProducts() 返回格式

```javascript
// 修复前
async getAllProducts() {
  return await this._query(...);  // 返回 { spot_products, perp_products }
}

// 修复后
async getAllProducts() {
  const result = await this._query(...);
  return result.perp_products || [];  // 返回 perp_products 数组
}
```

### 修复 2: getSubaccountOrders() 返回格式

```javascript
// 修复前
async getSubaccountOrders(productId) {
  return await this._query(...);  // 返回 { sender, product_id, orders }
}

// 修复后
async getSubaccountOrders(productId) {
  const result = await this._query(...);
  return result.orders || [];  // 返回 orders 数组
}
```

### 修复 3: cancelOrders() 参数格式

```javascript
// 确保 productIds 是数字数组
productIds: productIds.map(id => Number(id))

// 确保 digests 是正确的 bytes32 格式
const formattedDigests = digests.map(d => {
  if (typeof d === 'string' && d.startsWith('0x') && d.length === 66) {
    return d;
  }
  // ...
});
```

## 总结

1. **使用 `default` 订单类型**（GTC），不要使用 `ioc`
2. **确保订单金额 >= 100 USD**
3. **保存 `digest`** 用于后续取消
4. **使用正确的 `productId`**

如有问题，请运行 `test-cancel-order.js` 进行诊断。
