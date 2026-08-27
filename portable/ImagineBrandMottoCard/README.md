# Imagine Lab 侧边栏品牌宣言卡片

这是从 Imagine Lab 项目中抽离出的独立 React + TypeScript 组件，可直接移植到另一个项目的侧边栏底部。

## 文件

```text
ImagineBrandMottoCard/
├── ImagineBrandMottoCard.tsx
├── ImagineBrandMottoCard.css
├── index.ts
├── preview.html
└── assets/
    ├── brand-motto-bg.png
    └── imagine-lab-logo.png
```

## React 项目接入

1. 将整个 `ImagineBrandMottoCard` 文件夹复制到目标项目的组件目录，例如：

```text
src/components/ImagineBrandMottoCard/
```

2. 在侧边栏组件中引入：

```tsx
import ImagineBrandMottoCard from './components/ImagineBrandMottoCard';

function Sidebar({collapsed}: {collapsed: boolean}) {
  return (
    <aside className="sidebar">
      {/* 侧边栏现有内容 */}
      <ImagineBrandMottoCard collapsed={collapsed} />
    </aside>
  );
}
```

3. 侧边栏容器必须形成定位上下文：

```css
.sidebar {
  position: relative;
  width: 224px;
  height: 100vh;
}
```

默认位置与 Imagine Lab 一致：左侧 `8px`，底部 `82px`，用于放在 API 设置卡片上方。

## 使用目标项目自己的顶部 Logo

推荐把目标项目侧边栏顶部使用的同一张 Logo 传进组件：

```tsx
import sidebarLogo from '../assets/sidebar-logo.png';

<ImagineBrandMottoCard
  logoSrc={sidebarLogo}
  brandName="Imagine Lab"
  collapsed={collapsed}
/>
```

若不传 `logoSrc`，组件会使用包内的 Imagine Lab Logo。

## 调整位置或尺寸

通过 CSS 自定义属性调整，不需要改组件源码：

```tsx
<ImagineBrandMottoCard
  style={{
    '--im-card-left': '12px',
    '--im-card-bottom': '76px',
    '--im-card-width': '216px',
    '--im-card-height': '148px',
  } as React.CSSProperties}
/>
```

## 当前确认参数

- 尺寸：`208 × 148px`
- 左侧位置：`8px`
- 底部位置：`82px`
- 圆角：`16px`
- 文案：17px 衬线字体，28px 行高
- Logo 信息与文案间距：`22px`
- 底部内边距：`14.4px`（在原 18px 基础上减少 20%）
- 收起状态：`collapsed=true` 时隐藏

## 非 React 项目

打开 `preview.html` 可查看纯 HTML/CSS 结构，并复制其中的 DOM。背景图和 Logo 路径均使用包内相对路径。
