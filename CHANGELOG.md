# 更新日志

## [2.0.0] - 2024-12-07

### 🎉 重大更新：TypeScript 重构

#### 新增功能

##### 架构升级
- ✨ **TypeScript 支持**：完整的类型定义和类型检查
- 🏗️ **模块化架构**：清晰的目录结构和职责分离
- 🔌 **统一交易所接口**：`PerpExchange` 抽象层，方便扩展
- 📦 **配置管理系统**：统一的配置加载和验证

##### 风控系统
- 🛡️ **持仓限制**：单边持仓和总敞口控制
- 📊 **滑点保护**：自动检查并拒绝超出阈值的订单
- 💰 **亏损限制**：单笔和每日亏损限制
- 🚨 **紧急止损**：严重亏损时自动停止交易
- ⚖️ **持仓平衡检测**：监控两边持仓差异

##### 日志和监控
- 📝 **结构化日志**：使用 `pino` 替代 `console.log`
- 📱 **Telegram 通知**：实时推送交易、风险和错误信息
- ⏱️ **性能监控**：记录每次操作的执行时间
- 🎨 **美化输出**：开发环境友好的日志格式

##### 工具和辅助
- 🔄 **重试机制**：网络错误自动重试
- 🧮 **手续费分析**：实时计算含手续费的实际利润
- 🔧 **配置验证**：启动时检查配置完整性
- 📖 **示例代码**：完整的使用示例

#### 改进

##### 代码质量
- 类型安全：所有接口都有完整的 TypeScript 类型定义
- 错误处理：统一的错误处理和日志记录
- 代码复用：抽象基类减少重复代码
- 可测试性：模块化设计便于单元测试

##### 性能优化
- 并发请求：使用 `Promise.all` 并行获取数据
- 缓存机制：缓存 productId 等频繁查询的数据
- 编译优化：TypeScript 编译后性能提升

##### 用户体验
- 清晰的错误提示
- 详细的配置说明
- 完整的文档和示例
- 向后兼容原有 JS 版本

#### 新增文件

```
src/
├── types/index.ts              # 类型定义
├── config/index.ts             # 配置管理
├── utils/
│   ├── logger.ts              # 日志系统
│   ├── telegram.ts            # Telegram 通知
│   └── helpers.ts             # 工具函数
├── risk/
│   └── risk-manager.ts        # 风控管理器
├── exchanges/
│   ├── base-exchange.ts       # 交易所基类
│   ├── nado-adapter.ts        # Nado 适配器
│   └── lighter-adapter.ts     # Lighter 适配器
├── core/
│   └── hedge-engine.ts        # 对冲引擎
├── examples/
│   └── simple-hedge.ts        # 使用示例
├── test-setup.ts              # 配置测试工具
└── index.ts                   # 主入口

文档:
├── README-TS.md               # TypeScript 版本文档
├── MIGRATION.md               # 迁移指南
└── CHANGELOG.md               # 本文件

脚本:
├── install-ts.sh              # TypeScript 安装脚本
└── tsconfig.json              # TypeScript 配置
```

#### 新增依赖

```json
{
  "dependencies": {
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "node-telegram-bot-api": "^0.64.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0"
  }
}
```

#### 新增配置项

```env
# 风控配置
MAX_POSITION_SIZE=0.1
MAX_TOTAL_EXPOSURE=1.0
MAX_OPEN_ORDERS=10
MAX_SLIPPAGE=0.005
MAX_LOSS_PER_TRADE=100
MAX_DAILY_LOSS=1000
EMERGENCY_STOP_LOSS=5000

# 手续费配置
NADO_TAKER_FEE=0.0015
NADO_MAKER_FEE=-0.0008
LIGHTER_TAKER_FEE=0.001
LIGHTER_MAKER_FEE=0
MIN_PROFIT_THRESHOLD=0

# Telegram 通知
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# 日志配置
LOG_LEVEL=info
LOG_PRETTY=true
NODE_ENV=development
```

#### 新增命令

```bash
# TypeScript 相关
npm run build          # 编译 TypeScript
npm run dev            # 开发模式运行
npm run start:ts       # 运行 TypeScript 版本
npm test               # 测试配置
npm run example        # 运行示例

# 安装
./install-ts.sh        # 一键安装 TypeScript 版本
```

#### 向后兼容

- ✅ 原有的 JS 版本完全保留
- ✅ 所有原有命令继续可用
- ✅ `.env` 配置向后兼容
- ✅ 可以逐步迁移，不需要一次性切换

#### 文档

- 📖 `README-TS.md`：TypeScript 版本完整文档
- 📖 `MIGRATION.md`：从 JS 迁移到 TS 的详细指南
- 📖 `CHANGELOG.md`：本更新日志
- 📖 示例代码：`src/examples/simple-hedge.ts`

### 使用方法

#### 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 测试配置
npm test

# 3. 运行示例
npm run example

# 4. 开发模式
npm run dev
```

#### 继续使用 JS 版本

```bash
# 原有命令完全不变
node strategies/hedge_manager.js spread BTC
node strategies/hedge_manager.js open --coin BTC --size 0.002
```

### 已知问题

- TypeScript 编译可能需要几秒钟，开发时建议使用 `ts-node`
- Telegram 通知需要先创建 Bot 并获取 Token

### 下一步计划

- [ ] WebSocket 实时订单跟踪
- [ ] 网格策略实现
- [ ] 多账户支持
- [ ] Web 管理界面
- [ ] 回测系统
- [ ] 更多交易所支持

---

## [1.0.0] - 2024-12-01

### 初始版本

- ✅ 基本的对冲功能
- ✅ Nado 和 Lighter 集成
- ✅ CLI 管理工具
- ✅ 循环对冲
- ✅ PM2 部署支持
