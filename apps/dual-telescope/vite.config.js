import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createRelay } from './server/relay-core.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Plugin de Vite para integrar el relay WebSocket y endpoints en desarrollo.
function devRelay() {
  return {
    name: 'dual-telescope-relay',
    apply: 'serve',
    configureServer(server) {
      const relay = createRelay({ sensorSource: process.env.SENSOR_SOURCE ?? 'ocular' });
      server.middlewares.use((req, res, next) => {
        if (!relay.handleRequest(req, res)) next();
      });
      server.httpServer?.on('upgrade', (req, socket, head) => relay.handleUpgrade(req, socket, head));

      const original = server.printUrls.bind(server);
      server.printUrls = () => {
        original();
        const { local = [], network = [] } = server.resolvedUrls ?? {};
        const linea = (rol, url) => server.config.logger.info(
          `  \x1b[32m➜\x1b[0m  \x1b[1m${rol}\x1b[0m: \x1b[36m${url}\x1b[0m`,
        );
        if (local[0]) linea('Ocular ', local[0]);
        for (const u of network) linea('Guía   ', `${u.replace(/\/$/, '')}/guide.html`);
        if (!network.length) {
          server.config.logger.warn('  Guía: sin dirección de red. Hace falta `server.host`.');
        }
      };
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'production' ? [devRelay()] : [basicSsl(), devRelay()],
  server: {
    host: true,
    port: 5175,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        ocular: resolve(here, 'index.html'),
        guide: resolve(here, 'guide.html'),
      },
    },
  },
}));
