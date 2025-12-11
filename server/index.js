#!/usr/bin/env node
/**
 * Nado-Lighter 对冲机器人 API 服务器
 * 提供 REST API 和 WebSocket 实时推送
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { NadoClient, NadoPriceFeed } = require('../nado-sdk/src/index');
const { LighterClient, LighterPriceFeed } = require('../lighter-sdk/index');
const { HedgeStrategy } = require('../strategies/hedge-strategy');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ========== 全局状态 ==========
let nadoClient = null;
let lighterClient = null;
let nadoPriceFeed = null;
let lighterPriceFeed = null;
let hedgeStrategy = null;

let isRunning = false;
let currentTask = null;  // 当前运行的任务
let shouldStop = false;  // 停止标志

// 配置（可通过 API 修改）
let config = {
  coin: process.env.HEDGE_COIN || 'BTC',
  size: parseFloat(process.env.HEDGE_SIZE || '0.0013'),
  nadoOrderTimeout: parseInt(process.env.NADO_ORDER_TIMEOUT || '60000'),
  nadoMaxRetries: parseInt(process.env.NADO_MAX_RETRIES || '3'),
  nadoPriceStrategy: process.env.NADO_PRICE_STRATEGY || 'best',
  lighterMaxSlippage: parseFloat(process.env.LIGHTER_MAX_SLIPPAGE || '0.005'),
  holdTime: parseInt(process.env.HEDGE_LOOP_HOLD_TIME || '10'),
  interval: parseInt(process.env.HEDGE_LOOP_INTERVAL || '10'),
};

// 价格监控间隔
let priceMonitorInterval = null;

// ========== 初始化客户端 ==========
function initClients() {
  if (!process.env.NADO_PRIVATE_KEY) {
    throw new Error('请设置 NADO_PRIVATE_KEY 环境变量');
  }
  
  const lighterPrivateKey = process.env.API_KEY_PRIVATE_KEY || process.env.LIGHTER_PRIVATE_KEY;
  if (!lighterPrivateKey) {
    throw new Error('请设置 API_KEY_PRIVATE_KEY 环境变量');
  }

  nadoClient = new NadoClient(process.env.NADO_PRIVATE_KEY, {
    network: process.env.NADO_NETWORK || 'inkMainnet',
  });
  nadoPriceFeed = new NadoPriceFeed(nadoClient);

  lighterClient = new LighterClient(
    lighterPrivateKey,
    parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
    parseInt(process.env.LIGHTER_API_KEY_INDEX || '0')
  );
  lighterPriceFeed = new LighterPriceFeed(lighterClient);

  // 创建策略实例
  hedgeStrategy = new HedgeStrategy(
    nadoClient,
    lighterClient,
    nadoPriceFeed,
    lighterPriceFeed,
    {
      nadoOrderTimeout: config.nadoOrderTimeout,
      nadoMaxRetries: config.nadoMaxRetries,
      nadoPriceStrategy: config.nadoPriceStrategy,
      lighterMaxSlippage: config.lighterMaxSlippage,
      holdTime: config.holdTime * 1000,
    }
  );

  console.log('✅ 客户端初始化成功');
}

// ========== 日志推送 ==========
function emitLog(level, message, details = null) {
  const log = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  io.emit('log', log);
  console.log(`[${level.toUpperCase()}] ${message}`);
}

// ========== 价格监控 ==========
async function fetchPrices() {
  try {
    const coin = config.coin;
    const nadoSymbol = `${coin}-PERP`;
    const lighterSymbol = `${coin}USD`;

    const [nadoBook, lighterBook] = await Promise.all([
      nadoPriceFeed.getL2Book(nadoSymbol),
      lighterPriceFeed.getL2Book(lighterSymbol),
    ]);

    const priceData = {
      coin,
      nado: {
        bid: nadoBook.bestBid,
        ask: nadoBook.bestAsk,
        mid: nadoBook.midPrice,
      },
      lighter: {
        bid: lighterBook.bid,
        ask: lighterBook.ask,
        mid: lighterBook.mid,
      },
      spread: nadoBook.midPrice - lighterBook.mid,
      spreadPercent: ((nadoBook.midPrice - lighterBook.mid) / lighterBook.mid * 100).toFixed(4),
      timestamp: Date.now(),
    };

    io.emit('prices', priceData);
    return priceData;
  } catch (error) {
    console.error('获取价格失败:', error.message);
    return null;
  }
}

function startPriceMonitor() {
  if (priceMonitorInterval) return;
  
  // 立即获取一次
  fetchPrices();
  
  // 每 5 秒更新一次（避免 API 限流 429）
  priceMonitorInterval = setInterval(fetchPrices, 5000);
  console.log('📊 价格监控已启动 (间隔 5s)');
}

function stopPriceMonitor() {
  if (priceMonitorInterval) {
    clearInterval(priceMonitorInterval);
    priceMonitorInterval = null;
    console.log('📊 价格监控已停止');
  }
}


// ========== REST API ==========

// 获取配置
app.get('/api/config', (req, res) => {
  res.json({ success: true, data: config });
});

// 更新配置
app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  config = { ...config, ...newConfig };
  
  // 更新策略配置
  if (hedgeStrategy) {
    hedgeStrategy.config = {
      ...hedgeStrategy.config,
      nadoOrderTimeout: config.nadoOrderTimeout,
      nadoMaxRetries: config.nadoMaxRetries,
      nadoPriceStrategy: config.nadoPriceStrategy,
      lighterMaxSlippage: config.lighterMaxSlippage,
      holdTime: config.holdTime * 1000,
    };
  }
  
  emitLog('info', '配置已更新', JSON.stringify(newConfig));
  res.json({ success: true, data: config });
});

// 获取状态
app.get('/api/status', async (req, res) => {
  try {
    const state = hedgeStrategy ? hedgeStrategy.getState() : null;
    res.json({
      success: true,
      data: {
        isRunning,
        shouldStop,
        state: state?.state || 'IDLE',
        currentHedge: state?.currentHedge || null,
        stats: state?.stats || null,
        config,
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 获取价格
app.get('/api/prices', async (req, res) => {
  try {
    const prices = await fetchPrices();
    res.json({ success: true, data: prices });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 单次对冲
app.post('/api/hedge/once', async (req, res) => {
  if (isRunning) {
    return res.json({ success: false, error: '已有任务在运行中' });
  }

  const { coin, size } = req.body;
  const hedgeCoin = coin || config.coin;
  const hedgeSize = size || config.size;

  isRunning = true;
  shouldStop = false;
  io.emit('status', { isRunning: true, type: 'once' });
  emitLog('info', `开始单次对冲: ${hedgeCoin} ${hedgeSize}`);

  res.json({ success: true, message: '单次对冲已启动' });

  // 异步执行
  try {
    const result = await runHedgeOnce(hedgeCoin, hedgeSize);
    emitLog('success', `单次对冲完成`, JSON.stringify(result));
    io.emit('hedgeComplete', { type: 'once', result });
  } catch (error) {
    emitLog('error', `单次对冲失败: ${error.message}`);
    io.emit('hedgeError', { type: 'once', error: error.message });
  } finally {
    isRunning = false;
    io.emit('status', { isRunning: false });
  }
});

// 循环对冲
app.post('/api/hedge/loop', async (req, res) => {
  if (isRunning) {
    return res.json({ success: false, error: '已有任务在运行中' });
  }

  const { coin, size, rounds, interval, holdTime } = req.body;
  const hedgeCoin = coin || config.coin;
  const hedgeSize = size || config.size;
  const hedgeRounds = rounds || 5;
  const hedgeInterval = (interval || config.interval) * 1000;
  const hedgeHoldTime = (holdTime || config.holdTime) * 1000;

  isRunning = true;
  shouldStop = false;
  io.emit('status', { isRunning: true, type: 'loop', totalRounds: hedgeRounds });
  emitLog('info', `开始循环对冲: ${hedgeCoin} ${hedgeSize} x ${hedgeRounds} 轮`);

  res.json({ success: true, message: '循环对冲已启动' });

  // 异步执行
  try {
    const result = await runHedgeLoop({
      coin: hedgeCoin,
      size: hedgeSize,
      rounds: hedgeRounds,
      interval: hedgeInterval,
      holdTime: hedgeHoldTime,
    });
    emitLog('success', `循环对冲完成: ${result.successCount}/${result.totalRounds} 成功`);
    io.emit('hedgeComplete', { type: 'loop', result });
  } catch (error) {
    emitLog('error', `循环对冲失败: ${error.message}`);
    io.emit('hedgeError', { type: 'loop', error: error.message });
  } finally {
    isRunning = false;
    shouldStop = false;
    io.emit('status', { isRunning: false });
  }
});

// 停止对冲
app.post('/api/hedge/stop', (req, res) => {
  if (!isRunning) {
    return res.json({ success: false, error: '没有运行中的任务' });
  }

  shouldStop = true;
  emitLog('warning', '收到停止指令，将在当前轮次完成后停止');
  io.emit('status', { shouldStop: true });
  res.json({ success: true, message: '停止指令已发送' });
});

// ========== 对冲执行逻辑 ==========

async function runHedgeOnce(coin, size) {
  // 更新策略配置
  hedgeStrategy.config.holdTime = config.holdTime * 1000;
  
  const result = await hedgeStrategy.runOnce(coin, size);
  
  // 发送订单事件
  if (result.openResult) {
    emitOrderLog('open', result.openResult);
  }
  if (result.closeResult) {
    emitOrderLog('close', result.closeResult);
  }
  
  return result;
}

async function runHedgeLoop(params) {
  const { coin, size, rounds, interval, holdTime } = params;
  
  // 更新策略配置
  hedgeStrategy.config.holdTime = holdTime;
  
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= rounds; i++) {
    if (shouldStop) {
      emitLog('warning', `用户停止，已完成 ${i - 1}/${rounds} 轮`);
      break;
    }

    io.emit('loopProgress', { currentRound: i, totalRounds: rounds });
    emitLog('info', `开始第 ${i}/${rounds} 轮`);

    try {
      const result = await hedgeStrategy.runOnce(coin, size);
      results.push(result);

      if (result.success) {
        successCount++;
        emitOrderLog('open', result.openResult);
        emitOrderLog('close', result.closeResult);
        emitLog('success', `第 ${i} 轮完成`);
      } else {
        failCount++;
        emitLog('error', `第 ${i} 轮失败: ${result.error}`);
      }

      // 更新统计
      io.emit('stats', {
        totalRounds: successCount + failCount,
        successCount,
        failCount,
        totalVolume: successCount * size * 2,
      });

    } catch (error) {
      failCount++;
      emitLog('error', `第 ${i} 轮异常: ${error.message}`);
    }

    // 间隔等待
    if (i < rounds && !shouldStop && interval > 0) {
      emitLog('info', `等待 ${interval / 1000}s 后开始下一轮...`);
      await sleep(interval);
    }
  }

  return {
    success: failCount === 0,
    totalRounds: successCount + failCount,
    successCount,
    failCount,
    results,
  };
}

function emitOrderLog(phase, orderResult) {
  if (!orderResult) return;
  
  const { nado, lighter } = orderResult;
  
  if (nado) {
    const side = phase === 'open' ? '买入' : '卖出';
    emitLog('info', `[Nado] ${side} ${nado.filledSize} @ ${nado.avgPrice}`, 
      `重试: ${nado.retries} 次`);
  }
  
  if (lighter) {
    const side = phase === 'open' ? '卖出' : '买入';
    emitLog('info', `[Lighter] ${side} ${lighter.filledSize}`,
      `滑点: ${(lighter.slippage * 100).toFixed(4)}%`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== WebSocket ==========

io.on('connection', (socket) => {
  console.log('📱 客户端已连接:', socket.id);
  
  // 发送当前状态
  socket.emit('status', {
    isRunning,
    shouldStop,
    config,
  });
  
  // 立即发送一次价格
  fetchPrices();
  
  socket.on('disconnect', () => {
    console.log('📱 客户端已断开:', socket.id);
  });
});

// ========== 启动服务器 ==========

const PORT = process.env.API_PORT || 3001;

async function start() {
  try {
    initClients();
    startPriceMonitor();
    
    server.listen(PORT, () => {
      console.log(`\n🚀 API 服务器已启动: http://localhost:${PORT}`);
      console.log(`📊 WebSocket 已启动: ws://localhost:${PORT}`);
      console.log('\n可用 API:');
      console.log('  GET  /api/config     - 获取配置');
      console.log('  POST /api/config     - 更新配置');
      console.log('  GET  /api/status     - 获取状态');
      console.log('  GET  /api/prices     - 获取价格');
      console.log('  POST /api/hedge/once - 单次对冲');
      console.log('  POST /api/hedge/loop - 循环对冲');
      console.log('  POST /api/hedge/stop - 停止对冲');
    });
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

start();
