#!/bin/bash

# Nado-Lighter 对冲机器人 - 一键安装脚本
# 使用方法：curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/nado-lighter-hedge/main/install.sh | bash

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║      Nado-Lighter 对冲机器人 - 一键安装                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root
if [ "$EUID" -eq 0 ]; then 
  echo -e "${YELLOW}警告: 不建议使用 root 用户运行此脚本${NC}"
  read -p "是否继续? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    OS=$(uname -s)
    VER=$(uname -r)
fi

echo -e "${GREEN}✓ 检测到操作系统: $OS $VER${NC}"
echo ""

# 检查 curl 或 wget
if command -v curl &> /dev/null; then
    DOWNLOADER="curl -fsSL"
elif command -v wget &> /dev/null; then
    DOWNLOADER="wget -qO-"
else
    echo -e "${RED}❌ 错误: 需要 curl 或 wget${NC}"
    echo "请先安装: sudo apt install curl 或 sudo yum install curl"
    exit 1
fi

# 检查并安装 Git
echo "📦 检查 Git..."
if ! command -v git &> /dev/null; then
    echo "Git 未安装，正在安装..."
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        sudo apt update
        sudo apt install -y git
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        sudo yum install -y git
    else
        echo -e "${RED}❌ 无法自动安装 Git，请手动安装${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Git 已安装: $(git --version)${NC}"

# 检查并安装 Node.js
echo ""
echo "📦 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装，正在安装..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}❌ 无法自动安装 Node.js${NC}"
        echo "请访问 https://nodejs.org/ 手动安装"
        exit 1
    fi
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 已安装: $NODE_VERSION${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未找到${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm 已安装: $(npm -v)${NC}"

# 询问安装目录
echo ""
echo "📁 选择安装目录"
DEFAULT_DIR="$HOME/nado-lighter-hedge"
read -p "安装目录 (默认: $DEFAULT_DIR): " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}

# 如果目录已存在，询问是否覆盖
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  目录已存在: $INSTALL_DIR${NC}"
    read -p "是否删除并重新安装? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "安装已取消"
        exit 0
    fi
fi

# 克隆仓库
echo ""
echo "📥 正在下载项目..."
# 注意: 这里的 URL 需要替换为实际的 GitHub 仓库地址
REPO_URL="https://github.com/YOUR_USERNAME/nado-lighter-hedge.git"

if ! git clone "$REPO_URL" "$INSTALL_DIR"; then
    echo -e "${RED}❌ 下载失败${NC}"
    echo "请检查网络连接或仓库地址是否正确"
    exit 1
fi

cd "$INSTALL_DIR"
echo -e "${GREEN}✓ 项目已下载到: $INSTALL_DIR${NC}"

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
if ! npm install; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 创建配置文件
echo ""
echo "⚙️  配置环境变量"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ 已创建 .env 配置文件${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  重要: 请编辑 .env 文件并填写以下配置:${NC}"
    echo "   - NADO_PRIVATE_KEY"
    echo "   - LIGHTER_PRIVATE_KEY"
    echo "   - LIGHTER_ACCOUNT_INDEX"
    echo ""
    echo "编辑命令: nano $INSTALL_DIR/.env"
    echo ""
    
    # 询问是否现在编辑
    read -p "是否现在编辑配置文件? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
else
    echo -e "${GREEN}✓ .env 文件已存在${NC}"
fi

# 询问是否安装 PM2
echo ""
echo "📦 进程管理器 PM2"
if ! command -v pm2 &> /dev/null; then
    read -p "是否安装 PM2? (推荐) (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "正在安装 PM2..."
        if sudo npm install -g pm2; then
            echo -e "${GREEN}✓ PM2 安装成功${NC}"
            
            # 询问是否设置开机自启
            read -p "是否设置 PM2 开机自启? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                pm2 startup | tail -n 1 > /tmp/pm2_startup.sh
                if [ -f /tmp/pm2_startup.sh ]; then
                    sudo bash /tmp/pm2_startup.sh
                    rm /tmp/pm2_startup.sh
                    echo -e "${GREEN}✓ PM2 开机自启已设置${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  PM2 安装失败，可以稍后手动安装${NC}"
        fi
    fi
else
    echo -e "${GREEN}✓ PM2 已安装${NC}"
fi

# 测试配置
echo ""
echo "🧪 测试配置..."
if node strategies/hedge_manager.js config 2>/dev/null; then
    echo -e "${GREEN}✓ 配置测试通过${NC}"
else
    echo -e "${YELLOW}⚠️  配置测试失败，请检查 .env 文件${NC}"
fi

# 显示完成信息
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║                    ✅ 安装完成！                           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 安装目录: $INSTALL_DIR"
echo ""
echo "🚀 快速开始:"
echo ""
echo "1. 进入项目目录:"
echo "   cd $INSTALL_DIR"
echo ""
echo "2. 查看配置:"
echo "   node strategies/hedge_manager.js config"
echo ""
echo "3. 查看价差:"
echo "   node strategies/hedge_manager.js spread BTC"
echo ""
echo "4. 小额测试:"
echo "   node strategies/hedge_manager.js open --size 0.001"
echo ""
echo "5. 启动循环对冲 (使用 PM2):"
echo "   pm2 start strategies/hedge_manager.js --name hedge -- loop BTC -n 1000 -i 10"
echo "   pm2 logs hedge"
echo ""
echo "📚 查看完整文档:"
echo "   cat $INSTALL_DIR/README.md"
echo "   cat $INSTALL_DIR/QUICKSTART.md"
echo ""
echo "⚠️  重要提示:"
echo "   1. 请确保已正确配置 .env 文件"
echo "   2. 先用小金额测试"
echo "   3. 确保两边账户有充足保证金"
echo ""
echo "💡 获取 Lighter 账户索引:"
echo "   访问: https://mainnet.zklighter.elliot.ai/api/v1/account?by=l1_address&value=YOUR_WALLET_ADDRESS"
echo ""

# 询问是否查看快速指南
read -p "是否查看快速指南? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    less "$INSTALL_DIR/QUICKSTART.md" 2>/dev/null || cat "$INSTALL_DIR/QUICKSTART.md"
fi

echo ""
echo "祝使用愉快！🎉"
echo ""
