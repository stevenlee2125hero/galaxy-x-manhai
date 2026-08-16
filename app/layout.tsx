import type { Metadata, Viewport } from "next";
import globalsCss from "./globals.css?inline";
import iphone15Css from "./iphone15.css?inline";
import applePolishCss from "./apple-polish.css?inline";

const codexPreviewGuard = `
window.addEventListener("unhandledrejection", function (event) {
  var message = event.reason && event.reason.message;
  if (message === "Cannot read properties of undefined (reading 'send')") {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
`;

export const metadata: Metadata = {
  title: "银河X漫海｜手机漫画馆",
  description: "为手机打造的清新私人漫画 App",
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
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><head>{process.env.NODE_ENV === "development" && <script dangerouslySetInnerHTML={{ __html: codexPreviewGuard }}/>}<style dangerouslySetInnerHTML={{ __html: `${globalsCss}\n${iphone15Css}\n${applePolishCss}` }}/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/></head><body>{children}</body></html>}
