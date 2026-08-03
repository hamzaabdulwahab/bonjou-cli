import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The marketing page and the share app ship from one project so
        // they share a deploy, but they stay independent entries: the
        // marketing page carries no app bundle, and the app carries no
        // marketing markup.
        main: entry("index.html"),
        share: entry("share.html"),
      },
    },
  },
});
