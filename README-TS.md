# Nado-Lighter 对冲机器人 - TypeScript 版本

## 🎯 新版本特性

### ✨ 架构升级

- **TypeScript 支持**：完整的类型定义，更好的代码提示和错误检查
- **统一交易所接口**：`PerpExchange` 抽象层，方便扩展其他交易所
- **模块化设计**：清晰的目录结构，职责分离
- **结构化日志**：使用 `pino` 替代 `console.log`，支持日志级别和格式化
- **Telegram 通知**：实时推送交易、风险警告和错误信息

### 🛡️ 风控增强

- **最大持仓限制**：单边持仓和总敞口控制
- **滑点保护**：自动检查并拒绝超出阈值的订单
- **每日亏损限制**：达到阈值自动停止交易
- **紧急止损**：严重亏损时触发紧急停止
- **持仓不平衡检测**：监控两边持仓差异并告警

### 📊 功能完善

- **手续费分析**：实时计算含手续费的实际利润
- **重试机制**：网络错误自动重试
- **性能监控**：记录每次操作的执行时间
- **配置验证**：启动时检查配置完整性

## 📁 项目结构

```
nado-lighter-hedge/
├── src/                          # TypeScript 源码
│   ├── types/                    # 类型定义
│   │   └── index.ts
│   ├── config/                   # 配置管理
│   │   └── index.ts
│   ├── utils/                    # 工具函数
│   │   ├── logger.ts            # 日志模块
│   │   ├── telegram.ts          # Telegram 通知
│   │   └── helpers.ts           # 辅助函数
│   ├── risk/                     # 风控模块
│   │   └── risk-manager.ts
│   ├── exchanges/                # 交易所适配器
│   │   ├── base-exchange.ts     # 基类
│   │   ├── nado-adapter.ts      # Nado 适配器
│   │   └── lighter-adapter.ts   # Lighter 适配器
│   ├── core/                     # 核心引擎
│   │   └── hedge-engine.ts      # 对冲引擎
│   └── index.ts                  # 主入口
├── strategies/                   # 原有 JS 策略（保持兼容）
├── nado-sdk/                     # Nado SDK
├── lighter-sdk/                  # Lighter SDK
├── dist/                         # 编译输出
├── tsconfig.json                 # TypeScript 配置
├── package.json
├── .env.example
└── README-TS.md                  # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd nado-lighter-hedge
npm install
```

新增的依赖包括：
- `typescript` - TypeScript 编译器
- `ts-node` - 直接运行 TypeScript
- `pino` - 高性能日志库
- `node-telegram-bot-api` - Telegram 通知

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
nano .env
```

**必填配置：**
```env
NADO_PRIVATE_KEY=0x...
LIGHTER_PRIVATE_KEY=0x...
LIGHTER_ACCOUNT_INDEX=0
```

**可选配置：**
```env
# 风控
MAX_POSITION_SIZE=0.1
MAX_DAILY_LOSS=1000

# Telegram（可选）
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 日志
LOG_LEVEL=info
LOG_PRETTY=true
```

### 3. 运行 TypeScript 版本

#### 开发模式（直接运行 TS）

```bash
npm run dev
```

#### 编译后运行

```bash
# 编译
npm run build

# 运行编译后的代码
node dist/index.js
```

#### 使用 ts-node 运行

```bash
npm run start:ts
```

### 4. 原有 JS 版本仍然可用

```bash
# 原有的 CLI 工具仍然可以使用
node strategies/hedge_manager.js help
node strategies/hedge_manager.js spread BTC
```

## 📖 使用示例

### 示例 1：查看价差

```typescript
import { initBot } from './src';

async function checkSpread() {
  const bot = await initBot();
  const spread = await bot.hedgeEngine.getSpreadInfo('BTC-PERP');
  console.log(spread);
}

checkSpread();
```

### 示例 2：执行对冲

```typescript
import { initBot } from './src';

async function executeHedge() {
  const bot = await initBot();
  
  const result = await bot.hedgeEngine.execute('BTC-PERP', 0.002, {
    slippage: 0.001,
    orderType: 'ioc',
  });
  
  console.log('Hedge result:', result);
}

executeHedge();
```

### 示例 3：检查风险状态

```typescript
import { initBot } from './src';

async function checkRisk() {
  const bot = await initBot();
  const status = bot.riskManager.getRiskStatus();
  console.log('Risk status:', status);
}

checkRisk();
```

## 🔧 API 文档

### HedgeEngine

#### `execute(coin, size, options)`

执行对冲交易。

**参数：**
- `coin` (string): 币种，如 'BTC-PERP'
- `size` (number): 交易数量
- `options` (object):
  - `slippage` (number): 滑点，默认 0.001
  - `orderType` (OrderType): 订单类型，默认 'ioc'
  - `checkFill` (boolean): 是否检查成交，默认 true
  - `reverse` (boolean): 是否反向（平仓），默认 false

**返回：**
```typescript
{
  success: boolean;
  coin: string;
  size: number;
  direction?: HedgeDirection;
  prices?: { primary: number; hedge: number };
  orders?: { primary: Order; hedge: Order };
  executionTime: number;
  error?: string;
}
```

#### `getSpreadInfo(coin)`

获取价差信息。

**返回：**
```typescript
{
  coin: string;
  primary: SimplifiedBook;
  hedge: SimplifiedBook;
  priceDiff: number;
  priceDiffPercent: number;
  direction: string;
  feeAnalysis: {
    primaryFee: string;
    hedgeFee: string;
    profitA: number;
    profitB: number;
    bestProfit: number;
    bestProfitPercent: number;
  };
}
```

### RiskManager

#### `canOpenPosition(coin, size, price, currentPositions)`

检查是否可以开仓。

**返回：**
```typescript
{
  allowed: boolean;
  reason?: string;
}
```

#### `checkSlippage(expectedPrice, actualPrice, side)`

检查滑点是否可接受。

#### `recordLoss(loss)`

记录交易损失。

#### `getRiskStatus()`

获取风险状态。

### PerpExchange（交易所接口）

所有交易所适配器都实现此接口：

```typescript
interface PerpExchange {
  // 行情
  getOrderBook(symbol: string): Promise<OrderBook>;
  getSimplifiedBook(symbol: string): Promise<SimplifiedBook>;
  getMarkPrice(symbol: string): Promise<number>;
  
  // 订单
  placeOrder(params: PlaceOrderParams): Promise<Order>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  getOrder(orderId: string, symbol: string): Promise<Order>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  
  // 持仓
  getPosition(symbol: string): Promise<Position | null>;
  getPositions(): Promise<Position[]>;
  
  // 账户
  getAccountInfo(): Promise<AccountInfo>;
  getBalance(asset?: string): Promise<Balance[]>;
}
```

## 📱 Telegram 通知

### 设置 Telegram Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 获取 Bot Token
4. 获取你的 Chat ID（可以使用 [@userinfobot](https://t.me/userinfobot)）
5. 在 `.env` 中配置：

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
```

### 通知类型

- 🚀 **启动/停止通知**
- ✅ **交易成功/失败**
- ⚠️ **风险警告**（持仓不平衡、滑点过大等）
- 🚨 **紧急告警**（触发止损、每日亏损超限）
- ❌ **错误通知**
- 📊 **每日总结**

## 🛡️ 风控说明

### 持仓限制

```env
# 单边最大持仓（BTC 数量）
MAX_POSITION_SIZE=0.1

# 总敞口限制（所有币种加总）
MAX_TOTAL_EXPOSURE=1.0
```

### 亏损限制

```env
# 单笔最大亏损
MAX_LOSS_PER_TRADE=100

# 每日最大亏损
MAX_DAILY_LOSS=1000

# 紧急止损阈值（触发后停止所有交易）
EMERGENCY_STOP_LOSS=5000
```

### 滑点保护

```env
# 最大可接受滑点（0.005 = 0.5%）
MAX_SLIPPAGE=0.005
```

超出此滑点的订单会被拒绝。

## 📊 日志系统

### 日志级别

```env
LOG_LEVEL=info  # trace, debug, info, warn, error
```

### 日志类型

- **trade**: 交易相关日志
- **risk**: 风控相关日志
- **performance**: 性能监控日志

### 查看日志

```bash
# 开发环境（美化输出）
LOG_PRETTY=true npm run dev

# 生产环境（JSON 格式）
LOG_PRETTY=false npm start
```

## 🔄 迁移指南

### 从 JS 版本迁移到 TS 版本

1. **配置兼容**：`.env` 文件完全兼容，只需添加新的配置项
2. **API 兼容**：原有的 JS 策略仍然可以使用
3. **逐步迁移**：可以先使用 TS 版本的核心功能，保留 JS 版本的策略

### 扩展新交易所

1. 创建新的适配器类，继承 `BaseExchange`
2. 实现 `PerpExchange` 接口的所有方法
3. 在配置中添加新交易所的配置

示例：

```typescript
import { BaseExchange } from './base-exchange';

export class NewExchangeAdapter extends BaseExchange {
  constructor(apiKey: string, apiSecret: string) {
    super('new-exchange');
    // 初始化客户端
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    // 实现
  }

  // ... 实现其他方法
}
```

## 🐛 故障排查

### TypeScript 编译错误

```bash
# 清理并重新编译
rm -rf dist
npm run build
```

### 依赖问题

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 日志不显示

检查 `LOG_LEVEL` 设置，确保不是 `error` 级别。

### Telegram 通知不工作

1. 检查 `TELEGRAM_ENABLED=true`
2. 验证 Bot Token 和 Chat ID 正确
3. 确保机器人已启动（发送 `/start` 给你的 bot）

## 📈 性能优化

### 1. 使用编译后的代码

```bash
npm run build
node dist/index.js
```

编译后的代码比 ts-node 运行快 2-3 倍。

### 2. 调整日志级别

生产环境使用 `LOG_LEVEL=warn` 或 `error`。

### 3. 禁用美化输出

```env
LOG_PRETTY=false
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**注意**：本软件仅供学习和研究使用。使用本软件进行交易的任何损失由使用者自行承担。
