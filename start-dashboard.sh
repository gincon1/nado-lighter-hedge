#!/bin/bash
# 启动 Nado-Lighter 对冲机器人 Dashboard
# 同时启动后端 API 服务器和前端开发服务器

echo "🚀 启动 Nado-Lighter 对冲机器人 Dashboard"
echo ""

# 检查是否在正确目录
if [ ! -f ".env" ]; then
    echo "❌ 请在 nado-lighter-hedge 目录下运行此脚本"
    exit 1
fi

# 启动后端 API 服务器
echo "📡 启动后端 API 服务器 (端口 3001)..."
node server/index.js &
SERVER_PID=$!

# 等待服务器启动
sleep 2

# 启动前端开发服务器
echo "🎨 启动前端开发服务器 (端口 5173)..."
cd dashboard && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动:"
echo "   - API 服务器: http://localhost:3001"
echo "   - Dashboard:  http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待并处理退出
trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
