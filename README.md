# Nado-Lighter 对冲交易机器人

一个专业的 Nado 与 Lighter 永续合约 DEX 之间的自动化对冲交易机器人，采用 Maker-Taker 策略实现低成本套利。

## ✨ 核心特性

- 🎯 **智能对冲策略**: Nado 限价单 (Maker) + Lighter 市价单 (Taker)
- 🔄 **完整状态机**: 精确管理订单生命周期（开仓→持仓→平仓）
- ⏱️ **超时保护**: 60秒自动撤单重挂机制，最多3次重试
- 📊 **实时监控**: React Dashboard 可视化界面
- 🛡️ **风险管理**: 滑点控制、敞口恢复、紧急停止机制
- 💰 **手续费优化**: Nado Maker返佣(-0.08%) + Lighter Taker(0.1%)
- 🔌 **WebSocket支持**: 实时价格推送和状态更新

## 🎬 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **Python**: >= 3.8 (Lighter SDK 依赖)
- **系统**: Linux / macOS / Windows (WSL)

### 1. 安装项目

```bash
# 克隆仓库
git clone https://github.com/your-username/nado-lighter-hedge.git
cd nado-lighter-hedge

# 安装主项目依赖
npm install

# 安装服务器依赖
cd server && npm install && cd ..

# 安装前端依赖
cd dashboard && npm install && cd ..
```

### 2. 安装 Lighter Python SDK

```bash
# 使用 pip 安装 Lighter SDK
pip install git+https://github.com/elliottech/lighter-python.git

# 或者使用 pip3
pip3 install git+https://github.com/elliottech/lighter-python.git
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，填入您的配置：

```bash
# ============ 交易所配置 ============

# Nado 配置
NADO_PRIVATE_KEY=0x你的Nado钱包私钥
NADO_NETWORK=inkMainnet

# Lighter 配置
API_KEY_PRIVATE_KEY=你的Lighter_API密钥
LIGHTER_ACCOUNT_INDEX=你的账户索引
LIGHTER_API_KEY_INDEX=你的API密钥索引

# ============ 对冲配置 ============

HEDGE_COIN=BTC
HEDGE_SIZE=0.01
NADO_ORDER_TIMEOUT=60000
NADO_MAX_RETRIES=3
LIGHTER_MAX_SLIPPAGE=0.005

# 循环配置
HEDGE_LOOP_HOLD_TIME=10    # 持仓时间(秒)
HEDGE_LOOP_INTERVAL=2      # 轮次间隔(秒)
```

### 4. 启动服务

#### 方式一：使用 Dashboard（推荐）

**终端 1 - 启动后端 API 服务器:**

```bash
cd /path/to/nado-lighter-hedge
node server/index.js
```

服务器将在 `http://localhost:3001` 启动

**终端 2 - 启动前端界面:**

```bash
cd /path/to/nado-lighter-hedge/dashboard
npm run dev
```

前端将在 `http://localhost:3000` 启动

打开浏览器访问 `http://localhost:3000` 即可使用可视化界面进行对冲交易。

#### 方式二：使用命令行

```bash
# 单次对冲（一次完整的开仓+平仓流程）
node strategies/run-hedge.js once BTC 0.01

# 循环对冲（执行10轮）
node strategies/run-hedge.js loop BTC 0.01 10

# 查看帮助
node strategies/run-hedge.js help
```

## 📁 项目结构

```
nado-lighter-hedge/
├── strategies/              # 核心策略代码
│   ├── hedge-strategy.js    # 主策略（状态机管理）
│   ├── nado-order-manager.js # Nado订单管理
│   ├── lighter-hedger.js    # Lighter对冲执行
│   └── run-hedge.js         # 命令行入口
├── server/                  # API服务器
│   ├── index.js             # Express服务器+WebSocket
│   └── package.json
├── dashboard/               # React前端
│   ├── src/
│   │   ├── App.jsx          # 主应用
│   │   ├── components/      # UI组件
│   │   └── store/           # Zustand状态管理
│   └── package.json
├── nado-sdk/                # Nado SDK封装
│   └── src/
│       ├── client.js        # Nado客户端
│       ├── orders.js        # 订单管理
│       └── price_feed.js    # 价格获取
├── lighter-sdk/             # Lighter SDK封装
│   ├── client.js            # Lighter客户端
│   ├── price_feed.js        # 价格获取
│   └── lighter_python.py    # Python SDK桥接
├── .env.example             # 环境变量模板
├── .gitignore               # Git忽略文件
└── README.md                # 本文档
```

## 🔧 API 端点

后端服务器提供以下 REST API：

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取当前配置 |
| POST | `/api/config` | 更新配置 |
| GET | `/api/status` | 获取运行状态 |
| GET | `/api/prices` | 获取当前价格 |
| POST | `/api/hedge/once` | 单次对冲 |
| POST | `/api/hedge/loop` | 循环对冲 |
| POST | `/api/hedge/stop` | 停止对冲 |

### WebSocket 事件

- `prices`: 实时价格更新
- `status`: 状态变化
- `log`: 日志推送
- `hedgeComplete`: 对冲完成
- `hedgeError`: 对冲错误

## 🎯 对冲流程

完整的对冲流程包含以下状态：

```
IDLE → PLACING_NADO → HEDGING_ON_LIGHTER → POSITION_OPENED 
     → CLOSING_NADO → CLOSING_LIGHTER → COMPLETED → IDLE
```

### 开仓阶段

1. **Nado 限价买单**: 在最优买价下单，等待成交
2. **Lighter 市价卖出**: Nado成交后立即在Lighter对冲
3. **持仓等待**: 保持对冲仓位一段时间

### 平仓阶段

4. **Nado 限价卖单**: 平掉Nado多头仓位
5. **Lighter 市价买入**: 同时平掉Lighter空头仓位
6. **计算PnL**: 统计本轮盈亏

## 💡 使用场景

### 1. 刷量交易

适合Nado和Lighter之间进行无风险刷量：

```bash
# 持仓时间5秒，轮次间隔2秒，执行100轮
curl -X POST http://localhost:3001/api/hedge/loop \
  -H "Content-Type: application/json" \
  -d '{
    "coin": "BTC",
    "size": 0.01,
    "rounds": 100,
    "holdTime": 5,
    "interval": 2
  }'
```

### 2. 套利交易

当两个交易所价差较大时执行套利：

```bash
# 单次对冲，捕捉价差
curl -X POST http://localhost:3001/api/hedge/once \
  -H "Content-Type: application/json" \
  -d '{
    "coin": "BTC",
    "size": 0.02
  }'
```

## 📊 支持的交易对

| 币种 | Nado Symbol | Lighter Symbol | Nado Product ID |
|------|-------------|----------------|-----------------|
| BTC | BTC-PERP | BTCUSD | 2 |
| ETH | ETH-PERP | ETHUSD | 4 |
| SOL | SOL-PERP | SOLUSD | 8 |

## 💰 手续费说明

- **Nado Maker**: -0.08% (返佣)
- **Lighter Taker**: 0.1%
- **净手续费**: 约 0.02% / 每次对冲

## ⚙️ 配置说明

### 核心参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `HEDGE_COIN` | 交易币种 | BTC |
| `HEDGE_SIZE` | 单笔数量 | 0.01 |
| `NADO_ORDER_TIMEOUT` | Nado订单超时(ms) | 60000 |
| `NADO_MAX_RETRIES` | 最大重试次数 | 3 |
| `LIGHTER_MAX_SLIPPAGE` | Lighter最大滑点 | 0.005 |
| `HEDGE_LOOP_HOLD_TIME` | 持仓时间(秒) | 10 |
| `HEDGE_LOOP_INTERVAL` | 轮次间隔(秒) | 10 |

### 价格策略

Nado支持三种价格策略：

- `best`: 最优价格（推荐）
- `mid`: 中间价
- `aggressive`: 激进价格

## 🛡️ 风险控制

1. **滑点保护**: Lighter订单设置最大滑点限制
2. **超时重试**: Nado订单60秒未成交自动撤单重挂
3. **敞口恢复**: Lighter对冲失败时自动重试恢复
4. **紧急停止**: 可随时中断对冲流程并平仓
5. **可中断睡眠**: 持仓等待期间可随时中断

## 🔍 监控与日志

### Dashboard 监控

访问 `http://localhost:3000` 可查看：

- 实时价格和价差
- 对冲执行状态
- 历史统计数据
- 系统日志

### 日志级别

服务器输出详细的执行日志：

```
[INFO] 开始对冲
[1.1] Nado 限价买单...
  ✓ 订单已提交: 0x...
  ✓ 订单完全成交！
[1.2] Lighter 市价卖出对冲...
  ✓ 对冲完成
[SUCCESS] 对冲任务完成
```

## 🚨 故障排查

### 常见问题

1. **Python SDK 导入失败**
   ```bash
   # 确认 Python 版本
   python --version  # 应该 >= 3.8
   
   # 重新安装 Lighter SDK
   pip install --upgrade git+https://github.com/elliottech/lighter-python.git
   ```

2. **REST API 429 错误**
   - 价格监控间隔已设置为5秒
   - 优先使用WebSocket获取价格
   - 避免频繁调用REST API

3. **Nado 订单未成交**
   - 检查价格策略设置
   - 增加超时时间
   - 查看市场深度

4. **Lighter 滑点过大**
   - 减小单笔数量
   - 调整最大滑点参数
   - 避免在波动大时交易

## 🔐 安全建议

1. **私钥安全**
   - 永远不要提交 `.env` 文件到 Git
   - 使用专用钱包，不要存放大额资金
   - 定期更换 API 密钥

2. **权限控制**
   - Lighter API Key 只授予交易权限
   - 不要授予提现权限

3. **资金管理**
   - 设置合理的单笔数量
   - 控制总持仓规模
   - 预留足够的保证金

## 📝 开发说明

### 技术栈

- **后端**: Node.js 18 + Express + Socket.io
- **前端**: React + Vite + Tailwind CSS + Zustand
- **SDK**: ethers.js, viem, lighter-python
- **类型**: TypeScript (部分)

### 运行测试

```bash
# 运行单元测试
npm test

# 构建 TypeScript
npm run build

# 开发模式
npm run dev
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## ⚠️ 免责声明

本软件仅供学习和研究使用。加密货币交易存在风险，使用本软件进行交易所产生的任何损失，开发者概不负责。请在充分了解风险的情况下使用本软件。

## 📮 联系方式

- GitHub Issues: [提交问题](https://github.com/your-username/nado-lighter-hedge/issues)
- Email: your-email@example.com

---

**Happy Trading! 🚀**
