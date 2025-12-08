# Nado-Lighter 对冲机器人

Nado 和 Lighter 永续合约 DEX 之间的对冲交易机器人。

## 功能特点

- Nado 限价单 (Maker) → Lighter 市价单 (Taker) 对冲
- 60秒超时自动撤单重挂机制
- 完整状态机管理
- 实时 Dashboard 监控界面

## 环境要求

- Node.js >= 18
- Python 3.8+ (Lighter SDK 需要)
- Lighter Python SDK: `pip install git+https://github.com/elliottech/lighter-python.git`

## 安装步骤

```bash
# 克隆项目
git clone https://github.com/gincon1/nado-lighter-hedge.git
cd nado-lighter-hedge

# 安装主项目依赖
npm install

# 安装服务器依赖
cd server && npm install && cd ..

# 安装前端依赖
cd dashboard && npm install && cd ..
```

## 配置

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
# Nado 配置
NADO_PRIVATE_KEY=你的私钥
NADO_NETWORK=inkMainnet

# Lighter 配置
API_KEY_PRIVATE_KEY=你的lighter_api_key
LIGHTER_ACCOUNT_INDEX=你的账户索引
LIGHTER_API_KEY_INDEX=2

# 对冲参数
HEDGE_COIN=BTC
HEDGE_SIZE=0.0013
NADO_ORDER_TIMEOUT=60000
NADO_MAX_RETRIES=3
LIGHTER_MAX_SLIPPAGE=0.005
HEDGE_LOOP_HOLD_TIME=10
HEDGE_LOOP_INTERVAL=10
```

## 使用方法

### 命令行模式

```bash
# 单次对冲（开仓+平仓）
node strategies/run-hedge.js once BTC 0.0013

# 循环对冲 5 轮
node strategies/run-hedge.js loop BTC 0.0013 5

# 查看帮助
node strategies/run-hedge.js help
```

### Dashboard 模式

需要打开两个终端：

**终端 1 - 启动 API 服务器：**

```bash
cd nado-lighter-hedge
node server/index.js
```

服务器运行在 http://localhost:3001

**终端 2 - 启动前端：**

```bash
cd nado-lighter-hedge/dashboard
npm run dev
```

前端运行在 http://localhost:3000

打开浏览器访问 http://localhost:3000 即可使用 Dashboard。

## 项目结构

```
nado-lighter-hedge/
├── strategies/          # 核心策略代码
│   ├── run-hedge.js     # 命令行入口
│   ├── hedge-strategy.js    # 主策略（状态机）
│   ├── nado-order-manager.js # Nado订单管理
│   └── lighter-hedger.js    # Lighter对冲执行
├── server/              # API 服务器
├── dashboard/           # React 前端
├── nado-sdk/            # Nado SDK
├── lighter-sdk/         # Lighter SDK
└── docs/                # 文档
```

## 支持的币种

| 币种 | Nado Product ID |
|------|-----------------|
| BTC  | 2 |
| ETH  | 4 |
| SOL  | 8 |

## 手续费

- Nado Maker: -0.08% (返佣)
- Lighter Taker: 0.1%

## License

MIT
