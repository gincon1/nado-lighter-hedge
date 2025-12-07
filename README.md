## nado-lighter-hedge-passive

一个基于 Nado 与 Lighter 的被动对冲策略实现：
- 先在 Nado 挂限价单（post_only）等待成交
- 成交后，Lighter 立刻以市价开反向仓位
- 持仓 30 秒或 1 分钟（可配置）
- Nado 发起限价平仓单；一旦成交，Lighter 立即市价平仓

### 环境要求
- Node.js 18+
- Python 3.10+（用于 Lighter 官方 Python SDK）

### 安装
```bash
# 安装 Node 依赖
npm install

# 安装 Lighter 官方 Python SDK
pip install git+https://github.com/elliottech/lighter-python.git
```

### 配置
在项目根目录创建 .env 文件，示例参考 `.env.example`：
```env
# Nado
NADO_PRIVATE_KEY=0x...             # 你的 Nado 钱包私钥
NADO_NETWORK=inkMainnet

# Lighter
API_KEY_PRIVATE_KEY=...            # Lighter API 私钥
LIGHTER_ACCOUNT_INDEX=221138       # 你的 Lighter 账户索引
LIGHTER_API_KEY_INDEX=2            # 你的 Lighter API 密钥索引

# 对冲参数
HEDGE_COIN=BTC                     # 币种（会自动转成 BTC-PERP）
HEDGE_SIZE=0.01                    # 数量
HEDGE_SLIPPAGE=0.005               # 滑点（0.5%）
HEDGE_HOLD_TIME=30                 # 持仓时间（秒）
ORDER_TIMEOUT=60                   # Nado 限价单超时（秒）
HEDGE_ROUNDS=1                     # 运行轮数（默认 1）
```

### 运行
```bash
# 构建 TypeScript
npm run build

# 运行被动对冲策略
npm run passive
```
策略会：
1. 获取两边价格
2. Nado 限价挂单（post_only）等待成交
3. 成交后 Lighter 市价开反单
4. 等待持仓时间
5. Nado 限价平仓单；成交后 Lighter 市价平仓

### 常见问题
- Nado 提示 "Insufficient account health"：账户余额不足或风险超限，请充值或降低 `HEDGE_SIZE`
- Lighter 价格获取：默认使用 `recentTrades` REST 作为价格源；若失败则回退至 WebSocket 订单簿
- BTC 精度（Lighter）：size_decimals=5（10^5），price_decimals=1（10^1）

### 关键脚本
- `src/core/passive-hedge-engine.ts`：被动对冲主逻辑
- `src/run-passive-hedge.ts`：运行入口（`npm run passive`）
- `src/exchanges/lighter-adapter.ts`：Lighter 下单适配（市价/限价映射）

### 注意
- 本策略按你的要求实现：Nado 限价成交触发 Lighter 市价开反单；Nado 限价平仓成交触发 Lighter 市价平仓
- 若你希望改为同步下单（两边同时市价），请告知我调整
