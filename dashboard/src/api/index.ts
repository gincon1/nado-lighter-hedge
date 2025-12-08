/**
 * API 服务
 * 与后端 REST API 交互
 */

import type { HedgeConfig, LoopParams, ApiResponse, StatusResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '请求失败',
    };
  }
}

// 获取配置
export async function getConfig(): Promise<ApiResponse<HedgeConfig>> {
  return request<HedgeConfig>('/api/config');
}

// 更新配置
export async function updateConfig(config: Partial<HedgeConfig>): Promise<ApiResponse<HedgeConfig>> {
  return request<HedgeConfig>('/api/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// 获取状态
export async function getStatus(): Promise<ApiResponse<StatusResponse>> {
  return request<StatusResponse>('/api/status');
}

// 获取价格
export async function getPrices(): Promise<ApiResponse<any>> {
  return request('/api/prices');
}

// 单次对冲
export async function hedgeOnce(coin?: string, size?: number): Promise<ApiResponse<any>> {
  return request('/api/hedge/once', {
    method: 'POST',
    body: JSON.stringify({ coin, size }),
  });
}

// 循环对冲
export async function hedgeLoop(params: LoopParams): Promise<ApiResponse<any>> {
  return request('/api/hedge/loop', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// 停止对冲
export async function stopHedge(): Promise<ApiResponse<any>> {
  return request('/api/hedge/stop', {
    method: 'POST',
  });
}
