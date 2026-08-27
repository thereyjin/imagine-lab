# Imagine Lab — 长期项目记忆

## 入口与构建
- 真源入口：`src/main.tsx`（非 `src/app/App.tsx`，后者是废弃的早期实现）。
- 样式三层覆盖：`styles.css` → `precision.css` → `final-tuning.css`（追加新样式，勿改既有选择器）。
- 状态管理：纯 React `useState`，无路由、无持久化。
- 构建：`npm run build` = `tsc -b && vite build`。**注意**：清空 dist 会触发 WorkBuddy `SAFE_DELETE_BULK_GUARD`（文件数 >50 阈值），标准 build 在自动清理 dist 时被拦截。绕过验证用 `npx vite build --outDir /tmp/il-build-check`。

## 设计系统核心心智（产品边界）
- 规范真源在配置栏（核心设计规范），画布只"引用"规范，绝不"每页提取新规范"。
- 沉淀菜单条件化：`designSystemMode='inherit'`（模板已有规范，显示"提交规范扩展建议"）vs `'create'`（项目级初始化，首项"建立核心设计规范"）。inherit 模式严禁出现"提取设计规范"。

## 本地预览
- dev server：`npm run dev -- --host 127.0.0.1`（端口 5173）。启动前先 `lsof -ti :5173` 确认无僵死进程。

## 外部设计工具接入
- Paper MCP：配置在 `~/.workbuddy/mcp.json`，用 streamable_http 直连 `http://127.0.0.1:29979/mcp`，无 `command`/`env`/`oauth_resource`（Paper Desktop app 打开文件即自动启动本地 MCP server，无需 API key）。排查顺序：Paper Desktop 是否打开且有活动文件 → 端口 29979 是否响应（curl POST 返回 415 表示 server 活着、只是缺 JSON-RPC 头）→ WorkBuddy 连接器管理页是否 Trust。
