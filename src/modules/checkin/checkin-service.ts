/**
 * 签到服务 - 封装 2 个签到 API
 * 使用原生 fetch 替代 axios
 */

import type {
  CheckinStatusResponse,
  CheckinResponse,
  WorkbuddyAccount,
} from '@/modules/core/types';
import { API_ENDPOINTS } from '@/modules/core/constants';
import { postJson } from '@/services/http-client';
import { runInBatches } from '@/modules/core/batch';

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
      const body = await postJson<CheckinStatusResponse>(
        API_ENDPOINTS.CHECKIN_STATUS,
        {},
        headers,
        15_000
      );
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
      const body = await postJson<CheckinResponse>(
        API_ENDPOINTS.DAILY_CHECKIN,
        {},
        headers,
        15_000
      );

      if (body.code === 0 || body.code === 200) {
        const data = body.data;
        return {
          success: data.success,
          message: data.message || (data.success ? '签到成功' : '今日已签到'),
          reward: data.reward || 0,
        };
      }

      // 业务错误码：部分情况下"已签到"也走此分支，检查 msg 判断
      const msg = body.msg || '';
      const alreadyCheckedIn = /已签到|already|checked.?in|重复/i.test(msg);
      if (alreadyCheckedIn) {
        return {
          success: true,
          message: msg || '今日已签到',
          reward: 0,
        };
      }

      return {
        success: false,
        message: msg || `签到失败(code=${body.code})`,
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
    const batchResults = await runInBatches(
      accounts,
      concurrency,
      (acc) =>
        CheckinService.doDailyCheckin(acc).then((r) => ({
          accountId: acc.id,
          email: acc.email,
          ...r,
        })),
      { onProgress }
    );

    return batchResults.map((br, idx) => {
      if (br.status === 'fulfilled') return br.value;
      return {
        accountId: accounts[idx]?.id || 'unknown',
        email: accounts[idx]?.email || 'unknown',
        success: false,
        message: `异常: ${br.reason}`,
      };
    });
  }
}
