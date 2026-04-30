/**
 * 首页 - 账号列表
 * 顶部操作栏 + FlatList 账号卡片 + 空状态
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAccountStore } from '@/modules/account/account-store';
import { useCheckinStore } from '@/modules/checkin/checkin-store';
import { CheckinService } from '@/modules/checkin/checkin-service';
import { useRefresh } from '@/hooks/useRefresh';
import { saveQuotaSnapshot } from '@/hooks/useAutoRefresh';
import { AccountCard } from '@/components/AccountCard';
import { EmptyState } from '@/components/EmptyState';
import { exportAccounts } from '@/modules/account/export-import';
import { checkinLogStorage } from '@/services/storage';
import { useTheme } from '@/theme';
import type { WorkbuddyAccount } from '@/modules/core/types';
import { runInBatches } from '@/modules/core/batch';

export default function HomePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const accounts = useAccountStore((s) => s.accounts);
  const isLoading = useAccountStore((s) => s.isLoading);
  const refreshingIds = useAccountStore((s) => s.refreshingIds);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);
  const setRefreshing = useAccountStore((s) => s.setRefreshing);
  const setError = useAccountStore((s) => s.setError);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const isBatchCheckingIn = useCheckinStore((s) => s.isBatchCheckingIn);
  const setCheckinStatus = useCheckinStore((s) => s.setCheckinStatus);
  const setBatchCheckingIn = useCheckinStore((s) => s.setBatchCheckingIn);
  const setBatchProgress = useCheckinStore((s) => s.setBatchProgress);
  const setLastBatchResult = useCheckinStore((s) => s.setLastBatchResult);
  const { refreshAccount } = useRefresh();

  // 签到统计
  const checkedCount = accounts.filter(
    (a) => a.checkin_status?.today_checked_in
  ).length;
  const totalCount = accounts.length;

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /** 下拉刷新 - 刷新所有账号 */
  const onRefresh = useCallback(async () => {
    setRefreshing(
      accounts.map((a) => a.id),
      true
    );
    setError(null);

    let successCount = 0;
    let failCount = 0;

    // 分批刷新，最多 2 并发，批次间延迟 1 秒避免请求过快被限流
    const batchResults = await runInBatches(
      accounts,
      2,
      (acc) => refreshAccount(acc),
      { delayMs: 1000 }
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setRefreshing([], false);

    // 刷新完成后保存额度历史快照
    await saveQuotaSnapshot();

    if (failCount > 0) {
      Alert.alert('刷新完成', `成功 ${successCount} 个，失败 ${failCount} 个`);
    }
  }, [accounts, refreshAccount, setRefreshing, setError]);

  /** 导入按钮 */
  const handleImport = () => {
    router.push('/account/import');
  };

  /** 导出按钮 */
  const handleExport = async () => {
    if (accounts.length === 0) {
      Alert.alert('提示', '暂无账号可导出');
      return;
    }

    try {
      const json = exportAccounts(accounts);
      await Clipboard.setStringAsync(json);
      Alert.alert('导出成功', `已导出 ${accounts.length} 个账号到剪贴板`);
    } catch (err) {
      Alert.alert('导出失败', String(err));
    }
  };

  /** 批量一键签到 */
  const handleBatchCheckin = useCallback(async () => {
    if (accounts.length === 0) return;

    Alert.alert(
      '批量签到',
      `将对 ${accounts.length} 个账号执行签到，确认？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认签到',
          onPress: async () => {
            setBatchCheckingIn(true);
            setBatchProgress(0, accounts.length);

            try {
              const results = await CheckinService.batchCheckin(
                accounts,
                (completed, total) => {
                  setBatchProgress(completed, total);
                }
              );

              setLastBatchResult(results);

              const successCount = results.filter((r) => r.success && !/已签到/.test(r.message)).length;
              const alreadyCount = results.filter((r) => r.success && /已签到/.test(r.message)).length;
              const failCount = results.filter((r) => !r.success).length;

              const parts: string[] = [];
              if (successCount > 0) parts.push(`签到成功 ${successCount}`);
              if (alreadyCount > 0) parts.push(`已签到 ${alreadyCount}`);
              if (failCount > 0) parts.push(`失败 ${failCount}`);
              Alert.alert('批量签到完成', parts.join('，') || `共 ${results.length} 个`);

              // 刷新全部状态 + 持久化
              for (const r of results) {
                try {
                  const account = accounts.find((a) => a.id === r.accountId);
                  if (!account) continue;
                  const status = await CheckinService.fetchCheckinStatus(
                    account.access_token,
                    account.domain,
                    account.uid,
                    account.enterprise_id,
                    account.tenant_id
                  );
                  if (status) {
                    setCheckinStatus(r.accountId, status);
                    await updateAccount(r.accountId, {
                      checkin_status: status,
                      last_checkin_time: Date.now(),
                    });
                  }
                } catch {
                  // 单个状态刷新失败不影响其他
                }
                // 写入签到日志
                await checkinLogStorage.appendLog({
                  accountId: r.accountId,
                  date: new Date().toISOString().split('T')[0],
                  success: r.success,
                  message: r.message,
                  reward: r.reward,
                });
              }
            } catch (err) {
              Alert.alert('批量签到失败', (err as Error).message);
            } finally {
              setBatchCheckingIn(false);
            }
          },
        },
      ]
    );
  }, [accounts, setBatchCheckingIn, setBatchProgress, setLastBatchResult, setCheckinStatus, updateAccount]);

  /** 列表项渲染 */
  const renderItem = useCallback(
    ({ item }: { item: WorkbuddyAccount }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/account/${item.id}`)}
      >
        <AccountCard
          account={item}
          isRefreshing={refreshingIds.has(item.id)}
        />
      </TouchableOpacity>
    ),
    [refreshingIds, router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPage }]}>
      {/* ====== 操作栏 ====== */}
      <View style={[styles.actionBar, { borderBottomColor: colors.border }]}>
        <View style={styles.checkinStats}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={[styles.checkinStatsText, { color: colors.textPrimary }]}>
            {checkedCount}/{totalCount} 已签到
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBatchCheckin}
            disabled={isBatchCheckingIn || totalCount === 0}
          >
            {isBatchCheckingIn ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onRefresh}
            disabled={isLoading}
          >
            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleExport}
          >
            <Ionicons name="arrow-up-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/checkin-export')}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleImport}
          >
            <Ionicons name="arrow-down-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ====== 账号列表 / 空状态 ====== */}
      {accounts.length === 0 && !isLoading ? (
        <EmptyState onImport={handleImport} />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.refreshTint}/>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkinStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkinStatsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
});
