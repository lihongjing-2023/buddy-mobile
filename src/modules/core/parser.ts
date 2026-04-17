/**
 * 纯解析工具函数
 * 从原项目 parser.ts 移植，零依赖
 */

import type {
  WorkbuddyAccount,
  QuotaRawData,
  UserResourceItem,
  DosageNotifyResponse,
  PaymentTypeResponse,
  UserResourceResponse,
  OfficialQuotaResource,
} from './types';
import { PACKAGE_CODE, RESOURCE_STATUS } from './constants';

// ==================== 类型守卫与转换 ====================

/** 将未知对象转为 Record */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** 安全解析数字 */
export function parseNumeric(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/** nullable 版本：无法解析返回 undefined */
function parseNumericNullable(value: unknown): number | undefined {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

// ==================== 账号解析 ====================

/** 从原始 JSON 对象解析 WorkbuddyAccount */
export function parseWorkbuddyAccount(raw: Record<string, unknown>): WorkbuddyAccount {
  const access_token =
    (raw.access_token as string) || (raw.accessToken as string) || '';
  const refresh_token =
    (raw.refresh_token as string) || (raw.refreshToken as string) || '';
  const email = (raw.email as string) || '';
  const uid = (raw.uid as string) || undefined;
  const nickname = (raw.nickname as string) || (raw.name as string) || undefined;

  // 优先使用原始 id（如 PC 端的 codebuddy_cn_xxx），避免重新生成导致 token 匹配失败
  const originalId = (raw.id as string) || undefined;
  let id: string;
  if (originalId && originalId.length > 5) {
    id = originalId;
  } else {
    // 兜底：根据 email/uid/access_token 生成唯一 ID
    const identitySeed = email || uid || access_token;
    if (!identitySeed) {
      throw new Error('Cannot generate account ID: missing email, uid and access_token');
    }
    id = `workbuddy_${identitySeed.toLowerCase()}`;
  }

  // 解析过期时间（兼容秒/毫秒）
  let expires_at = parseNumeric(
    raw.expires_at ?? raw.expiresAt,
    Date.now() + 86400000
  );
  if (expires_at < 1e12) expires_at *= 1000; // 秒转毫秒

  // 解析 quota_raw：兼容 PC 端格式（完整 API 响应）和移动端格式（已归一化）
  let quota_raw: WorkbuddyAccount['quota_raw'] = undefined;
  if (raw.quota_raw && typeof raw.quota_raw === 'object') {
    quota_raw = normalizeQuotaRaw(raw.quota_raw as Record<string, unknown>);
  }

  return {
    id,
    platform: 'workbuddy',
    email,
    uid,
    nickname,
    avatar_url: (raw.avatar_url ?? raw.avatarUrl) as string | undefined,
    access_token,
    refresh_token,
    expires_at,
    last_used: parseNumeric(raw.last_used ?? raw.lastUsed) || undefined,
    domain: raw.domain as string | undefined,
    token_type: (raw.token_type ?? raw.tokenType) as string | undefined,
    name: raw.name as string | undefined,
    enterprise_id: (raw.enterprise_id ?? raw.enterpriseId) as string | undefined,
    enterprise_name: (raw.enterprise_name ?? raw.enterpriseName) as string | undefined,
    quota_raw,
    checkin_status: raw.checkin_status as WorkbuddyAccount['checkin_status'] ?? undefined,
    last_checkin_time: parseNumeric(raw.last_checkin_time) || undefined,
  };
}

/**
 * 将 quota_raw 归一化为移动端内部格式
 * 兼容 PC 端完整 API 响应格式和移动端已归一化格式
 */
function normalizeQuotaRaw(raw: Record<string, unknown>): QuotaRawData {
  const dosage = raw.dosage ?? raw.dosageNotify;
  const payment = raw.payment ?? raw.paymentType;
  const userResource = raw.userResource ?? raw.user_resource;

  return {
    dosage: dosage ? normalizeDosageRaw(dosage) : undefined,
    payment: payment ? normalizePaymentRaw(payment) : undefined,
    userResource: userResource ? normalizeUserResourceRaw(userResource) : undefined,
  };
}

// ==================== 配额数据解析 ====================
// 与 PC 端 cockpit-tools/src/utils/codebuddy-suite/parser.ts 对齐

/**
 * 解析周期总额度
 * PC端逻辑: CycleCapacitySizePrecise ?? CycleCapacitySize ?? CapacitySizePrecise ?? CapacitySize ?? 0
 */
export function parseCycleTotal(item: UserResourceItem): number {
  // 优先从 _raw (原始 PascalCase) 中按 PC 端回退链取值
  const raw = item._raw;
  if (raw) {
    const v =
      parseNumericNullable(raw.CycleCapacitySizePrecise) ??
      parseNumericNullable(raw.CycleCapacitySize) ??
      parseNumericNullable(raw.CapacitySizePrecise) ??
      parseNumericNullable(raw.CapacitySize);
    if (v !== undefined) return v;
  }
  // 回退到已归一化的字段
  return item.cycle_total_amount || item.total_amount || 0;
}

/**
 * 解析周期剩余额度
 * PC端逻辑: CycleCapacityRemainPrecise ?? CycleCapacityRemain ?? CapacityRemainPrecise ?? CapacityRemain ?? 0
 */
export function parseCycleRemain(item: UserResourceItem): number {
  // 优先从 _raw (原始 PascalCase) 中按 PC 端回退链取值
  const raw = item._raw;
  if (raw) {
    const v =
      parseNumericNullable(raw.CycleCapacityRemainPrecise) ??
      parseNumericNullable(raw.CycleCapacityRemain) ??
      parseNumericNullable(raw.CapacityRemainPrecise) ??
      parseNumericNullable(raw.CapacityRemain);
    if (v !== undefined) return v;
  }
  // 回退到已归一化的字段
  return item.cycle_remain_amount || item.remain_amount || 0;
}

/** 判断资源是否有效（与PC端 isActiveResource 对齐：Status === 0 或 3） */
export function isActiveResource(item: UserResourceItem): boolean {
  return item.status === RESOURCE_STATUS.valid || item.status === RESOURCE_STATUS.usedUp;
}

/** 从 userResource 响应中提取资源列表 */
export function extractResourceAccounts(data: unknown): UserResourceItem[] {
  const rec = asRecord(data);
  const items = rec.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(normalizeUserResourceItem);
}

/** 将原始配额数据转换为标准化的展示模型（与PC端 toOfficialQuotaResource 对齐） */
export function toOfficialQuotaResource(
  item: UserResourceItem
): OfficialQuotaResource {
  // 与PC端对齐：total = parseCycleTotal, remain = parseCycleRemain, used = total - remain
  const total = Math.max(0, parseCycleTotal(item));
  const remain = Math.max(0, parseCycleRemain(item));
  const used = Math.max(0, total - remain);

  let progressPercent = 0;
  if (total > 0) progressPercent = Math.min(100, Math.round((used / total) * 100));

  return {
    packageCode: item.package_code ?? item.product_code ?? PACKAGE_CODE.free,
    displayName: item.package_name || '未知套餐',
    totalAmount: total,
    usedAmount: used,
    remainAmount: remain,
    cycleTotalAmount: total,
    cycleUsedAmount: used,
    extraAmount: Math.max(0, item.extra_amount || 0),
    beginTime: item.package_begin_time || undefined,
    endTime: item.package_end_time || undefined,
    status: item.status ?? RESOURCE_STATUS.valid,
    isDefaultPackage: !!item.is_default_package,
    progressPercent,
  };
}

/**
 * 聚合相同类型的周期资源（与PC端 aggregateCycleResources 对齐）
 * 将同一 category 下的多个资源项的 total/remain 累加，used = total - remain
 */
export function aggregateCycleResources(items: OfficialQuotaResource[]): OfficialQuotaResource | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const total = items.reduce((sum, r) => sum + r.totalAmount, 0);
  const remain = items.reduce((sum, r) => sum + r.remainAmount, 0);
  const used = Math.max(0, total - remain);
  const extra = items.reduce((sum, r) => sum + r.extraAmount, 0);
  const progressPercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  // 使用第一个资源的元信息
  const first = items[0];
  return {
    ...first,
    totalAmount: total,
    usedAmount: used,
    remainAmount: remain,
    cycleTotalAmount: total,
    cycleUsedAmount: used,
    extraAmount: extra,
    progressPercent,
  };
}

// ==================== 配额汇总工具 ====================

/** 合并三路 API 的原始响应 */
export interface ParsedQuotaResult {
  /** 标准化后的配额列表 */
  resources: OfficialQuotaResource[];
  /** 总额度 */
  grandTotal: number;
  /** 总已用 */
  grandUsed: number;
  /** 总剩余 */
  grandRemain: number;
  /** 是否有有效资源 */
  hasActiveResources: boolean;
}

/** 从 QuotaRawData 解析为 UI 可用的配额结果 */
export function parseQuotaRawData(
  dosage?: DosageNotifyResponse | null,
  payment?: PaymentTypeResponse | null,
  userResource?: UserResourceResponse | null
): ParsedQuotaResult {
  const rawItems = userResource?.items || [];
  // 只保留有效资源（与PC端对齐：Status 0=valid 或 3=usedUp）
  const activeItems = rawItems.filter(isActiveResource);
  const resources = activeItems.map(toOfficialQuotaResource);

  let grandTotal = 0;
  let grandUsed = 0;
  let grandRemain = 0;

  for (const res of resources) {
    grandTotal += res.totalAmount;
    grandUsed += res.usedAmount;
    grandRemain += res.remainAmount;
  }

  const hasActiveResources = resources.length > 0;

  // 如果没有 user-resource 数据，回退到 dosage 数据
  if (!hasActiveResources && dosage) {
    grandTotal = dosage.total_amount || 0;
    grandUsed = dosage.used_amount || 0;
    grandRemain = dosage.remain_amount || 0;
  }

  return {
    resources,
    grandTotal,
    grandUsed,
    grandRemain,
    hasActiveResources: hasActiveResources || (!!dosage && !!(dosage.total_amount)),
  };
}

// ==================== 内部归一化 ====================

/** 将 PascalCase 资源项转换为 snake_case（与PC端 extractResourceAccounts 对齐） */
export function normalizeUserResourceItem(raw: Record<string, unknown>): UserResourceItem {
  const numVal = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  // 优先使用 *Precise 字段（字符串精确值），再回退到整数字段
  const preciseNum = (preciseKey: string, intKey: string, fallbackKeys: string[] = []): number | undefined => {
    const preciseVal = numVal(raw[preciseKey]);
    if (preciseVal !== undefined) return preciseVal;
    const intVal = numVal(raw[intKey]);
    if (intVal !== undefined) return intVal;
    for (const key of fallbackKeys) {
      const v = numVal(raw[key]);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  return {
    id: (raw.Id ?? raw.id) as string | undefined,
    // ProductCode 是产品代码 (如 "p_tcaca")，PackageCode 是套餐代码 (如 "TCACA_code_008_xxx")
    product_code: (raw.ProductCode ?? raw.product_code) as string | undefined,
    package_code: (raw.PackageCode ?? raw.package_code) as string | undefined,
    package_name: (raw.PackageName ?? raw.package_name) as string | undefined,
    status: numVal(raw.Status ?? raw.status),
    // 保留原始值，但 total/used/remain 统一由 parseCycleTotal/parseCycleRemain 计算
    total_amount: preciseNum('CapacitySizePrecise', 'CapacitySize', ['total_amount', 'TotalAmount']) ?? 0,
    used_amount: preciseNum('CapacityUsedPrecise', 'CapacityUsed', ['used_amount', 'UsedAmount']) ?? 0,
    remain_amount: preciseNum('CapacityRemainPrecise', 'CapacityRemain', ['remain_amount', 'RemainAmount']) ?? 0,
    package_begin_time: numVal(raw.CycleStartTime ?? raw.PackageStartTime ?? raw.package_begin_time),
    package_end_time: numVal(raw.CycleEndTime ?? raw.PackageEndTime ?? raw.package_end_time),
    cycle_total_amount: preciseNum('CycleCapacitySizePrecise', 'CycleCapacitySize', ['cycle_total_amount']) ?? 0,
    cycle_remain_amount: preciseNum('CycleCapacityRemainPrecise', 'CycleCapacityRemain', ['cycle_remain_amount']) ?? 0,
    cycle_used_amount: preciseNum('CycleCapacityUsedPrecise', 'CycleCapacityUsed', ['cycle_used_amount']) ?? 0,
    extra_amount: numVal(raw.ExtraCapacity ?? raw.extra_amount),
    is_default_package: !!(raw.IsDefaultPackage ?? raw.is_default_package),
    // 保留原始 PascalCase 字段，供 parseCycleTotal/Remain 精确回退
    _raw: raw,
  };
}

// ==================== PC 端 quota_raw 兼容归一化 ====================

/**
 * 从嵌套的 Response.Data 结构中提取实际数据
 * PC 端完整 API 响应格式: { code: 0, data: { Response: { Data: ... } } }
 */
function extractPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;

  // 如果有 data 层（完整 API 响应），往下取
  const data = rec.data ?? rec.Data;
  if (data && typeof data === 'object') {
    const dataRec = data as Record<string, unknown>;
    // 如果有 Response 层，再往下取
    const response = dataRec.Response ?? dataRec.response;
    if (response && typeof response === 'object') {
      const respRec = response as Record<string, unknown>;
      const innerData = respRec.Data ?? respRec.data;
      if (innerData && typeof innerData === 'object') {
        return innerData as Record<string, unknown>;
      }
      return respRec;
    }
    return dataRec;
  }

  return rec;
}

/** 归一化 PC 端 dosage 响应为移动端 DosageNotifyResponse */
function normalizeDosageRaw(raw: unknown): DosageNotifyResponse | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  // 快速检测：如果已经是归一化格式（含 snake_case 字段），直接返回
  const rec = raw as Record<string, unknown>;
  if ('total_amount' in rec || 'used_amount' in rec || 'remain_amount' in rec) {
    return raw as DosageNotifyResponse;
  }

  const data = extractPayload(raw);
  if (!data || Object.keys(data).length === 0) return undefined;

  const numVal = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
    return undefined;
  };

  return {
    total_amount: numVal(data.TotalAmount ?? data.total_amount),
    used_amount: numVal(data.UsedAmount ?? data.used_amount),
    remain_amount: numVal(data.RemainAmount ?? data.remain_amount),
    dosage_notify_id: (data.DosageNotifyId ?? data.dosage_notify_id) as string | undefined,
    dosage_notify_code: (data.DosageNotifyCode ?? data.dosage_notify_code) as string | undefined,
    dosage_notify_zh: (data.DosageNotifyZh ?? data.dosage_notify_zh) as string | undefined,
    dosage_notify_en: (data.DosageNotifyEn ?? data.dosage_notify_en) as string | undefined,
  };
}

/** 归一化 PC 端 payment 响应为移动端 PaymentTypeResponse */
function normalizePaymentRaw(raw: unknown): PaymentTypeResponse | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  // 快速检测：如果已经是归一化格式（含 snake_case 字段），直接返回
  const rec = raw as Record<string, unknown>;
  if ('package_code' in rec || 'pay_type' in rec) {
    return raw as PaymentTypeResponse;
  }

  const data = extractPayload(raw);
  if (!data || Object.keys(data).length === 0) return undefined;

  const numVal = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
    return undefined;
  };

  return {
    pay_type: numVal(data.PayType ?? data.pay_type ?? data.paymentType),
    expire_time: numVal(data.ExpireTime ?? data.expire_time),
    package_code: (data.PackageCode ?? data.package_code) as string | undefined,
    plan_name: (data.PlanName ?? data.plan_name ?? data.PackageName ?? data.package_name) as string | undefined,
  };
}

/** 归一化 PC 端 userResource 响应为移动端 UserResourceResponse */
function normalizeUserResourceRaw(raw: unknown): UserResourceResponse | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const rec = raw as Record<string, unknown>;

  // 快速检测：如果已经是归一化格式（有 items 数组且元素含 package_code），直接返回避免重复归一化
  const existingItems = rec.items;
  if (Array.isArray(existingItems) && existingItems.length > 0) {
    const first = existingItems[0];
    if (first && typeof first === 'object' && ('package_code' in (first as Record<string, unknown>) || 'packageCode' in (first as Record<string, unknown>))) {
      // 已经归一化过，无需重复处理
      return raw as UserResourceResponse;
    }
  }

  // 尝试从完整 API 响应中提取
  const data = extractPayload(rec);
  if (!data || Object.keys(data).length === 0) return undefined;

  // 提取 Accounts 列表
  const rawList = data.Accounts ?? data.accounts ?? data.items ?? data.Items;
  const accounts = Array.isArray(rawList) ? rawList : [];

  if (accounts.length === 0) {
    // 可能已经是归一化后的格式
    const items = data.items;
    if (Array.isArray(items) && items.length > 0) {
      return raw as UserResourceResponse;
    }
    return undefined;
  }

  const items = accounts
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(normalizeUserResourceItem);

  return {
    items,
    total_count: items.length,
    page_number: 1,
    page_size: 100,
  };
}
