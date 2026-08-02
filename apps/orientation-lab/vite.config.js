import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS always: this page is opened on a phone over the LAN, and the orientation
// sensors need a secure context or they return nothing at all.
export default defineConfig({
  plugins: [basicSsl()],
  server: { host: true },
});
