/**
 * HTTP 客户端
 * 基于原生 fetch，带 Token 自动刷新拦截器 + 并发锁机制
 * 替代 axios 以减小 bundle 体积
 */

import { API_ENDPOINTS } from '@/modules/core/constants';
import type { ApiResponse, TokenRefreshData } from '@/modules/core/types';

// ==================== 类型定义 ====================

/** Token 刷新回调函数签名 */
export type TokenRefreshFn = (
  refreshToken: string
) => Promise<TokenRefreshData>;

/** HTTP 客户端配置选项 */
export interface HttpClientOptions {
  /** Token 获取函数 (返回当前有效的 access_token) */
  getAccessToken: () => string | undefined;
  /** Token 获取函数 (返回当前 refresh_token) */
  getRefreshToken: () => string | undefined;
  /** Token 刷新成功后的回调 */
  onTokenRefreshed: (data: TokenRefreshData) => void;
  /** 获取用户 ID (用于配额 API headers) */
  getUserId?: () => string | undefined;
  /** 获取域名 (X-Domain header) */
  getDomain?: () => string | undefined;
}

/** 请求配置 */
export interface RequestOptions {
  /** 请求头 */
  headers?: Record<string, string>;
  /** 超时时间 (ms) */
  timeout?: number;
}

/** HTTP 客户端实例接口 */
export interface HttpClient {
  /** GET 请求 */
  get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  /** POST 请求 */
  post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>>;
}

// ==================== 工具函数 ====================

/** 带超时的 fetch */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`请求超时 (${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 解析 API 响应 */
async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    // HTTP 状态码非 2xx
    const errorBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`);
  }

  const body = (await response.json()) as ApiResponse<T>;
  return body;
}

// ==================== 创建实例 ====================

export function createHttpClient(options: HttpClientOptions): HttpClient {
  // 并发刷新锁：防止多个 401 同时触发多次 refresh
  let refreshPromise: Promise<TokenRefreshData> | null = null;

  /** 构建请求头 */
  function buildHeaders(custom?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...custom,
    };

    const token = options.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const domain = options.getDomain?.();
    if (domain) {
      headers['X-Domain'] = domain;
    }

    return headers;
  }

  /** 执行请求（带 401 自动刷新重试） */
  async function request<T>(
    method: string,
    url: string,
    data?: unknown,
    requestOptions?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${API_ENDPOINTS.BASE}${url}`;
    const headers = buildHeaders(requestOptions?.headers);
    const timeout = requestOptions?.timeout ?? 30_000;

    const init: RequestInit = {
      method,
      headers,
    };

    if (data !== undefined && method !== 'GET') {
      init.body = JSON.stringify(data);
    }

    const response = await fetchWithTimeout(fullUrl, init, timeout);
    const body = await parseResponse<T>(response);

    // 401 自动刷新 Token
    if (response.status === 401 && !url.includes('auth/token/refresh')) {
      const rt = options.getRefreshToken();
      if (!rt) {
        throw new Error('无 refresh_token，认证失败');
      }

      // 使用并发锁，确保只执行一次 refresh
      if (!refreshPromise) {
        refreshPromise = doTokenRefresh(rt)
          .then((tokenData) => {
            options.onTokenRefreshed(tokenData);
            return tokenData;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newTokens = await refreshPromise;
        // 用新 token 重试原请求
        const retryHeaders = { ...headers, Authorization: `Bearer ${newTokens.accessToken}` };
        const retryInit: RequestInit = {
          method,
          headers: retryHeaders,
        };
        if (data !== undefined && method !== 'GET') {
          retryInit.body = JSON.stringify(data);
        }

        const retryResponse = await fetchWithTimeout(fullUrl, retryInit, timeout);
        return parseResponse<T>(retryResponse);
      } catch (refreshErr) {
        console.error('[HttpClient] Token refresh failed:', refreshErr);
        throw refreshErr;
      }
    }

    return body;
  }

  return {
    get<T>(url: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('GET', url, undefined, opts);
    },
    post<T>(url: string, data?: unknown, opts?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('POST', url, data, opts);
    },
  };
}

/** 执行实际的 Token 刷新请求 */
async function doTokenRefresh(
  refreshToken: string
): Promise<TokenRefreshData> {
  const response = await fetchWithTimeout(
    `${API_ENDPOINTS.BASE}${API_ENDPOINTS.TOKEN_REFRESH}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken,
      },
      body: JSON.stringify({}),
    },
    30_000
  );

  const body = (await response.json()) as ApiResponse<TokenRefreshData>;
  if (body.code !== 0 && body.code !== 200) {
    throw new Error(`Token refresh failed: ${body.msg || 'Unknown error'}`);
  }
  return body.data;
}

/** 为配额请求注入额外 headers 的辅助函数 */
export function buildQuotaHeaders(
  userId?: string,
  domain?: string,
  enterpriseId?: string,
  tenantId?: string
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (userId) headers['X-User-Id'] = userId;
  if (domain) headers['X-Domain'] = domain;
  if (enterpriseId) headers['X-Enterprise-Id'] = enterpriseId;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

// ==================== 便捷方法：无客户端直接请求 ====================

/** 直接 POST 请求（不经过 createHttpClient 实例） */
export async function postJson<T>(
  url: string,
  data?: unknown,
  headers?: Record<string, string>,
  timeout = 30_000
): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${API_ENDPOINTS.BASE}${url}`;
  const response = await fetchWithTimeout(
    fullUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: data !== undefined ? JSON.stringify(data) : JSON.stringify({}),
    },
    timeout
  );

  return parseResponse<T>(response);
}

/** 直接 GET 请求（不经过 createHttpClient 实例） */
export async function getJson<T>(
  url: string,
  headers?: Record<string, string>,
  timeout = 30_000
): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${API_ENDPOINTS.BASE}${url}`;
  const response = await fetchWithTimeout(
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    },
    timeout
  );

  return parseResponse<T>(response);
}
