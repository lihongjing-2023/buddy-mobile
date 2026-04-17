/**
 * 账号服务 - API 调用层
 * 封装 Token 刷新 + 账号信息拉取 + 三路配额 API 并行调用
 */

import axios, { AxiosInstance } from 'axios';
import {
  API_ENDPOINTS,
  DEFAULT_PRODUCT_CODE,
  RESOURCE_STATUS,
} from '@/modules/core/constants';
import type {
  WorkbuddyAccount,
  QuotaRawData,
  TokenRefreshData,
  ApiResponse,
  DosageNotifyResponse,
  PaymentTypeResponse,
  UserResourceResponse,
  UserResourceQuery,
} from '@/modules/core/types';
import { buildQuotaHeaders } from '@/services/http-client';
import { normalizeUserResourceItem } from '@/modules/core/parser';

// ==================== 账号服务类 ====================

export class AccountService {
  constructor(
    private httpClient: AxiosInstance,
    private getUid?: () => string | undefined,
    private getDomain?: () => string | undefined
  ) {}

  /**
   * 刷新单个账号的完整流程：
   * 1. 用 refresh_token 换新 token
   * 2. 并行调用 3 个配额 API
   * 3. 返回更新后的账号 + 配额数据
   */
  async refreshAccount(account: WorkbuddyAccount): Promise<{
    updatedAccount: WorkbuddyAccount;
    quotaRaw: QuotaRawData;
  }> {
    // Step 1: Token 刷新
    const tokens = await this.refreshToken(account);
    const now = Date.now();

    // 构建更新后的账号对象
    const updatedAccount: WorkbuddyAccount = {
      ...account,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      domain: tokens.domain || account.domain,
      token_type: tokens.tokenType || account.token_type,
      last_used: now,
    };

    // Step 2: 使用新 token 并行请求 3 个配额 API
    const quotaRaw = await this.fetchAllQuota(updatedAccount);

    return { updatedAccount, quotaRaw };
  }

  /** 仅刷新 Token（不含配额查询） */
  async refreshToken(
    account: WorkbuddyAccount
  ): Promise<TokenRefreshData> {
    const response = await axios.post<ApiResponse<TokenRefreshData>>(
      `${API_ENDPOINTS.BASE}${API_ENDPOINTS.TOKEN_REFRESH}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account.access_token}`,
          'X-Refresh-Token': account.refresh_token,
          ...(account.domain ? { 'X-Domain': account.domain } : {}),
        },
      }
    );

    const body = response.data;
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(`Token 刷新失败: ${body.msg}`);
    }
    return body.data;
  }

  /** 并行请求 3 个配额 API */
  async fetchAllQuota(
    account: WorkbuddyAccount
  ): Promise<QuotaRawData> {
    const uid = this.getUid?.() || account.uid;
    const domain = this.getDomain?.() || account.domain;
    const enterpriseId = account.enterprise_id;
    const tenantId = account.tenant_id;
    const headers = buildQuotaHeaders(uid, domain, enterpriseId, tenantId);
    const authHeader = {
      ...headers,
      Authorization: `Bearer ${account.access_token}`,
    };

    // 与 PC 端对齐：时间使用 "YYYY-MM-DD HH:MM:SS" 字符串格式，范围从当前到 101 年后
    const now = new Date();
    const formatDateTime = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const endTime = new Date(now);
    endTime.setFullYear(endTime.getFullYear() + 101);

    const userResourceBody: UserResourceQuery = {
      PageNumber: 1,
      PageSize: 100,
      ProductCode: DEFAULT_PRODUCT_CODE,
      Status: [RESOURCE_STATUS.valid, RESOURCE_STATUS.usedUp],
      PackageEndTimeRangeBegin: formatDateTime(now),
      PackageEndTimeRangeEnd: formatDateTime(endTime),
    };

    const [dosageRes, paymentRes, userRes] = await Promise.allSettled([
      axios.post<ApiResponse<DosageNotifyResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.DOSAGE_NOTIFY}`,
        {},
        { headers: authHeader }
      ),
      axios.post<ApiResponse<PaymentTypeResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.PAYMENT_TYPE}`,
        {},
        { headers: authHeader }
      ),
      axios.post<ApiResponse<UserResourceResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.USER_RESOURCE}`,
        userResourceBody,
        { headers: authHeader }
      ),
    ]);

    return {
      dosage: dosageRes.status === 'fulfilled'
        ? dosageRes.value.data.code === 0 || dosageRes.value.data.code === 200
          ? normalizeDosageResponse(dosageRes.value.data.data)
          : undefined
        : undefined,
      payment: paymentRes.status === 'fulfilled'
        ? paymentRes.value.data.code === 0 || paymentRes.value.data.code === 200
          ? normalizePaymentResponse(paymentRes.value.data.data)
          : undefined
        : undefined,
      userResource: userRes.status === 'fulfilled'
        ? userRes.value.data.code === 0 || userRes.value.data.code === 200
          ? normalizeUserResourceResponse(userRes.value.data.data)
          : undefined
        : undefined,
    };
  }

  /**
   * 获取账号信息 (/login/account)
   */
  async fetchAccountInfo(
    accessToken: string,
    domain?: string
  ): Promise<{ uid: string; email: string; name: string; nickname?: string }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (domain) headers['X-Domain'] = domain;

    const response = await axios.get<ApiResponse<Record<string, unknown>>>(
      `${API_ENDPOINTS.BASE}${API_ENDPOINTS.ACCOUNT_INFO}?state=workbuddy`,
      { headers }
    );

    const body = response.data;
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(`获取账号信息失败: ${body.msg}`);
    }

    const data = body.data as Record<string, unknown>;
    return {
      uid: String(data.id ?? data.uid ?? ''),
      email: (data.email as string) || '',
      name: (data.name as string) || '',
      nickname: (data.nickname as string) || undefined,
    };
  }
}

// ==================== API 响应归一化 ====================

/**
 * 从嵌套的 Response.Data 结构中提取实际数据
 * API 返回格式可能是:
 *   - 直接返回数据对象
 *   - { Response: { Data: ... } }
 */
function extractPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;

  // 如果有 Response 层，往下取
  const response = (rec.Response ?? rec.response) as Record<string, unknown> | undefined;
  if (response) {
    const data = (response.Data ?? response.data) as Record<string, unknown> | undefined;
    if (data) return data;
  }

  return rec;
}

/** 归一化 dosage-notify 响应 */
function normalizeDosageResponse(raw: unknown): DosageNotifyResponse {
  const data = extractPayload(raw);
  const numVal = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
    return undefined;
  };

  return {
    total_amount: numVal(data.TotalAmount ?? data.total_amount),
    used_amount: numVal(data.UsedAmount ?? data.used_amount),
    remain_amount: numVal(data.RemainAmount ?? data.remain_amount),
    dosage_notify_id: (data.DosageNotifyId ?? data.dosage_notify_id) as string | undefined,
    dosage_notify_code: (data.DosageNotifyCode ?? data.dosage_notify_code) as string | undefined,
    dosage_notify_zh: (data.DosageNotifyZh ?? data.dosage_notify_zh) as string | undefined,
    dosage_notify_en: (data.DosageNotifyEn ?? data.dosage_notify_en) as string | undefined,
  };
}

/** 归一化 payment-type 响应 */
function normalizePaymentResponse(raw: unknown): PaymentTypeResponse {
  const data = extractPayload(raw);
  const numVal = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
    return undefined;
  };

  return {
    pay_type: numVal(data.PayType ?? data.pay_type),
    expire_time: numVal(data.ExpireTime ?? data.expire_time),
    package_code: (data.PackageCode ?? data.package_code) as string | undefined,
    plan_name: (data.PlanName ?? data.plan_name ?? data.PackageName ?? data.package_name) as string | undefined,
  };
}

/**
 * 将 API 返回的 PascalCase user-resource 响应归一化为内部 snake_case 模型
 * API 实际路径: data.Response.Data.Accounts[]
 * 字段: PackageCode, PackageName, Status, CapacitySize, CapacityRemain, ...
 */
function normalizeUserResourceResponse(raw: unknown): UserResourceResponse {
  if (!raw || typeof raw !== 'object') return {};

  const rec = raw as Record<string, unknown>;

  // 尝试从 data.Response.Data 路径提取
  const response = (rec.Response ?? rec.response) as Record<string, unknown> | undefined;
  const data = response
    ? ((response.Data ?? response.data) as Record<string, unknown> | undefined)
    : rec;

  // 提取 Accounts / accounts / items 列表
  const rawList = data?.Accounts ?? data?.accounts ?? data?.items ?? data?.Items;
  const accounts = Array.isArray(rawList) ? rawList : [];

  const items = accounts
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(normalizeUserResourceItem);

  return {
    items,
    total_count: items.length,
    page_number: 1,
    page_size: 100,
  };
}

/** 工厂函数：创建默认 AccountService 实例 */
export function createAccountService(
  httpClient: AxiosInstance,
  getUid?: () => string | undefined,
  getDomain?: () => string | undefined
): AccountService {
  return new AccountService(httpClient, getUid, getDomain);
}
