import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createReadStream, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// The Stellarium engine is 1.4 MB. Rather than keep a third copy in the repo for
// a diagnostic app, serve web-app's during dev. Read-only, dev-server only.
function serveStellariumAssets() {
  const from = resolve(here, '../web-app/public');
  const files = {
    '/stellarium-web-engine.js': 'application/javascript',
    '/stellarium-web-engine.wasm': 'application/wasm',
  };
  return {
    name: 'serve-stellarium-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const type = files[req.url?.split('?')[0]];
        if (!type) return next();
        const file = resolve(from, req.url.split('?')[0].slice(1));
        if (!existsSync(file)) {
          res.statusCode = 404;
          return res.end(`No encontrado: ${file}`);
        }
        res.setHeader('Content-Type', type);
        createReadStream(file).pipe(res);
      });
    },
  };
}

// HTTPS always: these pages are opened on a phone over the LAN, and the
// orientation sensors need a secure context or they return nothing at all.
export default defineConfig({
  plugins: [basicSsl(), serveStellariumAssets()],
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        sky: resolve(here, 'sky.html'),
      },
    },
  },
});
