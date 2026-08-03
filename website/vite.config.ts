import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Only the share app is built. index.html is the in-progress
        // marketing page and is deliberately left out: nothing currently
        // links to it, and excluding it means a half-finished edit there
        // cannot break a deploy. Re-add `main: entry("index.html")` to
        // ship it again — vercel.json's "/" rewrite defers to a real
        // static file at the root whenever one exists.
        share: entry("share.html"),
      },
    },
  },
});
