#!/usr/bin/env python3
"""
Lighter API Key 设置脚本
用于生成和配置 Lighter API Key
"""

import asyncio
import os
import sys

# 检查 lighter 模块
try:
    import lighter
except ImportError:
    print("❌ Lighter Python SDK 未安装")
    print("\n请运行以下命令安装:")
    print("  pip install git+https://github.com/elliottech/lighter-python.git")
    sys.exit(1)

# 从 .env 文件加载配置
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env()

BASE_URL = "https://mainnet.zklighter.elliot.ai"

async def get_account_info(eth_private_key: str):
    """获取账户信息"""
    print("\n📋 获取账户信息...")
    
    client = lighter.ApiClient(url=BASE_URL)
    account_api = lighter.AccountApi(client)
    
    try:
        # 从私钥获取地址
        from eth_account import Account
        wallet = Account.from_key(eth_private_key)
        address = wallet.address
        
        print(f"   钱包地址: {address}")
        
        # 查询账户
        account = await account_api.account(by="l1_address", value=address)
        
        print(f"\n✅ 账户信息:")
        print(f"   账户索引 (LIGHTER_ACCOUNT_INDEX): {account.account_index}")
        print(f"   可用保证金: {int(account.free_collateral or 0) / 1e8:.2f} USDC")
        
        return account.account_index
        
    except Exception as e:
        print(f"\n❌ 获取账户失败: {e}")
        print("\n如果你还没有在 Lighter 上注册:")
        print("1. 访问 https://app.lighter.xyz")
        print("2. 连接你的钱包")
        print("3. 完成注册后重新运行此脚本")
        return None
    finally:
        await client.close()

async def setup_api_key():
    """设置 API Key"""
    print("\n" + "=" * 60)
    print("🔑 Lighter API Key 设置向导")
    print("=" * 60)
    
    # 获取以太坊私钥
    eth_private_key = os.environ.get('LIGHTER_ETH_PRIVATE_KEY') or os.environ.get('LIGHTER_PRIVATE_KEY')
    
    if not eth_private_key:
        print("\n请输入你的以太坊私钥 (用于生成 API Key):")
        print("(输入后按 Enter，私钥不会显示)")
        eth_private_key = input().strip()
    
    if not eth_private_key:
        print("❌ 未提供私钥")
        return
    
    # 确保有 0x 前缀
    if not eth_private_key.startswith('0x'):
        eth_private_key = '0x' + eth_private_key
    
    # 获取账户信息
    account_index = await get_account_info(eth_private_key)
    
    if account_index is None:
        return
    
    # 询问是否生成新的 API Key
    print("\n" + "-" * 40)
    print("📌 API Key 设置选项:")
    print("1. 使用现有的 API Key (如果你已经有)")
    print("2. 生成新的 API Key")
    
    choice = input("\n请选择 (1/2): ").strip()
    
    if choice == "1":
        print("\n请输入你的 API Key 私钥:")
        api_key_private_key = input().strip()
        
        api_key_index = input("请输入 API Key 索引 (默认 2): ").strip()
        api_key_index = int(api_key_index) if api_key_index else 2
        
    else:
        print("\n🔄 生成新的 API Key...")
        
        api_key_index = input("请输入 API Key 索引 (2-254, 默认 2): ").strip()
        api_key_index = int(api_key_index) if api_key_index else 2
        
        if api_key_index < 2 or api_key_index > 254:
            print("❌ API Key 索引必须在 2-254 之间")
            return
        
        try:
            # 生成 API Key
            private_key, public_key, err = lighter.SignerClient.generate_api_key(eth_private_key)
            
            if err:
                print(f"❌ 生成 API Key 失败: {err}")
                return
            
            api_key_private_key = private_key
            
            print("\n✅ API Key 生成成功!")
            print(f"   API Key 私钥: {private_key[:20]}...{private_key[-8:]}")
            print(f"   API Key 公钥: {public_key}")
            
        except Exception as e:
            print(f"❌ 生成 API Key 失败: {e}")
            return
    
    # 验证 API Key
    print("\n🔍 验证 API Key...")
    
    try:
        signer_client = lighter.SignerClient(
            url=BASE_URL,
            private_key=api_key_private_key,
            account_index=account_index,
            api_key_index=api_key_index
        )
        
        err = signer_client.check_client()
        
        if err:
            print(f"⚠️  API Key 验证警告: {err}")
            print("这可能是因为 API Key 还未注册到链上")
            print("首次交易时会自动注册")
        else:
            print("✅ API Key 验证成功!")
            
    except Exception as e:
        print(f"⚠️  验证时出现警告: {e}")
    
    # 输出配置
    print("\n" + "=" * 60)
    print("📝 请将以下配置添加到 .env 文件:")
    print("=" * 60)
    print(f"""
# Lighter 配置
LIGHTER_PRIVATE_KEY={api_key_private_key}
LIGHTER_ACCOUNT_INDEX={account_index}
LIGHTER_API_KEY_INDEX={api_key_index}
""")
    
    # 询问是否自动更新 .env
    update = input("\n是否自动更新 .env 文件? (y/N): ").strip().lower()
    
    if update == 'y':
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        
        # 读取现有内容
        existing = {}
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        existing[key.strip()] = value.strip()
        
        # 更新 Lighter 配置
        existing['LIGHTER_PRIVATE_KEY'] = api_key_private_key
        existing['LIGHTER_ACCOUNT_INDEX'] = str(account_index)
        existing['LIGHTER_API_KEY_INDEX'] = str(api_key_index)
        
        # 写入文件
        with open(env_path, 'w') as f:
            f.write("# Nado 配置\n")
            if 'NADO_PRIVATE_KEY' in existing:
                f.write(f"NADO_PRIVATE_KEY={existing['NADO_PRIVATE_KEY']}\n")
            else:
                f.write("NADO_PRIVATE_KEY=your_nado_private_key_here\n")
            f.write(f"NADO_NETWORK={existing.get('NADO_NETWORK', 'inkMainnet')}\n")
            
            f.write("\n# Lighter 配置\n")
            f.write(f"LIGHTER_PRIVATE_KEY={existing['LIGHTER_PRIVATE_KEY']}\n")
            f.write(f"LIGHTER_ACCOUNT_INDEX={existing['LIGHTER_ACCOUNT_INDEX']}\n")
            f.write(f"LIGHTER_API_KEY_INDEX={existing['LIGHTER_API_KEY_INDEX']}\n")
            
            f.write("\n# 对冲配置\n")
            f.write(f"HEDGE_COIN={existing.get('HEDGE_COIN', 'BTC')}\n")
            f.write(f"HEDGE_SIZE={existing.get('HEDGE_SIZE', '0.001')}\n")
            f.write(f"HEDGE_SLIPPAGE={existing.get('HEDGE_SLIPPAGE', '0.001')}\n")
            f.write(f"HEDGE_ORDER_TYPE={existing.get('HEDGE_ORDER_TYPE', 'ioc')}\n")
        
        print(f"\n✅ .env 文件已更新: {env_path}")
    
    print("\n🎉 设置完成!")
    print("\n下一步:")
    print("1. 运行 node scripts/test_lighter.js 测试连接")
    print("2. 运行 node strategies/hedge_manager.js config 查看配置")

if __name__ == "__main__":
    asyncio.run(setup_api_key())
