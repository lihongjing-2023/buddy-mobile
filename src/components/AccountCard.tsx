/**
 * 账号卡片组件
 * 显示账号邮箱、套餐徽章、用量状态、配额分组概要、签到状态
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkbuddyAccount } from '@/modules/core/types';
import {
  getPlanDetail,
  formatNumber,
  formatRelativeTime,
  getUsage,
  getQuotaCategoryGroups,
} from '@/modules/core/quota-model';
import { parseQuotaRawData } from '@/modules/core/parser';
import { UsageStatusBadge } from './UsageStatusBadge';
import { useTheme } from '@/theme';

interface AccountCardProps {
  account: WorkbuddyAccount;
  isRefreshing?: boolean;
}

export const AccountCard = React.memo(function AccountCard({ account, isRefreshing }: AccountCardProps) {
  const { colors } = useTheme();
  const quotaResult = parseQuotaRawData(
    account.quota_raw?.dosage,
    account.quota_raw?.payment,
    account.quota_raw?.userResource
  );
  // 优先从 userResource 资源项获取套餐代码，回退到 payment.package_code
  const primaryPackageCode = quotaResult.resources.length > 0
    ? quotaResult.resources[0].packageCode
    : account.quota_raw?.payment?.package_code;
  const plan = getPlanDetail(primaryPackageCode);
  const usage = getUsage(account);
  const categoryGroups = getQuotaCategoryGroups(quotaResult.resources);
  const hasVisibleGroups = categoryGroups.some((g) => g.visible);
  const checkinStatus = account.checkin_status;

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* 顶部：邮箱 + 套餐徽章 */}
      <View style={styles.header}>
        <View style={styles.emailRow}>
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.email, { color: colors.textPrimary }]} numberOfLines={1}>
            {account.email || account.nickname || account.id}
          </Text>
        </View>
        <View style={[styles.planBadge, { backgroundColor: plan.color + '22', borderColor: plan.color }]}>
          <Text style={[styles.planText, { color: plan.color }]}>{plan.name}</Text>
        </View>
      </View>

      {/* 用量状态 */}
      <View style={styles.usageRow}>
        <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>用量状态</Text>
        <UsageStatusBadge usage={usage} accountLabel={account.email} />
      </View>

      {/* 配额概要 */}
      {quotaResult.hasActiveResources && hasVisibleGroups ? (
        <View style={[styles.quotaSection, { backgroundColor: colors.bgNested }]}>
          {categoryGroups.filter((g) => g.visible).map((group) => {
            const barColor =
              group.quotaClass === 'critical' ? '#FF3B30' :
              group.quotaClass === 'low' ? '#FF9500' :
              group.quotaClass === 'medium' ? '#FFCC00' : '#34C759';

            return (
              <View key={group.key} style={styles.quotaGroupItem}>
                <View style={styles.quotaGroupHeader}>
                  <Text style={[styles.quotaGroupLabel, { color: colors.textPrimary }]}>{group.label}</Text>
                  <Text style={[styles.quotaGroupValue, { color: colors.textSecondary }]}>
                    {formatNumber(group.used)} / {formatNumber(group.total)}
                  </Text>
                </View>
                <View style={[styles.miniProgressTrack, { backgroundColor: colors.bgTrack }]}>
                  <View
                    style={[
                      styles.miniProgressFill,
                      {
                        width: `${Math.min(100, group.usedPercent)}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.noData, { color: colors.textSecondary }]}>暂无配额数据</Text>
      )}

      {/* 底部：签到状态 + 更新时间 */}
      <View style={styles.footer}>
        <View style={styles.checkinInfo}>
          {checkinStatus ? (
            checkinStatus.today_checked_in ? (
              <View style={styles.checkinBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                <Text style={styles.checkinDone}>已签到</Text>
                {checkinStatus.streak_days > 0 && (
                  <Text style={styles.streakText}>
                    🔥 {checkinStatus.streak_days}天
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.checkinBadge}>
                <Ionicons name="ellipse-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.checkinPending, { color: colors.textSecondary }]}>未签到</Text>
              </View>
            )
          ) : (
            <Text style={[styles.noCheckin, { color: colors.textSecondary }]}>签到状态未知</Text>
          )}
        </View>
        <Text style={[styles.updateTime, { color: colors.textSecondary }]}>
          {isRefreshing ? '刷新中...' : formatRelativeTime(account.last_used)}
        </Text>
      </View>

      {/* 刷新指示器 */}
      {isRefreshing && (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
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
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  usageLabel: {
    fontSize: 12,
  },
  quotaSection: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  quotaGroupItem: {
    gap: 4,
  },
  quotaGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaGroupLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  quotaGroupValue: {
    fontSize: 12,
  },
  miniProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  noData: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkinDone: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '500',
  },
  checkinPending: {
    fontSize: 12,
  },
  streakText: {
    fontSize: 11,
    marginLeft: 4,
  },
  noCheckin: {
    fontSize: 12,
  },
  updateTime: {
    fontSize: 11,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
