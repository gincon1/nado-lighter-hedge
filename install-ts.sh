#!/bin/bash

# Nado-Lighter TypeScript 版本安装脚本

set -e

echo "=================================="
echo "Nado-Lighter TypeScript 安装脚本"
echo "=================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ 错误: Node.js 版本过低 (当前: $(node -v))"
    echo "请升级到 Node.js 14 或更高版本"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install

echo ""
echo "✅ 依赖安装完成"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件"
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请编辑并填写配置"
    echo ""
    echo "必填配置项："
    echo "  - NADO_PRIVATE_KEY"
    echo "  - LIGHTER_PRIVATE_KEY"
    echo "  - LIGHTER_ACCOUNT_INDEX"
    echo ""
else
    echo "✅ .env 文件已存在"
    echo ""
fi

# 编译 TypeScript
echo "🔨 编译 TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ TypeScript 编译成功"
else
    echo "⚠️  TypeScript 编译失败，但不影响使用 ts-node 运行"
fi

echo ""
echo "=================================="
echo "✅ 安装完成！"
echo "=================================="
echo ""
echo "下一步："
echo ""
echo "1. 编辑 .env 文件，填写必要的配置："
echo "   nano .env"
echo ""
echo "2. 运行示例查看价差："
echo "   npm run dev"
echo ""
echo "3. 或使用原有的 JS 版本："
echo "   node strategies/hedge_manager.js spread BTC"
echo ""
echo "4. 查看 TypeScript 版本文档："
echo "   cat README-TS.md"
echo ""
echo "=================================="
