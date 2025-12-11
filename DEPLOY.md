# 部署指南

本文档提供详细的部署步骤，帮助您快速部署和运行 Nado-Lighter 对冲交易机器人。

## 📋 前置准备

### 系统要求

- **操作系统**: Ubuntu 20.04+ / macOS / Windows (WSL2)
- **内存**: 至少 2GB RAM
- **磁盘**: 至少 1GB 可用空间

### 必需软件

1. **Node.js 18+**
2. **Python 3.8+**
3. **Git**

## 🚀 完整部署流程

### Step 1: 安装 Node.js

#### Ubuntu/Debian

```bash
# 使用 nvm 安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x
```

#### macOS

```bash
# 使用 Homebrew
brew install node@18

# 或使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install 18
nvm use 18
```

### Step 2: 安装 Python

#### Ubuntu/Debian

```bash
# 安装 Python 3.8+
sudo apt update
sudo apt install python3 python3-pip -y

# 验证安装
python3 --version  # 应显示 Python 3.8+
pip3 --version
```

#### macOS

```bash
# 使用 Homebrew
brew install python@3.10
```

### Step 3: 克隆项目

```bash
# 克隆仓库
git clone https://github.com/gincon1/nado-lighter-hedge.git
cd nado-lighter-hedge

# 查看项目结构
ls -la
```

### Step 4: 安装项目依赖

```bash
# 1. 安装主项目依赖
npm install

# 2. 安装服务器依赖
cd server
npm install
cd ..

# 3. 安装前端依赖
cd dashboard
npm install
cd ..

# 4. 安装 Lighter Python SDK
pip3 install git+https://github.com/elliottech/lighter-python.git

# 验证 Python SDK 安装
python3 -c "import lighter; print('Lighter SDK installed successfully')"
```

### Step 5: 配置环境变量

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env 文件
nano .env  # 或使用 vim .env
```

#### 必填配置项

在 `.env` 文件中填入以下信息：

```bash
# ============ Nado 配置 ============
# 从 Nado 获取您的钱包私钥
NADO_PRIVATE_KEY=0xYOUR_NADO_PRIVATE_KEY_HERE
NADO_NETWORK=inkMainnet

# ============ Lighter 配置 ============
# 从 Lighter 获取 API Key
API_KEY_PRIVATE_KEY=YOUR_LIGHTER_API_KEY_HERE
LIGHTER_ACCOUNT_INDEX=YOUR_ACCOUNT_INDEX
LIGHTER_API_KEY_INDEX=YOUR_API_KEY_INDEX

# ============ 对冲参数 ============
HEDGE_COIN=BTC
HEDGE_SIZE=0.01
NADO_ORDER_TIMEOUT=60000
NADO_MAX_RETRIES=3
LIGHTER_MAX_SLIPPAGE=0.005
HEDGE_LOOP_HOLD_TIME=10
HEDGE_LOOP_INTERVAL=2
```

#### 获取配置信息

**Nado 私钥:**
1. 访问 https://nado.xyz
2. 连接您的钱包
3. 导出私钥（注意安全！）

**Lighter API Key:**
1. 访问 https://lighter.xyz
2. 登录账户
3. 进入 API 设置页面
4. 创建新的 API Key
5. 复制 API Key Private Key、Account Index 和 API Key Index

### Step 6: 测试配置

```bash
# 测试 Nado 连接
node -e "
require('dotenv').config();
const { NadoClient } = require('./nado-sdk/src/index');
const client = new NadoClient(process.env.NADO_PRIVATE_KEY, { network: process.env.NADO_NETWORK });
console.log('Nado 客户端初始化成功');
console.log('地址:', client.address);
"

# 测试 Lighter 连接
node -e "
require('dotenv').config();
const { LighterClient } = require('./lighter-sdk/index');
const client = new LighterClient(
  process.env.API_KEY_PRIVATE_KEY,
  parseInt(process.env.LIGHTER_ACCOUNT_INDEX),
  parseInt(process.env.LIGHTER_API_KEY_INDEX)
);
console.log('Lighter 客户端初始化成功');
"
```

### Step 7: 启动服务

#### 方式一：使用两个终端（推荐）

**终端 1 - 启动后端:**

```bash
cd /path/to/nado-lighter-hedge
node server/index.js
```

您应该看到：

```
✅ 客户端初始化成功
📊 价格监控已启动 (间隔 5s)
🚀 API 服务器已启动: http://localhost:3001
```

**终端 2 - 启动前端:**

```bash
cd /path/to/nado-lighter-hedge/dashboard
npm run dev
```

您应该看到：

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

#### 方式二：使用 PM2（生产环境）

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
pm2 start server/index.js --name nado-hedge-api

# 启动前端（生产构建）
cd dashboard
npm run build
pm2 serve dist 3000 --name nado-hedge-frontend

# 查看状态
pm2 status

# 查看日志
pm2 logs nado-hedge-api
```

### Step 8: 访问 Dashboard

打开浏览器，访问：

```
http://localhost:3000
```

您应该能看到：
- 实时价格显示
- 对冲控制面板
- 系统日志

## ✅ 验证部署

### 1. 测试单次对冲

在 Dashboard 中：
1. 选择币种（BTC）
2. 输入数量（0.01）
3. 点击"单次对冲"按钮

或使用 API：

```bash
curl -X POST http://localhost:3001/api/hedge/once \
  -H "Content-Type: application/json" \
  -d '{
    "coin": "BTC",
    "size": 0.01
  }'
```

### 2. 检查日志

在后端终端中，您应该能看到：

```
[INFO] 开始单次对冲: BTC 0.01
════════════════════════════════════════
  对冲任务开始
════════════════════════════════════════
[1.1] Nado 限价买单...
  ✓ 订单已提交
  ✓ 订单完全成交！
[1.2] Lighter 市价卖出对冲...
  ✓ 对冲完成
[SUCCESS] 对冲任务完成
```

## 🔧 故障排查

### 问题 1: Node.js 未找到

```bash
# 检查 Node.js 是否安装
which node

# 如果使用 nvm，确保已加载
source ~/.nvm/nvm.sh
nvm use 18
```

### 问题 2: Python SDK 导入失败

```bash
# 重新安装 Lighter SDK
pip3 uninstall lighter-python -y
pip3 install git+https://github.com/elliottech/lighter-python.git

# 检查 Python 路径
which python3
python3 --version
```

### 问题 3: 端口被占用

```bash
# 检查端口占用
lsof -i :3001  # 后端端口
lsof -i :3000  # 前端端口

# 杀死占用进程
kill -9 <PID>

# 或在 .env 中修改端口
API_PORT=3002
```

### 问题 4: 连接超时

```bash
# 检查网络连接
ping nado.xyz
ping lighter.xyz

# 检查防火墙设置
sudo ufw status
```

### 问题 5: 私钥错误

```bash
# 验证私钥格式
# Nado 私钥应以 0x 开头
# Lighter API Key 是十六进制字符串

# 检查 .env 文件
cat .env | grep PRIVATE_KEY
```

## 📊 监控和日志

### 查看实时日志

```bash
# 后端日志
tail -f server.log

# 或使用 PM2
pm2 logs nado-hedge-api --lines 100
```

### 性能监控

```bash
# 使用 PM2 监控
pm2 monit

# 查看系统资源
htop
```

## 🔒 安全建议

1. **不要提交 .env 文件**
   ```bash
   # 确认 .gitignore 包含
   cat .gitignore | grep .env
   ```

2. **使用专用钱包**
   - 不要在对冲钱包中存放大额资金
   - 定期提现利润

3. **限制 API 权限**
   - Lighter API Key 只授予交易权限
   - 不要授予提现权限

4. **定期备份**
   ```bash
   # 备份配置
   cp .env .env.backup.$(date +%Y%m%d)
   ```

## 📝 日常运维

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新安装依赖
npm install
cd server && npm install && cd ..
cd dashboard && npm install && cd ..

# 重启服务
pm2 restart all
```

### 清理日志

```bash
# 清理 PM2 日志
pm2 flush

# 清理旧备份
rm -rf backup_*
```

### 检查系统状态

```bash
# 查看服务状态
pm2 status

# 查看资源使用
pm2 monit

# 查看错误日志
pm2 logs --err
```

## 🆘 获取帮助

如果遇到问题：

1. 查看 [README.md](README.md) 文档
2. 检查 [Issues](https://github.com/gincon1/nado-lighter-hedge/issues)
3. 提交新的 Issue

---

**祝您部署顺利！** 🚀
