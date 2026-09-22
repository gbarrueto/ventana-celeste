import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS is enabled for every mode EXCEPT production, on purpose.
//
// Development means serving from a PC and opening the app on a phone over the
// LAN. The orientation sensors require a *secure context*, and a plain-HTTP LAN
// address is not one — the page loads but the sensors silently return nothing,
// which looks like broken code rather than a missing permission.
//
// Production means the device serving itself under Termux and opening
// http://localhost, which browsers already treat as a secure context. A
// self-signed certificate there would buy nothing and cost an "insecure
// connection" warning on every launch.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [svelte(), ...(mode === "production" ? [] : [basicSsl()])],
  build: {
    target: "es2017",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    brotliSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ["**/data/bigdata/**", "**/data/smalldata/**"],
    },
  },
}));
