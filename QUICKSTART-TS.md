# TypeScript 版本快速入门

## 🚀 5 分钟快速开始

### 步骤 1：安装（1 分钟）

```bash
cd nado-lighter-hedge
./install-ts.sh
```

或手动安装：

```bash
npm install
```

### 步骤 2：配置（2 分钟）

编辑 `.env` 文件：

```bash
nano .env
```

**最小配置**（必填）：

```env
NADO_PRIVATE_KEY=0x你的Nado私钥
LIGHTER_PRIVATE_KEY=0x你的Lighter私钥
LIGHTER_ACCOUNT_INDEX=0
```

### 步骤 3：测试配置（30 秒）

```bash
npm test
```

如果看到 "✅ 所有测试通过！"，说明配置正确。

### 步骤 4：查看价差（30 秒）

```bash
npm run example
```

你会看到：
- BTC 在两个交易所的价格
- 价差和利润分析
- 当前持仓状态
- 风险状态

### 步骤 5：执行对冲（1 分钟）

编辑 `src/examples/simple-hedge.ts`，取消注释对冲代码：

```typescript
// 找到这段代码并取消注释
const result = await bot.hedgeEngine.execute('BTC-PERP', 0.001, {
  slippage: 0.001,
  orderType: 'ioc',
});
```

然后运行：

```bash
npm run example
```

## 🎯 常用命令

### 开发和测试

```bash
# 测试配置
npm test

# 运行示例
npm run example

# 开发模式（自动重启）
npm run dev

# 编译 TypeScript
npm run build
```

### 原有 JS 版本

```bash
# 查看价差
node strategies/hedge_manager.js spread BTC

# 开仓
node strategies/hedge_manager.js open --coin BTC --size 0.002

# 平仓
node strategies/hedge_manager.js close BTC

# 循环对冲
node strategies/hedge_manager.js loop BTC -n 10 -i 5
```

## 📊 查看价差和利润

### 使用 TypeScript

```typescript
import { initBot } from './src';

const bot = await initBot();
const spread = await bot.hedgeEngine.getSpreadInfo('BTC-PERP');

console.log(`价差: ${spread.priceDiff.toFixed(2)}`);
console.log(`利润: ${spread.feeAnalysis.bestProfit.toFixed(4)}/单位`);
```

### 使用 JS CLI

```bash
node strategies/hedge_manager.js spread BTC
```

## 🛡️ 启用风控

在 `.env` 中配置：

```env
# 最大持仓（BTC 数量）
MAX_POSITION_SIZE=0.1

# 每日最大亏损（美元）
MAX_DAILY_LOSS=1000

# 最大滑点
MAX_SLIPPAGE=0.005
```

风控会自动生效，超出限制的订单会被拒绝。

## 📱 启用 Telegram 通知

### 1. 创建 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 并按提示操作
3. 获取 Bot Token（类似：`123456:ABC-DEF...`）

### 2. 获取 Chat ID

1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 发送任意消息
3. 获取你的 Chat ID（纯数字）

### 3. 配置

在 `.env` 中：

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
```

### 4. 测试

```bash
npm test
```

你会收到一条测试消息。

## 📝 查看日志

### 开发环境（美化输出）

```bash
LOG_PRETTY=true npm run dev
```

### 生产环境（JSON 格式）

```bash
LOG_PRETTY=false npm run start:ts
```

### 调整日志级别

```env
LOG_LEVEL=debug  # trace, debug, info, warn, error
```

## 🔄 执行对冲

### 简单对冲

```typescript
import { initBot } from './src';

const bot = await initBot();

// 开仓
await bot.hedgeEngine.execute('BTC-PERP', 0.002, {
  slippage: 0.001,
  orderType: 'ioc',
});

// 平仓
await bot.hedgeEngine.execute('BTC-PERP', 0.002, {
  slippage: 0.001,
  orderType: 'ioc',
  reverse: true,
});
```

### 循环对冲

```typescript
import { initBot } from './src';
import { sleep } from './src/utils/helpers';

const bot = await initBot();

for (let i = 0; i < 10; i++) {
  console.log(`第 ${i + 1} 轮`);
  
  // 开仓
  await bot.hedgeEngine.execute('BTC-PERP', 0.002);
  
  // 等待 30 秒
  await sleep(30000);
  
  // 平仓
  await bot.hedgeEngine.execute('BTC-PERP', 0.002, { reverse: true });
  
  // 间隔 5 秒
  await sleep(5000);
}
```

## 🚨 常见问题

### Q: npm test 失败

**A**: 检查 `.env` 文件是否存在，私钥是否正确。

### Q: 编译错误

**A**: 清理并重新安装：

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Q: Telegram 通知不工作

**A**: 
1. 确保 `TELEGRAM_ENABLED=true`
2. 检查 Bot Token 和 Chat ID
3. 给你的 bot 发送 `/start`

### Q: 如何回到 JS 版本

**A**: 直接使用原有命令：

```bash
node strategies/hedge_manager.js spread BTC
```

## 📚 下一步

- 📖 阅读完整文档：`cat README-TS.md`
- 🔄 查看迁移指南：`cat MIGRATION.md`
- 📝 查看更新日志：`cat CHANGELOG.md`
- 💡 查看示例代码：`src/examples/simple-hedge.ts`

## 🆘 获取帮助

遇到问题？

1. 运行 `npm test` 检查配置
2. 查看日志输出
3. 阅读文档
4. 提交 Issue

---

**祝交易顺利！🚀**
