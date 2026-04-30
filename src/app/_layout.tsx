/**
 * 根布局 - Stack 导航 + StatusBar + TabBar
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, type Href } from 'expo-router';
import { ThemeProvider, useTheme } from '@/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const TAB_BAR_HEIGHT = 56; // TabBar 自身高度（不含安全区）

function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const tabs: { path: Href; icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
    { path: '/', icon: 'home-outline', activeIcon: 'home', label: '首页' },
    { path: '/dashboard', icon: 'analytics-outline', activeIcon: 'analytics', label: '仪表盘' },
    { path: '/settings', icon: 'settings-outline', activeIcon: 'settings', label: '设置' },
  ];

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 8, backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder }]}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <TouchableOpacity
            key={String(tab.path)}
            style={styles.tabItem}
            onPress={() => router.replace(tab.path)}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={22}
              color={isActive ? colors.primary : colors.tabInactive}
            />
            <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.tabInactive }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RootLayoutInner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tabBarTotalHeight = TAB_BAR_HEIGHT + (insets.bottom || 8);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} backgroundColor={colors.bgPage} />
      <View style={[styles.root, { backgroundColor: colors.bgPage }]}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.headerBg,
            },
            headerTintColor: colors.headerTintColor,
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: colors.bgPage,
              paddingBottom: tabBarTotalHeight,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'Cockpit Tools',
            }}
          />
          <Stack.Screen
            name="account/[id]"
            options={{ title: '账号详情' }}
          />
          <Stack.Screen
            name="account/import"
            options={{ title: '导入账号' }}
          />
          <Stack.Screen
            name="checkin-export"
            options={{ title: '导出签到脚本' }}
          />
          <Stack.Screen name="dashboard" options={{ title: '仪表盘' }} />
          <Stack.Screen name="settings" options={{ title: '设置' }} />
        </Stack>
        <View style={styles.tabBarContainer} pointerEvents="box-none">
          <TabBar />
        </View>
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
    height: TAB_BAR_HEIGHT,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
