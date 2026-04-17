/**
 * 配额服务 - 封装 3 个配额 API
 * 依赖 http-client 的 axios 实例
 */

import axios from 'axios';
import type {
  DosageNotifyResponse,
  PaymentTypeResponse,
  UserResourceResponse,
  UserResourceQuery,
  ApiResponse,
  WorkbuddyAccount,
  QuotaRawData,
} from '@/modules/core/types';
import { API_ENDPOINTS, DEFAULT_PRODUCT_CODE, RESOURCE_STATUS } from '@/modules/core/constants';
import { buildQuotaHeaders } from '@/services/http-client';

export class QuotaService {
  constructor(
    private getAccessToken: () => string | undefined,
    private getUid?: () => string | undefined,
    private getDomain?: () => string | undefined
  ) {}

  /** 查询配额通知 */
  async fetchDosageNotify(account: WorkbuddyAccount): Promise<DosageNotifyResponse | undefined> {
    const headers = this.buildHeaders(account);
    try {
      const response = await axios.post<ApiResponse<DosageNotifyResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.DOSAGE_NOTIFY}`,
        {},
        { headers }
      );
      const data = response.data;
      return (data.code === 0 || data.code === 200) ? data.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** 查询支付类型/套餐信息 */
  async fetchPaymentType(account: WorkbuddyAccount): Promise<PaymentTypeResponse | undefined> {
    const headers = this.buildHeaders(account);
    try {
      const response = await axios.post<ApiResponse<PaymentTypeResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.PAYMENT_TYPE}`,
        {},
        { headers }
      );
      const data = response.data;
      return (data.code === 0 || data.code === 200) ? data.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** 查询用户资源列表 */
  async fetchUserResource(
    account: WorkbuddyAccount
  ): Promise<UserResourceResponse | undefined> {
    // 与 PC 端对齐：时间使用 "YYYY-MM-DD HH:MM:SS" 字符串格式，范围从当前到 101 年后
    const now = new Date();
    const formatDateTime = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const endTime = new Date(now);
    endTime.setFullYear(endTime.getFullYear() + 101);

    const body: UserResourceQuery = {
      PageNumber: 1,
      PageSize: 100,
      ProductCode: DEFAULT_PRODUCT_CODE,
      Status: [RESOURCE_STATUS.valid, RESOURCE_STATUS.usedUp],
      PackageEndTimeRangeBegin: formatDateTime(now),
      PackageEndTimeRangeEnd: formatDateTime(endTime),
    };

    const headers = this.buildHeaders(account);
    try {
      const response = await axios.post<ApiResponse<UserResourceResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.USER_RESOURCE}`,
        body,
        { headers }
      );

      const data = response.data;
      return (data.code === 0 || data.code === 200) ? data.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** 并行请求全部 3 个配额 API，返回合并结果 */
  async fetchAllQuotaRaw(
    account: WorkbuddyAccount
  ): Promise<QuotaRawData> {
    const [dosage, payment, userResource] = await Promise.all([
      this.fetchDosageNotify(account),
      this.fetchPaymentType(account),
      this.fetchUserResource(account),
    ]);

    return { dosage, payment, userResource };
  }

  // ====== 内部辅助方法 ======

  private buildHeaders(account: WorkbuddyAccount): Record<string, string> {
    const uid = this.getUid?.() || account.uid;
    const domain = this.getDomain?.() || account.domain;
    const enterpriseId = account.enterprise_id;
    const tenantId = account.tenant_id;

    return {
      ...buildQuotaHeaders(uid, domain, enterpriseId, tenantId),
      Authorization: `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
    };
  }
}
