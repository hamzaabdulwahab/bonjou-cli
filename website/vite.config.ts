import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // One entry. The site is the share app; vercel.json rewrites "/"
        // to it. An earlier standalone marketing page and its React entry
        // lived alongside this and were removed once nothing linked to
        // them; they are in git history if ever wanted back.
        share: entry("share.html"),
      },
    },
  },
});
