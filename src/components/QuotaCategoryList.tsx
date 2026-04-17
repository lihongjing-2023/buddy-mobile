/**
 * 配额分组列表组件
 * 按 category (base/activity/extra/other) 分组展示配额
 * 每组显示汇总进度条，可展开查看详细套餐信息
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QuotaCategoryGroup } from '@/modules/core/quota-model';
import type { OfficialQuotaResource } from '@/modules/core/types';
import { formatNumber } from '@/modules/core/quota-model';
import { useTheme } from '@/theme';

// 颜色映射：基于 quotaClass
const QUOTA_CLASS_COLORS: Record<string, string> = {
  critical: '#FF3B30',
  low: '#FF9500',
  medium: '#FFCC00',
  high: '#34C759',
};

// 分组图标
const CATEGORY_ICONS: Record<string, string> = {
  base: '📦',
  activity: '🎁',
  extra: '⚡',
  other: '📋',
};

interface QuotaCategoryListProps {
  groups: QuotaCategoryGroup[];
}

export function QuotaCategoryList({ groups }: QuotaCategoryListProps) {
  const { colors } = useTheme();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const visibleGroups = groups.filter((g) => g.visible);

  if (visibleGroups.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无配额数据</Text>
    );
  }

  return (
    <View style={styles.container}>
      {visibleGroups.map((group) => {
        const isExpanded = expandedKeys.has(group.key);
        const hasDetails = group.items.length > 1 || (group.items.length === 1 && group.items[0].displayName);
        const barColor = QUOTA_CLASS_COLORS[group.quotaClass] || '#34C759';

        return (
          <View key={group.key} style={[styles.categoryItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* 分组头部 */}
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => hasDetails && toggleExpand(group.key)}
              activeOpacity={hasDetails ? 0.7 : 1}
            >
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[group.key] || '📋'}</Text>
                <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>{group.label}</Text>
                {hasDetails && (
                  <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>({group.items.length})</Text>
                )}
              </View>
              <View style={styles.categoryStats}>
                <Text style={[styles.categoryValue, { color: colors.textPrimary }]}>
                  {formatNumber(group.used)} / {formatNumber(group.total)}
                </Text>
                {hasDetails && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.textSecondary}
                  />
                )}
              </View>
            </TouchableOpacity>

            {/* 进度条 */}
            <View style={[styles.progressTrack, { backgroundColor: colors.bgTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, group.usedPercent)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>

            {/* 剩余量提示 */}
            <View style={styles.remainRow}>
              <Text style={[styles.remainText, { color: colors.textSecondary }]}>
                剩余 {formatNumber(group.remain)}
              </Text>
              {group.remainPercent != null && (
                <Text style={[
                  styles.remainPercent,
                  { color: barColor },
                ]}>
                  {group.remainPercent.toFixed(1)}%
                </Text>
              )}
            </View>

            {/* 展开详情 */}
            {isExpanded && hasDetails && (
              <View style={[styles.detailList, { borderTopColor: colors.border }]}>
                {group.items.map((item, idx) => (
                  <QuotaItemDetail key={`${group.key}-${idx}`} item={item} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ==================== 子组件 ====================

interface QuotaItemDetailProps {
  item: OfficialQuotaResource;
}

function QuotaItemDetail({ item }: QuotaItemDetailProps) {
  const { colors } = useTheme();
  const remainPercent = item.totalAmount > 0
    ? (item.remainAmount / item.totalAmount) * 100
    : null;
  const quotaClass = getQuotaClassFromRemain(remainPercent);
  const valueColor = QUOTA_CLASS_COLORS[quotaClass] || colors.textPrimary;

  // 时间展示
  let timeText = '';
  if (item.endTime) {
    const end = new Date(item.endTime).toLocaleDateString('zh-CN');
    timeText = `到期 ${end}`;
  }

  return (
    <View style={[detailStyles.container, { backgroundColor: colors.bgNested }]}>
      <View style={detailStyles.header}>
        <Text style={[detailStyles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.displayName || '套餐信息未知'}
        </Text>
        <Text style={[detailStyles.value, { color: valueColor }]}>
          {formatNumber(item.usedAmount)} / {formatNumber(item.totalAmount)}
        </Text>
      </View>
      {timeText && (
        <Text style={[detailStyles.timeText, { color: colors.textSecondary }]}>{timeText}</Text>
      )}
    </View>
  );
}

function getQuotaClassFromRemain(remainPercent: number | null): string {
  if (remainPercent == null || !Number.isFinite(remainPercent)) return 'high';
  if (remainPercent <= 10) return 'critical';
  if (remainPercent <= 30) return 'low';
  if (remainPercent <= 60) return 'medium';
  return 'high';
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  categoryItem: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  remainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainText: {
    fontSize: 12,
  },
  remainPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
});

const detailStyles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
});
