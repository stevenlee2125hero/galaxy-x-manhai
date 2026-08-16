# 银河X漫海

专为 iPhone 15 Plus 优化的天空风漫画阅读 PWA。安装到主屏幕后可全屏运行，并针对灵动岛、圆角屏幕和底部 Home 指示条处理安全区域。

在线使用：[mangaverse-reader.stevenlee2125hero.chatgpt.site](https://mangaverse-reader.stevenlee2125hero.chatgpt.site)

## 主要能力

- 真实漫画封面与来源标记，不生成虚构封面或正文
- 直接看、登录看、付费看、会员看、域外看和网盘看筛选
- 章节选择、阅读进度、收藏、屏蔽与相似推荐
- 本机离线漫画导入与批量缓存
- 百度网盘官方 OAuth 接入
- iPhone 15 Plus 灵动岛、横竖屏与安全区域适配
- 可添加到 iOS 主屏幕的 PWA 安装体验

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
- 百度网盘凭据与令牌仅通过 HttpOnly、Secure Cookie 保存。
- 仅接入正版、公开授权、公共领域或用户自己拥有阅读权的资源。
- 仓库默认保持私有；公开前请完成服务端鉴权与内容授权审查。

更多安全约束见 [SECURITY.md](./SECURITY.md)。

## 技术栈

React 19、Next.js 16、Vinext、Vite 8、Cloudflare Worker。
