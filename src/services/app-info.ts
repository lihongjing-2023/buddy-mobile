/**
 * 应用信息工具
 * 读取 app.json 中注入的版本号
 */

import Constants from 'expo-constants';

/** 获取当前 App 版本号（来自 app.json version 字段） */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
