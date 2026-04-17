/**
 * 配额历史数据存储
 * 每次刷新后将汇总额度快照保存，用于仪表盘折线图展示
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUOTA_HISTORY_KEY = 'cockpit_quota_history';

/** 单条历史记录 */
export interface QuotaHistoryEntry {
  /** 记录时间 ISO 字符串 */
  timestamp: string;
  /** 总额度（所有账号汇总） */
  grandTotal: number;
  /** 总已使用（所有账号汇总） */
  grandUsed: number;
  /** 总剩余（所有账号汇总） */
  grandRemain: number;
  /** 按分类汇总 */
  categories: {
    base: { total: number; used: number; remain: number };
    activity: { total: number; used: number; remain: number };
    extra: { total: number; used: number; remain: number };
    other: { total: number; used: number; remain: number };
  };
  /** 账号数量 */
  accountCount: number;
}

/** 最多保留的历史条目数（约7天，每10分钟一条 = ~1008条，限制500条） */
const MAX_ENTRIES = 500;

// 简单的异步锁，防止并发追加导致数据丢失
let appendLock: Promise<void> = Promise.resolve();

export const quotaHistoryStorage = {
  /** 获取所有历史记录 */
  async getAll(): Promise<QuotaHistoryEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(QUOTA_HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /** 追加一条历史记录（带锁，防止并发冲突） */
  async append(entry: QuotaHistoryEntry): Promise<void> {
    // 使用锁队列确保串行执行
    const release = await acquireLock();
    try {
      const entries = await this.getAll();
      entries.push(entry);

      // 超出上限时裁剪（保留最新的）
      if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
      }

      await AsyncStorage.setItem(QUOTA_HISTORY_KEY, JSON.stringify(entries));
    } finally {
      release();
    }
  },

  /** 获取最近 N 条记录 */
  async getRecent(count: number): Promise<QuotaHistoryEntry[]> {
    const all = await this.getAll();
    return all.slice(-count);
  },

  /** 按时间范围获取记录 */
  async getByRange(startTime: string, endTime: string): Promise<QuotaHistoryEntry[]> {
    const all = await this.getAll();
    return all.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  },

  /** 清空所有历史 */
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(QUOTA_HISTORY_KEY);
  },
};

/** 获取追加锁 */
async function acquireLock(): Promise<() => void> {
  let release: () => void;
  const newLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prevLock = appendLock;
  appendLock = prevLock.then(() => newLock);
  await prevLock;
  return release!;
}
