/**
 * HTTP 客户端
 * 基于 axios，带 Token 自动刷新拦截器 + 并发锁机制
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_ENDPOINTS } from '@/modules/core/constants';
import type { ApiResponse, TokenRefreshData } from '@/modules/core/types';

// ==================== 类型定义 ====================

/** Token 刷新回调函数签名 */
export type TokenRefreshFn = (
  refreshToken: string
) => Promise<TokenRefreshData>;

/** HTTP 客户户端配置选项 */
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

// ==================== 创建实例 ====================

export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: API_ENDPOINTS.BASE,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // 并发刷新锁：防止多个 401 同时触发多次 refresh
  let refreshPromise: Promise<TokenRefreshData> | null = null;

  // ====== Request 拦截器：注入 Auth Headers ======
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = options.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const domain = options.getDomain?.();
      if (domain) {
        config.headers['X-Domain'] = domain;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // ====== Response 拦截器：自动刷新 Token ======
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // 仅对 401 且未重试过的请求进行 token 刷新
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('auth/token/refresh')
      ) {
        originalRequest._retry = true;
        const rt = options.getRefreshToken();

        if (!rt) {
          // 无 refresh_token，直接拒绝
          return Promise.reject(error);
        }

        // 使用并发锁，确保只执行一次 refresh
        if (!refreshPromise) {
          refreshPromise = doTokenRefresh(rt)
            .then((data) => {
              options.onTokenRefreshed(data);
              return data;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        try {
          const newTokens = await refreshPromise;
          // 重试原请求，更新 Authorization header
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return instance(originalRequest);
        } catch (refreshErr) {
          // refresh 失败，清除本地 token
          console.error('[HttpClient] Token refresh failed:', refreshErr);
          return Promise.reject(refreshErr);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

/** 执行实际的 Token 刷新请求 */
async function doTokenRefresh(
  refreshToken: string
): Promise<TokenRefreshData> {
  const response = await axios.post<ApiResponse<TokenRefreshData>>(
    `${API_ENDPOINTS.BASE}${API_ENDPOINTS.TOKEN_REFRESH}`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken,
      },
    }
  );

  const body = response.data;
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
