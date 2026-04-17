/**
 * 存储封装层
 * SecureStore (Token 安全存储) + AsyncStorage (账号数据持久化)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== 常量 ====================

const KEYS = {
  ACCOUNTS: 'cockpit_accounts',
  SETTINGS: 'cockpit_settings',
  CHECKIN_LOG: 'cockpit_checkin_log',
} as const;

// ==================== Token 安全存储 ====================

/**
 * SecureStore key 只允许字母数字、"." 和 "-"
 * 将 accountId 中的非法字符（如 _）替换为 "-"
 */
function toSecureKey(prefix: string, accountId: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9.\-]/g, '-');
  return `${prefix}.${safeId}`;
}

export const tokenStorage = {
  /** 存储 access_token */
  async setAccessToken(accountId: string, token: string): Promise<void> {
    await SecureStore.setItemAsync(toSecureKey('at', accountId), token);
  },

  /** 获取 access_token */
  async getAccessToken(accountId: string): Promise<string | null> {
    return await SecureStore.getItemAsync(toSecureKey('at', accountId));
  },

  /** 存储 refresh_token */
  async setRefreshToken(accountId: string, token: string): Promise<void> {
    await SecureStore.setItemAsync(toSecureKey('rt', accountId), token);
  },

  /** 获取 refresh_token */
  async getRefreshToken(accountId: string): Promise<string | null> {
    return await SecureStore.getItemAsync(toSecureKey('rt', accountId));
  },

  /** 删除某个账号的 token 对 */
  async removeTokens(accountId: string): Promise<void> {
    await SecureStore.deleteItemAsync(toSecureKey('at', accountId));
    await SecureStore.deleteItemAsync(toSecureKey('rt', accountId));
  },
};

// ==================== 账号数据存储 (AsyncStorage) ====================

export interface AppSettings {
  autoRefreshIntervalMinutes: number;
  backgroundCheckinEnabled: boolean;
  backgroundCheckinHour: number; // 24h format
}

const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshIntervalMinutes: 60,
  backgroundCheckinEnabled: false,
  backgroundCheckinHour: 9, // 早上9点
};

export const accountStorage = {
  /**
   * 获取所有账号元数据（不含 token 明文）
   * Token 存储在 SecureStore，加载后需通过 tokenStorage 补充
   */
  async getAccounts<T>(): Promise<T[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /** 保存账号元数据列表（应先剥离 token 明文） */
  async setAccounts(accounts: unknown[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  /** 清空所有账号 */
  async clearAccounts(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ACCOUNTS);
  },
};

// ==================== 设置存储 ====================

export const settingsStorage = {
  async get(): Promise<AppSettings> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async save(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.get();
    await AsyncStorage.setItem(
      KEYS.SETTINGS,
      JSON.stringify({ ...current, ...settings })
    );
  },
};

// ==================== 签到日志存储 ====================

export interface CheckinLogEntry {
  accountId: string;
  date: string; // YYYY-MM-DD
  success: boolean;
  message?: string;
  reward?: number;
}

export const checkinLogStorage = {
  async getLog(date: string): Promise<CheckinLogEntry[]> {
    try {
      const allLogsRaw = await AsyncStorage.getItem(KEYS.CHECKIN_LOG);
      const allLogs: Record<string, CheckinLogEntry[]> = allLogsRaw
        ? JSON.parse(allLogsRaw)
        : {};
      return allLogs[date] || [];
    } catch {
      return [];
    }
  },

  async appendLog(entry: CheckinLogEntry): Promise<void> {
    try {
      const allLogsRaw = await AsyncStorage.getItem(KEYS.CHECKIN_LOG);
      let allLogs: Record<string, CheckinLogEntry[]> = {};
      if (allLogsRaw) {
        try {
          const parsed = JSON.parse(allLogsRaw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            allLogs = parsed;
          }
        } catch {
          // 解析失败，使用空对象继续
          allLogs = {};
        }
      }
      if (!allLogs[entry.date]) allLogs[entry.date] = [];
      allLogs[entry.date].push(entry);

      // 只保留最近 30 天的日志
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      Object.keys(allLogs).forEach((d) => {
        if (d < cutoffStr) delete allLogs[d];
      });

      await AsyncStorage.setItem(KEYS.CHECKIN_LOG, JSON.stringify(allLogs));
    } catch (err) {
      console.error('[checkinLogStorage] appendLog failed:', err);
      // 静默失败，不影响主流程
    }
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.CHECKIN_LOG);
  },
};
