/**
 * 自动刷新 Hook
 * 提供 Token 刷新 + 配额查询的封装
 *
 * 刷新前从 SecureStore 获取最新 token，避免内存中的 token 过期
 */

import { useCallback } from 'react';
import { useAccountStore } from '@/modules/account/account-store';
import { tokenStorage } from '@/services/storage';
import { AccountService } from '@/modules/account/account-service';
import { CheckinService } from '@/modules/checkin/checkin-service';
import { isTokenExpiringSoon } from '@/modules/core/quota-model';
import type { WorkbuddyAccount } from '@/modules/core/types';

/**
 * 刷新单个账号
 * 流程：从 SecureStore 获取最新 token → Token 刷新 → 并行3路配额API → 更新 store
 */
export function useRefresh() {
  const { updateAccount, setRefreshing, setError } = useAccountStore();

  const refreshAccount = useCallback(
    async (account: WorkbuddyAccount) => {
      setRefreshing([account.id], true);
      setError(null);

      try {
        // 从 SecureStore 获取最新 token（避免内存中 token 过期）
        const [secureAt, secureRt] = await Promise.all([
          tokenStorage.getAccessToken(account.id),
          tokenStorage.getRefreshToken(account.id),
        ]);
        const freshAccount: WorkbuddyAccount = {
          ...account,
          access_token: secureAt || account.access_token,
          refresh_token: secureRt || account.refresh_token,
        };

        const service = new AccountService(
          (await import('axios')).default,
          () => freshAccount.uid,
          () => freshAccount.domain
        );

        const { updatedAccount, quotaRaw } = await service.refreshAccount(freshAccount);

        // 配额刷新完成后，并行获取签到状态（失败不影响主流程）
        const checkinStatusPromise = CheckinService.fetchCheckinStatus(
          updatedAccount.access_token,
          updatedAccount.domain,
          updatedAccount.uid,
          updatedAccount.enterprise_id,
          updatedAccount.tenant_id
        ).catch(() => null);

        const checkinStatus = await checkinStatusPromise;

        await updateAccount(account.id, {
          ...updatedAccount,
          quota_raw: quotaRaw,
          checkin_status: checkinStatus ?? updatedAccount.checkin_status,
        });

        return { success: true, account: updatedAccount };
      } catch (err) {
        const msg = (err as Error).message || '刷新失败';
        setError(`${account.email}: ${msg}`);
        return { success: false, error: msg };
      } finally {
        setRefreshing([account.id], false);
      }
    },
    [updateAccount, setRefreshing, setError]
  );

  /** 按需刷新（仅 Token 即将过期时才刷新） */
  const refreshIfNeeded = useCallback(
    async (account: WorkbuddyAccount) => {
      if (isTokenExpiringSoon(account.expires_at)) {
        return refreshAccount(account);
      }
      return { success: true, skipped: true as const };
    },
    [refreshAccount]
  );

  return { refreshAccount, refreshIfNeeded };
}
