/**
 * 签到状态管理 - Zustand Store
 */

import { create } from 'zustand';
import type { CheckinStatusResponse } from '@/modules/core/types';

interface CheckinState {
  /** 各账号的签到状态映射 */
  statusMap: Record<string, CheckinStatusResponse>;
  /** 是否正在批量签到 */
  isBatchCheckingIn: boolean;
  /** 批量签到进度 */
  batchProgress: { completed: number; total: number };
  /** 最后一次批量签到结果 */
  lastBatchResult: {
    accountId: string;
    email: string;
    success: boolean;
    message: string;
    reward?: number;
  }[] | null;

  // ====== Actions ======

  /** 设置单个账号的签到状态 */
  setCheckinStatus(accountId: string, status: CheckinStatusResponse): void;

  /** 批量设置签到状态 */
  setStatusMap(map: Record<string, CheckinStatusResponse>): void;

  /** 更新批量签到状态 */
  setBatchCheckingIn(isRunning: boolean): void;

  /** 更新进度 */
  setBatchProgress(completed: number, total: number): void;

  /** 保存批量签到结果 */
  setLastBatchResult(
    result: CheckinState['lastBatchResult']
  ): void;

  /** 清除所有签到缓存 */
  clear(): void;
}

export const useCheckinStore = create<CheckinState>((set) => ({
  statusMap: {},
  isBatchCheckingIn: false,
  batchProgress: { completed: 0, total: 0 },
  lastBatchResult: null,

  setCheckinStatus: (accountId, status) =>
    set((state) => ({
      statusMap: { ...state.statusMap, [accountId]: status },
    })),

  setStatusMap: (map) => set({ statusMap: map }),

  setBatchCheckingIn: (isRunning) => set({ isBatchCheckingIn: isRunning }),

  setBatchProgress: (completed, total) =>
    set({ batchProgress: { completed, total } }),

  setLastBatchResult: (result) => set({ lastBatchResult: result }),

  clear: () =>
    set({
      statusMap: {},
      lastBatchResult: null,
      isBatchCheckingIn: false,
      batchProgress: { completed: 0, total: 0 },
    }),
}));
