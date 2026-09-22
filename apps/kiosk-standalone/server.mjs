// Servidor de estáticos HTTP para kiosk-standalone usando únicamente la biblioteca estándar de Node.js.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const DIST = resolve(process.env.DIST ?? process.cwd(), 'dist');
const PORT = Number(process.env.PORT ?? 5174);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

// Direcciones IPv4 locales para enlace LAN.
export function direccionesLan() {
  const salida = [];
  for (const [nombre, entradas] of Object.entries(networkInterfaces())) {
    for (const e of entradas ?? []) {
      if (e.internal || (e.family !== 'IPv4' && e.family !== 4)) continue;
      salida.push({ nombre, address: e.address });
    }
  }
  const prioridad = (a) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : 2);
  return salida.sort((a, b) => prioridad(a.address) - prioridad(b.address));
}

export function createStaticServer({ dist = DIST } = {}) {
  const baseDir = resolve(dist);
  return createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      const decoded = decodeURIComponent(pathname);
      const target = decoded === '/' ? '/index.html' : decoded;
      const file = resolve(baseDir, '.' + (target.startsWith('/') ? target : '/' + target));
      if (!file.startsWith(baseDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Prohibido');
        return;
      }
      await stat(file);
      const ext = extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado.');
    }
  });
}

// Si se ejecuta directamente desde la línea de comandos
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('server.mjs')) {
  const server = createStaticServer({ dist: DIST });
  server.listen(PORT, () => {
    console.log(`[kiosk] sirviendo estáticos desde ${DIST}`);
    console.log('');
    console.log(`  Kiosk (este equipo): http://localhost:${PORT}/`);
    const lan = direccionesLan();
    if (lan.length) {
      for (const { nombre, address } of lan) {
        console.log(`  Red local:           http://${address}:${PORT}/   [${nombre}]`);
      }
    }
    console.log('');
  });
}

