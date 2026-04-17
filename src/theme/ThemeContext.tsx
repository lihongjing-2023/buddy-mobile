/**
 * 主题 Context + Provider + Hook
 * 提供当前主题颜色和切换功能
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeMode, type ThemeColors } from './colors';

const THEME_KEY = 'cockpit_theme_mode';

interface ThemeContextValue {
  /** 当前主题模式 */
  mode: ThemeMode;
  /** 当前主题颜色 */
  colors: ThemeColors;
  /** 切换主题 */
  setMode: (mode: ThemeMode) => void;
  /** 切换浅/深 */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: themes.light,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [loaded, setLoaded] = useState(false);

  // 从 AsyncStorage 恢复用户选择
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, setMode]);

  const colors = themes[mode];

  if (!loaded) return null; // 等待存储加载完成

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
