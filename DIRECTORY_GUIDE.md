# Nado-Lighter 被动对冲交易 Bot - 仓库结构与 Commit 建议

## 📁 目录结构说明与 Commit Message 参考

| 路径 | 功能说明（中文） | 推荐的 Commit Message |
|------|------------------|---------------------|
| **根目录 (`/`)** | 项目配置与入口文件 | `chore: project root files (config, README, package.json)` — 项目根配置文件 |
| **`.env.example`** | 环境变量模板（无真实敏感信息） | `docs: add .env configuration template` — 添加环境变量配置示例 |
| **`README.md`** | 完整的安装教程、运行流程、故障排查 | `docs: complete installation guide and hedge strategy overview` — 完整安装指南与对冲策略说明 |
| **`package.json`** | Node.js 依赖与 npm 运行脚本定义 | `chore: define npm scripts (build, passive strategy)` — 定义 npm 脚本与依赖 |
| **`tsconfig.json`** | TypeScript 编译配置 | `chore: configure TypeScript compiler options` — TypeScript 编译配置 |
| **`lighter-sdk/`** | Lighter 交易所 SDK 二次封装 | `feat: implement Lighter SDK wrapper with Python signature integration` — 实现 Lighter SDK 包装（含 Python 签名集成） |
| **`lighter-sdk/client.js`** | Lighter 官方 Python SDK 的 Node.js 代理层（处理下单、查询订单） | `feat: create Lighter API client wrapper with order execution & balance query` — 创建 Lighter API 客户端包装（下单、余额查询） |
| **`lighter-sdk/price_feed.js`** | Lighter 价格数据源管理（REST + WebSocket 双通道，优先 REST） | `feat: implement dual-channel price feed (REST primary, WebSocket fallback)` — 实现双通道价格源（REST 优先，WS 备选） |
| **`lighter-sdk/index.js`** | Lighter SDK 导出入口 | `chore: export Lighter SDK modules` — 导出 Lighter SDK 模块 |
| **`nado-sdk/`** | Nado 交易所 SDK 二次封装 | `feat: implement Nado SDK wrapper with signature & order management` — 实现 Nado SDK 包装（签名与订单管理） |
| **`nado-sdk/src/client.js`** | Nado API 客户端（处理钱包签名、下单、查询订单） | `feat: create Nado API client with wallet signature support` — 创建 Nado API 客户端（含钱包签名） |
| **`nado-sdk/src/signer.js`** | Nado 交易签名器（EdDSA 签名逻辑） | `feat: implement EdDSA signer for Nado transactions` — 实现 Nado 交易签名（EdDSA） |
| **`nado-sdk/src/orders.js`** | Nado 订单管理模块（限价单、市价单、平仓单） | `feat: implement Nado order management (limit, market, close orders)` — 实现 Nado 订单管理模块 |
| **`nado-sdk/src/price_feed.js`** | Nado 价格数据源（GraphQL 查询实时价格） | `feat: implement Nado price feed via GraphQL` — 通过 GraphQL 实现 Nado 价格源 |
| **`nado-sdk/src/types.js`** | Nado SDK 类型定义 | `chore: define TypeScript types for Nado SDK` — 定义 Nado SDK 类型 |
| **`nado-sdk/src/utils.js`** | Nado SDK 工具函数（数值格式化、精度转换） | `chore: add Nado utility functions (decimals, formatting)` — 添加 Nado 工具函数 |
| **`nado-sdk/src/index.js`** | Nado SDK 导出入口 | `chore: export Nado SDK modules` — 导出 Nado SDK 模块 |
| **`scripts/`** | 辅助脚本与工具 | `chore: add helper scripts for setup & testing` — 添加辅助脚本 |
| **`scripts/lighter_setup.py`** | Lighter Python SDK 初始化脚本（获取 API 密钥、账户信息） | `feat: add Python script for Lighter API key initialization` — 添加 Lighter API 密钥初始化脚本 |
| **`src/`** | 核心 TypeScript 源代码（策略引擎、交易适配器） | `feat: implement core passive hedge strategy in TypeScript` — 实现核心被动对冲策略 |
| **`src/config/index.ts`** | 环境变量加载与配置管理 | `feat: implement configuration loader from .env` — 实现配置加载器 |
| **`src/core/passive-hedge-engine.ts`** | **被动对冲引擎（核心）** — Nado 限价成交触发 Lighter 市价开平仓流程 | `feat: implement passive hedge engine (Nado limit trigger → Lighter market execution)` — 实现被动对冲引擎（Nado 限价触发 Lighter 市价） |
| **`src/core/hedge-engine.ts`** | 对冲引擎基类 | `chore: define base hedge engine abstract class` — 定义对冲引擎基类 |
| **`src/exchanges/base-exchange.ts`** | 交易所适配器基类 | `chore: define base exchange adapter interface` — 定义交易所适配器基类 |
| **`src/exchanges/lighter-adapter.ts`** | **Lighter 适配器** — 统一 Lighter 下单接口（自动转换市价/限价、精度处理） | `feat: implement Lighter exchange adapter (order placement & balance tracking)` — 实现 Lighter 适配器（下单与余额追踪） |
| **`src/exchanges/nado-adapter.ts`** | **Nado 适配器** — 统一 Nado 下单接口（限价单 post_only、签名、查询） | `feat: implement Nado exchange adapter (post-only limit orders & signature)` — 实现 Nado 适配器（post-only 限价与签名） |
| **`src/run-passive-hedge.ts`** | **被动对冲策略运行入口** — `npm run passive` 调用的脚本 | `feat: add passive hedge strategy runner script` — 添加被动对冲策略运行脚本 |
| **`src/index.ts`** | 主入口文件（导出所有模块） | `chore: export core modules and functions` — 导出核心模块 |
| **`src/risk/risk-manager.ts`** | 风险控制管理器（头寸大小、账户余额检查） | `feat: implement risk manager (position size, account health checks)` — 实现风险管理器 |
| **`src/types/index.ts`** | TypeScript 类型定义 | `chore: define shared TypeScript types and interfaces` — 定义共享类型与接口 |
| **`src/utils/logger.ts`** | 日志记录工具 | `chore: add logger utility for debugging` — 添加日志工具 |
| **`src/utils/helpers.ts`** | 辅助函数（精度转换、符号映射等） | `chore: add helper functions for decimals and symbol mapping` — 添加辅助函数 |
| **`src/utils/telegram.ts`** | Telegram 通知工具（可选） | `feat: add optional Telegram notification support` — 添加可选 Telegram 通知支持 |
| **`src/examples/simple-hedge.ts`** | 简单对冲策略示例 | `docs: add simple hedge strategy example` — 添加对冲策略示例 |
| **`src/test-setup.ts`** | 测试环境配置 | `chore: add test environment setup` — 添加测试环境配置 |
| **`strategies/`** | 交易策略实现（多种对冲方案） | `feat: implement multiple hedge strategy variants` — 实现多种对冲策略变体 |
| **`strategies/hedge_manager.js`** | 对冲管理器（订单生命周期、错误恢复、重试逻辑） | `feat: implement hedge manager with lifecycle & retry logic` — 实现对冲管理器（生命周期与重试） |
| **`strategies/hedge_executor.js`** | 对冲执行器（实际执行下单、平仓） | `feat: implement hedge executor for order execution` — 实现对冲执行器 |
| **`strategies/hedge_operations.js`** | 对冲操作集合（打开头寸、关闭头寸、获取状态） | `feat: implement hedge operations (open, close, status)` — 实现对冲操作集合 |
| **`.gitignore`** | Git 忽略规则 | `chore: configure git ignore rules` — 配置 Git 忽略规则 |

---

## 💡 使用说明

### Commit Message 规范
- **`feat:`** 新增功能（如新的 SDK 包装、新适配器）
- **`fix:`** 修复 bug（如精度错误、价格获取失败）
- **`docs:`** 文档更新（如 README、示例代码）
- **`refactor:`** 代码重构（优化、简化逻辑）
- **`chore:`** 杂务（依赖更新、配置文件、类型定义）
- **`feat:` 后面可选地加一行中文注释**，帮助理解具体功能

### 核心文件（最重要）
1. **`src/core/passive-hedge-engine.ts`** — 被动对冲核心逻辑（Nado 限价成交 → Lighter 市价反向开平）
2. **`src/exchanges/lighter-adapter.ts`** — Lighter 适配器（市价/限价转换、精度处理）
3. **`src/exchanges/nado-adapter.ts`** — Nado 适配器（post-only 限价、签名、查询）
4. **`lighter-sdk/client.js`** — Lighter SDK 包装（Python 签名集成）
5. **`nado-sdk/src/client.js`** — Nado SDK 包装（钱包签名）

### 价格监控脚本
README 中提供了价格监控命令，可同时查看 Nado 和 Lighter 的 BTC 实时价格（每 3 秒更新）。

---

## 🚀 运行命令
```bash
# 安装依赖
npm install
pip install git+https://github.com/elliottech/lighter-python.git

# 构建
npm run build

# 运行被动对冲策略
npm run passive
```

---

**最后更新**: 2025-12-07  
**项目状态**: 被动对冲策略完成实现，已在 GitHub 公开发布
