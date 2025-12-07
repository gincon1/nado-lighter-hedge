# 迁移指南：从 JS 版本到 TypeScript 版本

## 概述

本指南帮助你从现有的 JavaScript 版本平滑迁移到新的 TypeScript 版本。

**好消息**：两个版本可以共存！你可以继续使用原有的 JS 脚本，同时逐步采用 TS 版本的新功能。

## 主要变化

### 1. 项目结构

```
旧版本（JS）:
├── strategies/
│   ├── hedge_manager.js
│   ├── hedge_executor.js
│   └── hedge_operations.js
├── nado-sdk/
└── lighter-sdk/

新版本（TS）:
├── src/                    # 新增 TypeScript 源码
│   ├── types/
│   ├── config/
│   ├── utils/
│   ├── risk/
│   ├── exchanges/
│   ├── core/
│   └── index.ts
├── strategies/             # 保留原有 JS 代码
├── nado-sdk/
└── lighter-sdk/
```

### 2. 配置管理

**旧版本**：直接从 `.env` 读取

```javascript
const coin = process.env.HEDGE_COIN || 'BTC';
const size = parseFloat(process.env.HEDGE_SIZE || '0.002');
```

**新版本**：统一配置管理

```typescript
import { loadConfig } from './config';

const config = loadConfig();
const strategy = config.strategies[0];
console.log(strategy.coin, strategy.size);
```

### 3. 交易所客户端

**旧版本**：直接使用 SDK

```javascript
const { NadoClient } = require('../nado-sdk/src/index');
const nadoClient = new NadoClient(privateKey, { network });
```

**新版本**：使用适配器

```typescript
import { NadoAdapter } from './exchanges/nado-adapter';

const nadoExchange = new NadoAdapter(privateKey, network);
// 统一接口
const book = await nadoExchange.getOrderBook('BTC-PERP');
const position = await nadoExchange.getPosition('BTC-PERP');
```

### 4. 日志系统

**旧版本**：console.log

```javascript
console.log('✅ 对冲执行完成');
console.error('❌ 对冲执行失败:', error.message);
```

**新版本**：结构化日志

```typescript
import { logger } from './utils/logger';

logger.info('Hedge execution completed', { executionTime, fillStatus });
logger.error('Hedge execution failed', error);
```

### 5. 风控

**旧版本**：简单的参数检查

```javascript
if (size > MAX_SIZE) {
  throw new Error('Size too large');
}
```

**新版本**：完整的风控系统

```typescript
import { RiskManager } from './risk/risk-manager';

const riskManager = new RiskManager(config.risk);
const check = riskManager.canOpenPosition(coin, size, price, positions);

if (!check.allowed) {
  throw new Error(check.reason);
}
```

## 迁移步骤

### 步骤 1：安装新依赖

```bash
cd nado-lighter-hedge
npm install
```

这会安装 TypeScript 和其他新依赖，但不会影响现有功能。

### 步骤 2：更新 .env 配置

在现有 `.env` 文件中添加新的配置项：

```bash
# 风控配置（新增）
MAX_POSITION_SIZE=0.1
MAX_TOTAL_EXPOSURE=1.0
MAX_DAILY_LOSS=1000

# Telegram 通知（可选）
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# 日志配置（新增）
LOG_LEVEL=info
LOG_PRETTY=true
```

### 步骤 3：测试 TypeScript 版本

不影响现有功能的情况下测试新版本：

```bash
# 编译 TypeScript
npm run build

# 运行示例
npm run dev
```

### 步骤 4：逐步迁移策略

你可以选择：

**选项 A：继续使用 JS 版本**

```bash
# 原有命令完全不变
node strategies/hedge_manager.js spread BTC
node strategies/hedge_manager.js open --coin BTC --size 0.002
```

**选项 B：使用 TS 版本的新功能**

```typescript
// 创建新的策略文件 src/strategies/my-strategy.ts
import { initBot } from '../index';

async function myStrategy() {
  const bot = await initBot();
  
  // 使用新的 API
  const spread = await bot.hedgeEngine.getSpreadInfo('BTC-PERP');
  
  if (spread.feeAnalysis.bestProfit > 0) {
    await bot.hedgeEngine.execute('BTC-PERP', 0.002);
  }
}
```

**选项 C：混合使用**

在 JS 代码中导入 TS 模块：

```javascript
// strategies/my-js-strategy.js
const { initBot } = require('../dist/index');

async function main() {
  const bot = await initBot();
  // 使用 TS 版本的功能
}
```

## 功能对照表

| 功能 | JS 版本 | TS 版本 |
|------|---------|---------|
| 查看价差 | `hedge_manager.js spread BTC` | `bot.hedgeEngine.getSpreadInfo('BTC-PERP')` |
| 开仓 | `hedge_manager.js open` | `bot.hedgeEngine.execute(coin, size)` |
| 平仓 | `hedge_manager.js close BTC` | `bot.hedgeEngine.execute(coin, size, { reverse: true })` |
| 查看持仓 | `hedge_manager.js status` | `bot.primaryExchange.getPositions()` |
| 循环对冲 | `hedge_manager.js loop BTC -n 10` | 自己实现循环逻辑 |
| 风控检查 | 无 | `bot.riskManager.canOpenPosition()` |
| Telegram 通知 | 无 | 自动发送 |
| 结构化日志 | console.log | `logger.info()` |

## 常见问题

### Q: 我必须迁移到 TS 版本吗？

**A**: 不必须。JS 版本会继续维护，你可以继续使用。TS 版本提供了更好的类型安全和新功能，但不是强制的。

### Q: 两个版本可以同时运行吗？

**A**: 可以。它们共享相同的 SDK 和配置，但使用不同的入口点。

### Q: 如何在 JS 中使用 TS 的新功能？

**A**: 先编译 TS 代码（`npm run build`），然后在 JS 中 require 编译后的文件：

```javascript
const { initBot } = require('./dist/index');
```

### Q: TypeScript 编译失败怎么办？

**A**: 可以使用 `ts-node` 直接运行，不需要编译：

```bash
npm run dev
```

### Q: 如何添加自定义策略？

**A**: 

**JS 方式**：在 `strategies/` 目录下创建新的 `.js` 文件

**TS 方式**：在 `src/strategies/` 目录下创建新的 `.ts` 文件

### Q: 配置文件需要改动吗？

**A**: `.env` 文件向后兼容，只需添加新的配置项即可。

## 推荐迁移路径

### 阶段 1：熟悉新功能（1-2 天）

1. 安装依赖
2. 运行示例代码
3. 查看日志输出
4. 测试 Telegram 通知

### 阶段 2：并行运行（1 周）

1. 保持 JS 版本运行
2. 同时运行 TS 版本监控
3. 对比两个版本的行为
4. 调整配置

### 阶段 3：逐步切换（2-4 周）

1. 将部分策略迁移到 TS
2. 利用新的风控功能
3. 启用 Telegram 通知
4. 优化日志级别

### 阶段 4：完全迁移（可选）

1. 所有策略使用 TS 版本
2. 移除旧的 JS 策略文件
3. 使用 PM2 运行 TS 版本

## 回滚方案

如果遇到问题，可以随时回滚到 JS 版本：

```bash
# 停止 TS 版本
pm2 stop nado-lighter-hedge-ts

# 启动 JS 版本
pm2 start strategies/hedge_manager.js --name nado-lighter-hedge-js -- loop BTC -n 1000 -i 10
```

## 获取帮助

- 查看 `README-TS.md` 了解 TS 版本详细文档
- 查看 `src/examples/` 目录下的示例代码
- 遇到问题请提交 Issue

---

**记住**：迁移是可选的，按照自己的节奏进行！
