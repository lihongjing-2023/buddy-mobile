/**
 * 导出签到 Shell 脚本页面
 * 用户配置签到时间后，选择签到账号，导出可在 Linux 下运行的 Shell 脚本
 */

import { useState, useCallback } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { useAccountStore } from '@/modules/account/account-store';
import { generateCheckinShellScript } from '@/modules/checkin/export-shell';
import { useTheme } from '@/theme';
import type { WorkbuddyAccount } from '@/modules/core/types';

export default function CheckinExportPage() {
  const accounts = useAccountStore((s) => s.accounts);
  const { colors } = useTheme();

  // 签到时间配置（小时:分钟）
  const [checkinHour, setCheckinHour] = useState('9');
  const [checkinMinute, setCheckinMinute] = useState('0');

  // 选中的账号ID列表
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map((a) => a.id)));
    }
  }, [selectedIds, accounts]);

  // 单个账号选择
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 公共校验：返回选中的账号和时间，校验失败时弹 Alert 并返回 null */
  const validateAndGetParams = useCallback((): {
    selectedAccounts: WorkbuddyAccount[];
    hour: number;
    minute: number;
  } | null => {
    const selectedAccounts = accounts.filter((a) => selectedIds.has(a.id));
    if (selectedAccounts.length === 0) {
      Alert.alert('提示', '请至少选择一个签到账号');
      return null;
    }

    const hour = parseInt(checkinHour, 10);
    const minute = parseInt(checkinMinute, 10);
    if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
      Alert.alert('提示', '请输入有效的时间（0-23小时，0-59分钟）');
      return null;
    }

    return { selectedAccounts, hour, minute };
  }, [accounts, selectedIds, checkinHour, checkinMinute]);

  // 导出脚本
  const handleExport = useCallback(async () => {
    const params = validateAndGetParams();
    if (!params) return;

    try {
      const result = generateCheckinShellScript(params.selectedAccounts, params.hour, params.minute);

      // 复制到剪贴板
      await Clipboard.setStringAsync(result.script);

      Alert.alert(
        '导出成功',
        `签到脚本已复制到剪贴板\n\n包含 ${result.accountCount} 个账号\n签到时间: ${params.hour}:${String(params.minute).padStart(2, '0')}\n\n上传到 Linux 服务器后:\n1. chmod +x ${result.filename}\n2. ./${result.filename} --install-cron 安装定时任务\n3. ./${result.filename} --now 立即执行`,
      );
    } catch (err) {
      Alert.alert('导出失败', (err as Error).message);
    }
  }, [validateAndGetParams]);

  // 保存为文件（使用 expo-file-system 写入缓存目录）
  const handleSaveFile = useCallback(async () => {
    const params = validateAndGetParams();
    if (!params) return;

    try {
      const result = generateCheckinShellScript(params.selectedAccounts, params.hour, params.minute);
      const filePath = `${FileSystem.cacheDirectory}${result.filename}`;
      await FileSystem.writeAsStringAsync(filePath, result.script, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      Alert.alert(
        '保存成功',
        `脚本已保存到缓存目录\n路径: ${filePath}\n\n请通过文件管理器或 scp 将脚本上传到 Linux 服务器`,
      );
    } catch (err) {
      Alert.alert('保存失败', (err as Error).message);
    }
  }, [validateAndGetParams]);

  // 预览脚本
  const [previewScript, setPreviewScript] = useState<string | null>(null);

  const handlePreview = useCallback(() => {
    const params = validateAndGetParams();
    if (!params) return;

    const result = generateCheckinShellScript(params.selectedAccounts, params.hour, params.minute);
    setPreviewScript(result.script);
  }, [validateAndGetParams]);

  const selectedCount = selectedIds.size;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPage }]} contentContainerStyle={styles.content}>
      {/* 签到时间配置 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>签到时间</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          设置每天自动签到的执行时间（Linux crontab 格式）
        </Text>

        <View style={[styles.timeRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>每天</Text>
          <TextInput
            style={[styles.timeInput, { backgroundColor: colors.bgNested, color: colors.textPrimary, borderColor: colors.border }]}
            keyboardType="number-pad"
            placeholder="9"
            placeholderTextColor={colors.textSecondary}
            value={checkinHour}
            onChangeText={setCheckinHour}
            maxLength={2}
            selectTextOnFocus
          />
          <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>时</Text>
          <TextInput
            style={[styles.timeInput, { backgroundColor: colors.bgNested, color: colors.textPrimary, borderColor: colors.border }]}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            value={checkinMinute}
            onChangeText={setCheckinMinute}
            maxLength={2}
            selectTextOnFocus
          />
          <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>分签到</Text>
        </View>

        <Text style={[styles.cronPreview, { color: colors.textSecondary }]}>
          Crontab 表达式: {checkinMinute} {checkinHour} * * *
        </Text>
      </View>

      {/* 选择签到账号 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>选择签到账号</Text>
          <TouchableOpacity onPress={toggleSelectAll}>
            <Text style={[styles.selectAllText, { color: colors.primary }]}>
              {selectedCount === accounts.length ? '取消全选' : '全选'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          已选择 {selectedCount} / {accounts.length} 个账号
        </Text>

        {accounts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无账号，请先导入</Text>
          </View>
        ) : (
          <View style={styles.accountList}>
            {accounts.map((account) => {
              const isSelected = selectedIds.has(account.id);
              return (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountItem,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.bgCard,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleSelect(account.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountEmail, { color: colors.textPrimary }]}>
                      {account.email || account.nickname || account.id}
                    </Text>
                    {account.nickname && account.email && (
                      <Text style={[styles.accountNickname, { color: colors.textSecondary }]}>
                        {account.nickname}
                      </Text>
                    )}
                  </View>
                  {account.checkin_status?.today_checked_in && (
                    <View style={styles.checkedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                      <Text style={styles.checkedText}>已签到</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 操作按钮 */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: colors.primary }]}
          onPress={handleExport}
          disabled={selectedCount === 0}
        >
          <Ionicons name="clipboard-outline" size={20} color={colors.textOnPrimary} />
          <Text style={[styles.exportButtonText, { color: colors.textOnPrimary }]}>
            复制脚本到剪贴板
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={handleSaveFile}
          disabled={selectedCount === 0}
        >
          <Ionicons name="download-outline" size={20} color={colors.primary} />
          <Text style={[styles.saveButtonText, { color: colors.primary }]}>
            保存为文件
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.previewButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={handlePreview}
          disabled={selectedCount === 0}
        >
          <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.previewButtonText, { color: colors.textSecondary }]}>
            预览脚本内容
          </Text>
        </TouchableOpacity>
      </View>

      {/* 脚本预览 */}
      {previewScript && (
        <View style={[styles.previewSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>脚本预览</Text>
            <TouchableOpacity onPress={() => setPreviewScript(null)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.previewScroll} nestedScrollEnabled>
            <Text style={[styles.previewCode, { color: colors.textPrimary }]}>
              {previewScript}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* 使用说明 */}
      <View style={[styles.helpSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.helpTitle, { color: colors.textPrimary }]}>使用说明</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          {'1. 将导出的脚本上传到 Linux 服务器\n' +
           '2. 添加执行权限: chmod +x cockpit-checkin.sh\n' +
           '3. 安装定时任务: ./cockpit-checkin.sh --install-cron\n' +
           '4. 立即执行签到: ./cockpit-checkin.sh --now\n' +
           '5. 查看帮助: ./cockpit-checkin.sh --help\n\n' +
           '注意:\n' +
           '• 脚本需要 curl 命令支持\n' +
           '• Token 会随时间过期，建议配合 Token 自动刷新\n' +
           '• 请确保服务器时间准确（建议使用 NTP 同步）'}
        </Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeInput: {
    width: 56,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  cronPreview: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  accountList: {
    gap: 8,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  accountNickname: {
    fontSize: 12,
    marginTop: 2,
  },
  checkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  actionSection: {
    gap: 10,
    marginBottom: 24,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewScroll: {
    maxHeight: 300,
  },
  previewCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  helpSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 20,
  },
});