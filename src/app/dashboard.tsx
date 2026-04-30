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
import { runInBatches } from '@/modules/core/batch';

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
  const accounts = useAccountStore((s) => s.accounts);
  const setRefreshing = useAccountStore((s) => s.setRefreshing);
  const setError = useAccountStore((s) => s.setError);
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

  // 异常数据过滤：移除与相邻点偏差过大的数据点（骤降超过 40%）
  const cleanedHistory = useMemo(() => {
    if (filteredHistory.length <= 2) return filteredHistory;
    const result: typeof filteredHistory = [filteredHistory[0]];
    for (let i = 1; i < filteredHistory.length; i++) {
      const prev = result[result.length - 1];
      const curr = filteredHistory[i];
      // 骤降检测：当前总额 < 前一个有效点的 60% 视为异常
      if (prev.grandTotal > 0 && curr.grandTotal / prev.grandTotal < 0.6) {
        continue; // 跳过异常点
      }
      result.push(curr);
    }
    return result;
  }, [filteredHistory]);

  /** 简单移动平均平滑（窗口大小 3） */
  const smoothValues = useCallback(
    (values: number[], windowSize = 3): number[] => {
      if (values.length <= windowSize) return values;
      const half = Math.floor(windowSize / 2);
      return values.map((_, i) => {
        const start = Math.max(0, i - half);
        const end = Math.min(values.length, i + half + 1);
        const slice = values.slice(start, end);
        return slice.reduce((sum, v) => sum + v, 0) / slice.length;
      });
    },
    []
  );

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

  // 构建折线图数据（使用清洗后的历史 + 平滑处理）
  const chartData = useMemo(() => {
    if (cleanedHistory.length === 0) return { lines: [], yMax: 0 };

    const plotWidth = 1; // 归一化到 0~1 之间
    const entryCount = cleanedHistory.length;
    const step = entryCount > 1 ? plotWidth / (entryCount - 1) : 0;

    // 提取原始数值并应用平滑
    const rawTotals = cleanedHistory.map((e) => e.grandTotal);
    const rawUseds = cleanedHistory.map((e) => e.grandUsed);
    const rawRemains = cleanedHistory.map((e) => e.grandRemain);

    const smoothedTotals = smoothValues(rawTotals);
    const smoothedUseds = smoothValues(rawUseds);
    const smoothedRemains = smoothValues(rawRemains);

    const totalPoints: { x: number; y: number; value: number; label: string }[] = [];
    const usedPoints: { x: number; y: number; value: number; label: string }[] = [];
    const remainPoints: { x: number; y: number; value: number; label: string }[] = [];

    cleanedHistory.forEach((entry, idx) => {
      const x = idx * step;
      const date = new Date(entry.timestamp);
      // 根据时间范围自适应 X 轴标签格式
      let shortLabel: string;
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      if (timeRange === '7d' || timeRange === '30d') {
        // 长范围：显示 MM/DD HH:mm
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        shortLabel = `${mo}/${dd} ${hh}:${mm}`;
      } else {
        // 短范围：只显示 HH:mm
        shortLabel = `${hh}:${mm}`;
      }

      totalPoints.push({ x, y: smoothedTotals[idx], value: entry.grandTotal, label: shortLabel });
      usedPoints.push({ x, y: smoothedUseds[idx], value: entry.grandUsed, label: shortLabel });
      remainPoints.push({ x, y: smoothedRemains[idx], value: entry.grandRemain, label: shortLabel });
    });

    const yMax = Math.max(
      ...smoothedTotals,
      ...smoothedUseds,
      ...smoothedRemains,
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
  }, [cleanedHistory, smoothValues, timeRange]);

  /** 手动刷新 */
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshing(
      accounts.map((a) => a.id),
      true
    );
    setError(null);

    const batchSize = 2;
    await runInBatches(
      accounts,
      batchSize,
      (acc) => refreshAccount(acc),
      { delayMs: 1000 }
    );

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
        {cleanedHistory.length > 1 ? (
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
