import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [svelte(), basicSsl()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        telescope: 'telescope.html',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
