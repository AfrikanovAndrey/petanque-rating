import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Абсолютный путь к каталогу `frontend/src` (без завершающего `/`). */
function resolveSrcDir(): string {
  let pathname = decodeURIComponent(
    new URL("./src", import.meta.url).pathname
  );
  // Windows: `file:///C:/...` → `/C:/...` — убираем ведущий `/`
  if (/^\/[A-Za-z]:\//.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname.replace(/\/$/, "");
}

const srcDir = resolveSrcDir();

// Резолв импортов вида `@/types` → `src/types` (tsconfig paths Vite сам не читает).
// https://vitejs.dev/config/shared-options.html#resolve-alias
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${srcDir}/`,
      },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://backend:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
