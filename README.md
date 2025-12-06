# Nado-Lighter 对冲机器人

![Node version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

在 Nado 和 Lighter 两个去中心化永续合约交易所之间执行对冲交易的自动化工具。

## 🚀 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/lzysxj001-glitch/nado-lighter-hedge/main/install.sh | bash
```

或使用 wget：

```bash
wget -qO- https://raw.githubusercontent.com/lzysxj001-glitch/nado-lighter-hedge/main/install.sh | bash
```

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/lzysxj001-glitch/nado-lighter-hedge.git
cd nado-lighter-hedge

# 运行安装脚本
./deploy.sh
```

## 功能特点

- ✅ **自动对冲**: 在两个交易所之间自动执行对冲交易
- ✅ **价差监控**: 实时监控两边价差，智能选择最优方向
- ✅ **灵活配置**: 支持多种订单类型和滑点配置
- ✅ **批量操作**: 支持循环对冲、往返交易等批量操作
- ✅ **持仓管理**: 自动跟踪和管理两边持仓
- ✅ **风险控制**: 内置最小订单验证和错误处理

## 项目结构

```
nado-lighter-hedge/
├── nado-sdk/              # Nado SDK
│   └── src/
│       ├── client.js
│       ├── price_feed.js
│       └── types.js
├── lighter-sdk/           # Lighter SDK
│   ├── client.js
│   ├── price_feed.js
│   └── index.js
├── strategies/            # 对冲策略
│   ├── hedge_executor.js      # 对冲执行器
│   ├── hedge_operations.js    # 对冲操作封装
│   └── hedge_manager.js       # CLI 管理器
├── package.json
├── .env.example          # 环境变量模板
└── README.md
```

## 安装

### 1. 克隆或复制项目

```bash
# 如果是 Git 仓库
git clone <repository-url>
cd nado-lighter-hedge

# 或者直接使用已有的项目文件夹
cd nado-lighter-hedge
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
nano .env  # 或使用其他编辑器
```

需要配置的关键参数：

```env
# Nado 配置
NADO_PRIVATE_KEY=0x...           # Nado 钱包私钥
NADO_NETWORK=inkMainnet          # Nado 网络（inkMainnet/inkTestnet）

# Lighter 配置
LIGHTER_PRIVATE_KEY=0x...        # Lighter 钱包私钥
LIGHTER_ACCOUNT_INDEX=0          # Lighter 账户索引
LIGHTER_API_KEY_INDEX=0          # Lighter API 密钥索引

# 对冲配置
HEDGE_COIN=BTC                   # 默认交易币种
HEDGE_SIZE=0.002                 # 默认交易数量
HEDGE_SLIPPAGE=0.001            # 滑点（0.1%）
HEDGE_ORDER_TYPE=ioc            # 订单类型（ioc/limit）
```

### 4. 获取 Lighter 账户索引

访问以下 URL（替换为你的钱包地址）：
```
https://mainnet.zklighter.elliot.ai/api/v1/account?by=l1_address&value=YOUR_WALLET_ADDRESS
```

在返回的 JSON 中找到 `account_index` 字段，填入 `.env` 文件。

## 使用方法

### 基础命令

#### 1. 查看帮助
```bash
node strategies/hedge_manager.js help
```

#### 2. 查看配置
```bash
node strategies/hedge_manager.js config
```

#### 3. 查看价差
```bash
# 查看默认币种价差
node strategies/hedge_manager.js spread

# 查看指定币种价差
node strategies/hedge_manager.js spread BTC
node strategies/hedge_manager.js spread ETH
```

#### 4. 查看持仓
```bash
node strategies/hedge_manager.js status
```

### 对冲交易

#### 1. 开仓
```bash
# 使用默认配置开仓
node strategies/hedge_manager.js open

# 指定币种和数量
node strategies/hedge_manager.js open --coin BTC --size 0.002

# 开仓后自动平仓（3600秒后）
node strategies/hedge_manager.js open --auto-close 3600

# 强制执行（跳过确认）
node strategies/hedge_manager.js open -f
```

#### 2. 平仓
```bash
# 平仓全部持仓
node strategies/hedge_manager.js close BTC

# 平仓指定数量
node strategies/hedge_manager.js close BTC --size 0.001
```

#### 3. 往返对冲
```bash
# 立即开仓并平仓
node strategies/hedge_manager.js roundtrip BTC

# 指定数量
node strategies/hedge_manager.js roundtrip BTC --size 0.002
```

#### 4. 循环对冲
```bash
# 循环10次
node strategies/hedge_manager.js loop BTC --count 10

# 循环10次，每次间隔5秒
node strategies/hedge_manager.js loop BTC -n 10 -i 5

# 循环10次，持仓30秒后平仓，每轮间隔5秒
node strategies/hedge_manager.js loop BTC -n 10 --hold-time 30 -i 5

# 失败时停止循环
node strategies/hedge_manager.js loop BTC -n 10 --stop-on-error
```

### 命令行选项

| 选项 | 简写 | 说明 | 示例 |
|------|------|------|------|
| --coin | -c | 币种 | --coin BTC |
| --size | -s | 交易数量 | --size 0.002 |
| --count | -n | 循环次数 | --count 10 |
| --interval | -i | 循环间隔（秒） | --interval 5 |
| --hold-time | - | 持仓时间（秒） | --hold-time 30 |
| --force | -f | 强制执行 | --force |
| --dry-run | - | 模拟模式 | --dry-run |
| --auto-close | - | 自动平仓延迟 | --auto-close 3600 |
| --stop-on-error | - | 失败时停止 | --stop-on-error |

## 部署到服务器

### 方式一：使用 PM2（推荐）

PM2 是一个进程管理器，可以保持应用持续运行。

#### 1. 安装 PM2
```bash
npm install -g pm2
```

#### 2. 启动循环对冲
```bash
# 启动并命名为 nado-lighter-hedge
pm2 start strategies/hedge_manager.js --name nado-lighter-hedge -- loop BTC -n 1000 -i 10

# 查看日志
pm2 logs nado-lighter-hedge

# 查看状态
pm2 status

# 停止
pm2 stop nado-lighter-hedge

# 重启
pm2 restart nado-lighter-hedge

# 删除
pm2 delete nado-lighter-hedge
```

#### 3. 设置开机自启
```bash
# 保存当前进程列表
pm2 save

# 生成开机启动脚本
pm2 startup

# 按提示执行命令（通常是 sudo 命令）
```

### 方式二：使用 systemd

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/nado-lighter-hedge.service
```

内容：
```ini
[Unit]
Description=Nado-Lighter Hedge Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/nado-lighter-hedge
ExecStart=/usr/bin/node strategies/hedge_manager.js loop BTC -n 1000 -i 10
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start nado-lighter-hedge

# 查看状态
sudo systemctl status nado-lighter-hedge

# 查看日志
sudo journalctl -u nado-lighter-hedge -f

# 设置开机自启
sudo systemctl enable nado-lighter-hedge
```

### 方式三：使用 screen/tmux

```bash
# 使用 screen
screen -S hedge
node strategies/hedge_manager.js loop BTC -n 1000 -i 10
# 按 Ctrl+A+D 分离会话

# 重新连接
screen -r hedge

# 使用 tmux
tmux new -s hedge
node strategies/hedge_manager.js loop BTC -n 1000 -i 10
# 按 Ctrl+B+D 分离会话

# 重新连接
tmux attach -t hedge
```

## 服务器部署完整流程

### Ubuntu/Debian 服务器

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js（如果未安装）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 安装 Git（如果需要）
sudo apt install -y git

# 4. 克隆或上传项目
# 方式A: Git 克隆
git clone <repository-url>
cd nado-lighter-hedge

# 方式B: 上传文件
# 使用 scp, rsync 或 SFTP 上传项目文件

# 5. 安装依赖
npm install

# 6. 配置环境变量
cp .env.example .env
nano .env  # 填写配置

# 7. 测试运行
node strategies/hedge_manager.js config
node strategies/hedge_manager.js spread BTC

# 8. 安装 PM2
npm install -g pm2

# 9. 启动服务
pm2 start strategies/hedge_manager.js --name nado-lighter-hedge -- loop BTC -n 1000 -i 10

# 10. 保存配置
pm2 save
pm2 startup

# 11. 监控
pm2 logs nado-lighter-hedge
pm2 monit
```

### CentOS/RHEL 服务器

```bash
# 1. 更新系统
sudo yum update -y

# 2. 安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 3. 其他步骤同 Ubuntu
```

## 监控和日志

### PM2 监控

```bash
# 实时日志
pm2 logs nado-lighter-hedge

# 只看错误日志
pm2 logs nado-lighter-hedge --err

# 系统监控
pm2 monit

# 查看进程信息
pm2 show nado-lighter-hedge
```

### 日志位置

- PM2 日志: `~/.pm2/logs/`
- systemd 日志: `journalctl -u nado-lighter-hedge`

## 风险提示

⚠️ **重要风险警告**

1. **市场风险**: 加密货币市场波动剧烈，对冲不能完全消除风险
2. **执行风险**: 订单可能部分成交或不成交，导致敞口风险
3. **网络风险**: 网络延迟可能导致价差变化，影响对冲效果
4. **资金风险**: 确保两边账户都有足够的保证金
5. **API风险**: API 限流或故障可能影响交易执行
6. **私钥安全**: 务必保管好私钥，不要泄露

## 最佳实践

1. **小额测试**: 先用小金额测试，确认流程正常
2. **监控价差**: 定期查看价差，只在有利润空间时对冲
3. **设置限制**: 使用循环次数限制，避免无限循环
4. **保证金管理**: 确保两边都有充足的保证金
5. **定期检查**: 定期检查持仓和账户状态
6. **日志监控**: 定期查看日志，及时发现问题

## 故障排查

### 常见问题

1. **订单失败**
   - 检查账户余额是否充足
   - 检查 API 密钥是否正确
   - 检查网络连接

2. **价格异常**
   - 检查两边是否都能正常获取价格
   - 检查币种符号是否正确

3. **持仓不平衡**
   - 检查订单是否全部成交
   - 手动调整持仓使其平衡

4. **进程崩溃**
   - 查看 PM2 日志找出原因
   - 确认配置正确
   - 检查服务器资源

## 技术支持

如有问题，请：
1. 查看日志获取详细错误信息
2. 检查配置是否正确
3. 确认网络连接正常
4. 查阅 Nado 和 Lighter 官方文档

## 许可证

MIT License

## 免责声明

本软件仅供学习和研究使用。使用本软件进行交易的任何损失由使用者自行承担。作者不对使用本软件造成的任何损失负责。
