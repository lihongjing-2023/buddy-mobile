/**
 * 更新弹窗组件
 * 显示版本信息、设备架构检测、镜像加速下载进度、一键安装
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import {
  type UpdateInfo,
  type DownloadAsset,
  type DownloadStatus,
  downloadApk,
  installApk,
  formatFileSize,
} from '@/modules/core/update-service';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export function UpdateModal({ visible, updateInfo, onClose }: UpdateModalProps) {
  const { colors } = useTheme();
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({ state: 'idle' });
  const [selectedAsset, setSelectedAsset] = useState<DownloadAsset | null>(null);

  const asset = selectedAsset || updateInfo?.recommendedAsset || null;

  // 重置状态
  const handleClose = useCallback(() => {
    setDownloadStatus({ state: 'idle' });
    setSelectedAsset(null);
    onClose();
  }, [onClose]);

  // 一键下载
  const handleDownload = useCallback(async () => {
    if (!asset) return;

    try {
      const fileUri = await downloadApk(asset, setDownloadStatus);
      // 下载完成，自动弹出安装
      setDownloadStatus({ state: 'downloaded', fileUri });
    } catch {
      // downloadApk 内部已设置 error 状态
    }
  }, [asset]);

  // 安装 APK
  const handleInstall = useCallback(async () => {
    if (downloadStatus.state !== 'downloaded') return;

    setDownloadStatus({ state: 'installing' });
    try {
      await installApk(downloadStatus.fileUri);
      // 安装 Intent 已发送，不自动关闭弹窗，等用户安装完回来
      setDownloadStatus({ state: 'downloaded', fileUri: downloadStatus.fileUri });
    } catch (err) {
      setDownloadStatus({
        state: 'error',
        message: (err as Error).message,
      });
    }
  }, [downloadStatus]);

  if (!updateInfo) return null;

  const isDownloading = downloadStatus.state === 'downloading';
  const isDownloaded = downloadStatus.state === 'downloaded';
  const isInstalling = downloadStatus.state === 'installing';
  const isError = downloadStatus.state === 'error';
  const isIdle = downloadStatus.state === 'idle';

  const progressPercent =
    downloadStatus.state === 'downloading'
      ? Math.round(downloadStatus.progress * 100)
      : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* 头部 */}
          <View style={styles.header}>
            <Ionicons name="rocket-outline" size={24} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>发现新版本</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 版本信息 */}
            <View style={[styles.versionRow, { backgroundColor: colors.bgNested }]}>
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>当前版本</Text>
                <Text style={[styles.versionValue, { color: colors.textSecondary }]}>
                  v{updateInfo.latestVersion && '—'}{/** 占位对齐 */}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>最新版本</Text>
                <Text style={[styles.versionValue, { color: colors.primary, fontWeight: '700' }]}>
                  v{updateInfo.latestVersion}
                </Text>
              </View>
            </View>

            {/* 设备架构检测 */}
            {updateInfo.deviceAbi && (
              <View style={[styles.archRow, { borderColor: colors.border }]}>
                <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
                <Text style={[styles.archText, { color: colors.textSecondary }]}>
                  检测到设备架构：<Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{updateInfo.deviceAbi}</Text>
                </Text>
              </View>
            )}

            {/* 推荐的 APK */}
            {asset && (
              <View style={[styles.apkCard, { backgroundColor: colors.bgNested, borderColor: colors.border }]}>
                <View style={styles.apkRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  <View style={styles.apkInfo}>
                    <Text style={[styles.apkName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {asset.name}
                    </Text>
                    <Text style={[styles.apkSize, { color: colors.textSecondary }]}>
                      {formatFileSize(asset.size)}
                    </Text>
                  </View>
                </View>
                {updateInfo.downloadAssets.length > 1 && (
                  <TouchableOpacity onPress={() => setSelectedAsset(null)}>
                    <Text style={[styles.switchText, { color: colors.primary }]}>
                      切换
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* APK 选择列表（多个 APK 时展示） */}
            {updateInfo.downloadAssets.length > 1 && !selectedAsset && (
              <View style={styles.apkList}>
                {updateInfo.downloadAssets.map((a) => {
                  const isRecommended = a === updateInfo.recommendedAsset;
                  return (
                    <TouchableOpacity
                      key={a.name}
                      style={[
                        styles.apkOption,
                        {
                          backgroundColor: isRecommended ? colors.primaryLight : colors.bgNested,
                          borderColor: isRecommended ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedAsset(a)}
                    >
                      <View style={styles.apkOptionLeft}>
                        <Ionicons
                          name={isRecommended ? 'checkmark-circle' : 'document-text-outline'}
                          size={18}
                          color={isRecommended ? colors.primary : colors.textSecondary}
                        />
                        <View>
                          <Text style={[styles.apkOptionName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {a.name}
                          </Text>
                          <Text style={[styles.apkOptionSize, { color: colors.textSecondary }]}>
                            {formatFileSize(a.size)} {isRecommended ? '· 推荐' : ''}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 更新说明 */}
            {updateInfo.body ? (
              <View style={styles.changelogSection}>
                <Text style={[styles.changelogTitle, { color: colors.textPrimary }]}>更新说明</Text>
                <Text style={[styles.changelogBody, { color: colors.textSecondary }]}>
                  {updateInfo.body.length > 500
                    ? updateInfo.body.slice(0, 500) + '...'
                    : updateInfo.body}
                </Text>
              </View>
            ) : null}

            {/* 下载进度 */}
            {isDownloading && (
              <View style={styles.progressSection}>
                <View style={[styles.progressBarBg, { backgroundColor: colors.bgNested }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { backgroundColor: colors.primary, width: `${progressPercent}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressInfo}>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {progressPercent}%
                  </Text>
                  <Text style={[styles.mirrorText, { color: colors.textSecondary }]}>
                    镜像：{downloadStatus.mirror}
                  </Text>
                </View>
              </View>
            )}

            {/* 下载完成提示 */}
            {isDownloaded && (
              <View style={[styles.successRow, { backgroundColor: '#34C75915' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                <Text style={[styles.successText, { color: '#34C759' }]}>
                  下载完成，点击下方按钮安装
                </Text>
              </View>
            )}

            {/* 安装中 */}
            {isInstalling && (
              <View style={styles.installingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.installingText, { color: colors.textSecondary }]}>
                  正在启动安装器...
                </Text>
              </View>
            )}

            {/* 错误提示 */}
            {isError && (
              <View style={[styles.errorRow, { backgroundColor: '#FF3B3015' }]}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" />
                <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                  {downloadStatus.message}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* 底部按钮 */}
          <View style={[styles.footer, { borderColor: colors.border }]}>
            {isIdle && (
              <>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>稍后再说</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
                  onPress={handleDownload}
                  disabled={!asset}
                >
                  <Ionicons name="cloud-download-outline" size={18} color={colors.textOnPrimary} />
                  <Text style={[styles.downloadBtnText, { color: colors.textOnPrimary }]}>
                    一键下载安装
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isDownloading && (
              <>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>取消</Text>
                </TouchableOpacity>
                <View style={[styles.downloadingBtn, { backgroundColor: colors.primary + '80' }]}>
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  <Text style={[styles.downloadBtnText, { color: colors.textOnPrimary }]}>
                    下载中 {progressPercent}%
                  </Text>
                </View>
              </>
            )}

            {isDownloaded && (
              <>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>关闭</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.installBtn, { backgroundColor: '#34C759' }]}
                  onPress={handleInstall}
                >
                  <Ionicons name="build-outline" size={18} color="#fff" />
                  <Text style={styles.installBtnText}>安装更新</Text>
                </TouchableOpacity>
              </>
            )}

            {isInstalling && (
              <View style={[styles.installingBtn, { backgroundColor: colors.primary + '80' }]}>
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
                <Text style={[styles.downloadBtnText, { color: colors.textOnPrimary }]}>
                  启动安装器中...
                </Text>
              </View>
            )}

            {isError && (
              <>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>关闭</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
                  onPress={handleDownload}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.textOnPrimary} />
                  <Text style={[styles.downloadBtnText, { color: colors.textOnPrimary }]}>重试下载</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.browserBtn, { borderColor: colors.primary }]}
                  onPress={() => updateInfo.htmlUrl && Linking.openURL(updateInfo.htmlUrl)}
                >
                  <Text style={[styles.browserBtnText, { color: colors.primary }]}>前往下载页</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 16,
    marginBottom: 12,
  },
  versionItem: {
    alignItems: 'center',
    gap: 4,
  },
  versionLabel: {
    fontSize: 11,
  },
  versionValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  archRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    borderStyle: 'dashed',
  },
  archText: {
    fontSize: 12,
  },
  apkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  apkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  apkInfo: {
    flex: 1,
  },
  apkName: {
    fontSize: 13,
    fontWeight: '500',
  },
  apkSize: {
    fontSize: 11,
    marginTop: 2,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  apkList: {
    gap: 6,
    marginBottom: 12,
  },
  apkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  apkOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  apkOptionName: {
    fontSize: 12,
    fontWeight: '500',
  },
  apkOptionSize: {
    fontSize: 11,
    marginTop: 2,
  },
  changelogSection: {
    marginBottom: 12,
  },
  changelogTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  changelogBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mirrorText: {
    fontSize: 11,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: '500',
  },
  installingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 12,
  },
  installingText: {
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  downloadingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  installBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  installingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  browserBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  browserBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
