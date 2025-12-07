/**
 * 结构化日志模块
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || 'info';
const pretty = process.env.LOG_PRETTY !== 'false';

// 创建日志实例
export const logger = pino({
  level: logLevel,
  transport: pretty && isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * 创建子日志器
 */
export function createLogger(name: string) {
  return logger.child({ module: name });
}

/**
 * 日志辅助函数
 */
export const log = {
  info: (msg: string, data?: any) => logger.info(data, msg),
  warn: (msg: string, data?: any) => logger.warn(data, msg),
  error: (msg: string, error?: any) => {
    if (error instanceof Error) {
      logger.error({ err: error, stack: error.stack }, msg);
    } else {
      logger.error({ error }, msg);
    }
  },
  debug: (msg: string, data?: any) => logger.debug(data, msg),
  trace: (msg: string, data?: any) => logger.trace(data, msg),
};

/**
 * 交易日志（专门用于记录交易事件）
 */
export const tradeLogger = logger.child({ type: 'trade' });

/**
 * 风控日志
 */
export const riskLogger = logger.child({ type: 'risk' });

/**
 * 性能日志
 */
export const perfLogger = logger.child({ type: 'performance' });
