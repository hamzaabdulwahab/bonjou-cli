import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

/**
 * Mirrors the rewrites in vercel.json.
 *
 * Production serves index.html for "/", "/app", and "/r/{code}". Without
 * the same mapping here, the dev server 404s on every one of those and the
 * client router can only be exercised against a real deploy.
 */
const rewrites = () => ({
  name: "bonjou-rewrites",
  configureServer(server: { middlewares: { use: (fn: Middleware) => void } }) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? "").split("?")[0];
      if (path === "/app" || path === "/share" || /^\/r\//.test(path)) {
        req.url = "/index.html";
      }
      next();
    });
  },
});

type Middleware = (
  req: { url?: string },
  res: unknown,
  next: () => void,
) => void;

export default defineConfig({
  plugins: [react(), rewrites()],
  build: {
    rollupOptions: {
      input: {
        // One entry. "/" is served by index.html directly; vercel.json only
        // rewrites the client routes "/app" and "/r/{code}" onto it. An
        // earlier standalone marketing page and its React entry lived
        // alongside this and are in git history if ever wanted back.
        share: entry("index.html"),
      },
    },
  },
});
