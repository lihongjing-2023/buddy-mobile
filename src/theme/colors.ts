/**
 * 主题颜色定义
 * 支持浅色/深色两种主题，默认浅色
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  /** 页面背景 */
  bgPage: string;
  /** 卡片背景 */
  bgCard: string;
  /** 嵌套区域背景（如配额区域、输入框） */
  bgNested: string;
  /** 进度条轨道背景 */
  bgTrack: string;
  /** 边框 / 分割线 */
  border: string;
  /** 主文字颜色 */
  textPrimary: string;
  /** 次要文字颜色 */
  textSecondary: string;
  /** 标签栏 inactive 颜色 */
  tabInactive: string;
  /** 主色调 */
  primary: string;
  /** 主色调浅背景 */
  primaryLight: string;
  /** 状态栏样式 */
  statusBarStyle: 'light' | 'dark';
  /** Header 背景色 */
  headerBg: string;
  /** Header 文字色 */
  headerTintColor: string;
  /** 白色/反色文字 */
  textOnPrimary: string;
  /** 刷新控件颜色 */
  refreshTint: string;
  /** TabBar 背景 */
  tabBarBg: string;
  /** TabBar 上边框 */
  tabBarBorder: string;
}

export const lightTheme: ThemeColors = {
  bgPage: '#F5F5F7',
  bgCard: '#FFFFFF',
  bgNested: '#F0F0F2',
  bgTrack: '#E5E5EA',
  border: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  tabInactive: '#8E8E93',
  primary: '#5856D6',
  primaryLight: '#5856D622',
  statusBarStyle: 'dark',
  headerBg: '#FFFFFF',
  headerTintColor: '#1C1C1E',
  textOnPrimary: '#FFFFFF',
  refreshTint: '#5856D6',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E5E5EA',
};

export const darkTheme: ThemeColors = {
  bgPage: '#0F0E17',
  bgCard: '#1A1925',
  bgNested: '#0F0E17',
  bgTrack: '#232228',
  border: '#232228',
  textPrimary: '#E4E4E7',
  textSecondary: '#8E8E93',
  tabInactive: '#8E8E93',
  primary: '#8B5CF6',
  primaryLight: '#8B5CF622',
  statusBarStyle: 'light',
  headerBg: '#1A1925',
  headerTintColor: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  refreshTint: '#8B5CF6',
  tabBarBg: '#1A1925',
  tabBarBorder: '#232228',
};

export const themes: Record<ThemeMode, ThemeColors> = {
  light: lightTheme,
  dark: darkTheme,
};
