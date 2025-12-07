# 🎉 欢迎使用 Nado-Lighter 对冲机器人 v2.0.0

## 📍 从这里开始

恭喜！你的对冲机器人已升级到 **TypeScript 版本**，具备完善的风控、日志和通知功能。

## ⚡ 3 步快速开始

### 1️⃣ 安装（30 秒）

```bash
cd nado-lighter-hedge
npm install
```

### 2️⃣ 配置（1 分钟）

编辑 `.env` 文件，填写必需配置：

```env
NADO_PRIVATE_KEY=0x你的私钥
LIGHTER_PRIVATE_KEY=0x你的私钥
LIGHTER_ACCOUNT_INDEX=0
```

### 3️⃣ 测试（30 秒）

```bash
npm test
```

看到 "✅ 所有测试通过！" 就可以开始使用了！

## 🎯 你想做什么？

### 📊 查看价差和利润

```bash
npm run example
```

或使用原有命令：

```bash
node strategies/hedge_manager.js spread BTC
```

### 🔄 执行对冲交易

**使用 TypeScript（推荐）：**

编辑 `src/examples/simple-hedge.ts`，取消注释对冲代码，然后：

```bash
npm run example
```

**使用原有 JS 版本：**

```bash
node strategies/hedge_manager.js open --coin BTC --size 0.002
```

### 🔁 循环对冲刷量

```bash
node strategies/hedge_manager.js loop BTC -n 10 -i 5
```

### 📱 启用 Telegram 通知

1. 创建 Bot：找 [@BotFather](https://t.me/BotFather)，发送 `/newbot`
2. 获取 Chat ID：找 [@userinfobot](https://t.me/userinfobot)
3. 在 `.env` 中配置：

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=你的Bot Token
TELEGRAM_CHAT_ID=你的Chat ID
```

4. 测试：`npm test`

## 📚 文档导航

| 我想... | 阅读这个文档 |
|---------|-------------|
| 5 分钟快速上手 | `QUICKSTART-TS.md` |
| 了解所有新功能 | `README-TS.md` |
| 从 JS 迁移到 TS | `MIGRATION.md` |
| 查看更新内容 | `CHANGELOG.md` |
| 了解升级详情 | `UPGRADE-SUMMARY.md` |

## 🆕 新功能亮点

### ✨ TypeScript 支持
- 完整的类型定义
- 更好的代码提示
- 编译时错误检查

### 🛡️ 完善的风控
- 最大持仓限制
- 滑点保护
- 每日亏损限制
- 紧急止损

### 📝 结构化日志
- 多级别日志
- 美化输出
- 性能监控

### 📱 Telegram 通知
- 交易通知
- 风险警告
- 错误告警
- 每日总结

### 🔧 统一接口
- 交易所适配器
- 方便扩展
- 代码复用

## 🚀 常用命令

```bash
# 测试配置
npm test

# 运行示例
npm run example

# 开发模式
npm run dev

# 编译 TypeScript
npm run build

# 查看价差（JS）
node strategies/hedge_manager.js spread BTC

# 开仓（JS）
node strategies/hedge_manager.js open --coin BTC --size 0.002

# 循环对冲（JS）
node strategies/hedge_manager.js loop BTC -n 10 -i 5
```

## ⚙️ 配置说明

### 必填配置

```env
NADO_PRIVATE_KEY=0x...
LIGHTER_PRIVATE_KEY=0x...
LIGHTER_ACCOUNT_INDEX=0
```

### 推荐配置

```env
# 风控
MAX_POSITION_SIZE=0.1
MAX_DAILY_LOSS=1000
MAX_SLIPPAGE=0.005

# 日志
LOG_LEVEL=info
LOG_PRETTY=true

# Telegram（可选）
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## 🔄 向后兼容

**好消息**：原有的 JS 版本完全保留！

```bash
# 所有原有命令继续可用
node strategies/hedge_manager.js help
node strategies/hedge_manager.js spread BTC
node strategies/hedge_manager.js open
node strategies/hedge_manager.js loop BTC -n 10
```

你可以：
- ✅ 继续使用 JS 版本
- ✅ 逐步迁移到 TS 版本
- ✅ 两个版本并行使用

## 🎓 学习路径

### 第 1 天：熟悉环境
1. ✅ 运行 `npm test` 测试配置
2. ✅ 运行 `npm run example` 查看示例
3. ✅ 阅读 `QUICKSTART-TS.md`

### 第 2-3 天：测试功能
1. ✅ 配置 Telegram 通知
2. ✅ 测试风控功能
3. ✅ 小额测试对冲

### 第 4-7 天：实际使用
1. ✅ 运行循环对冲
2. ✅ 监控日志和通知
3. ✅ 调整配置参数

## 🐛 遇到问题？

### 配置测试失败

```bash
# 检查 .env 文件
cat .env

# 确保包含必需配置
```

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### Telegram 通知不工作

1. 确保 `TELEGRAM_ENABLED=true`
2. 检查 Bot Token 和 Chat ID
3. 给你的 bot 发送 `/start`

### 其他问题

查看对应文档或提交 Issue。

## 📞 获取帮助

- 📖 查看文档目录
- 🔍 搜索 Issue
- 💬 提交新 Issue
- 📧 联系开发者

## 🎯 推荐工作流

### 开发环境

```bash
# 1. 启动开发模式
npm run dev

# 2. 查看美化日志
LOG_PRETTY=true npm run dev

# 3. 调试模式
LOG_LEVEL=debug npm run dev
```

### 生产环境

```bash
# 1. 编译代码
npm run build

# 2. 使用 PM2 运行
pm2 start dist/index.js --name nado-lighter-hedge

# 3. 查看日志
pm2 logs nado-lighter-hedge
```

## 🔐 安全提示

- ✅ 私钥存储在 `.env` 文件中
- ✅ `.env` 已在 .gitignore 中
- ✅ 不要将私钥提交到 Git
- ✅ 定期更换 API 密钥
- ✅ 使用风控限制降低风险

## 🎉 开始使用

现在你已经准备好了！选择一个方式开始：

**快速测试：**
```bash
npm run example
```

**查看价差：**
```bash
node strategies/hedge_manager.js spread BTC
```

**执行对冲：**
```bash
node strategies/hedge_manager.js open --coin BTC --size 0.001
```

**循环刷量：**
```bash
node strategies/hedge_manager.js loop BTC -n 10 -i 5
```

---

## 📖 下一步阅读

1. **快速入门**：`QUICKSTART-TS.md` - 5 分钟上手指南
2. **完整文档**：`README-TS.md` - 所有功能详解
3. **迁移指南**：`MIGRATION.md` - JS 到 TS 迁移
4. **更新日志**：`CHANGELOG.md` - 版本更新记录

---

**祝交易顺利！🚀**

有问题随时查看文档或提交 Issue。
