/**
 * 自动刷新 Hook
 * 根据设置中的 autoRefreshIntervalMinutes 定时刷新所有账号
 * 刷新后自动保存额度历史快照
 */

import { useEffect, useRef, useCallback } from 'react';
import { settingsStorage } from '@/services/storage';
import { useAccountStore } from '@/modules/account/account-store';
import { useRefresh } from '@/hooks/useRefresh';
import { quotaHistoryStorage, type QuotaHistoryEntry } from '@/services/quota-history-storage';
import { parseQuotaRawData } from '@/modules/core/parser';
import { getQuotaCategoryGroups } from '@/modules/core/quota-model';

/** 从当前账号列表计算汇总额度并保存历史快照 */
export async function saveQuotaSnapshot() {
  const { accounts } = useAccountStore.getState();

  if (accounts.length === 0) return;

  let grandTotal = 0;
  let grandUsed = 0;
  let grandRemain = 0;
  const categorySums: QuotaHistoryEntry['categories'] = {
    base: { total: 0, used: 0, remain: 0 },
    activity: { total: 0, used: 0, remain: 0 },
    extra: { total: 0, used: 0, remain: 0 },
    other: { total: 0, used: 0, remain: 0 },
  };

  for (const acc of accounts) {
    const quotaResult = parseQuotaRawData(
      acc.quota_raw?.dosage,
      acc.quota_raw?.payment,
      acc.quota_raw?.userResource
    );

    if (quotaResult.hasActiveResources) {
      grandTotal += quotaResult.grandTotal;
      grandUsed += quotaResult.grandUsed;
      grandRemain += quotaResult.grandRemain;

      const groups = getQuotaCategoryGroups(quotaResult.resources);
      for (const g of groups) {
        if (g.visible && g.key in categorySums) {
          const cat = g.key as keyof typeof categorySums;
          categorySums[cat].total += g.total;
          categorySums[cat].used += g.used;
          categorySums[cat].remain += g.remain;
        }
      }
    }
  }

  await quotaHistoryStorage.append({
    timestamp: new Date().toISOString(),
    grandTotal,
    grandUsed,
    grandRemain,
    categories: categorySums,
    accountCount: accounts.length,
  });
}

export function useAutoRefresh() {
  const { accounts } = useAccountStore();
  const { refreshAccount } = useRefresh();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const doAutoRefresh = useCallback(async () => {
    // 避免刷新频率过高（至少间隔5分钟）
    const now = Date.now();
    if (now - lastRefreshRef.current < 5 * 60 * 1000) return;

    lastRefreshRef.current = now;

    for (let i = 0; i < accounts.length; i += 2) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      const batch = accounts.slice(i, i + 2);
      await Promise.allSettled(batch.map((acc) => refreshAccount(acc)));
    }

    // 刷新完成后保存额度历史快照
    await saveQuotaSnapshot();
  }, [accounts, refreshAccount]);

  useEffect(() => {
    let cancelled = false;

    const setupTimer = async () => {
      const settings = await settingsStorage.get();
      const intervalMs = settings.autoRefreshIntervalMinutes * 60 * 1000;

      // 间隔 < 1 分钟视为禁用
      if (intervalMs < 60_000) return;
      if (cancelled) return;

      timerRef.current = setInterval(() => {
        if (accounts.length > 0) {
          doAutoRefresh();
        }
      }, intervalMs);
    };

    setupTimer();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [accounts.length, doAutoRefresh]);
}
