# 🚀 Cockpit Tools Mobile

> WorkBuddy CN 账号管理工具移动端 — 额度查询与每日签到

[![Expo](https://img.shields.io/badge/Expo-SDK_52-000?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.76.9-61dafb?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

一个专为 WorkBuddy CN 用户设计的跨平台移动端应用，支持账号额度查询、每日签到、配额分组展示等功能。基于 **Expo Managed Workflow** 构建，可同时运行于 iOS 与 Android。

---

## 📖 目录

- [功能特性](#-功能特性)
- [截图](#-截图)
- [快速开始](#-快速开始)
- [开发指南](#-开发指南)
- [数据导入](#-数据导入)
- [项目结构](#-项目结构)
- [技术栈](#-技术栈)
- [常见问题](#-常见问题)
- [相关链接](#-相关链接)
- [贡献](#-贡献)
- [许可证](#-许可证)

---

## ✨ 功能特性

- ✅ **账号管理** — 从 PC 端 Cockpit Tools 导出 JSON，手机端导入账号
- ✅ **额度查询** — 自动刷新 Token，并行查询 3 个配额 API，展示套餐详情与使用量
- ✅ **每日签到** — 单个/批量一键签到，实时展示签到状态
- ✅ **配额分组** — 按基础体验包/活动赠送包/加量包/其他分组，含进度条与展开详情
- ✅ **状态标识** — 用量正常/异常状态可视化，异常时弹窗展示详细通知
- ✅ **跨平台** — 一套代码同时运行于 iOS 与 Android

---

## 📸 截图

> 待补充：应用界面截图

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm / yarn / pnpm
- Expo Go App（Android / iOS）
- 可选：Android Studio（Android 模拟器）或 Xcode（iOS 模拟器）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/lihongjing-2023/buddy-mobile.git
cd buddy-mobile

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npx expo start

# 4. 使用 Expo Go 扫描二维码（真机）
# 或按 a/i 键启动模拟器
```

### 构建发布

```bash
# Android 构建
npm run build:android

# iOS 构建
npm run build:ios

# Web 构建
npm run build:web
```

---

## 🛠️ 开发指南

### 项目脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Expo 开发服务器 |
| `npm run android` | 运行 Android 应用 |
| `npm run ios` | 运行 iOS 应用 |
| `npm run web` | 在浏览器中运行 |
| `npm run prebuild` | 清理并重新生成原生代码 |
| `npm run tsc` | 运行 TypeScript 类型检查 |
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm run doctor` | 运行 Expo Doctor 检查环境 |

### 目录结构

```
cockpit-tools-mobile/
├── assets/              # 静态资源（图片、字体等）
├── docs/                # 项目文档
│   └── ARCHITECTURE.md  # 数据存储架构说明
├── src/
│   ├── app/             # Expo Router 页面（文件路由）
│   ├── components/      # 通用 UI 组件
│   ├── services/        # API 服务层
│   ├── stores/          # Zustand 状态管理
│   ├── utils/           # 工具函数
│   └── constants/       # 常量定义
├── android/             # Android 原生工程（Expo 生成）
├── .gitignore           # Git 忽略配置
├── app.json             # Expo 应用配置
├── eas.json             # EAS Build 配置
├── package.json         # 依赖配置
└── tsconfig.json        # TypeScript 配置
```

### 代码规范

- 使用 **TypeScript**，遵循 `strict` 模式
- 组件使用 **函数式组件 + Hooks**
- 状态管理使用 **Zustand**（全局状态）与 `useState`（局部状态）
- API 请求使用 **axios**，统一在 `src/services/` 下管理
- 样式使用 **StyleSheet**，遵循 React Native 最佳实践

---

## 📥 数据导入

支持以下 JSON 格式（兼容 PC 端 Cockpit Tools 导出）：

```json
// 单个账号
{"access_token": "...", "refresh_token": "...", "email": "user@example.com"}

// 账号数组
[{"access_token": "...", "refresh_token": "..."}, ...]

// 包装格式
{"accounts": [...]} 或 {"items": [...]}
```

字段名兼容 `camelCase` / `snake_case`（如 `accessToken` / `access_token`）。

导入流程：粘贴 JSON / 选择文件 → 解析 → 去重合并 → 写入 AsyncStorage（元数据）+ SecureStore（Token）。

---

## 🔄 与 PC 端功能对比

> 对比项目：[cockpit-tools](https://github.com/user/cockpit-tools) (Tauri + React)

| 功能 | PC 端 | 移动端 | 说明 |
|------|:-----:|:------:|------|
| 卡片/列表视图 | ✅ | ✅ | 移动端仅卡片视图 |
| 搜索账号 | ✅ | ❌ | 待实现 |
| 套餐筛选 | ✅ | ❌ | 待实现 |
| 标签系统 | ✅ | ❌ | 待实现 |
| 用量状态展示 | ✅ | ✅ | 异常弹窗详情 |
| 配额分组展示 | ✅ | ✅ | 进度条 + 展开 |
| 签到功能 | ✅ | ✅ | 独立签到页 |
| 导出 JSON | ✅ | ✅ | 移动端仅剪贴板 |
| OAuth 登录 | ✅ | ❌ | 待实现 |

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 了解数据存储与同步机制。

---

## ❓ 常见问题

### Q: Token 存储在哪里？

A: Token 存储在 **SecureStore**（加密存储），账号元数据存储在 **AsyncStorage**（明文）。详见 [数据存储架构](docs/ARCHITECTURE.md)。

### Q: 为什么没有自动刷新功能？

A: 当前版本已实现 `useAutoRefresh` Hook，可在首页根据设置自动定时刷新。若未生效，请检查 `AppSettings` 配置。

### Q: 如何清空所有数据？

A: 在「设置」页面点击「清空全部账号」即可清除所有账号与 Token（SecureStore + AsyncStorage）。

### Q: 后台签到为什么不可用？

A: 移动端后台签到受限于系统限制（iOS 后台最多 30 秒，Android 需 Foreground Service），实现复杂且不可靠，暂不开放。

---

## 🔗 相关链接

- **PC 端项目**：[cockpit-tools](https://github.com/user/cockpit-tools)
- **Expo 文档**：https://docs.expo.dev/
- **React Native 文档**：https://reactnative.dev/
- **WorkBuddy CN 官网**：https://workbuddy.cn/

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目基于 **MIT** 许可证开源，详见 [LICENSE](LICENSE) 文件。

---

> 如有问题或建议，请提交 [Issue](https://github.com/lihongjing-2023/buddy-mobile/issues)。感谢使用 Cockpit Tools Mobile！
