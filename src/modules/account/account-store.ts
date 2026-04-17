/**
 * 账号状态管理 - Zustand Store
 * 负责账号 CRUD + 持久化
 *
 * Token 存储策略：
 * - SecureStore: token 的唯一持久化来源（加密存储）
 * - AsyncStorage: 账号元数据（不含 token 明文）
 * - Zustand 内存: 完整账号对象（含 token），方便 UI 使用
 *
 * 写入流程：内存对象 → 剥离 token → AsyncStorage 存元数据 + SecureStore 存 token
 * 读取流程：AsyncStorage 读元数据 → SecureStore 补充 token → 组装完整对象
 */

import { create } from 'zustand';
import type { WorkbuddyAccount } from '@/modules/core/types';
import { accountStorage, tokenStorage } from '@/services/storage';
import { parseWorkbuddyAccount } from '../core/parser';

// ==================== Token 剥离/补充工具 ====================

/** 从账号对象中剥离 token，返回不含 token 的安全副本 */
function stripTokens(account: WorkbuddyAccount): Omit<WorkbuddyAccount, 'access_token' | 'refresh_token'> & { access_token?: string; refresh_token?: string } {
  const { access_token: _at, refresh_token: _rt, ...safe } = account;
  // 保留标记位，表示 token 存在于 SecureStore
  return { ...safe, access_token: undefined, refresh_token: undefined };
}

/** 从 SecureStore 补充 token 到账号对象 */
async function hydrateTokens(account: WorkbuddyAccount): Promise<void> {
  const [at, rt] = await Promise.all([
    tokenStorage.getAccessToken(account.id),
    tokenStorage.getRefreshToken(account.id),
  ]);
  if (at) account.access_token = at;
  if (rt) account.refresh_token = rt;
}

/** 将 token 写入 SecureStore */
async function persistTokens(account: WorkbuddyAccount): Promise<void> {
  if (account.access_token) {
    await tokenStorage.setAccessToken(account.id, account.access_token);
  }
  if (account.refresh_token) {
    await tokenStorage.setRefreshToken(account.id, account.refresh_token);
  }
}

/** 将 token 变更写入 SecureStore */
async function persistTokenUpdates(id: string, updates: Partial<WorkbuddyAccount>): Promise<void> {
  if (updates.access_token) {
    await tokenStorage.setAccessToken(id, updates.access_token);
  }
  if (updates.refresh_token) {
    await tokenStorage.setRefreshToken(id, updates.refresh_token);
  }
}

// ==================== Store State ====================

interface AccountState {
  /** 所有账号（内存中含 token，持久化时剥离） */
  accounts: WorkbuddyAccount[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 正在刷新的账号 ID 集合 */
  refreshingIds: Set<string>;
  /** 最后错误信息 */
  error: string | null;

  // ====== Actions ======

  /** 从存储加载账号列表 */
  loadAccounts: () => Promise<void>;

  /** 导入新账号（upsert 去重） */
  upsertAccounts: (newAccounts: WorkbuddyAccount[]) => Promise<number>;

  /** 更新单个账号（如刷新后） */
  updateAccount: (id: string, updates: Partial<WorkbuddyAccount>) => Promise<void>;

  /** 删除单个账号 */
  removeAccount: (id: string) => Promise<void>;

  /** 批量删除账号 */
  removeAccounts: (ids: string[]) => Promise<void>;

  /** 清空所有账号 */
  clearAll: () => Promise<void>;

  /** 标记正在刷新 */
  setRefreshing: (ids: string[], refreshing: boolean) => void;

  /** 设置错误信息 */
  setError: (error: string | null) => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  isLoading: false,
  refreshingIds: new Set(),
  error: null,

  loadAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const raw = await accountStorage.getAccounts<Record<string, unknown>>();
      const accounts = Array.isArray(raw) 
        ? raw.map((r) => parseWorkbuddyAccount(r))
        : [];

      // 从 SecureStore 补充 token（唯一权威来源）
      await Promise.all(accounts.map(hydrateTokens));

      set({ accounts, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: `加载失败: ${err}` });
    }
  },

  upsertAccounts: async (newAccounts: WorkbuddyAccount[]): Promise<number> => {
    const current = get().accounts;
    let addedCount = 0;

    for (const incoming of newAccounts) {
      const existingIdx = current.findIndex(
        (a) =>
          a.id === incoming.id ||
          (a.email && a.email === incoming.email) ||
          (a.uid && a.uid === incoming.uid)
      );

      if (existingIdx >= 0) {
        const existing = current[existingIdx];
        const merged: WorkbuddyAccount = {
          ...(existing.last_used && existing.last_used >= (incoming.last_used || 0)
            ? existing
            : incoming),
          nickname: incoming.nickname || existing.nickname,
          avatar_url: incoming.avatar_url || existing.avatar_url,
          name: incoming.name || existing.name,
          domain: incoming.domain || existing.domain,
          enterprise_id: incoming.enterprise_id || existing.enterprise_id,
          enterprise_name: incoming.enterprise_name || existing.enterprise_name,
          last_used: Math.max(existing.last_used || 0, incoming.last_used || 0),
        };
        current[existingIdx] = merged;
      } else {
        current.push(incoming);
        addedCount++;
      }
    }

    // 持久化：AsyncStorage 存元数据（剥离 token），SecureStore 存 token
    const safeAccounts = current.map(stripTokens);
    await accountStorage.setAccounts(safeAccounts);
    await Promise.all(newAccounts.map(persistTokens));
    set({ accounts: [...current] });

    return addedCount;
  },

  updateAccount: async (id, updates) => {
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );

    // 持久化：AsyncStorage 存元数据（剥离 token），SecureStore 存 token
    const safeAccounts = accounts.map(stripTokens);
    await accountStorage.setAccounts(safeAccounts);
    await persistTokenUpdates(id, updates);
    set({ accounts });
  },

  removeAccount: async (id) => {
    const accounts = get().accounts.filter((a) => a.id !== id);
    const safeAccounts = accounts.map(stripTokens);
    await accountStorage.setAccounts(safeAccounts);
    await tokenStorage.removeTokens(id);
    set({ accounts });
  },

  removeAccounts: async (ids) => {
    const idSet = new Set(ids);
    const accounts = get().accounts.filter((a) => !idSet.has(a.id));
    const safeAccounts = accounts.map(stripTokens);
    await accountStorage.setAccounts(safeAccounts);
    await Promise.all(ids.map((id) => tokenStorage.removeTokens(id)));
    set({ accounts });
  },

  clearAll: async () => {
    const allIds = get().accounts.map((a) => a.id);
    await accountStorage.clearAccounts();
    await Promise.all(allIds.map((id) => tokenStorage.removeTokens(id)));
    set({ accounts: [] });
  },

  setRefreshing: (ids, refreshing) => {
    const refreshingIds = new Set(get().refreshingIds);
    for (const id of ids) {
      if (refreshing) refreshingIds.add(id);
      else refreshingIds.delete(id);
    }
    set({ refreshingIds });
  },

  setError: (error) => set({ error }),
}));
