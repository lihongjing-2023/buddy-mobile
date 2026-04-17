/**
 * 后台签到任务
 * 使用 expo-task-manager + expo-background-fetch 实现
 *
 * 注意：此功能在移动端标记为不可用（受系统后台任务限制）
 * 保留代码仅供参考
 */

import 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { BACKGROUND_CHECKIN_TASK } from '@/modules/core/constants';
import { CheckinService } from './checkin-service';

// ==================== 注册后台任务 ====================

export async function registerBackgroundCheckinTask(): Promise<void> {
  // 检查是否已注册
  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    BACKGROUND_CHECKIN_TASK
  );
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKGROUND_CHECKIN_TASK, {
    minimumInterval: 15 * 60, // 最小间隔15分钟
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

/** 取消后台签到任务 */
export async function unregisterBackgroundCheckinTask(): Promise<void> {
  await BackgroundFetch.unregisterTaskAsync(BACKGROUND_CHECKIN_TASK);
}

// ==================== 任务定义 ====================

TaskManager.defineTask(
  BACKGROUND_CHECKIN_TASK,
  async () => {
    try {
      // 从存储读取所有账号
      const { accountStorage, tokenStorage } = await import('@/services/storage');
      const { parseWorkbuddyAccount } = await import('@/modules/core/parser');
      const rawAccounts = await accountStorage.getAccounts<
        Record<string, unknown>
      >();

      if (!rawAccounts || rawAccounts.length === 0) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const accounts = rawAccounts.map((r) => parseWorkbuddyAccount(r));

      // 从 SecureStore 补充 token（唯一权威来源）
      for (const acc of accounts) {
        const [at, rt] = await Promise.all([
          tokenStorage.getAccessToken(acc.id),
          tokenStorage.getRefreshToken(acc.id),
        ]);
        if (at) acc.access_token = at;
        if (rt) acc.refresh_token = rt;
      }

      let checkedCount = 0;

      for (const acc of accounts) {
        if (!acc.access_token || !acc.refresh_token) continue;
        try {
          const status = await CheckinService.fetchCheckinStatus(
            acc.access_token,
            acc.domain,
            acc.uid,
            acc.enterprise_id,
            acc.enterprise_id
          );

          if (status && !status.today_checked_in) {
            const result = await CheckinService.doDailyCheckin(acc);
            if (result.success) checkedCount++;
          } else if (status && status.today_checked_in) {
            checkedCount++;
          }
        } catch {
          // 单个账号失败不影响其他账号
        }
      }

      // 记录日志
      const { checkinLogStorage } = await import('@/services/storage');
      const today = new Date().toISOString().split('T')[0];
      await checkinLogStorage.appendLog({
        accountId: 'background',
        date: today,
        success: true,
        message: `后台签到完成，共 ${checkedCount}/${accounts.length} 个账号`,
      });

      return checkedCount > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('[BackgroundCheckin] Error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  }
);
