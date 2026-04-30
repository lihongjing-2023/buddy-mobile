/**
 * 折线图组件
 * 基于 react-native-svg 手绘折线图，展示额度历史趋势
 */

import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';

interface DataPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface QuotaLineChartProps {
  /** 图表数据，每条线一个数组 */
  lines: {
    data: DataPoint[];
    color: string;
    label: string;
  }[];
  /** Y 轴最大值 */
  yMax: number;
  /** 图表宽度（默认屏幕宽度 - 32） */
  width?: number;
  /** 图表高度 */
  height?: number;
}

const CHART_PADDING = { top: 20, right: 16, bottom: 48, left: 50 };

export function QuotaLineChart({ lines, yMax, width, height = 200 }: QuotaLineChartProps) {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = width || screenWidth - 32;
  const plotWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  if (lines.length === 0 || lines.every((l) => l.data.length === 0)) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无历史数据</Text>
      </View>
    );
  }

  // Y 轴刻度（5 级）
  const yTicks = 5;
  const yStep = yMax / yTicks;

  // 将数据点映射到 SVG 坐标（dataX 为 0~1 的归一化值）
  const toSvgX = (dataX: number) => CHART_PADDING.left + dataX * plotWidth;
  const toSvgY = (dataY: number) => CHART_PADDING.top + plotHeight - (dataY / yMax) * plotHeight;

  // 生成网格线和Y轴标签
  const gridLines = [];
  const yLabels = [];
  for (let i = 0; i <= yTicks; i++) {
    const yVal = yStep * i;
    const y = toSvgY(yVal);
    gridLines.push(
      <Line
        key={`grid-${i}`}
        x1={CHART_PADDING.left}
        y1={y}
        x2={chartWidth - CHART_PADDING.right}
        y2={y}
        stroke={colors.border}
        strokeWidth={0.5}
      />
    );
    yLabels.push(
      <SvgText
        key={`ylabel-${i}`}
        x={CHART_PADDING.left - 6}
        y={y + 4}
        textAnchor="end"
        fontSize={9}
        fill={colors.textSecondary}
      >
        {formatCompact(yVal)}
      </SvgText>
    );
  }

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={height}>
        {/* 网格线 */}
        {gridLines}
        {/* Y 轴标签 */}
        {yLabels}

        {/* 折线 */}
        {lines.map((line, lineIdx) => {
          if (line.data.length < 2) return null;

          const pointsStr = line.data
            .map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`)
            .join(' ');

          return (
            <Polyline
              key={`line-${lineIdx}`}
              points={pointsStr}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* 数据点（仅最后一个点显示） */}
        {lines.map((line, lineIdx) => {
          if (line.data.length === 0) return null;
          const last = line.data[line.data.length - 1];
          return (
            <Circle
              key={`dot-${lineIdx}`}
              cx={toSvgX(last.x)}
              cy={toSvgY(last.y)}
              r={3.5}
              fill={line.color}
              stroke={colors.bgCard}
              strokeWidth={1.5}
            />
          );
        })}

        {/* X 轴标签（最多4个，自适应标签长度） */}
        {lines[0]?.data
          ?.filter((_, idx, arr) => {
            const maxLabels = 4;
            if (arr.length <= maxLabels) return true;
            const step = Math.ceil(arr.length / maxLabels);
            return idx % step === 0 || idx === arr.length - 1;
          })
          .map((p, i) => {
            // 长标签（含日期）：拆成两行显示
            const parts = p.label.split(' ');
            const hasDatePart = parts.length > 1;
            return (
              <SvgText
                key={`xlabel-${i}`}
                x={toSvgX(p.x)}
                y={height - 6}
                textAnchor="middle"
                fontSize={8}
                fill={colors.textSecondary}
              >
                {hasDatePart ? parts[0] : p.label}
              </SvgText>
            );
          })}
        {/* 日期标签的第二行（时间部分） */}
        {lines[0]?.data
          ?.filter((_, idx, arr) => {
            const maxLabels = 4;
            if (arr.length <= maxLabels) return true;
            const step = Math.ceil(arr.length / maxLabels);
            return idx % step === 0 || idx === arr.length - 1;
          })
          .filter((p) => p.label.includes(' '))
          .map((p, i) => {
            const timePart = p.label.split(' ')[1];
            return (
              <SvgText
                key={`xlabel-time-${i}`}
                x={toSvgX(p.x)}
                y={height + 6}
                textAnchor="middle"
                fontSize={7}
                fill={colors.textSecondary}
              >
                {timePart}
              </SvgText>
            );
          })}
      </Svg>

      {/* 图例 */}
      <View style={styles.legend}>
        {lines.map((line, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: line.color }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{line.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** 紧凑数字格式 */
function formatCompact(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${(num / 10_000).toFixed(1)}W`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Math.round(num).toString();
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
