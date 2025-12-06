const axios = require('axios');
const { privateKeyToAccount } = require('viem/accounts');
const { encodePacked, keccak256, toHex } = require('viem');
const { ensureHexPrefix, isValidPrivateKey } = require('./utils');
const { Deployments } = require('./types');
const {
  subaccountToHex,
  signOrder,
  signCancelOrders,
  signCancelProductOrders,
  getOrderVerifyingAddress,
} = require('./signer');
const {
  getOrderNonce,
  addDecimals,
  toIntegerString,
  packOrderAppendix,
  getOrderExpiration,
} = require('./orders');

/**
 * Nado 客户端封装
 * 使用 REST API 直接调用
 */
class NadoClient {
  // API 端点配置
  static ENDPOINTS = {
    inkMainnet: {
      gateway: 'https://gateway.prod.nado.xyz/v1',
      gatewayV2: 'https://gateway.prod.nado.xyz/v2',
      archive: 'https://archive.prod.nado.xyz/v1',
      archiveV2: 'https://archive.prod.nado.xyz/v2',
      trigger: 'https://trigger.prod.nado.xyz/v1',
      websocket: 'wss://gateway.prod.nado.xyz/v1/ws',
    },
    inkTestnet: {
      gateway: 'https://gateway.testnet.nado.xyz/v1',
      gatewayV2: 'https://gateway.prod.nado.xyz/v2',
      archive: 'https://archive.testnet.nado.xyz/v1',
      archiveV2: 'https://archive.prod.nado.xyz/v2',
      trigger: 'https://trigger.testnet.nado.xyz/v1',
      websocket: 'wss://gateway.testnet.nado.xyz/v1/ws',
    },
  };

  constructor(privateKey, options = {}) {
    const {
      network = 'inkTestnet',  // 'inkMainnet' | 'inkTestnet'
    } = options;

    // 验证私钥
    if (!isValidPrivateKey(privateKey)) {
      throw new Error('无效的私钥格式');
    }

    this.privateKey = ensureHexPrefix(privateKey);
    this.network = network;

    // 创建 viem 账户
    this.account = privateKeyToAccount(this.privateKey);
    this.address = this.account.address;

    // 创建默认子账户 ID (address + 12 bytes for name)
    // subaccount bytes32 = address (20 bytes) + subaccountName (12 bytes)
    // Nado 默认使用 "default" 作为子账户名称
    this.subaccountName = 'default';
    this.subaccount = subaccountToHex(this.address, this.subaccountName);

    // 获取部署配置
    const deployment = Deployments[network];
    if (!deployment) {
      throw new Error(`不支持的网络: ${network}，请使用 'inkMainnet' 或 'inkTestnet'`);
    }
    this.deployment = deployment;
    this.chainId = deployment.chainId;
    this.sequencerAddress = deployment.endpoint;  // 取消订单等操作使用 sequencer 地址

    // 获取 API 端点
    const endpoints = NadoClient.ENDPOINTS[network];
    if (!endpoints) {
      throw new Error(`不支持的网络: ${network}，请使用 'inkMainnet' 或 'inkTestnet'`);
    }

    this.engineUrl = endpoints.gateway;  // Gateway API 用于查询和执行
    this.indexerUrl = endpoints.archive;  // Archive API 用于历史数据
    this.triggerUrl = endpoints.trigger;   // Trigger API 用于条件订单

    // 创建 HTTP 客户端
    this.httpClient = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NadoSDK/0.1.0',
      },
      withCredentials: true,
      validateStatus: () => true, // 自定义状态验证
    });

    console.log(`✅ Nado 客户端初始化成功`);
    console.log(`地址: ${this.address}`);
    console.log(`网络: ${network}`);
    console.log(`Gateway: ${this.engineUrl}`);
    console.log(`Archive: ${this.indexerUrl}`);
  }

  /**
   * 获取用户地址
   * @returns {string}
   */
  getAddress() {
    return this.address;
  }

  /**
   * 查询请求（发送到 /query 端点）
   * @private
   */
  async _query(endpoint, params) {
    const url = `${endpoint}/query`;

    try {
      const response = await this.httpClient.get(url, { params });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (response.data.status === 'failure') {
        throw new Error(response.data.error || '查询失败');
      }

      return response.data.data || response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`查询失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 执行请求（发送到 /execute 端点）
   * @private
   */
  async _execute(endpoint, payload) {
    const url = `${endpoint}/execute`;

    try {
      const response = await this.httpClient.post(url, payload);

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (response.data.status === 'failure') {
        throw new Error(response.data.error || '执行失败');
      }

      return response.data.data || response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`执行失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 获取所有产品信息
   * @returns {Promise<Object>}
   */
  async getAllProducts() {
    return await this._query(this.engineUrl, {
      type: 'all_products',
    });
  }

  /**
   * 获取交易对符号列表
   * @returns {Promise<Object>}
   */
  async getSymbols() {
    return await this._query(this.engineUrl, {
      type: 'symbols',
    });
  }

  /**
   * 获取市场价格
   * @param {string} productId - 产品 ID
   * @returns {Promise<Object>}
   */
  async getMarketPrice(productId) {
    return await this._query(this.engineUrl, {
      type: 'market_price',
      product_id: productId,
    });
  }

  /**
   * 获取市场流动性（订单簿）
   * @param {string} productId - 产品 ID
   * @param {number} depth - 深度，默认 20
   * @returns {Promise<Object>}
   */
  async getMarketLiquidity(productId, depth = 20) {
    return await this._query(this.engineUrl, {
      type: 'market_liquidity',
      product_id: productId,
      depth,
    });
  }

  /**
   * 获取子账户信息（持仓、余额等）
   * @param {string} subaccountId - 子账户 ID，默认使用当前的默认子账户
   * @returns {Promise<Object>}
   */
  async getSubaccountInfo(subaccountId = null) {
    return await this._query(this.engineUrl, {
      type: 'subaccount_info',
      subaccount: subaccountId || this.subaccount,
    });
  }

  /**
   * 获取隔离持仓
   * @param {string} subaccountId - 子账户 ID
   * @returns {Promise<Object>}
   */
  async getIsolatedPositions(subaccountId = null) {
    return await this._query(this.engineUrl, {
      type: 'isolated_positions',
      subaccount: subaccountId || this.subaccount,
    });
  }

  /**
   * 获取订单信息
   * @param {string} digest - 订单摘要/ID
   * @returns {Promise<Object>}
   */
  async getOrder(digest) {
    return await this._query(this.engineUrl, {
      type: 'order',
      digest,
    });
  }

  /**
   * 获取子账户的所有订单
   * @param {string} productId - 产品 ID
   * @param {string} subaccountId - 子账户 ID
   * @returns {Promise<Object>}
   */
  async getSubaccountOrders(productId, subaccountId = null) {
    return await this._query(this.engineUrl, {
      type: 'subaccount_orders',
      product_id: productId,
      sender: subaccountId || this.subaccount,
    });
  }

  /**
   * 获取手续费率
   * @param {string} subaccountId - 子账户 ID
   * @returns {Promise<Object>}
   */
  async getSubaccountFeeRates(subaccountId = null) {
    return await this._query(this.engineUrl, {
      type: 'fee_rates',
      sender: subaccountId || this.subaccount,
    });
  }

  /**
   * 下单
   * @param {Object} orderParams - 订单参数
   * @param {number} orderParams.productId - 产品 ID
   * @param {number|string} orderParams.price - 价格
   * @param {number|string} orderParams.size - 数量
   * @param {string} orderParams.side - 方向: 'buy' | 'sell'
   * @param {string} orderParams.orderType - 订单类型: 'default' | 'ioc' | 'fok' | 'post_only'
   * @param {boolean} orderParams.reduceOnly - 是否只减仓
   * @param {number} orderParams.expirationSeconds - 过期秒数，0=GTC
   * @returns {Promise<Object>}
   */
  async placePerpOrder(orderParams) {
    const {
      productId,
      price,
      size,
      side,
      orderType = 'default',
      reduceOnly = false,
      expirationSeconds = 0,
    } = orderParams;

    // 计算 amount: 正数=买，负数=卖
    const amount = side.toLowerCase() === 'buy' ? Math.abs(parseFloat(size)) : -Math.abs(parseFloat(size));

    // 生成 nonce
    const nonce = getOrderNonce();

    // 计算过期时间
    const expiration = toIntegerString(getOrderExpiration(expirationSeconds));

    // 打包 appendix
    const appendix = toIntegerString(packOrderAppendix({
      orderExecutionType: orderType,
      reduceOnly,
      isolated: false,
      triggerType: null,
    }));

    // 构建 EIP-712 订单值
    const orderValues = {
      sender: this.subaccount,
      priceX18: toIntegerString(addDecimals(price)),
      amount: toIntegerString(addDecimals(amount)),
      expiration,
      nonce,
      appendix,
    };

    // 签名
    const signature = await signOrder(
      this.account,
      orderValues,
      productId,
      this.chainId
    );

    // 构建请求 payload
    const payload = {
      place_order: {
        product_id: productId,
        order: orderValues,
        signature,
        spot_leverage: null,
        borrow_margin: null,
      },
    };

    // 执行下单
    const result = await this._execute(this.engineUrl, payload);

    return {
      ...result,
      orderParams: {
        productId,
        price,
        size,
        side,
        orderType,
        nonce,
      },
    };
  }

  /**
   * 取消订单
   * @param {Object} params - 取消参数
   * @param {number[]} params.productIds - 产品 ID 列表
   * @param {string[]} params.digests - 订单摘要列表
   * @returns {Promise<Object>}
   */
  async cancelOrders(params) {
    const { productIds, digests } = params;

    // 生成 nonce
    const nonce = getOrderNonce();

    // 构建取消订单 EIP-712 值
    const cancelValues = {
      sender: this.subaccount,
      productIds,
      digests,
      nonce,
    };

    // 签名 (使用 sequencer 地址)
    const signature = await signCancelOrders(
      this.account,
      cancelValues,
      this.sequencerAddress,
      this.chainId
    );

    // 构建请求 payload
    const payload = {
      cancel_orders: {
        tx: cancelValues,
        signature,
      },
    };

    // 执行取消
    return await this._execute(this.engineUrl, payload);
  }

  /**
   * 取消单个订单
   * @param {number} productId - 产品 ID
   * @param {string} digest - 订单摘要
   * @returns {Promise<Object>}
   */
  async cancelOrder(productId, digest) {
    return await this.cancelOrders({
      productIds: [productId],
      digests: [digest],
    });
  }

  /**
   * 取消某个产品的所有订单
   * @param {number[]} productIds - 产品 ID 列表
   * @returns {Promise<Object>}
   */
  async cancelProductOrders(productIds) {
    // 生成 nonce
    const nonce = getOrderNonce();

    // 构建取消订单 EIP-712 值
    const cancelValues = {
      sender: this.subaccount,
      productIds,
      nonce,
    };

    // 签名 (使用 sequencer 地址)
    const signature = await signCancelProductOrders(
      this.account,
      cancelValues,
      this.sequencerAddress,
      this.chainId
    );

    // 构建请求 payload
    const payload = {
      cancel_product_orders: {
        tx: cancelValues,
        signature,
      },
    };

    // 执行取消
    return await this._execute(this.engineUrl, payload);
  }

  /**
   * 获取子账户 hex
   * @returns {string}
   */
  getSubaccount() {
    return this.subaccount;
  }
}

module.exports = NadoClient;
