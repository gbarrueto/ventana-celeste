import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// HTTPS always: these pages are opened on a phone over the LAN, and the
// orientation sensors need a secure context or they return nothing at all.
//
// The Stellarium engine is imported from @ventanaceleste/core/assets with ?url,
// so there is no copy here and no dev-server proxy for it.
export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5176,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        sky: resolve(here, 'sky.html'),
        io: resolve(here, 'io.html'),
      },
    },
  },
});
