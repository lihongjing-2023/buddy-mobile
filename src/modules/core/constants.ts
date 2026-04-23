/**
 * 常量定义
 * 零依赖，纯数据常量
 */

// ==================== API 端点 ====================

export const API_ENDPOINTS = {
  BASE: 'https://www.codebuddy.cn',
  /** Token 刷新 */
  TOKEN_REFRESH: '/v2/plugin/auth/token/refresh',
  /** 获取账号信息 */
  ACCOUNT_INFO: '/v2/plugin/login/account',
  /** 配额通知 */
  DOSAGE_NOTIFY: '/v2/billing/meter/get-dosage-notify',
  /** 支付类型 */
  PAYMENT_TYPE: '/v2/billing/meter/get-payment-type',
  /** 用户资源配额 */
  USER_RESOURCE: '/v2/billing/meter/get-user-resource',
  /** 查询签到状态 */
  CHECKIN_STATUS: '/v2/billing/meter/checkin-status',
  /** 执行每日签到 */
  DAILY_CHECKIN: '/v2/billing/meter/daily-checkin',
} as const;

export const PLATFORM = 'workbuddy' as const;

/** user-resource 查询的默认 ProductCode */
export const DEFAULT_PRODUCT_CODE = 'p_tcaca';

/** Token 过期提前刷新时间 (5分钟) */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** 后台任务名称 */
export const BACKGROUND_CHECKIN_TASK = 'background-checkin-task';

/** 批量操作最大并发数 */
export const BATCH_CONCURRENCY = 5;

/** GitHub 仓库信息（用于检查更新） */
export const GITHUB_REPO = 'lihongjing-2023/buddy-mobile' as const;

// ==================== 套餐代码常量 ====================
// 与 PC 端 cockpit-tools/src/types/codebuddy-suite.ts 完全对齐

export const PACKAGE_CODE = {
  /** 免费版 */
  free: 'TCACA_code_001_PqouKr6QWV',
  /** 专业版月付 */
  proMon: 'TCACA_code_002_AkiJS3ZHF5',
  /** 专业版年付 */
  proYear: 'TCACA_code_003_FAnt7lcmRT',
  /** 赠送包 */
  gift: 'TCACA_code_006_DbXS0lrypC',
  /** 活动包（裂变包） */
  activity: 'TCACA_code_007_nzdH5h4Nl0',
  /** 个人体验版（免费月度） */
  freeMon: 'TCACA_code_008_cfWoLwvjU4',
  /** 加量包 */
  extra: 'TCACA_code_009_0XmEQc2xOf',
} as const;

/** PACKAGE_CODE 的值类型 */
export type PackageCodeValue = (typeof PACKAGE_CODE)[keyof typeof PACKAGE_CODE];

/** 套餐代码到显示名的映射（支持前缀匹配兜底） */
export const PACKAGE_DISPLAY_NAMES: Record<string, string> = {
  [PACKAGE_CODE.free]: '免费版',
  [PACKAGE_CODE.proMon]: '专业版(月)',
  [PACKAGE_CODE.proYear]: '专业版(年)',
  [PACKAGE_CODE.gift]: '赠送包',
  [PACKAGE_CODE.activity]: '活动赠送包',
  [PACKAGE_CODE.freeMon]: '体验版',
  [PACKAGE_CODE.extra]: '加量包',
};

/** 套餐颜色映射 */
export const PACKAGE_COLORS: Record<string, string> = {
  [PACKAGE_CODE.free]: '#8E8E93',
  [PACKAGE_CODE.proMon]: '#5856D6',
  [PACKAGE_CODE.proYear]: '#5856D6',
  [PACKAGE_CODE.gift]: '#34C759',
  [PACKAGE_CODE.activity]: '#FF9500',
  [PACKAGE_CODE.freeMon]: '#34C759',
  [PACKAGE_CODE.extra]: '#FF2D92',
};

// ==================== 资源状态枚举 ====================
// 与 PC 端 cockpit-tools/src/types/codebuddy-suite.ts 完全对齐
// API 返回的 Status 值含义：0=有效, 1=退款, 2=过期, 3=用尽

export const RESOURCE_STATUS = {
  /** 有效 */
  valid: 0,
  /** 已退款 */
  refund: 1,
  /** 已过期 */
  expired: 2,
  /** 已用尽 */
  usedUp: 3,
} as const;

/** 资源状态值类型 */
export type ResourceStatusValue = (typeof RESOURCE_STATUS)[keyof typeof RESOURCE_STATUS];

/** 资源状态显示名 */
export const RESOURCE_STATUS_LABELS: Record<number, string> = {
  [RESOURCE_STATUS.valid]: '有效',
  [RESOURCE_STATUS.refund]: '已退款',
  [RESOURCE_STATUS.expired]: '已过期',
  [RESOURCE_STATUS.usedUp]: '已用尽',
};

/** 资源状态对应颜色 */
export const RESOURCE_STATUS_COLORS: Record<number, string> = {
  [RESOURCE_STATUS.valid]: '#34C759',
  [RESOURCE_STATUS.refund]: '#8E8E93',
  [RESOURCE_STATUS.expired]: '#8E8E93',
  [RESOURCE_STATUS.usedUp]: '#FF3B30',
};
