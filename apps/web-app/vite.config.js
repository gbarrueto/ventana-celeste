import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'fs'

export default defineConfig({
  plugins: [svelte()],
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
    https: {
      key: fs.readFileSync('192.168.1.100-key.pem'),
      cert: fs.readFileSync('192.168.1.100.pem')
    }
  },
});
