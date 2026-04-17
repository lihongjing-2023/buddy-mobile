/**
 * 空状态组件
 * 无账号时显示引导导入
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface EmptyStateProps {
  onImport: () => void;
}

export function EmptyState({ onImport }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Ionicons name="cloud-download-outline" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>还没有账号</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        从 PC 端 Cockpit Tools 导出账号 JSON{'\n'}
        然后在此导入即可开始使用
      </Text>
      <TouchableOpacity style={[styles.importButton, { backgroundColor: colors.primary }]} onPress={onImport}>
        <Ionicons name="add-circle-outline" size={20} color={colors.textOnPrimary} />
        <Text style={[styles.importButtonText, { color: colors.textOnPrimary }]}>导入账号</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
