/**
 * 用量状态徽章组件
 * 显示正常/异常状态，异常时可展开详情弹窗
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UsageInfo } from '@/modules/core/quota-model';
import { useTheme } from '@/theme';

interface UsageStatusBadgeProps {
  usage: UsageInfo;
  accountLabel?: string;
}

export function UsageStatusBadge({ usage, accountLabel }: UsageStatusBadgeProps) {
  const { colors } = useTheme();
  const [showDetail, setShowDetail] = useState(false);

  if (usage.isNormal) {
    return (
      <View style={styles.normalBadge}>
        <Ionicons name="checkmark-circle" size={14} color="#34C759" />
        <Text style={styles.normalText}>正常</Text>
      </View>
    );
  }

  const detailText = usage.dosageNotifyZh || usage.dosageNotifyEn || usage.dosageNotifyCode || '用量异常';

  return (
    <>
      <TouchableOpacity
        style={styles.abnormalBadge}
        onPress={() => setShowDetail(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="alert-circle" size={14} color="#FF3B30" />
        <Text style={styles.abnormalText}>异常</Text>
        <Text style={[styles.viewDetailText, { color: colors.primary }]}>详情</Text>
      </TouchableOpacity>

      <Modal
        visible={showDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetail(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDetail(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>用量状态详情</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {accountLabel && (
                <View style={styles.accountRow}>
                  <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>账号</Text>
                  <Text style={[styles.accountValue, { color: colors.textPrimary }]}>{accountLabel}</Text>
                </View>
              )}
              <View style={styles.errorDetailBox}>
                <Ionicons name="warning" size={20} color="#FF9500" style={styles.warningIcon} />
                <Text style={styles.errorDetailText}>{detailText}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowDetail(false)}
            >
              <Text style={[styles.modalConfirmText, { color: colors.textOnPrimary }]}>确认</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  normalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#34C75918',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  normalText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
  },
  abnormalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF3B3018',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  abnormalText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  viewDetailText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 18,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  accountLabel: {
    fontSize: 13,
  },
  accountValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  errorDetailBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FF950012',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FF950033',
    gap: 10,
  },
  warningIcon: {
    marginTop: 1,
  },
  errorDetailText: {
    color: '#FF9500',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  modalConfirmBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 10,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
