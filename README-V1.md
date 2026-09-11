# Imagine Lab V1

当前入口为 src/start/main.tsx。旧原型源码保留，但当前入口和本地服务不加载旧 AI/Figma/Canvas 功能。

## 启动

```sh
npm run build
npm run preview:real
```

预览 http://127.0.0.1:4174/。检查根目录默认是本仓库。需要检查另一个可信本地项目时，启动前设置 `IMAGINE_PROJECT_ROOT` 为该项目绝对路径。依赖须在目标项目安装好。本地服务仅监听回环地址。

规则源：public/imagine/rules.md；manifest 格式：public/imagine/schema.json。构建后通过 /imagine/rules.md 供同机宿主 AI 读取。云端 AI 无法访问本机 localhost，需要用户提供规则文件。

## 检查与权限

检查结构、README 字段、静态依赖声明、TypeScript 及真实 example 构建；不会执行项目的 npm scripts，不安装依赖，不验证视觉或业务行为。动态拼接资源地址与运行期行为仍需人工/AI 浏览器验收。检查最多 90 秒，项目配置与文件应来自可信工作目录。

GitHub 同步只调用读取 API，固定远端 commit，并逐文件核对 manifest、组件、package.json、tsconfig.json 的 Git blob 哈希。内容不同不宣布成功。它证明当前远端包含相同交付，不要求人为再造一个新 commit。没有自动 push。

公开仓库无需 Token。私有仓库在服务进程环境配置 `IMAGINE_GITHUB_TOKEN`，使用只读 Contents 权限；不要将 Token 写入代码、浏览器或聊天。未配置真实目标仓库前，远端收录尚待用户真实流程验收。

刷新保留等待任务和仓库输入，不复用旧通过结论。组件目录展示本次已核实交付的名称、分类、预览图片与固定版本代码入口；不执行远端 JSX。预览必须来自 manifest 声明且哈希已验证的图片。目录仅在本地服务内存缓存，重启后重新检查/同步。完整 MCP 服务和跨项目持久目录属于后续扩展，不在此版本假装连接。

## 动画

public/mascot/idle-00.png 至 idle-11.png：12 个 336×304 透明 PNG，身体基线 282。frames.json 记录自动识别的边界、位移及时间表。idle.webp 是 10.48 秒循环；页面用 PNG 序列，可按系统减少动态设置停在首帧。

仅使用 0/1/2 号帧待机，保留其余原始动作而不混入循环。其他角色动作按用户要求使用第 0 帧占位，纸条等只是 CSS 反馈，未重绘角色。源图不修改。

重新生成：`python3 scripts/prepare-mascot.py "源图路径"`（需要 Pillow）。

## 验证

`npm run test:lab` 用隔离的临时项目检查成功、缺文件、类型错误、资源丢失、依赖漏声明、目录越界及跨源拒绝；不连接远端仓库、不上传文件。
