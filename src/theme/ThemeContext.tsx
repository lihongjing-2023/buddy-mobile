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
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        }
      })
      .catch((err) => {
        console.error('[Theme] Failed to load theme:', err);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, newMode);
    } catch (err) {
      console.error('[Theme] Failed to save theme:', err);
    }
  }, []);

  const toggle = useCallback(() => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
  }, [mode, setMode]);

  const colors = themes[mode];

  // 使用默认主题渲染，避免白屏；加载完成后再应用保存的主题
  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
