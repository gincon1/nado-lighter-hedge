/**
 * Lighter Client SDK - 修复版本
 * 基于 Lighter 官方 API 文档 (https://apidocs.lighter.xyz)
 * 
 * 重要说明：
 * Lighter 使用特殊的签名机制，需要通过 Go 编译的二进制库进行签名。
 * 本 SDK 提供两种模式：
 * 1. 只读模式：获取市场数据、订单簿等（不需要签名）
 * 2. 交易模式：需要配合官方 Python SDK 或自行实现签名
 * 
 * 推荐方案：使用 Python 子进程调用官方 SDK 进行签名和下单
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class LighterClient {
  constructor(privateKey, accountIndex = 0, apiKeyIndex = 2, options = {}) {
    this.privateKey = privateKey;
    this.accountIndex = accountIndex;
    this.apiKeyIndex = apiKeyIndex;
    
    // 官方 API 基础 URL
    this.baseUrl = options.baseUrl || 'https://mainnet.zklighter.elliot.ai';
    this.apiUrl = `${this.baseUrl}/api/v1`;
    this.wsUrl = options.wsUrl || 'wss://mainnet.zklighter.elliot.ai/stream';
    
    // 注意：Lighter API 私钥不是以太坊私钥，不能用 ethers.Wallet 初始化
    // 地址需要通过 account_index 查询获取
    this.wallet = null;
    this.address = null;
    
    // Nonce 管理
    this._nonce = null;
    
    // 订单簿索引映射（根据 Lighter 官方 - 已修正）
    this.orderBookIds = {
      'ETH': 0, 'ETHUSD': 0,
      'BTC': 1, 'BTCUSD': 1,
      'SOL': 2, 'SOLUSD': 2,
      'DOGE': 3, 'DOGEUSD': 3,
      'PEPE': 4, 'PEPEUSD': 4,
      'WLD': 5, 'WLDUSD': 5,
      'LINK': 6, 'LINKUSD': 6,
      'AVAX': 7, 'AVAXUSD': 7,
      'NEAR': 8, 'NEARUSD': 8,
      'DOT': 9, 'DOTUSD': 9,
      'TON': 10, 'TONUSD': 10,
      'TAO': 11, 'TAOUSD': 11,
      'POL': 12, 'POLUSD': 12,
    };

    // HTTP 客户端配置
    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  // ========== 只读 API（不需要签名）==========

  /**
   * 获取 API 状态
   */
  async getStatus() {
    try {
      const response = await axios.get(this.baseUrl);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * 获取交易所信息
   */
  async getInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/info`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get info: ${error.message}`);
    }
  }

  /**
   * 获取账户信息（通过 L1 地址）
   */
  async getAccount(address = null) {
    try {
      const response = await this.httpClient.get('/account', {
        params: {
          by: 'l1_address',
          value: address || this.address
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get account: ${error.message}`);
    }
  }

  /**
   * 获取账户信息（通过索引）
   */
  async getAccountByIndex(index = null) {
    try {
      const response = await this.httpClient.get('/account', {
        params: {
          by: 'index',
          value: index !== null ? index : this.accountIndex
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get account by index: ${error.message}`);
    }
  }

  /**
   * 获取订单簿 ID
   */
  getOrderBookId(symbol) {
    const normalizedSymbol = symbol.toUpperCase().replace('USD', '');
    const orderBookId = this.orderBookIds[normalizedSymbol] ?? this.orderBookIds[symbol.toUpperCase()];
    if (orderBookId === undefined) {
      throw new Error(`Unknown symbol: ${symbol}. Available: ${Object.keys(this.orderBookIds).join(', ')}`);
    }
    return orderBookId;
  }

  /**
   * 获取所有订单簿信息
   */
  async getOrderBooks() {
    try {
      const response = await this.httpClient.get('/orderBooks');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get order books: ${error.message}`);
    }
  }

  /**
   * 获取订单簿详情（包含深度数据）- 正确的端点
   */
  async getOrderBookDetails(symbol, depth = 20) {
    try {
      const orderBookId = this.getOrderBookId(symbol);
      const response = await this.httpClient.get('/orderBookDetails', {
        params: {
          order_book_id: orderBookId,
          depth: depth
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get order book details: ${error.message}`);
    }
  }

  /**
   * 兼容旧方法名
   */
  async getOrderBook(symbol, depth = 20) {
    return this.getOrderBookDetails(symbol, depth);
  }

  /**
   * 获取最近成交
   */
  async getRecentTrades(symbol, limit = 50) {
    try {
      const orderBookId = this.getOrderBookId(symbol);
      const response = await this.httpClient.get('/recentTrades', {
        params: {
          order_book_id: orderBookId,
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get recent trades: ${error.message}`);
    }
  }

  /**
   * 获取 K 线数据
   */
  async getCandlesticks(symbol, resolution = '1h', limit = 100) {
    try {
      const orderBookId = this.getOrderBookId(symbol);
      const response = await this.httpClient.get('/candlesticks', {
        params: {
          order_book_id: orderBookId,
          resolution: resolution,
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get candlesticks: ${error.message}`);
    }
  }

  /**
   * 获取资金费率
   */
  async getFundingRates(symbol) {
    try {
      const orderBookId = this.getOrderBookId(symbol);
      const response = await this.httpClient.get('/funding-rates', {
        params: {
          order_book_id: orderBookId
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get funding rates: ${error.message}`);
    }
  }

  /**
   * 获取交易所统计
   */
  async getExchangeStats() {
    try {
      const response = await this.httpClient.get('/exchangeStats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get exchange stats: ${error.message}`);
    }
  }

  /**
   * 获取下一个 nonce
   */
  async getNextNonce() {
    try {
      const response = await this.httpClient.get('/nextNonce', {
        params: {
          account_index: this.accountIndex,
          api_key_index: this.apiKeyIndex
        }
      });
      this._nonce = response.data.nonce;
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get next nonce: ${error.message}`);
    }
  }

  // ========== 交易 API（通过 Python SDK）==========

  /**
   * 通过 Python SDK 创建订单
   */
  async createOrderViaPython(params) {
    const {
      symbol,
      side,
      orderType = 'limit',
      amount,
      price,
      reduce_only = false,
      time_in_force = 'ioc'
    } = params;

    const orderBookId = this.getOrderBookId(symbol);
    
    // 不同市场的精度配置 (根据 Lighter API)
    const marketPrecision = {
      0: { sizeDecimals: 4, priceDecimals: 2 },  // ETH
      1: { sizeDecimals: 5, priceDecimals: 1 },  // BTC
      2: { sizeDecimals: 3, priceDecimals: 3 },  // SOL
    };
    
    const precision = marketPrecision[orderBookId] || { sizeDecimals: 5, priceDecimals: 1 };
    const baseMult = Math.pow(10, precision.sizeDecimals);
    const priceMult = Math.pow(10, precision.priceDecimals);
    
    const baseAmount = Math.floor(parseFloat(amount) * baseMult);
    const priceInt = Math.floor(parseFloat(price) * priceMult);
    
    // 确定 side 字符串
    const sideStr = side === 'buy' ? 'bid' : 'ask';
    
    // 确定 time_in_force
    // 使用 IOC (Immediate Or Cancel) 立即成交
    let tifStr = 'ORDER_TIME_IN_FORCE_IMMEDIATE_OR_CANCEL';
    let orderExpiry = 0;  // IOC 使用 0
    
    if (time_in_force === 'gtc') {
      tifStr = 'ORDER_TIME_IN_FORCE_GOOD_TILL_TIME';
      orderExpiry = -1;  // GTT 使用 -1 (默认 28 天)
    } else if (time_in_force === 'post_only') {
      tifStr = 'ORDER_TIME_IN_FORCE_POST_ONLY';
      orderExpiry = -1;
    }
    
    // 生成唯一的 client_order_index
    const clientOrderIndex = Math.floor(Date.now() % 1000000);
    
    // 生成 Python 脚本
    const pythonScript = `
import asyncio
import lighter
import json
import sys

async def create_order():
    try:
        # 新版 SDK 使用 api_private_keys 字典
        client = lighter.SignerClient(
            url="${this.baseUrl}",
            account_index=${this.accountIndex},
            api_private_keys={${this.apiKeyIndex}: "${this.privateKey}"}
        )
        
        err = client.check_client()
        if err:
            print(json.dumps({"success": False, "error": str(err)}))
            return
        
        # 使用限价单（参考 perp-dex-tools 实现）
        # order_expiry=-1 表示使用默认的28天过期
        result = await client.create_order(
            market_index=${orderBookId},
            client_order_index=${clientOrderIndex},
            is_ask=${sideStr === 'ask' ? 'True' : 'False'},
            price=${priceInt},
            base_amount=${baseAmount},
            order_type=client.ORDER_TYPE_LIMIT,
            time_in_force=client.${tifStr},
            reduce_only=${reduce_only ? 'True' : 'False'},
            trigger_price=0,
            order_expiry=${orderExpiry}
        )
        
        print(json.dumps({"success": True, "result": str(result), "client_order_index": ${clientOrderIndex}}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

asyncio.run(create_order())
`;

    return this._runPythonScript(pythonScript);
  }

  /**
   * 运行 Python 脚本
   */
  _runPythonScript(script) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`Python script failed (code ${code}): ${stderr}`));
          return;
        }
        
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          
          if (!result.success) {
            reject(new Error(result.error || 'Unknown error'));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}\nStderr: ${stderr}`));
        }
      });
      
      python.on('error', (err) => {
        reject(new Error(`Failed to start Python: ${err.message}`));
      });
    });
  }

  /**
   * 创建订单 - 主方法
   */
  async createOrder(params) {
    console.log('📤 通过 Python SDK 创建 Lighter 订单...');
    console.log(`   Symbol: ${params.symbol}, Side: ${params.side}, Price: ${params.price}, Amount: ${params.amount}`);
    
    try {
      const result = await this.createOrderViaPython(params);
      console.log('✅ Lighter 订单创建成功');
      console.log('   订单结果:', JSON.stringify(result));
      return result;
    } catch (error) {
      // 提供详细的错误说明
      if (error.message.includes('lighter') || error.message.includes('ModuleNotFoundError')) {
        throw new Error(`
❌ Lighter Python SDK 未安装或配置错误

请执行以下步骤：

1. 安装 Python SDK:
   pip install git+https://github.com/elliottech/lighter-python.git

2. 如果是首次使用，需要设置 API Key:
   参考: https://github.com/elliottech/lighter-python/blob/main/examples/system_setup.py

3. 确保 API Key Index >= 2 (0 和 1 保留给桌面和移动端)

原始错误: ${error.message}
        `);
      }
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(clientOrderIndex) {
    const pythonScript = `
import asyncio
import lighter
import json

async def cancel_order():
    try:
        client = lighter.SignerClient(
            url="${this.baseUrl}",
            account_index=${this.accountIndex},
            api_private_keys={${this.apiKeyIndex}: "${this.privateKey}"}
        )
        
        err = client.check_client()
        if err:
            print(json.dumps({"success": False, "error": str(err)}))
            return
        
        result = await client.create_cancel_order(
            order_index=${clientOrderIndex}
        )
        
        print(json.dumps({"success": True, "result": str(result)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

asyncio.run(cancel_order())
`;

    return this._runPythonScript(pythonScript);
  }

  /**
   * 获取持仓信息
   */
  async getPositions() {
    try {
      const account = await this.getAccountByIndex();
      return account.positions || [];
    } catch (error) {
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }

  /**
   * 获取活跃订单
   */
  async getActiveOrders(symbol = null) {
    try {
      const params = {
        account_index: this.accountIndex
      };
      
      if (symbol) {
        params.order_book_id = this.getOrderBookId(symbol);
      }

      const response = await this.httpClient.get('/accountActiveOrders', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get active orders: ${error.message}`);
    }
  }

  /**
   * 兼容旧方法名
   */
  async getOrders(symbol = null) {
    return this.getActiveOrders(symbol);
  }

  /**
   * 获取历史订单
   */
  async getInactiveOrders(symbol = null, limit = 50) {
    try {
      const params = {
        account_index: this.accountIndex,
        limit: limit
      };
      
      if (symbol) {
        params.order_book_id = this.getOrderBookId(symbol);
      }

      const response = await this.httpClient.get('/accountInactiveOrders', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get inactive orders: ${error.message}`);
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 转换数量到合约格式（8位小数）
   */
  toContractAmount(amount) {
    return Math.floor(parseFloat(amount) * 1e8);
  }

  /**
   * 从合约格式转换数量
   */
  fromContractAmount(amount) {
    return parseFloat(amount) / 1e8;
  }

  /**
   * 验证账户配置
   */
  async validateAccount() {
    try {
      const account = await this.getAccount();
      
      if (!account || !account.account_index) {
        throw new Error('Account not found. Please check your wallet address.');
      }
      
      // 更新账户索引
      if (this.accountIndex === 0) {
        this.accountIndex = account.account_index;
        console.log(`ℹ️  自动更新账户索引: ${this.accountIndex}`);
      }
      
      console.log(`✅ Lighter 账户验证成功`);
      console.log(`   地址: ${this.address}`);
      console.log(`   账户索引: ${account.account_index}`);
      console.log(`   可用保证金: ${this.fromContractAmount(account.free_collateral || 0)} USDC`);
      
      return account;
    } catch (error) {
      throw new Error(`Account validation failed: ${error.message}`);
    }
  }
}

module.exports = LighterClient;
