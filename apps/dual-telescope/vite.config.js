import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createRelay } from './server/relay-core.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Una app, dos entradas (decisión 4.5): el Ocular lleva los sensores, el Guía
// sólo recibe. Comparten core; se diferencian en qué conectan.
//
// HTTPS en desarrollo por la misma razón que en kiosk: los sensores necesitan
// contexto seguro cuando la página se abre desde otro dispositivo por la LAN.
// En producción el Ocular se sirve a sí mismo por localhost, que ya lo es.
// En desarrollo el relay va montado sobre el propio servidor de Vite. Así la
// página y el socket comparten origen y protocolo: con HTTPS el socket es wss://
// automáticamente, que es lo que permite que los sensores funcionen (contexto
// seguro) sin caer en mixed content.
function devRelay() {
  return {
    name: 'dual-telescope-relay',
    apply: 'serve',
    configureServer(server) {
      const relay = createRelay({ sensorSource: process.env.SENSOR_SOURCE ?? 'ocular' });
      server.middlewares.use((req, res, next) => {
        if (!relay.handleRequest(req, res)) next();
      });
      // Vite ya usa este servidor para su WebSocket de HMR: sólo se toma
      // RELAY_PATH y el resto se deja pasar.
      server.httpServer?.on('upgrade', (req, socket, head) => relay.handleUpgrade(req, socket, head));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'production' ? [devRelay()] : [basicSsl(), devRelay()],
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        ocular: resolve(here, 'index.html'),
        guide: resolve(here, 'guide.html'),
      },
    },
  },
}));
