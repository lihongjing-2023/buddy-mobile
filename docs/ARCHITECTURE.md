# 移动端数据存储架构

## 存储介质

| 介质 | 用途 | 生命周期 | 安全性 |
|------|------|----------|--------|
| **AsyncStorage** | 非敏感数据（账号信息、设置、签到日志） | 持久化，卸载App才清除 | 明文存储 |
| **SecureStore** | 敏感Token（access_token、refresh_token） | 持久化，卸载App才清除 | 加密存储 |
| **Zustand (内存)** | 运行时状态（refreshingIds、statusMap等） | 进程内，重启后需重新加载 | 无持久化 |

---

## 1. 账号信息（`WorkbuddyAccount`）

### 存储位置

| 数据 | 存储介质 | Key | 说明 |
|------|----------|-----|------|
| 账号元数据（**不含 token**） | AsyncStorage | `cockpit_accounts` | 剥离 token 后的 JSON |
| access_token | SecureStore | `at.{accountId}` | **唯一 token 来源**，加密存储 |
| refresh_token | SecureStore | `rt.{accountId}` | **唯一 token 来源**，加密存储 |

### Token 存储策略

```
写入流程：
  内存 WorkbuddyAccount (含 token)
    → stripTokens() 剥离 access_token / refresh_token
    → AsyncStorage: 存元数据（不含 token 明文）
    → SecureStore: 存 token（加密，唯一持久化来源）

读取流程：
  AsyncStorage: 读元数据 → parseWorkbuddyAccount()
  SecureStore: 读 token → hydrateTokens() 补充
    → 组装完整的 WorkbuddyAccount (含 token) → 写入 Zustand 内存
```

### 数据字段

```
WorkbuddyAccount {
  id, platform, email, uid, nickname, avatar_url,
  access_token, refresh_token, expires_at, last_used,
  domain, token_type, name, enterprise_id, enterprise_name,
  quota_raw: {
    dosage: DosageNotifyResponse,      // 用量通知 + 用量状态码
    payment: PaymentTypeResponse,       // 套餐信息
    userResource: UserResourceResponse  // 详细配额资源列表
  },
  checkin_status: CheckinStatusResponse,
  last_checkin_time: number
}
```

### 数据流向

#### 导入 → `upsertAccounts()`

```
用户输入 Token/JSON/文件
  → 解析为 WorkbuddyAccount[]
  → upsertAccounts(newAccounts)
    ├─ AsyncStorage: 合并去重后写入 accounts 数组（按 id/email/uid 去重）
    └─ SecureStore: 写入 at.{id} + rt.{id}
```

#### 加载 → `loadAccounts()`（App启动时调用）

```
loadAccounts()
  → AsyncStorage.getItem('cockpit_accounts')
  → JSON.parse → parseWorkbuddyAccount() 逐条解析
  → 从 SecureStore 补充 access_token / refresh_token（若AsyncStorage中缺失）
  → 写入 Zustand store.accounts
```

#### 刷新 → `refreshAccount()`（首页下拉 / 详情页手动）

```
refreshAccount(account)
  1. refreshToken() → API 换新 token
     POST /v2/login/token-refresh
     Headers: Authorization + X-Refresh-Token + X-Domain
  2. fetchAllQuota() → Promise.allSettled 并行 3 路配额 API
     POST /v2/billing/meter/get-dosage-notify
     POST /v2/billing/meter/get-payment-type
     POST /v2/billing/meter/get-user-resource
  3. updateAccount(id, { ...updated, quota_raw })
    ├─ AsyncStorage: 更新整个 accounts 数组
    └─ SecureStore: 更新 at.{id} + rt.{id}
```

#### 删除 → `removeAccount(id)`

```
removeAccount(id)
  ├─ AsyncStorage: 过滤掉该账号后重写
  └─ SecureStore: 删除 at.{id} + rt.{id}
```

---

## 2. 配额数据（`QuotaRawData`）

### 存储位置

嵌套在 `WorkbuddyAccount.quota_raw` 字段中，随账号一起存在 AsyncStorage。

### 三路 API 响应

```typescript
QuotaRawData {
  dosage: DosageNotifyResponse {      // 用量通知
    total_amount, used_amount, remain_amount,
    dosage_notify_id,
    dosage_notify_code,               // 用量状态码（空/0/USAGE_NORMAL=正常）
    dosage_notify_zh,                 // 异常中文描述
    dosage_notify_en                  // 异常英文描述
  },
  payment: PaymentTypeResponse {      // 套餐信息
    package_code, package_name,
    enterprise_id, enterprise_name
  },
  userResource: UserResourceResponse { // 详细配额列表
    TotalCount, Resources: OfficialQuotaResource[]
  }
}
```

### 更新触发

| 触发场景 | 刷新范围 | 说明 |
|----------|----------|------|
| 首页下拉刷新 | 全部账号 | 分批5并发刷新所有账号 |
| 详情页"刷新Token"按钮 | 单个账号 | 刷新当前账号 |
| `refreshIfNeeded()` | 单个账号 | 仅Token即将过期时触发 |

### ⚠️ 注意

- **无自动定期刷新机制**：`AppSettings.autoRefreshIntervalMinutes` 已定义但未使用
- App重启后 `quota_raw` 保持上次刷新的数据，不会自动更新

---

## 3. 签到数据

### 存储位置

| 数据 | 存储位置 | Key | 持久化 |
|------|----------|-----|--------|
| `checkin_status` | AsyncStorage（account 对象内） | `cockpit_accounts` | ✅ |
| `last_checkin_time` | AsyncStorage（account 对象内） | `cockpit_accounts` | ✅ |
| 签到日志 | AsyncStorage（独立存储） | `cockpit_checkin_log` | ✅ |
| 签到页运行时状态 | Zustand `checkin-store` | `statusMap` | ❌ 仅内存 |

### 数据流向

#### 详情页签到

```
handleCheckin()
  → CheckinService.doDailyCheckin(account)        // API 签到
  → CheckinService.fetchCheckinStatus(...)          // 查询最新状态
  → updateAccount(id, { checkin_status, last_checkin_time })  // 持久化到 AsyncStorage
```

#### 签到页签到

```
handleSingleCheckin(account)
  → CheckinService.doDailyCheckin(account)          // API 签到
  → CheckinService.fetchCheckinStatus(...)           // 查询最新状态
  → setCheckinStatus(accountId, status)              // 仅更新 Zustand statusMap
  → updateAccount(id, { checkin_status, last_checkin_time })  // 持久化到 AsyncStorage

handleBatchCheckin()
  → CheckinService.batchCheckin(accounts)            // 批量 API 签到
  → fetchAllStatus()                                  // 逐个查询状态
  → setCheckinStatus(accountId, status)              // 更新 Zustand statusMap
  → updateAccount(id, { checkin_status, last_checkin_time })  // 持久化到 AsyncStorage
```

#### 签到日志

```
checkinLogStorage.appendLog(entry)
  → AsyncStorage: 写入 cockpit_checkin_log
  → 自动清理超过 30 天的日志
```

---

## 4. 应用设置（`AppSettings`）

### 存储位置

AsyncStorage，key `cockpit_settings`

```typescript
AppSettings {
  autoRefreshIntervalMinutes: 60,    // 自动刷新间隔（分钟）— 已定义，未实现
  backgroundCheckinEnabled: false,    // 后台签到开关 — 已定义，未实现
  backgroundCheckinHour: 9,          // 后台签到时间（24h制）— 已定义，未实现
}
```

---

## 5. 数据更新/删除触发汇总

| 事件 | 更新内容 | 写入位置 |
|------|----------|----------|
| App启动 | 加载 accounts | AsyncStorage + SecureStore → Zustand |
| 导入账号 | accounts + tokens | AsyncStorage + SecureStore |
| 首页下拉刷新 | 全部账号 token + quota_raw | AsyncStorage + SecureStore |
| 详情页刷新 | 单个账号 token + quota_raw | AsyncStorage + SecureStore |
| 详情页签到 | checkin_status + last_checkin_time | AsyncStorage |
| 签到页签到 | checkin_status + last_checkin_time + 日志 | AsyncStorage + Zustand |
| 签到页刷新状态 | statusMap | Zustand (内存) |
| 删除账号 | 移除账号 | AsyncStorage + SecureStore |
| 清空全部 | 移除所有账号 | AsyncStorage + SecureStore |

---

## 6. 已修复的问题

### ✅ Token 双存储混乱（已修复）

**问题**：`access_token` 同时存 AsyncStorage（账号JSON内）和 SecureStore，两者可能不一致；AsyncStorage 中 token 明文泄露。

**修复**：
- AsyncStorage 不再存储 token 明文，保存前调用 `stripTokens()` 剥离
- SecureStore 成为 token **唯一持久化来源**
- 加载时从 SecureStore 通过 `hydrateTokens()` 补充 token
- `useRefresh` 刷新前从 SecureStore 获取最新 token，避免用过期 token 请求

### ✅ 签到状态双轨（已修复）

**问题**：签到页的 `statusMap`（内存）和 `account.checkin_status`（持久化）互相独立。

**修复**：签到页签到成功后，同时调用 `updateAccount()` 将签到状态持久化到 AsyncStorage。

### ✅ 自动刷新未实现（已修复）

**问题**：`AppSettings.autoRefreshIntervalMinutes` 已定义但未使用。

**修复**：新增 `useAutoRefresh` Hook，在首页根据设置自动定时刷新。

### ✅ API 响应字段映射错误（已修复）

**问题**：API 返回 PascalCase 字段（`PackageCode`, `CapacitySize`）和嵌套路径（`Response.Data.Accounts`），但移动端按 snake_case 解析，导致配额数据全为 0。

**修复**：新增 `normalizeDosageResponse`、`normalizePaymentResponse`、`normalizeUserResourceResponse` 归一化函数，兼容两种命名格式。

### ✅ 后台签到未实现

**说明**：移动端后台签到受限于操作系统后台任务限制（iOS 后台最多30秒，Android 需 Foreground Service），实现复杂且不可靠，标记为不实现。`AppSettings` 中保留字段定义但不再展示相关 UI。
