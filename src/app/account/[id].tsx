/**
 * 账号详情页
 * 展示用量状态 + 配额分组详情 + 签到状态 + 操作按钮
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAccountStore } from '@/modules/account/account-store';
import { useRefresh } from '@/hooks/useRefresh';
import { UsageStatusBadge } from '@/components/UsageStatusBadge';
import { QuotaCategoryList } from '@/components/QuotaCategoryList';
import { CheckinBadge } from '@/components/CheckinBadge';
import {
  getPlanDetail,
  formatRelativeTime,
  formatNumber,
  getUsage,
  getQuotaCategoryGroups,
} from '@/modules/core/quota-model';
import { parseQuotaRawData } from '@/modules/core/parser';
import { CheckinService } from '@/modules/checkin/checkin-service';
import { useTheme } from '@/theme';

export default function AccountDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const accounts = useAccountStore((s) => s.accounts);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const { refreshAccount } = useRefresh();
  const { colors } = useTheme();

  const account = accounts.find((a) => a.id === id);

  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // 解析配额数据
  const quotaResult = account
    ? parseQuotaRawData(
        account.quota_raw?.dosage,
        account.quota_raw?.payment,
        account.quota_raw?.userResource
      )
    : null;

  const usage = account ? getUsage(account) : null;
  const categoryGroups = quotaResult ? getQuotaCategoryGroups(quotaResult.resources) : [];
  const plan = getPlanDetail(account?.quota_raw?.payment?.package_code);

  /** 刷新 Token + 配额 */
  const handleRefresh = useCallback(async () => {
    if (!account) return;
    const result = await refreshAccount(account);
    if (result.success) {
      Alert.alert('刷新成功', '配额数据已更新');
    } else if ('error' in result) {
      Alert.alert('刷新失败', result.error);
    }
  }, [account, refreshAccount]);

  /** 签到 */
  const handleCheckin = useCallback(async () => {
    if (!account) return;
    setIsCheckingIn(true);
    try {
      const result = await CheckinService.doDailyCheckin(account);
      if (result.success) {
        Alert.alert('签到成功', `获得 ${result.reward} 积分`);
        const status = await CheckinService.fetchCheckinStatus(
          account.access_token,
          account.domain,
          account.uid,
          account.enterprise_id,
          account.tenant_id
        );
        if (status) {
          await updateAccount(account.id, {
            checkin_status: status,
            last_checkin_time: Date.now(),
          });
        }
      } else {
        Alert.alert('签到失败', result.message);
      }
    } catch (err) {
      Alert.alert('签到异常', (err as Error).message);
    } finally {
      setIsCheckingIn(false);
    }
  }, [account, updateAccount]);

  /** 删除账号 */
  const handleDelete = useCallback(() => {
    if (!account) return;
    Alert.alert('确认删除', `删除账号 ${account.email}？此操作不可恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await useAccountStore.getState().removeAccount(account.id);
          router.back();
        },
      },
    ]);
  }, [account, router]);

  if (!account) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPage }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>账号不存在</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPage }]} contentContainerStyle={styles.content}>
      {/* 头部信息 */}
      <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.profileHeader}>
          <Ionicons name="person-circle" size={44} color={colors.primary} />
          <View style={styles.profileInfo}>
            <Text style={[styles.email, { color: colors.textPrimary }]}>{account.email}</Text>
            {account.nickname && <Text style={[styles.nickname, { color: colors.textSecondary }]}>{account.nickname}</Text>}
          </View>
          <View style={[styles.planBadge, { backgroundColor: plan.color + '22', borderColor: plan.color }]}>
            <Text style={[styles.planText, { color: plan.color }]}>{plan.name}</Text>
          </View>
        </View>

        {quotaResult?.hasActiveResources && (
          <View style={[styles.summaryRow, { backgroundColor: colors.bgNested }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatNumber(quotaResult.grandTotal)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>总额度</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#FF9500' }]}>
                {formatNumber(quotaResult.grandUsed)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>已使用</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#34C759' }]}>
                {formatNumber(quotaResult.grandRemain)}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>剩余</Text>
            </View>
          </View>
        )}
      </View>

      {/* 用量状态 */}
      {usage && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>用量状态</Text>
          <View style={[styles.usageCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <UsageStatusBadge usage={usage} accountLabel={account.email} />
          </View>
        </View>
      )}

      {/* 签到状态 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>签到状态</Text>
        <CheckinBadge status={account.checkin_status} />
      </View>

      {/* 配额分组详情 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>配额详情</Text>
        {categoryGroups.some((g) => g.visible) ? (
          <QuotaCategoryList groups={categoryGroups} />
        ) : (
          <Text style={[styles.noData, { color: colors.textSecondary }]}>暂无配额数据，点击下方刷新获取</Text>
        )}
      </View>

      {/* 操作按钮 */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={handleRefresh}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>刷新 Token</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: '#34C75933' }]}
          onPress={handleCheckin}
          disabled={isCheckingIn}
        >
          {isCheckingIn ? (
            <ActivityIndicator size="small" color="#34C759" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />
          )}
          <Text style={[styles.actionButtonText, { color: '#34C759' }]}>
            {isCheckingIn ? '签到中...' : '每日签到'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.bgCard, borderColor: '#FF3B3033' }]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>删除账号</Text>
        </TouchableOpacity>
      </View>

      {/* 更新时间 */}
      <Text style={[styles.updateTime, { color: colors.textSecondary }]}>
        最后更新: {formatRelativeTime(account.last_used)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFound: {
    fontSize: 16,
    marginBottom: 12,
  },
  backLink: {
    fontSize: 14,
  },
  profileCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  email: {
    fontSize: 16,
    fontWeight: '700',
  },
  nickname: {
    fontSize: 13,
    marginTop: 2,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  usageCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  noData: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  actions: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  updateTime: {
    fontSize: 12,
    textAlign: 'center',
  },
});
