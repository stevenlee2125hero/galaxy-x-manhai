import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./iphone15.css";
import "./apple-polish.css";

export const metadata: Metadata = {
  title: "银河X漫海｜手机漫画馆",
  description: "为 iPhone 15 Plus 打造的清新私人漫画 App",
  applicationName: "银河X漫海",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable:true, title:"银河X漫海", statusBarStyle:"black-translucent" },
  formatDetection: { telephone:false },
  other: { "codex-preview": "development" },
};
export const viewport: Viewport = { width:"device-width", initialScale:1, maximumScale:5, userScalable:true, viewportFit:"cover", themeColor:"#c7efff" };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><head><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/></head><body>{children}</body></html>}
