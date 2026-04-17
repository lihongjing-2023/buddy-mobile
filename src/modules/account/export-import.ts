/**
 * 账号导入/导出工具
 * 兼容 PC 端 cockpit-tools 的 JSON 格式
 * 支持 camelCase/snake_case 字段映射
 */

import type { WorkbuddyAccount, ImportResult } from '../core/types';
import { parseWorkbuddyAccount, asRecord } from '../core/parser';

// ==================== 导入逻辑 ====================

/** 解析导入数据，支持多种格式 */
export function parseImportData(raw: unknown): WorkbuddyAccount[] {
  if (!raw) return [];

  // 格式1: 单个对象
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = asRecord(raw);

    // 检查是否为包装格式 { accounts: [...] } 或 { items: [...] }
    const wrappedAccounts = rec.accounts || rec.items;
    if (Array.isArray(wrappedAccounts)) {
      return parseImportArray(wrappedAccounts);
    }

    // 检查是否有 access_token 字段，判断是否为单个账号
    const hasToken = !!(
      rec.access_token ||
      rec.accessToken ||
      rec.access_token
    );
    if (hasToken) {
      try {
        return [parseWorkbuddyAccount(rec)];
      } catch {
        return [];
      }
    }

    return [];
  }

  // 格式2: 数组
  if (Array.isArray(raw)) {
    return parseImportArray(raw);
  }

  return [];
}

function parseImportArray(arr: unknown[]): WorkbuddyAccount[] {
  const results: WorkbuddyAccount[] = [];

  for (const item of arr) {
    try {
      const account = parseWorkbuddyAccount(asRecord(item));
      if (account.access_token && account.email) {
        results.push(account);
      }
    } catch {
      // 跳过无法解析的条目
    }
  }

  return results;
}

/** 执行导入（含去重 upsert） */
export async function importAccounts(
  raw: unknown,
  existingAccounts: WorkbuddyAccount[]
): Promise<ImportResult> {
  const parsed = parseImportData(raw);

  if (parsed.length === 0) {
    return { success: false, imported:0, skipped:0, errors: ['未找到有效账号'], accounts: [] };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const finalAccounts: WorkbuddyAccount[] = [...existingAccounts];

  for (const incoming of parsed) {
    const dupIdx = finalAccounts.findIndex(
      (a) =>
        a.id === incoming.id ||
        (a.email && a.email === incoming.email) ||
        (a.uid && a.uid === incoming.uid)
    );

    if (dupIdx >= 0) {
      // 合并：保留 last_used 较新的
      const existing = finalAccounts[dupIdx];
      const keepExisting =
        existing.last_used &&
        existing.last_used >= (incoming.last_used || 0);

      finalAccounts[dupIdx] = keepExisting
        ? { ...existing, ...incoming, last_used: existing.last_used }
        : { ...incoming, ...existing, last_used: incoming.last_used };
      skipped++;
    } else {
      finalAccounts.push(incoming);
      imported++;
    }
  }

  return {
    success: true,
    imported,
    skipped,
    errors,
    accounts: finalAccounts,
  };
}

// ==================== 导出逻辑 ====================

/** 导出账号列表为 JSON 字符串 */
export function exportAccounts(accounts: WorkbuddyAccount[]): string {
  const exportable = accounts.map((acc) => ({
    id: acc.id,
    platform: acc.platform,
    email: acc.email,
    uid: acc.uid || '',
    nickname: acc.nickname || '',
    avatar_url: acc.avatar_url || '',
    name: acc.name || '',
    domain: acc.domain || '',
    enterprise_id: acc.enterprise_id || '',
    enterprise_name: acc.enterprise_name || '',
    access_token: acc.access_token,
    refresh_token: acc.refresh_token,
    expires_at: acc.expires_at,
    last_used: acc.last_used || 0,

    // 配额和签到数据也一并导出
    quota_raw: acc.quota_raw ? { ...acc.quota_raw } : undefined,
    checkin_status: acc.checkin_status
      ? { ...acc.checkin_status }
      : undefined,
    last_checkin_time: acc.last_checkin_time || 0,
  }));

  return JSON.stringify(exportable, null, 2);
}

/** 从剪贴板/文本解析导入数据 */
export function parseTextImport(text: string): unknown {
  text = text.trim();
  if (!text) throw new Error('输入内容为空');

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 解析失败: ${(err as Error).message}`);
  }
}
