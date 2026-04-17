/**
 * 签到徽章组件
 * 显示签到状态、连续天数、积分奖励
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CheckinStatusResponse } from '@/modules/core/types';
import { useTheme } from '@/theme';

interface CheckinBadgeProps {
  status?: CheckinStatusResponse | null;
  compact?: boolean;
}

export function CheckinBadge({ status, compact = false }: CheckinBadgeProps) {
  const { colors } = useTheme();

  if (!status) {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <Ionicons name="help-circle-outline" size={compact ? 16 : 20} color={colors.textSecondary} />
        {!compact && <Text style={[styles.unknownText, { color: colors.textSecondary }]}>未知</Text>}
      </View>
    );
  }

  const checkedIn = status.today_checked_in;

  if (compact) {
    return (
      <View style={styles.compact}>
        <Ionicons
          name={checkedIn ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={checkedIn ? '#34C759' : colors.textSecondary}
        />
        {status.streak_days > 0 && (
          <Text style={styles.streakCompact}>🔥{status.streak_days}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: checkedIn ? '#34C75933' : colors.border }, checkedIn && styles.checkedContainer]}>
      {/* 签到图标 */}
      <View style={styles.iconRow}>
        <Ionicons
          name={checkedIn ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={checkedIn ? '#34C759' : colors.textSecondary}
        />
        <Text style={[styles.statusText, { color: checkedIn ? '#34C759' : colors.textSecondary }]}>
          {checkedIn ? '今日已签到' : '今日未签到'}
        </Text>
      </View>

      {/* 详细信息 */}
      <View style={styles.detailRow}>
        {status.streak_days > 0 && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>连续</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{status.streak_days}天</Text>
          </View>
        )}
        {status.today_credit > 0 && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>今日积分</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>+{status.today_credit}</Text>
          </View>
        )}
        {status.daily_credit > 0 && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>每日奖励</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{status.daily_credit}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedContainer: {
    borderColor: '#34C75933',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  unknownText: {
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  streakCompact: {
    fontSize: 11,
  },
});
