# 贡献指南

感谢您考虑为 **Cockpit Tools Mobile** 做贡献！🎉

本指南将帮助您了解如何提交 Issue、Pull Request 以及代码规范。

---

## 📝 提交 Issue

如果您发现了 Bug 或有功能建议，请先搜索是否已存在相关 Issue。若无，请新建 Issue 并包含以下信息：

- **环境**：Expo SDK 版本、Node.js 版本、设备型号
- **复现步骤**：清晰描述如何复现问题
- **预期行为**：您期望的结果是什么
- **实际行为**：实际发生了什么
- **截图/日志**：如有，请附上

---

## 🔀 提交 Pull Request

### 1. Fork 仓库

点击右上角 Fork 按钮，将仓库复制到您的 GitHub 账号。

### 2. 克隆到本地

```bash
git clone https://github.com/<您的用户名>/buddy-mobile.git
cd buddy-mobile
```

### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bugfix-name
```

分支命名建议：
- `feature/xxx` — 新功能
- `fix/xxx` — Bug 修复
- `docs/xxx` — 文档修改
- `refactor/xxx` — 代码重构

### 4. 开发与测试

```bash
# 安装依赖
npm install

# 启动开发服务器进行测试
npx expo start
```

- 确保代码通过 TypeScript 类型检查：`npm run tsc`
- 确保代码通过 ESLint 检查：`npm run lint`
- 在至少一个平台（Android / iOS）上测试通过

### 5. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
# 或
git commit -m "fix: 修复某个问题描述"
```

提交信息规范（参考 [Conventional Commits](https://www.conventionalcommits.org/)）：

- `feat:` — 新功能
- `fix:` — Bug 修复
- `docs:` — 文档更新
- `style:` — 代码格式调整（不影响功能）
- `refactor:` — 代码重构
- `test:` — 测试相关
- `chore:` — 构建/工具链相关

### 6. 推送并提交 PR

```bash
git push origin feature/your-feature-name
```

在 GitHub 上打开 Pull Request，填写 PR 描述，说明变更内容与动机。

---

## 📐 代码规范

- 使用 **TypeScript**，避免 `any` 类型
- 组件使用 **函数式组件 + Hooks**，优先使用 `const` 与解构赋值
- 状态管理：全局状态用 **Zustand**，局部状态用 `useState`
- API 请求统一放在 `src/services/`，使用 `axios` 并统一错误处理
- 样式使用 `StyleSheet.create`，遵循 React Native 最佳实践
- 文件命名：组件使用 `PascalCase`（如 `AccountCard.tsx`），工具函数使用 `camelCase`（如 `formatDate.ts`）
- 导入顺序：第三方库 → 内部模块 → 样式/常量

---

## 🧪 测试

当前项目未集成自动化测试框架。如需添加测试，建议使用：

- **Jest** — 单元测试
- **React Native Testing Library** — 组件测试
- **Detox** — E2E 测试（可选）

请在 PR 中包含测试用例。

---

## 📚 文档

- 新功能需同步更新 `README.md`
- 架构变更需更新 `docs/ARCHITECTURE.md`
- 复杂业务逻辑建议添加代码注释

---

## ❓ 有问题？

如有疑问，请在 [Discussions](https://github.com/lihongjing-2023/buddy-mobile/discussions) 中发起讨论。

感谢您的贡献！🙏
