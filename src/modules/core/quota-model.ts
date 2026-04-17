/**
 * 配额模型计算函数
 * 与 PC 端 cockpit-tools/src/utils/codebuddy-suite/quota-model.ts 对齐
 */

import type { OfficialQuotaResource, WorkbuddyAccount } from './types';
import {
  PACKAGE_CODE,
  PACKAGE_DISPLAY_NAMES,
  PACKAGE_COLORS,
  RESOURCE_STATUS,
  RESOURCE_STATUS_LABELS,
  RESOURCE_STATUS_COLORS,
} from './constants';
import {
  toOfficialQuotaResource,
  aggregateCycleResources,
  isActiveResource,
} from './parser';
import type { UserResourceResponse } from './types';

// ==================== 套餐详情获取 ====================

export interface PlanDetailInfo {
  name: string;
  code: string;
  color: string;
}

/**
 * 获取套餐显示信息
 * 支持精确匹配和前缀匹配（因为 API 可能返回带后缀的 PackageCode）
 */
export function getPlanDetail(
  code: string | undefined
): PlanDetailInfo {
  const pkgCode = code || PACKAGE_CODE.free;

  // 先精确匹配
  if (PACKAGE_DISPLAY_NAMES[pkgCode]) {
    return {
      name: PACKAGE_DISPLAY_NAMES[pkgCode],
      code: pkgCode,
      color: PACKAGE_COLORS[pkgCode] || '#8E8E93',
    };
  }

  // 前缀匹配：TCACA_code_001_xxx → free, TCACA_code_002_xxx → proMon, 等
  const prefixMap: { prefix: string; code: string }[] = [
    { prefix: 'TCACA_code_001', code: PACKAGE_CODE.free },
    { prefix: 'TCACA_code_002', code: PACKAGE_CODE.proMon },
    { prefix: 'TCACA_code_003', code: PACKAGE_CODE.proYear },
    { prefix: 'TCACA_code_006', code: PACKAGE_CODE.gift },
    { prefix: 'TCACA_code_007', code: PACKAGE_CODE.activity },
    { prefix: 'TCACA_code_008', code: PACKAGE_CODE.freeMon },
    { prefix: 'TCACA_code_009', code: PACKAGE_CODE.extra },
    { prefix: 'TCACA_code', code: PACKAGE_CODE.free },
  ];

  for (const { prefix, code: baseCode } of prefixMap) {
    if (pkgCode.startsWith(prefix)) {
      return {
        name: PACKAGE_DISPLAY_NAMES[baseCode] || '未知',
        code: baseCode,
        color: PACKAGE_COLORS[baseCode] || '#8E8E93',
      };
    }
  }

  return {
    name: '未知',
    code: pkgCode,
    color: '#8E8E93',
  };
}

// ==================== 套餐分类（与PC端 getOfficialQuotaModel 对齐） ====================

/** 套餐分类 */
export type PackageCategory = 'pro' | 'extra' | 'trialOrFreeMon' | 'free' | 'activity' | 'other';

/** 判断 packageCode 属于哪个分类 */
function categorizePackage(packageCode: string): PackageCategory {
  // 与PC端对齐的分类逻辑
  const isProPackage = packageCode.startsWith('TCACA_code_002') || packageCode.startsWith('TCACA_code_003');
  const isExtraPackage = packageCode.startsWith('TCACA_code_009');
  const isTrialOrFreeMonPackage =
    packageCode.startsWith('TCACA_code_006') || packageCode.startsWith('TCACA_code_008');
  const isFree = packageCode.startsWith('TCACA_code_001');
  const isActivity = packageCode.startsWith('TCACA_code_007');

  if (isProPackage) return 'pro';
  if (isExtraPackage) return 'extra';
  if (isTrialOrFreeMonPackage) return 'trialOrFreeMon';
  if (isFree) return 'free';
  if (isActivity) return 'activity';
  return 'other';
}

/**
 * 完整的配额模型（与PC端 getOfficialQuotaModel 对齐）
 * 流程: extract → filter active → categorize → aggregate → sort → return
 */
export function getOfficialQuotaModel(
  userResource?: UserResourceResponse | null
): OfficialQuotaResource[] {
  if (!userResource?.items) return [];

  // Step 1: 只保留有效资源（Status === 0 或 3）
  const activeItems = userResource.items.filter(isActiveResource);

  // Step 2: 转换为 OfficialQuotaResource
  const resources = activeItems.map(toOfficialQuotaResource);

  // Step 3: 按 category 分组
  const buckets: Record<PackageCategory, OfficialQuotaResource[]> = {
    pro: [],
    extra: [],
    trialOrFreeMon: [],
    free: [],
    activity: [],
    other: [],
  };

  for (const res of resources) {
    const cat = categorizePackage(res.packageCode);
    buckets[cat].push(res);
  }

  // Step 4: 同 category 内聚合（与PC端 aggregateCycleResources 对齐）
  const aggregated: OfficialQuotaResource[] = [];
  const categoryOrder: PackageCategory[] = ['pro', 'free', 'trialOrFreeMon', 'activity', 'extra', 'other'];

  for (const cat of categoryOrder) {
    const items = buckets[cat];
    if (items.length === 0) continue;
    const merged = aggregateCycleResources(items);
    if (merged) aggregated.push(merged);
  }

  // Step 5: 排序（默认包最前，然后按 remainAmount 降序）
  aggregated.sort((a, b) => {
    if (a.isDefaultPackage && !b.isDefaultPackage) return -1;
    if (!a.isDefaultPackage && b.isDefaultPackage) return 1;
    return b.remainAmount - a.remainAmount;
  });

  return aggregated;
}

// ==================== 配额展示项 ====================

export interface QuotaDisplayItem {
  /** 资源标识 */
  key: string;
  /** 显示名称 */
  label: string;
  /** 总量文本 (如 "100,000") */
  totalText: string;
  /** 已用量文本 */
  usedText: string;
  /** 剩余量文本 */
  remainText: string;
  /** 进度百分比 0-100 */
  percent: number;
  /** 状态标签文本 */
  statusLabel: string;
  /** 状态颜色 */
  statusColor: string;
  /** 是否有效/可展示 */
  isActive: boolean;
  /** 有效期文本 */
  periodText?: string;
  /** 额外赠送量文本 */
  extraText?: string;
  /** 原始资源对象 */
  resource: OfficialQuotaResource;
}

/** 将 OfficialQuotaResource 转为 UI 展示用的 QuotaDisplayItem */
export function getQuotaDisplayItems(resources: OfficialQuotaResource[]): QuotaDisplayItem[] {
  return resources
    .map((res) => {
      const plan = getPlanDetail(res.packageCode);
      const statusLabel =
        RESOURCE_STATUS_LABELS[res.status] || '未知';
      const statusColor =
        RESOURCE_STATUS_COLORS[res.status] || '#8E8E93';
      const isActive =
        res.status === RESOURCE_STATUS.valid ||
        res.status === RESOURCE_STATUS.usedUp;

      let periodText: string | undefined;
      if (res.beginTime && res.endTime) {
        const start = new Date(res.beginTime).toLocaleDateString('zh-CN');
        const end = new Date(res.endTime).toLocaleDateString('zh-CN');
        periodText = `${start} ~ ${end}`;
      } else if (res.endTime) {
        const end = new Date(res.endTime).toLocaleDateString('zh-CN');
        periodText = `到期 ${end}`;
      }

      let extraText: string | undefined;
      if (res.extraAmount > 0) {
        extraText = `+${formatNumber(res.extraAmount)}`;
      }

      return {
        key: `${res.packageCode}_${res.endTime || ''}`,
        label: plan.name,
        totalText: formatNumber(res.totalAmount),
        usedText: formatNumber(res.usedAmount),
        remainText: formatNumber(res.remainAmount),
        percent: res.progressPercent,
        statusLabel,
        statusColor,
        isActive,
        periodText,
        extraText,
        resource: res,
      };
    })
    .sort((a, b) => {
      // 默认包排最前，然后按状态排序，再按剩余量降序
      if (a.resource.isDefaultPackage && !b.resource.isDefaultPackage)
        return -1;
      if (!a.resource.isDefaultPackage && b.resource.isDefaultPackage)
        return 1;
      // valid > usedUp > others
      const statusOrder: Record<number, number> = { [RESOURCE_STATUS.valid]: 0, [RESOURCE_STATUS.usedUp]: 1 };
      const aOrder = statusOrder[a.resource.status] ?? 99;
      const bOrder = statusOrder[b.resource.status] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.resource.remainAmount - a.resource.remainAmount;
    });
}

// ==================== 用量状态 ====================

/** 用量状态信息 */
export interface UsageInfo {
  /** 用量通知代码 */
  dosageNotifyCode?: string;
  /** 中文描述 */
  dosageNotifyZh?: string;
  /** 英文描述 */
  dosageNotifyEn?: string;
  /** 是否正常（无异常通知） */
  isNormal: boolean;
}

/** 从账号数据获取用量状态 */
export function getUsage(account: WorkbuddyAccount): UsageInfo {
  const dosage = account.quota_raw?.dosage;
  const code = dosage?.dosage_notify_code || '';
  return {
    dosageNotifyCode: code,
    dosageNotifyZh: dosage?.dosage_notify_zh || undefined,
    dosageNotifyEn: dosage?.dosage_notify_en || undefined,
    isNormal: !code || code === '0' || code === 'USAGE_NORMAL',
  };
}

// ==================== 配额分组 ====================

/** 配额分组类型 */
export type QuotaCategory = 'base' | 'activity' | 'extra' | 'other';

/** 配额分组聚合项 */
export interface QuotaCategoryGroup {
  key: QuotaCategory;
  label: string;
  used: number;
  total: number;
  remain: number;
  usedPercent: number;
  remainPercent: number | null;
  quotaClass: string;
  items: OfficialQuotaResource[];
  visible: boolean;
}

const CATEGORY_LABELS: Record<QuotaCategory, string> = {
  base: '基础体验包',
  activity: '活动赠送包',
  extra: '加量包',
  other: '其他',
};

const CATEGORY_ICONS: Record<QuotaCategory, string> = {
  base: '📦',
  activity: '🎁',
  extra: '⚡',
  other: '📋',
};

/**
 * 判断 packageCode 属于哪个分组（与PC端 getQuotaCategoryGroups 对齐）
 * PC端逻辑：
 *   pro (proMon/proYear) → base
 *   free → base
 *   trialOrFreeMon (gift/freeMon) → base
 *   activity → activity
 *   extra → extra
 */
function resolveCategory(packageCode: string): QuotaCategory {
  // 专业版月/年付 → 基础包
  if (packageCode.startsWith('TCACA_code_002') || packageCode.startsWith('TCACA_code_003')) return 'base';
  // 免费版 → 基础包
  if (packageCode.startsWith('TCACA_code_001')) return 'base';
  // 赠送/体验版 → 基础包
  if (packageCode.startsWith('TCACA_code_006') || packageCode.startsWith('TCACA_code_008')) return 'base';
  // 活动赠送 → activity
  if (packageCode.startsWith('TCACA_code_007')) return 'activity';
  // 加量包 → extra
  if (packageCode.startsWith('TCACA_code_009')) return 'extra';
  // TCACA 前缀兜底 → 基础包
  if (packageCode.startsWith('TCACA')) return 'base';
  return 'other';
}

/** 获取剩余百分比对应的样式等级 */
export function getQuotaClass(remainPercent: number | null): string {
  if (remainPercent == null || !Number.isFinite(remainPercent)) return 'high';
  if (remainPercent <= 10) return 'critical';
  if (remainPercent <= 30) return 'low';
  if (remainPercent <= 60) return 'medium';
  return 'high';
}

/** 获取配额分组聚合数据 */
export function getQuotaCategoryGroups(resources: OfficialQuotaResource[]): QuotaCategoryGroup[] {
  const buckets: Record<QuotaCategory, OfficialQuotaResource[]> = {
    base: [],
    activity: [],
    extra: [],
    other: [],
  };

  for (const res of resources) {
    const cat = resolveCategory(res.packageCode);
    buckets[cat].push(res);
  }

  const aggregate = (items: OfficialQuotaResource[]): Omit<QuotaCategoryGroup, 'key' | 'label' | 'items' | 'visible'> => {
    const total = items.reduce((sum, r) => sum + r.totalAmount, 0);
    const remain = items.reduce((sum, r) => sum + r.remainAmount, 0);
    const used = items.reduce((sum, r) => sum + r.usedAmount, 0);
    const usedPercent = total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
    const remainPercent = total > 0 ? Math.max(0, Math.min(100, (remain / total) * 100)) : null;
    return { total, remain, used, usedPercent, remainPercent, quotaClass: getQuotaClass(remainPercent) };
  };

  const categories: QuotaCategory[] = ['base', 'activity', 'extra', 'other'];

  return categories.map((key) => {
    const items = buckets[key];
    const agg = aggregate(items);
    return {
      key,
      label: CATEGORY_LABELS[key],
      ...agg,
      items,
      visible: agg.total > 0,
    };
  });
}

/** 获取分组图标 */
export function getCategoryIcon(key: QuotaCategory): string {
  return CATEGORY_ICONS[key];
}

// ==================== 格式化工具 ====================

/** 格式化大数字（添加千分位） */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 10_000) {
    return `${(num / 10_000).toFixed(1)}W`;
  }
  return num.toLocaleString('zh-CN');
}

/** 格式化时间戳为相对时间描述 */
export function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  // 兼容秒级时间戳：小于 1e12 视为秒级，转为毫秒
  let ms = timestamp;
  if (ms < 1e12) ms *= 1000;
  // 无效或过旧时间戳（早于 2000-01-01）直接返回空
  if (ms < 946684800000) return '';
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return new Date(ms).toLocaleDateString('zh-CN');
}

/** 检查 Token 是否即将过期（提前5分钟刷新） */
export function isTokenExpiringSoon(expiresAt: number, bufferMs = 5 * 60 * 1000): boolean {
  return Date.now() >= expiresAt - bufferMs;
}
