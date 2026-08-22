import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "pages",
  base: "/galaxy-x-manhai/",
  publicDir: "../public",
  plugins: [react()],
  define: { "import.meta.env.VITE_STATIC_SITE": JSON.stringify("true") },
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: "index.html",
        notFound: "404.html"
      }
    }
  }
});
