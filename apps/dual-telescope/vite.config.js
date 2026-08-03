import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Una app, dos entradas (decisión 4.5): el Ocular lleva los sensores, el Guía
// sólo recibe. Comparten core; se diferencian en qué conectan.
//
// HTTPS en desarrollo por la misma razón que en kiosk: los sensores necesitan
// contexto seguro cuando la página se abre desde otro dispositivo por la LAN.
// En producción el Ocular se sirve a sí mismo por localhost, que ya lo es.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'production' ? [] : [basicSsl()],
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
