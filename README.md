# 银河X漫海

专为手机优化的天空风漫画阅读网页。线上唯一运行环境是 GitHub Pages，安装到手机主屏幕后可全屏运行，并针对灵动岛、圆角屏幕和底部 Home 指示条处理安全区域。

在线使用：[GitHub Pages](https://stevenlee2125hero.github.io/galaxy-x-manhai/)

## 主要能力

- 真实漫画封面与来源标记，不生成虚构封面或正文
- 直接看、登录看、付费看、会员看、域外看和网盘看筛选
- 章节选择、阅读进度、收藏、屏蔽与相似推荐
- 本机离线漫画导入与批量缓存
- GitHub Pages 静态网页，不依赖 Cloudflare 或运行中的服务端
- 手机灵动岛、横竖屏与安全区域适配
- 可添加到 iOS 主屏幕的 PWA 安装体验

## 发布与更新

推送到 `main` 会触发 `.github/workflows/pages.yml`，自动构建并发布 GitHub Pages。每天北京时间 01:00 附近，`.github/workflows/nightly-sync.yml` 会检查公开目录源、更新 `public/comic-catalog.json` 与同步状态，然后自动触发 Pages 重新发布。

网页端不保存百度密钥，也不能从 GitHub Pages 读取百度网盘私有目录；本机漫画请使用“我的”中的本机导入，数据只保存在当前手机浏览器。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

生产检查：

```bash
npm run lint
npm run build
```

## 安全与版权

- 不要提交密码、API Key、OAuth Token、私人漫画包或私有来源链接。
- GitHub Pages 版本不包含百度 OAuth 服务端功能，避免把密钥放进静态网页。
- 仅接入正版、公开授权、公共领域或用户自己拥有阅读权的资源。
- 仓库默认保持私有；公开前请完成服务端鉴权与内容授权审查。

更多安全约束见 [SECURITY.md](./SECURITY.md)。

## 技术栈

React 19、Next.js 16、Vinext、Vite 8、GitHub Actions、GitHub Pages。
