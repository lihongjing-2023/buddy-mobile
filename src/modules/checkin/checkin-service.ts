/**
 * 签到服务 - 封装 2 个签到 API
 */

import type {
  CheckinStatusResponse,
  CheckinResponse,
  ApiResponse,
  WorkbuddyAccount,
} from '@/modules/core/types';
import { API_ENDPOINTS } from '@/modules/core/constants';

export class CheckinService {
  /** 查询签到状态 */
  static async fetchCheckinStatus(
    accessToken: string,
    domain?: string,
    uid?: string,
    enterpriseId?: string,
    tenantId?: string
  ): Promise<CheckinStatusResponse | null> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (domain) headers['X-Domain'] = domain;
    if (uid) headers['X-User-Id'] = uid;
    if (enterpriseId) headers['X-Enterprise-Id'] = enterpriseId;
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    try {
      const axios = (await import('axios')).default;
      const response = await axios.post<ApiResponse<CheckinStatusResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.CHECKIN_STATUS}`,
        {},
        { headers, timeout: 15_000 }
      );

      const body = response.data;
      return body.code === 0 || body.code === 200 ? body.data : null;
    } catch {
      return null;
    }
  }

  /** 执行每日签到 */
  static async doDailyCheckin(
    account: WorkbuddyAccount
  ): Promise<{ success: boolean; message: string; reward?: number }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
    };
    if (account.domain) headers['X-Domain'] = account.domain;
    if (account.uid) headers['X-User-Id'] = account.uid;
    if (account.enterprise_id) {
      headers['X-Enterprise-Id'] = account.enterprise_id;
    }
    if (account.tenant_id) {
      headers['X-Tenant-Id'] = account.tenant_id;
    }

    try {
      const axios = (await import('axios')).default;
      const response = await axios.post<ApiResponse<CheckinResponse>>(
        `${API_ENDPOINTS.BASE}${API_ENDPOINTS.DAILY_CHECKIN}`,
        {},
        { headers, timeout: 15_000 }
      );

      const body = response.data;

      // code != 0 && code != 200 时 daily-checkin 返回 success=false 的业务错误（如已签到）
      if (body.code === 0 || body.code === 200) {
        const data = body.data;
        return {
          success: data.success,
          message: data.message || '签到成功',
          reward: data.reward || 0,
        };
      }

      // 业务错误码（如已签到）
      return {
        success: false,
        message: body.msg || `签到失败(code=${body.code})`,
      };
    } catch (err) {
      return {
        success: false,
        message: `网络异常: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 批量签到（控制并发数）
   * @returns 签到结果列表
   */
  static async batchCheckin(
    accounts: WorkbuddyAccount[],
    onProgress?: (completed: number, total: number) => void,
    concurrency = 5
  ): Promise<{
    accountId: string;
    email: string;
    success: boolean;
    message: string;
    reward?: number;
  }[]> {
    const results: {
      accountId: string;
      email: string;
      success: boolean;
      message: string;
      reward?: number;
    }[] = [];

    let completed = 0;

    // 分批执行，控制并发
    for (let i = 0; i < accounts.length; i += concurrency) {
      const batch = accounts.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((acc) =>
          CheckinService.doDailyCheckin(acc).then((r) => ({
            accountId: acc.id,
            email: acc.email,
            ...r,
          }))
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const br = batchResults[j];
        completed++;
        onProgress?.(completed, accounts.length);

        if (br.status === 'fulfilled') {
          results.push(br.value);
        } else {
          results.push({
            accountId: batch[j]?.id || 'unknown',
            email: batch[j]?.email || 'unknown',
            success: false,
            message: `异常: ${br.reason}`,
          });
        }
      }
    }

    return results;
  }
}
