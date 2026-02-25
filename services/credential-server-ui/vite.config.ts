import os from "node:os";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const viteCacheDir = path.join(
  process.env.LOCALAPPDATA ?? os.tmpdir(),
  "fairway-veridian-wallet",
  "credential-server-ui",
  "vite-cache"
);

// https://vite.dev/config/
export default defineConfig({
  cacheDir: viteCacheDir,
  plugins: [
    react({
      include: "**/*.tsx",
    }),
    nodePolyfills(),
  ],
  server: {
    host: true,
    port: 3002,
    watch: {
      usePolling: true,
    },
  },
});
