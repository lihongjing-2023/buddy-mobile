/**
 * cockpit-tools-mobile 核心类型定义
 * 从原项目 src/types/codebuddy-suite.ts 移植，零 RN 依赖
 * 注意：此文件不引用 constants.ts 中的 enum，以避免循环依赖
 */

// ==================== 基础账号类型 ====================

/** CodeBuddy Suite 账号基础字段 */
export interface CodebuddySuiteAccountBase {
  /** 唯一标识，格式 workbuddy_{email/uid} */
  id: string;
  /** 平台标识 */
  platform: 'workbuddy';
  /** 用户邮箱 */
  email: string;
  /** 用户 UID */
  uid?: string;
  /** 昵称 */
  nickname?: string;
  /** 头像 URL */
  avatar_url?: string;
  /** 访问令牌 */
  access_token: string;
  /** 刷新令牌 */
  refresh_token: string;
  /** Token 过期时间戳 (ms) */
  expires_at: number;
  /** 最后使用时间 */
  last_used?: number;
}

/** WorkBuddy CN 平台完整账号 */
export interface WorkbuddyAccount extends CodebuddySuiteAccountBase {
  platform: 'workbuddy';

  // ===== Token 刷新响应字段 =====
  domain?: string;
  token_type?: string;

  // ===== 账号信息 (/login/account) =====
  name?: string;

  // ===== 企业信息（与 PC 端对齐） =====
  enterprise_id?: string;
  enterprise_name?: string;
  tenant_id?: string;

  // ===== 配额数据 (3路 API 合并) =====
  quota_raw?: QuotaRawData;

  // ===== 签到数据 =====
  checkin_status?: CheckinStatusResponse;
  last_checkin_time?: number;
}

/** 三路配额 API 的原始响应数据 */
export interface QuotaRawData {
  dosage?: DosageNotifyResponse | null;
  payment?: PaymentTypeResponse | null;
  userResource?: UserResourceResponse | null;
}

/** 最后刷新成功的完整 payload（用于导出） */
export interface OAuthCompletePayload {
  account: WorkbuddyAccount;
  quota_raw?: QuotaRawData;
  refreshed_at: number;
}

// ==================== 配额 API 响应类型 ====================

/** GET /v2/billing/meter/get-dosage-notify 响应 data 字段 */
export interface DosageNotifyResponse {
  total_amount?: number;
  used_amount?: number;
  remain_amount?: number;
  dosage_notify_id?: string;
  /** 用量通知代码，空/'0'/'USAGE_NORMAL' 表示正常 */
  dosage_notify_code?: string;
  /** 用量通知中文描述 */
  dosage_notify_zh?: string;
  /** 用量通知英文描述 */
  dosage_notify_en?: string;
  [key: string]: unknown;
}

/** POST /v2/billing/meter/get-payment-type 响应 data 字段 */
export interface PaymentTypeResponse {
  pay_type?: number;
  expire_time?: number;
  package_code?: string;
  plan_name?: string;
  [key: string]: unknown;
}

/** POST /v2/billing/meter/get-user-resource 响应 data 字段 */
export interface UserResourceResponse {
  items?: UserResourceItem[];
  total_count?: number;
  page_number?: number;
  page_size?: number;
  [key: string]: unknown;
}

/** 单个用户资源项 */
export interface UserResourceItem {
  id?: string;
  product_code?: string;
  package_code?: string;
  package_name?: string;
  status?: number;
  total_amount?: number;
  used_amount?: number;
  remain_amount?: number;
  package_begin_time?: number;
  package_end_time?: number;
  cycle_total_amount?: number;
  cycle_remain_amount?: number;
  cycle_used_amount?: number;
  extra_amount?: number;
  is_default_package?: boolean;
  /** 保留原始 PascalCase 字段，供 parseCycleTotal/Remain 按PC端逻辑回退 */
  _raw?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 解析后的标准配额资源（用于 UI 展示） */
export interface OfficialQuotaResource {
  /** 资源类型编码 */
  packageCode: string;
  /** 显示名称 */
  displayName: string;
  /** 总额度 */
  totalAmount: number;
  /** 已用量 */
  usedAmount: number;
  /** 剩余额度 */
  remainAmount: number;
  /** 周期总额度 */
  cycleTotalAmount: number;
  /** 周期已用量 */
  cycleUsedAmount: number;
  /** 额外赠送量 */
  extraAmount: number;
  /** 开始时间戳 */
  beginTime?: number;
  /** 过期时间戳 */
  endTime?: number;
  /** 状态 */
  status: number;
  /** 是否默认套餐 */
  isDefaultPackage: boolean;
  /** 进度百分比 0-100 */
  progressPercent: number;
}

// ==================== 签到相关类型 ====================

/** POST /v2/billing/meter/checkin-status 响应 data 字段 */
export interface CheckinStatusResponse {
  today_checked_in: boolean;
  active: boolean;
  streak_days: number;
  daily_credit: number;
  today_credit: number;
  next_streak_day: number;
  is_streak_day: boolean;
  checkin_dates?: string[];
  [key: string]: unknown;
}

/** POST /v2/billing/meter/daily-checkin 响应 data 字段 */
export interface CheckinResponse {
  success: boolean;
  message: string;
  reward: number;
  next_checkin_in: number; // ms
  [key: string]: unknown;
}

// ==================== 导入/导出类型 ====================

/** 支持的导入格式（兼容 PC 端） */
export type ImportSource =
  | WorkbuddyAccount              // 单个对象
  | WorkbuddyAccount[]            // 数组
  | { accounts: WorkbuddyAccount[] } // 包装格式
  | { items: WorkbuddyAccount[] };   // 包装格式

/** 导入结果 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number; // 重复跳过
  errors: string[];
  accounts: WorkbuddyAccount[];
}

// ==================== API 通用类型 ====================

/** 统一 API 响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
  traceId?: string;
}

/** Token 刷新请求参数（token 在 header 中传递，body 为空） */
export type TokenRefreshRequest = Record<string, never>;

/** Token 刷新响应 data */
export interface TokenRefreshData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  domain?: string;
  tokenType?: string;
}

/** user-resource 查询参数（与 PC 端对齐：时间使用字符串格式） */
export interface UserResourceQuery {
  PageNumber: number;
  PageSize: number;
  ProductCode: string;
  Status: number[];
  PackageEndTimeRangeBegin: string;
  PackageEndTimeRangeEnd: string;
}
