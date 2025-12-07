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
在项目根目录创建 `.env` 文件（参考 `.env.example`）：
```env
# Nado
NADO_PRIVATE_KEY=0x...             # 你的 Nado 钱包私钥
NADO_NETWORK=inkMainnet

# Lighter
API_KEY_PRIVATE_KEY=...            # Lighter API 私钥
LIGHTER_ACCOUNT_INDEX=...          # 你的 Lighter 账户索引
LIGHTER_API_KEY_INDEX=...          # 你的 Lighter API 密钥索引

# 对冲参数
HEDGE_COIN=BTC                     # 币种（会自动转成 BTC-PERP）
HEDGE_SIZE=0.01                    # 数量
HEDGE_SLIPPAGE=0.005               # 滑点（0.5%）
HEDGE_HOLD_TIME=30                 # 持仓时间（秒）
ORDER_TIMEOUT=60                   # Nado 限价单超时（秒）
HEDGE_ROUNDS=1                     # 运行轮数（默认 1）
```

### 安装教程

#### 第 1 步：获取必要信息
准备以下信息：
1. **Nado 私钥**：从你的 Nado 钱包导出（例如 MetaMask 导出的 0x 开头的 64 位十六进制）
2. **Lighter API 信息**：
   - 登录 Lighter 官网，获取 API 私钥（约 64 位十六进制）
   - 查看账户信息，获取 Account Index（整数）
   - API Key Index 通常为 `2`（0、1 保留给桌面和移动端）

#### 第 2 步：克隆仓库
```bash
git clone https://github.com/gincon1/nado-lighter-hedge-passive.git
cd nado-lighter-hedge-passive
```

#### 第 3 步：安装依赖

**Node 依赖**：
```bash
npm install
```

**Python 依赖**（用于 Lighter 官方 SDK 签名）：
```bash
pip install git+https://github.com/elliottech/lighter-python.git
```

若你有代理或网络限制，可尝试：
```bash
pip install --upgrade pip setuptools wheel
pip install git+https://github.com/elliottech/lighter-python.git --no-cache-dir
```

#### 第 4 步：配置 .env 文件

复制示例配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的实际信息：
```bash
vi .env  # 或 nano .env
```

示例（填入你的真实数据）：
```env
# Nado
NADO_PRIVATE_KEY=0xabc123...     # 替换为你的 Nado 私钥
NADO_NETWORK=inkMainnet

# Lighter
API_KEY_PRIVATE_KEY=def456...    # 替换为你的 Lighter API 私钥
LIGHTER_ACCOUNT_INDEX=123456     # 替换为你的 Account Index
LIGHTER_API_KEY_INDEX=2

# 对冲参数
HEDGE_COIN=BTC
HEDGE_SIZE=0.01                  # 交易数量（BTC）
HEDGE_SLIPPAGE=0.005             # 滑点 0.5%
HEDGE_HOLD_TIME=30               # 持仓 30 秒
ORDER_TIMEOUT=60                 # 订单超时 60 秒
HEDGE_ROUNDS=1                   # 运行 1 轮
```

#### 第 5 步：构建项目
```bash
npm run build
```

#### 第 6 步：运行对冲策略
```bash
npm run passive
```

### 运行流程
策略执行顺序：
1. 获取 Nado 和 Lighter 当前价格
2. **Nado 限价挂单**（post_only）等待成交
3. Nado 成交后，**Lighter 立即市价开反向仓位**
4. 等待 `HEDGE_HOLD_TIME` 秒（默认 30 秒）
5. **Nado 限价发起平仓单**（post_only）
6. Nado 平仓成交，**Lighter 立即市价平仓**
7. 重复运行（循环次数由 `HEDGE_ROUNDS` 控制）

### 监控价格（可选）
若想同时监控两边价格变化，可在另一个终端运行价格监控脚本：
```bash
node -e "
require('dotenv').config();
const { NadoAdapter } = require('./dist/exchanges/nado-adapter');
const { LighterAdapter } = require('./dist/exchanges/lighter-adapter');
const { loadConfig } = require('./dist/config');

const config = loadConfig();
const nado = new NadoAdapter(config.primary.privateKey);
const lighter = new LighterAdapter(config.hedge.privateKey, config.hedge.accountIndex, config.hedge.apiKeyIndex);

async function showPrices() {
  const [nadoBook, lighterBook] = await Promise.all([nado.getSimplifiedBook('BTC-PERP'), lighter.getSimplifiedBook('BTC-PERP')]);
  const now = new Date().toLocaleTimeString('zh-CN');
  console.log(\`[
${now}] Nado: \${nadoBook.bid} / \${nadoBook.ask} | Lighter: \${lighterBook.bid.toFixed(1)} / \${lighterBook.ask.toFixed(1)}");
}

showPrices();
setInterval(showPrices, 3000);
"
```
按 Ctrl+C 停止

### 故障排查

| 问题 | 解决方案 |
|------|--------|
| `Cannot find module 'lighter'` | 检查 Python SDK 是否安装：`pip install git+https://github.com/elliottech/lighter-python.git` |
| Nado: "Insufficient account health" | 账户余额不足，请充值 USDC 或降低 `HEDGE_SIZE` |
| Lighter: "order price flagged as accidental" | 价格偏离太远，调整 `HEDGE_SLIPPAGE` 或取消重试 |
| 持仓后未平仓 | 检查 Nado 限价单是否成交；可手动取消后重试 |
| Python SDK 权限错误 | 在 `.env` 中确认 `LIGHTER_API_KEY_INDEX=2`（正确）；0、1 为系统保留 |

### 市场信息

**BTC 精度（Lighter）**：
- `size_decimals = 5` → 最小单位 10^-5 BTC
- `price_decimals = 1` → 最小单位 0.1 USD
- 示例：0.01 BTC 以 89685.6 USD 成交

**价格数据源**：
- 优先使用 recentTrades REST API（更稳定）
- 若失败则回退至 WebSocket 订单簿
- 更新频率：每 3 秒检查一次（对冲脚本中可配置）

### 核心代码
- `src/core/passive-hedge-engine.ts`：被动对冲引擎（核心策略逻辑）
- `src/run-passive-hedge.ts`：运行入口脚本（`npm run passive` 调用）
- `src/exchanges/lighter-adapter.ts`：Lighter 下单适配（自动转换市价/限价）
- `lighter-sdk/client.js`：Lighter 官方 SDK 包装（Python 签名集成）
- `lighter-sdk/price_feed.js`：价格源管理（REST + WebSocket 双通道）

### 对冲逻辑说明

你的对冲策略是**事件驱动型**：
1. **Nado 方**：挂限价单（post_only），等待真实成交
2. **触发**：一旦 Nado 成交，立即向 Lighter 开仓（市价）
3. **持仓**：等待指定时间（默认 30 秒）
4. **平仓**：Nado 再挂限价平仓单，成交后 Lighter 立即市价平仓

这种方式确保两边真实对冲，避免单边持仓风险。

### 支持与反馈
若遇到问题，请检查：
- `.env` 配置是否正确
- Python 官方 SDK 是否成功安装
- 账户余额是否充足
- 网络是否正常连接
