# Nado-Lighter 对冲机器人 Dashboard

交易所风格的深色主题 Dashboard，用于控制和监控 Nado-Lighter 对冲机器人。

## 功能特性

- 🎯 **交易控制面板**：币种选择、快捷操作、循环对冲参数设置
- 📊 **实时状态面板**：持仓信息、配置信息、今日统计
- 📝 **日志终端**：实时显示交易事件，支持筛选和清空
- 🔔 **风险提示**：敞口警告、滑点超限提醒

## 技术栈

- React 18 + TypeScript
- TailwindCSS（深色主题）
- Zustand（状态管理）
- React Hot Toast（通知）
- Lucide React（图标）
- Vite（构建工具）

## 项目结构

```
dashboard/
├── src/
│   ├── components/          # UI 组件
│   │   ├── Header.tsx       # 顶部状态栏
│   │   ├── ControlPanel.tsx # 交易控制面板
│   │   ├── StatusPanel.tsx  # 实时状态面板
│   │   ├── LogConsole.tsx   # 日志终端
│   │   └── ConfirmModal.tsx # 确认对话框
│   ├── hooks/
│   │   └── useHedgeApi.ts   # API 调用 Hook
│   ├── stores/
│   │   └── useAppStore.ts   # 全局状态管理
│   ├── types/
│   │   └── index.ts         # TypeScript 类型定义
│   ├── api/
│   │   └── mock.ts          # Mock API 数据
│   ├── App.tsx              # 主应用组件
│   ├── main.tsx             # 入口文件
│   └── index.css            # 全局样式
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## API 接口说明

所有 API 调用封装在 `src/hooks/useHedgeApi.ts` 中，当前使用 Mock 数据。

### 接口列表

| 函数 | 说明 | 预期 API |
|------|------|----------|
| `getSpread(coin)` | 获取价差信息 | `GET /api/spread?coin=BTC` |
| `openOnce(coin)` | 单次开仓 | `POST /api/open` |
| `closeOnce(coin)` | 单次平仓 | `POST /api/close` |
| `roundtrip(coin)` | 往返对冲 | `POST /api/roundtrip` |
| `startLoop(params)` | 开始循环对冲 | `POST /api/loop/start` |
| `stopLoop()` | 停止循环对冲 | `POST /api/loop/stop` |
| `getStatus()` | 获取持仓状态 | `GET /api/status` |
| `getConfig()` | 获取配置 | `GET /api/config` |
| `updateConfig(config)` | 更新配置 | `POST /api/config` |

### 对接真实 API

1. 在 `vite.config.ts` 中配置代理指向后端服务
2. 修改 `src/api/mock.ts` 中的函数，替换为真实 API 调用
3. 或直接在 `useHedgeApi.ts` 中替换 mock 函数

## 界面预览

```
┌─────────────────────────────────────────────────────────────────┐
│  Nado-Lighter 对冲机器人 | BTC 价差: 45.50 (0.05%) | 空闲中      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │   交易控制               │  │   持仓信息                   │   │
│  │   [BTC] [ETH] [SOL]     │  │   Nado: 多 0.0013 @ 91500   │   │
│  │                         │  │   Lighter: 空 0.0013 @ 91450│   │
│  │   [查看价差] [单次开仓]  │  │   状态: ✓ 完全对冲           │   │
│  │   [单次平仓] [往返一次]  │  ├─────────────────────────────┤   │
│  │                         │  │   当前配置                   │   │
│  │   循环参数:              │  │   币种: BTC | 数量: 0.0013  │   │
│  │   数量: 0.0013          │  │   滑点: 0.5% | 间隔: 10s    │   │
│  │   轮数: 5               │  ├─────────────────────────────┤   │
│  │   [▶ 开始循环对冲]       │  │   今日统计                   │   │
│  └─────────────────────────┘  │   轮数: 12 | 成交量: 0.0312 │   │
│                               └─────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  日志终端                                            [筛选] [清空]│
│  [12:01:03] ℹ 获取 BTC 价差成功 - 价差: 45.50 (0.0499%)         │
│  [12:01:05] ✓ BTC 开仓成功 - 订单ID: OPEN_1234567890            │
│  [12:01:07] ✓ BTC 平仓成功 - 订单ID: CLOSE_1234567891           │
└─────────────────────────────────────────────────────────────────┘
```

## 开发说明

- 所有界面文案使用简体中文
- 代码注释使用中英结合
- 组件使用函数式 + Hooks
- 状态管理使用 Zustand
