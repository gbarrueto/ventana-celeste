import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
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
    watch: {
      ignored: ["**/data/bigdata/**", "**/data/smalldata/**"],
    },
  },
});
