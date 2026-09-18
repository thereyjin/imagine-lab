# Imagine Lab 组件整理规则 v1

Imagine Lab 只提供规则、确定性检查和 GitHub 只读目录，不提供模型能力。

## 读取与确认
先通过 Paper MCP 读取操作说明、当前选择、完整节点树、JSX、computed styles、截图和资源。连接不可用时明确说明，不假装读取。
按独立用途和复用价值给出简短组件清单，来源明确时直接继续实现。只有画板选择或业务行为不明确才集中询问；不重复确认已给出的范围。不要为凑数量拆分零碎图层；确有五个可复用组件才实现五个。相同结构以 props/variant 表达。
能读取的信息不重复询问。不明确的业务行为、图标用途和响应式规则集中询问。未确定的交互不能假称实现。

## 原稿保护与实现
永远保留原始 Design。必须整理结构时先复制独立 Code Ready 副本，只修改副本，每批对照原稿截图。无法安全调整的 absolute 保留。
确认目标项目。本版检查器支持 React + TypeScript；其他技术栈先告知尚不支持。组件接受明确 props，避免依赖应用全局状态。保留字体、图片、图标资源及来源/许可，不重绘冒充原资源。
运行预览，对照原稿检查视觉、不同内容和约定交互。检查器只证明文件与构建，不证明视觉与功能验收。

## 本地交付契约
在用户确认的项目根目录生成 .imagine/manifest.json：

```json
{
  "schemaVersion": 1,
  "project": "项目名称",
  "components": [{
    "componentId": "course-card",
    "name": "课程卡片",
    "category": "内容展示",
    "path": "src/components/CourseCard",
    "framework": "react",
    "source": "Paper 文件和节点 ID",
    "status": "ready",
    "preview": "assets/preview.png"
  }]
}
```

每个组件目录必须含 index.tsx、example.tsx、README.md、assets/。从真实运行示例中截图到 assets/preview.png，并在 manifest 的 preview 字段声明。没有预览图的旧组件仍可检查，但目录只展示代码入口，不冒充已有视觉预览。
example.tsx 必须导入并展示真实组件，包含最小可运行示例。样式/内部模块/资源放组件目录内，跨组件依赖在 README 列出。外部依赖在项目 package.json 声明，保留锁文件。不要外链临时图片。
README 必须包含「用途」「Props」「依赖」「限制」「示例」五个章节，列出状态、使用方法、未完成行为与来源。
manifest 只登记实际完成的组件。不要修改 Imagine Lab 源码来绕过检查。

## 交接与 GitHub
收到带任务编号的指令后，在 `.imagine/task-<taskId>.json` 中记录 `taskId`、`source: {file, artboard, nodeId}`、`components`、`revision` 和 `previewUrl`。开始写入前将 `status` 设为 `writing`；完成代码、构建和运行预览后，最后原子更新为 `ready`。每次修改增加字符串形式的 `revision`。预览必须为可访问的本机 HTTP 地址。Imagine Lab 只会自动检查当前任务的 ready 记录；旧组件或未写完的记录不会触发成功。

先在 Imagine Lab 完成本地结构、TypeScript、example 构建检查；失败按实际错误修复再检查。
未经用户确认仓库、分支和范围，不创建仓库、commit 或 push。检查通过不代表获得全仓库上传授权。不上传 token、.env、node_modules 或无关文件。
用户授权后由宿主 AI 提交本次 manifest、组件、必要依赖和文档，返回 owner/repo、分支、commit SHA。
用户点击「效果可以，发布到 GitHub」复制的任务已包含指定仓库、分支和本次组件的发布授权，不再索要相同确认。若实际发布范围超出授权，则说明具体差异。点击复制不等于发布，用户仍需把任务粘贴到 AI 聊天中。
Imagine Lab 只读验证远端固定 commit 下文件哈希与本次本地交付一致后收录，不代替 Git 客户端。
