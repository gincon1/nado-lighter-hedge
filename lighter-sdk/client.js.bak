/**
 * Lighter Client SDK
 * Based on Lighter API documentation and perp-dex-toolkit implementation
 */

const { ethers } = require('ethers');
const axios = require('axios');

class LighterClient {
  constructor(privateKey, accountIndex = 0, apiKeyIndex = 0, options = {}) {
    this.privateKey = privateKey;
    this.accountIndex = accountIndex;
    this.apiKeyIndex = apiKeyIndex;
    
    this.baseUrl = options.baseUrl || 'https://mainnet.zklighter.elliot.ai/api/v1';
    this.chainId = options.chainId || 324; // zkSync Era mainnet
    
    // 初始化 wallet
    this.wallet = new ethers.Wallet(privateKey);
    this.address = this.wallet.address;
    
    // 订单簿 ID 映射
    this.orderBookIds = {
      'BTCUSD': 0,
      'ETHUSD': 1,
      'SOLUSD': 2,
      // 根据需要添加更多
    };
  }

  /**
   * 生成签名
   */
  async signMessage(message) {
    return await this.wallet.signMessage(message);
  }

  /**
   * 获取账户信息
   */
  async getAccount() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/account`,
        {
          params: {
            by: 'l1_address',
            value: this.address
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get account: ${error.message}`);
    }
  }

  /**
   * 获取订单簿 ID
   */
  getOrderBookId(symbol) {
    const orderBookId = this.orderBookIds[symbol.toUpperCase()];
    if (orderBookId === undefined) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    return orderBookId;
  }

  /**
   * 获取订单簿数据
   */
  async getOrderBook(symbol, depth = 20) {
    try {
      const orderBookId = this.getOrderBookId(symbol);
      const response = await axios.get(
        `${this.baseUrl}/order_book`,
        {
          params: {
            order_book_id: orderBookId,
            depth: depth
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get order book: ${error.message}`);
    }
  }

  /**
   * 创建订单
   */
  async createOrder(params) {
    const {
      symbol,
      side, // 'buy' or 'sell'
      orderType, // 'limit' or 'market'
      amount,
      price,
      reduce_only = false
    } = params;

    try {
      const orderBookId = this.getOrderBookId(symbol);
      
      // 构建订单数据
      const orderData = {
        order_book_id: orderBookId,
        account_index: this.accountIndex,
        api_key_index: this.apiKeyIndex,
        side: side === 'buy' ? 0 : 1,
        order_type: orderType === 'limit' ? 0 : 1,
        amount: this._toContractAmount(amount),
        recipient: this.address,
        reduce_only: reduce_only
      };

      if (orderType === 'limit') {
        orderData.price = this._toContractPrice(price);
      }

      // 生成签名
      const message = this._buildOrderMessage(orderData);
      const signature = await this.signMessage(message);

      // 发送订单
      const response = await axios.post(
        `${this.baseUrl}/order`,
        {
          ...orderData,
          signature
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    try {
      const cancelData = {
        account_index: this.accountIndex,
        api_key_index: this.apiKeyIndex,
        order_id: orderId
      };

      const message = this._buildCancelMessage(cancelData);
      const signature = await this.signMessage(message);

      const response = await axios.post(
        `${this.baseUrl}/cancel`,
        {
          ...cancelData,
          signature
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  /**
   * 获取持仓
   */
  async getPositions() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/positions`,
        {
          params: {
            account_index: this.accountIndex
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }

  /**
   * 获取订单状态
   */
  async getOrder(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/order`,
        {
          params: {
            order_id: orderId
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  /**
   * 获取账户订单
   */
  async getOrders(symbol = null) {
    try {
      const params = {
        account_index: this.accountIndex
      };

      if (symbol) {
        params.order_book_id = this.getOrderBookId(symbol);
      }

      const response = await axios.get(
        `${this.baseUrl}/orders`,
        { params }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get orders: ${error.message}`);
    }
  }

  /**
   * 内部方法：转换数量到合约格式
   */
  _toContractAmount(amount) {
    // Lighter 使用 18 位精度
    return ethers.utils.parseUnits(amount.toString(), 18).toString();
  }

  /**
   * 内部方法：转换价格到合约格式
   */
  _toContractPrice(price) {
    // Lighter 使用 18 位精度
    return ethers.utils.parseUnits(price.toString(), 18).toString();
  }

  /**
   * 内部方法：构建订单签名消息
   */
  _buildOrderMessage(orderData) {
    // 简化版本，实际应该按 Lighter 规范构建
    return `Order: ${JSON.stringify(orderData)}`;
  }

  /**
   * 内部方法：构建取消订单签名消息
   */
  _buildCancelMessage(cancelData) {
    return `Cancel: ${JSON.stringify(cancelData)}`;
  }
}

module.exports = LighterClient;
