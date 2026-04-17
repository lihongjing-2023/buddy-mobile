/**
 * 导入页面
 * 支持 JSON 文本粘贴 + 文件选择两种模式
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAccountStore } from '@/modules/account/account-store';
import { parseTextImport, parseImportData } from '@/modules/account/export-import';
import { useTheme } from '@/theme';

type ImportMode = 'text' | 'file';

export default function ImportPage() {
  const router = useRouter();
  const { upsertAccounts } = useAccountStore();
  const { colors } = useTheme();

  const [mode, setMode] = useState<ImportMode>('text');
  const [jsonText, setJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [previewAccounts, setPreviewAccounts] = useState<Array<{
    email: string;
    uid?: string;
  }> | null>(null);

  /** 解析文本输入 */
  const handleParse = useCallback(() => {
    try {
      const parsed = parseTextImport(jsonText);
      const accounts = parseImportData(parsed);

      if (accounts.length === 0) {
        Alert.alert('解析失败', '未找到有效的账号数据，请检查 JSON 格式');
        setPreviewAccounts(null);
        return;
      }

      setPreviewAccounts(
        accounts.map((a) => ({ email: a.email, uid: a.uid }))
      );
    } catch (err) {
      Alert.alert('JSON 解析失败', (err as Error).message);
      setPreviewAccounts(null);
    }
  }, [jsonText]);

  /** 选择文件 */
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        setJsonText(content);

        // 自动解析
        const parsed = parseTextImport(content);
        const accounts = parseImportData(parsed);

        if (accounts.length === 0) {
          Alert.alert('解析失败', '文件中未找到有效的账号数据');
          setPreviewAccounts(null);
          return;
        }

        setPreviewAccounts(
          accounts.map((a) => ({ email: a.email, uid: a.uid }))
        );
      }
    } catch (err) {
      Alert.alert('文件读取失败', (err as Error).message);
    }
  }, []);

  /** 确认导入 */
  const handleConfirmImport = useCallback(async () => {
    if (!previewAccounts || previewAccounts.length === 0) return;

    setIsImporting(true);
    try {
      const parsed = parseTextImport(jsonText);
      const accounts = parseImportData(parsed);

      const addedCount = await upsertAccounts(accounts);

      Alert.alert(
        '导入完成',
        `新增 ${addedCount} 个账号，${accounts.length - addedCount} 个已存在被跳过`,
        [
          {
            text: '好的',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err) {
      Alert.alert('导入失败', (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [previewAccounts, jsonText, upsertAccounts, router]);

  /** 从剪贴板粘贴 */
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (text) {
        setJsonText(text);
      } else {
        Alert.alert('提示', '剪贴板为空');
      }
    } catch {
      Alert.alert('提示', '无法访问剪贴板');
    }
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPage }]} contentContainerStyle={styles.content}>
      {/* 模式切换 Tab */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgCard }]}>
        <TouchableOpacity
          style={[styles.tab, mode === 'text' && { backgroundColor: colors.bgNested }]}
          onPress={() => setMode('text')}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={mode === 'text' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, { color: mode === 'text' ? colors.primary : colors.textSecondary }]}>
            粘贴 JSON
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'file' && { backgroundColor: colors.bgNested }]}
          onPress={() => setMode('file')}
        >
          <Ionicons
            name="folder-outline"
            size={18}
            color={mode === 'file' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, { color: mode === 'file' ? colors.primary : colors.textSecondary }]}>
            选择文件
          </Text>
        </TouchableOpacity>
      </View>

      {/* 文本输入模式 */}
      {mode === 'text' && (
        <View style={styles.textSection}>
          <View style={styles.textHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>粘贴从 PC 端导出的 JSON 数据</Text>
            <TouchableOpacity onPress={handlePasteFromClipboard}>
              <Text style={[styles.pasteButton, { color: colors.primary }]}>从剪贴板粘贴</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bgCard, color: colors.textPrimary, borderColor: colors.border }]}
            multiline
            placeholder='{"access_token": "...", "refresh_token": "...", "email": "..."}'
            placeholderTextColor={colors.textSecondary}
            value={jsonText}
            onChangeText={setJsonText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.parseButton, { backgroundColor: colors.primary }]}
            onPress={handleParse}
            disabled={!jsonText.trim()}
          >
            <Text style={[styles.parseButtonText, { color: colors.textOnPrimary }]}>解析 JSON</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 文件选择模式 */}
      {mode === 'file' && (
        <View style={styles.fileSection}>
          <TouchableOpacity style={[styles.fileButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={handlePickFile}>
            <Ionicons name="document-attach-outline" size={32} color={colors.primary} />
            <Text style={[styles.fileButtonText, { color: colors.textPrimary }]}>选择 JSON 文件</Text>
            <Text style={[styles.fileHint, { color: colors.textSecondary }]}>支持从 PC 端 Cockpit Tools 导出的 .json 文件</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 解析预览 */}
      {previewAccounts && (
        <View style={[styles.previewSection, { backgroundColor: colors.bgCard, borderColor: '#34C75933' }]}>
          <Text style={styles.previewTitle}>
            识别到 {previewAccounts.length} 个账号
          </Text>
          {previewAccounts.map((acc, idx) => (
            <View key={idx} style={[styles.previewItem, { borderBottomColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <View style={styles.previewInfo}>
                <Text style={[styles.previewEmail, { color: colors.textPrimary }]}>{acc.email || '未知邮箱'}</Text>
                {acc.uid && <Text style={[styles.previewUid, { color: colors.textSecondary }]}>UID: {acc.uid}</Text>}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>
                确认导入 ({previewAccounts.length} 个账号)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 格式说明 */}
      <View style={[styles.helpSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.helpTitle, { color: colors.textPrimary }]}>支持的格式</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          {'• 单个账号对象: {"access_token": "...", ...}\n' +
            '• 账号数组: [{"access_token": "..."}, ...]\n' +
            '• 包装格式: {"accounts": [...]} 或 {"items": [...]}\n\n' +
            '字段兼容 camelCase/snake_case 命名\n' +
            '必须包含 access_token 字段'}
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textSection: {
    marginBottom: 20,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
  },
  pasteButton: {
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    borderRadius: 10,
    padding: 14,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 180,
    textAlignVertical: 'top',
    borderWidth: 1,
    marginBottom: 12,
  },
  parseButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  parseButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fileSection: {
    marginBottom: 20,
  },
  fileButton: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  fileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  fileHint: {
    fontSize: 12,
    marginTop: 6,
  },
  previewSection: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  previewTitle: {
    color: '#34C759',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  previewInfo: {
    flex: 1,
  },
  previewEmail: {
    fontSize: 14,
  },
  previewUid: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
