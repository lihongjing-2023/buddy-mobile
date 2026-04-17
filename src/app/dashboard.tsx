/**
 * 仪表盘页面
 * 总览额度卡片 + 历史趋势折线图
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountStore } from '@/modules/account/account-store';
import { useRefresh } from '@/hooks/useRefresh';
import { useAutoRefresh, saveQuotaSnapshot } from '@/hooks/useAutoRefresh';
import { quotaHistoryStorage, type QuotaHistoryEntry } from '@/services/quota-history-storage';
import { parseQuotaRawData } from '@/modules/core/parser';
import { QuotaLineChart } from '@/components/QuotaLineChart';
import { useTheme } from '@/theme';

/** 时间范围选项 */
type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange; hours: number }[] = [
  { label: '1时', value: '1h', hours: 1 },
  { label: '6时', value: '6h', hours: 6 },
  { label: '24时', value: '24h', hours: 24 },
  { label: '7天', value: '7d', hours: 168 },
  { label: '30天', value: '30d', hours: 720 },
];

export default function DashboardPage() {
  const { colors } = useTheme();
  const { accounts, setRefreshing, setError } = useAccountStore();
  const { refreshAccount } = useRefresh();
  useAutoRefresh();

  const [history, setHistory] = useState<QuotaHistoryEntry[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载历史数据
  const loadHistory = useCallback(async () => {
    const all = await quotaHistoryStorage.getAll();
    setHistory(all);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 按时间范围过滤
  const filteredHistory = useMemo(() => {
    const option = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange);
    if (!option) return history;
    const cutoff = new Date(Date.now() - option.hours * 60 * 60 * 1000).toISOString();
    return history.filter((e) => e.timestamp >= cutoff);
  }, [history, timeRange]);

  // 计算当前汇总数据
  const summary = useMemo(() => {
    let grandTotal = 0;
    let grandUsed = 0;
    let grandRemain = 0;

    for (const acc of accounts) {
      const quotaResult = parseQuotaRawData(
        acc.quota_raw?.dosage,
        acc.quota_raw?.payment,
        acc.quota_raw?.userResource
      );
      if (quotaResult.hasActiveResources) {
        grandTotal += quotaResult.grandTotal;
        grandUsed += quotaResult.grandUsed;
        grandRemain += quotaResult.grandRemain;
      }
    }

    const usedPercent = grandTotal > 0 ? (grandUsed / grandTotal) * 100 : 0;
    const remainPercent = grandTotal > 0 ? (grandRemain / grandTotal) * 100 : 0;

    return { grandTotal, grandUsed, grandRemain, usedPercent, remainPercent };
  }, [accounts]);

  // 构建折线图数据
  const chartData = useMemo(() => {
    if (filteredHistory.length === 0) return { lines: [], yMax: 0 };

    const plotWidth = 1; // 归一化到 0~1 之间
    const entryCount = filteredHistory.length;
    const step = entryCount > 1 ? plotWidth / (entryCount - 1) : 0;

    const totalPoints: { x: number; y: number; value: number; label: string }[] = [];
    const usedPoints: { x: number; y: number; value: number; label: string }[] = [];
    const remainPoints: { x: number; y: number; value: number; label: string }[] = [];

    filteredHistory.forEach((entry, idx) => {
      const x = idx * step;
      const date = new Date(entry.timestamp);
      // 短标签用于 X 轴
      const shortLabel = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      totalPoints.push({ x, y: entry.grandTotal, value: entry.grandTotal, label: shortLabel });
      usedPoints.push({ x, y: entry.grandUsed, value: entry.grandUsed, label: shortLabel });
      remainPoints.push({ x, y: entry.grandRemain, value: entry.grandRemain, label: shortLabel });
    });

    const yMax = Math.max(
      ...filteredHistory.map((e) => e.grandTotal),
      ...filteredHistory.map((e) => e.grandUsed),
      ...filteredHistory.map((e) => e.grandRemain),
      1
    ) * 1.1;

    return {
      lines: [
        { data: totalPoints, color: '#5856D6', label: '总额度' },
        { data: usedPoints, color: '#FF9500', label: '已使用' },
        { data: remainPoints, color: '#34C759', label: '剩余' },
      ],
      yMax,
    };
  }, [filteredHistory]);

  /** 手动刷新 */
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshing(
      accounts.map((a) => a.id),
      true
    );
    setError(null);

    const batchSize = 2;
    for (let i = 0; i < accounts.length; i += batchSize) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      const batch = accounts.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((acc) => refreshAccount(acc)));
    }

    setRefreshing([], false);
    await saveQuotaSnapshot();
    await loadHistory();
    setIsRefreshing(false);
  }, [accounts, refreshAccount, setRefreshing, setError, loadHistory]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgPage }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.refreshTint} />
      }
    >
      {/* ====== 总览卡片 ====== */}
      <View style={styles.overviewCards}>
        {/* 总额度卡片 */}
        <View style={[styles.overviewCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.cardIconBg, { backgroundColor: '#5856D622' }]}>
            <Ionicons name="cube-outline" size={20} color="#5856D6" />
          </View>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{summary.grandTotal.toLocaleString('zh-CN')}</Text>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>总额度</Text>
        </View>

        {/* 使用率卡片 */}
        <View style={[styles.overviewCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.cardIconBg, { backgroundColor: summary.usedPercent > 80 ? '#FF3B3022' : summary.usedPercent > 50 ? '#FF950022' : '#34C75922' }]}>
            <Ionicons name="speedometer-outline" size={20} color={summary.usedPercent > 80 ? '#FF3B30' : summary.usedPercent > 50 ? '#FF9500' : '#34C759'} />
          </View>
          <Text style={[styles.cardValue, { color: summary.usedPercent > 80 ? '#FF3B30' : summary.usedPercent > 50 ? '#FF9500' : '#34C759' }]}>
            {summary.usedPercent.toFixed(1)}%
          </Text>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>使用率</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.bgTrack, marginTop: 6 }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, summary.usedPercent)}%`,
                  backgroundColor: summary.usedPercent > 80 ? '#FF3B30' : summary.usedPercent > 50 ? '#FF9500' : '#34C759',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* ====== 时间范围选择 ====== */}
      <View style={styles.timeRangeBar}>
        {TIME_RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.timeRangeBtn,
              {
                backgroundColor: timeRange === opt.value ? colors.primary : colors.bgCard,
                borderColor: timeRange === opt.value ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setTimeRange(opt.value)}
          >
            <Text
              style={[
                styles.timeRangeText,
                { color: timeRange === opt.value ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ====== 总额度趋势图 ====== */}
      <View style={[styles.chartSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>额度趋势</Text>
        {filteredHistory.length > 1 ? (
          <QuotaLineChart
            lines={chartData.lines}
            yMax={chartData.yMax}
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.chartEmptyText, { color: colors.textSecondary }]}>
              {history.length === 0
                ? '刷新数据后将开始记录历史趋势'
                : '当前时间范围内仅有一条记录，需要更多数据'}
            </Text>
          </View>
        )}
      </View>

      {/* ====== 历史记录统计 ====== */}
      <View style={[styles.statsSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>数据统计</Text>
        <View style={styles.statsRow}>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: colors.textPrimary }]}>{accounts.length}</Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>账号数</Text>
          </View>
          <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: colors.textPrimary }]}>{history.length}</Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>历史记录</Text>
          </View>
          <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: colors.textPrimary }]}>
              {history.length > 0
                ? formatRelativeTimeShort(new Date(history[history.length - 1].timestamp).getTime())
                : '-'}
            </Text>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>最近记录</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/** 简短相对时间 */
function formatRelativeTimeShort(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${Math.floor(diff / 86_400_000)}天前`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  overviewCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
  },
  cardIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 11,
  },
  progressCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timeRangeBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  timeRangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  chartEmptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  statsSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 28,
  },
});
