/**
 * 设置页面
 * 主题切换、自动刷新间隔、关于信息
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsStorage, type AppSettings } from '@/services/storage';
import { useAccountStore } from '@/modules/account/account-store';
import { useTheme, type ThemeMode } from '@/theme';

const REFRESH_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '2 小时', value: 120 },
  { label: '6 小时', value: 360 },
];

const THEME_OPTIONS: { label: string; value: ThemeMode; icon: string }[] = [
  { label: '浅色', value: 'light', icon: 'sunny-outline' },
  { label: '深色', value: 'dark', icon: 'moon-outline' },
];

export default function SettingsPage() {
  const { clearAll, accounts } = useAccountStore();
  const { colors, mode, setMode } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    autoRefreshIntervalMinutes: 60,
    backgroundCheckinEnabled: false,
    backgroundCheckinHour: 9,
  });

  useEffect(() => {
    settingsStorage.get().then(setSettings);
  }, []);

  const updateSetting = async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await settingsStorage.save(partial);
  };

  const handleClearAll = () => {
    Alert.alert('确认清空', '删除所有账号数据？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          await clearAll();
          Alert.alert('已清空', '所有账号数据已删除');
        },
      },
    ]);
  };

  const currentRefreshLabel =
    REFRESH_OPTIONS.find((o) => o.value === settings.autoRefreshIntervalMinutes)?.label || `${settings.autoRefreshIntervalMinutes} 分钟`;

  const [customMinutes, setCustomMinutes] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  /** 选择预设或切换到自定义模式 */
  const handleRefreshOption = (value: number) => {
    setIsCustomMode(false);
    setCustomMinutes('');
    updateSetting({ autoRefreshIntervalMinutes: value });
  };

  /** 应用自定义分钟数 */
  const applyCustomInterval = () => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins < 1) {
      Alert.alert('提示', '请输入大于 0 的分钟数');
      return;
    }
    if (mins > 1440) {
      Alert.alert('提示', '最大支持 1440 分钟（24 小时）');
      return;
    }
    setIsCustomMode(false);
    updateSetting({ autoRefreshIntervalMinutes: mins });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPage }]} contentContainerStyle={styles.content}>
      {/* 外观主题 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>外观主题</Text>

        <View style={styles.themeOptions}>
          {THEME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.themeOption,
                { backgroundColor: colors.bgCard, borderColor: mode === opt.value ? colors.primary : colors.border },
                mode === opt.value && styles.themeOptionActive,
              ]}
              onPress={() => setMode(opt.value)}
            >
              <Ionicons
                name={opt.icon as any}
                size={22}
                color={mode === opt.value ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === opt.value ? colors.primary : colors.textSecondary },
                  mode === opt.value && styles.themeOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {mode === opt.value && (
                <Ionicons name="checkmark" size={16} color={colors.primary} style={styles.themeCheck} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 数据刷新 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>数据刷新</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>自动刷新间隔</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                定时刷新所有账号的 Token 和配额数据
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.refreshOptions}>
          {REFRESH_OPTIONS.map((opt) => {
            const isSelected = !isCustomMode && settings.autoRefreshIntervalMinutes === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.refreshOption,
                  {
                    backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleRefreshOption(opt.value)}
              >
                <Text
                  style={[
                    styles.refreshOptionText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                    isSelected && styles.refreshOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* 自定义按钮 */}
          <TouchableOpacity
            style={[
              styles.refreshOption,
              {
                backgroundColor: isCustomMode ? colors.primaryLight : colors.bgCard,
                borderColor: isCustomMode ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setIsCustomMode(true);
              setCustomMinutes(String(settings.autoRefreshIntervalMinutes));
            }}
          >
            <Text
              style={[
                styles.refreshOptionText,
                { color: isCustomMode ? colors.primary : colors.textSecondary },
                isCustomMode && styles.refreshOptionTextActive,
              ]}
            >
              自定义
            </Text>
          </TouchableOpacity>
        </View>

        {/* 自定义输入区域 */}
        {isCustomMode && (
          <View style={[styles.customRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.customLabel, { color: colors.textPrimary }]}>每</Text>
            <TextInput
              style={[styles.customInput, { backgroundColor: colors.bgNested, color: colors.textPrimary, borderColor: colors.border }]}
              keyboardType="number-pad"
              placeholder="分钟数"
              placeholderTextColor={colors.textSecondary}
              value={customMinutes}
              onChangeText={setCustomMinutes}
              onSubmitEditing={applyCustomInterval}
              returnKeyType="done"
              maxLength={4}
              selectTextOnFocus
            />
            <Text style={[styles.customLabel, { color: colors.textPrimary }]}>分钟刷新</Text>
            <TouchableOpacity
              style={[styles.customApplyBtn, { backgroundColor: colors.primary }]}
              onPress={applyCustomInterval}
            >
              <Text style={[styles.customApplyText, { color: colors.textOnPrimary }]}>确定</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 当前生效值提示 */}
        {!isCustomMode && settings.autoRefreshIntervalMinutes > 0 && (
          <Text style={[styles.currentHint, { color: colors.textSecondary }]}>
            当前：每 {currentRefreshLabel} 自动刷新一次
          </Text>
        )}
        {!isCustomMode && settings.autoRefreshIntervalMinutes === 0 && (
          <Text style={[styles.currentHint, { color: colors.textSecondary }]}>
            自动刷新已关闭
          </Text>
        )}
      </View>

      {/* 签到设置 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>签到设置</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border, opacity: 0.5 }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            <View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>后台自动签到</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                移动端不支持后台签到（受系统后台任务限制）
              </Text>
            </View>
          </View>
          <Text style={[styles.disabledBadge, { color: colors.textSecondary, backgroundColor: colors.bgNested }]}>{'不可用'}</Text>
        </View>
      </View>

      {/* 数据管理 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>数据管理</Text>

        <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>账号数量</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                当前已导入 {accounts.length} 个账号
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.dangerItem, { backgroundColor: colors.bgCard, borderColor: '#FF3B3033' }]} onPress={handleClearAll}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={styles.dangerText}>清空所有账号</Text>
        </TouchableOpacity>
      </View>

      {/* 关于 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>关于</Text>
        <View style={[styles.aboutCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>Cockpit Tools Mobile</Text>
          <Text style={[styles.appVersion, { color: colors.textSecondary }]}>v1.0.0</Text>
          <Text style={[styles.appDesc, { color: colors.textSecondary }]}>
            WorkBuddy CN 账号管理工具{'\n'}
            支持额度查询、每日签到
          </Text>
        </View>
      </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
  },
  themeOptionActive: {
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  themeOptionTextActive: {
    fontWeight: '600',
  },
  themeCheck: {
    marginLeft: 'auto',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  dangerText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  aboutCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
  },
  appVersion: {
    fontSize: 13,
    marginTop: 4,
  },
  appDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  refreshOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  refreshOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  refreshOptionActive: {
    backgroundColor: '#5856D622',
  },
  refreshOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  refreshOptionTextActive: {
    fontWeight: '600',
  },
  disabledBadge: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    gap: 8,
  },
  customLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  customInput: {
    width: 72,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  customApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  customApplyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentHint: {
    fontSize: 12,
    marginTop: 8,
  },
});
