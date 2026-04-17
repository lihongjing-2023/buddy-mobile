/**
 * 配额进度条组件
 * 显示单个配额资源的使用进度
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { QuotaDisplayItem } from '@/modules/core/quota-model';
import { useTheme } from '@/theme';

interface QuotaBarProps {
  item: QuotaDisplayItem;
}

export function QuotaBar({ item }: QuotaBarProps) {
  const { colors } = useTheme();
  const barColor = item.percent >= 90 ? '#FF3B30' : item.percent >= 70 ? '#FF9500' : '#34C759';

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* 标题行 */}
      <View style={styles.titleRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: item.statusColor }]}>{item.statusLabel}</Text>
        </View>
      </View>

      {/* 进度条 */}
      <View style={[styles.progressTrack, { backgroundColor: colors.bgTrack }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, item.percent)}%`, backgroundColor: barColor },
          ]}
        />
      </View>

      {/* 数值行 */}
      <View style={styles.valueRow}>
        <Text style={[styles.usedText, { color: colors.textPrimary }]}>
          已用 {item.usedText}
        </Text>
        <Text style={[styles.remainText, { color: colors.textSecondary }]}>
          剩余 {item.remainText} / 总计 {item.totalText}
        </Text>
      </View>

      {/* 额外信息和有效期 */}
      <View style={styles.extraRow}>
        {item.extraText && (
          <Text style={styles.extraText}>额外赠送 {item.extraText}</Text>
        )}
        {item.periodText && (
          <Text style={[styles.periodText, { color: colors.textSecondary }]}>{item.periodText}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usedText: {
    fontSize: 13,
  },
  remainText: {
    fontSize: 12,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  extraText: {
    color: '#FF2D92',
    fontSize: 11,
  },
  periodText: {
    fontSize: 11,
  },
});
