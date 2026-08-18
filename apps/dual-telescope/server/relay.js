// Relay de producción: sirve dist/ y hace de puente entre Ocular y Guía.
//
// Corre en el dispositivo principal, que por defecto es el mismo que lleva los
// sensores. En desarrollo no se usa: ahí el relay va enganchado al dev server de
// Vite para compartir su HTTPS (ver vite.config.js y docs/deployment.md).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { createRelay, direccionesLan } from './relay-core.js';

// Desde el directorio de trabajo, no desde la ubicación del archivo: así sirve
// igual dentro del repo y en el paquete de despliegue, y evita `import.meta.url`,
// que no sobrevive al bundleo.
const DIST = resolve(process.env.DIST ?? process.cwd(), 'dist');
const PORT = Number(process.env.PORT ?? 8080);
const SENSOR_SOURCE = process.env.SENSOR_SOURCE ?? 'ocular';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const relay = createRelay({ sensorSource: SENSOR_SOURCE });

const server = createServer(async (req, res) => {
  if (relay.handleRequest(req, res)) return;
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    const file = join(DIST, normalize(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end('Prohibido');
      return;
    }
    await stat(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado.');
  }
});

server.on('upgrade', (req, socket, head) => {
  if (!relay.handleUpgrade(req, socket, head)) socket.destroy();
});

server.listen(PORT, () => {
  console.log(`[relay] fuente de sensores: ${SENSOR_SOURCE}`);
  console.log(`[relay] estáticos desde ${DIST}`);
  console.log('');
  console.log(`  Ocular (este equipo): http://localhost:${PORT}/`);
  // Las direcciones salen de Node, no de `ip route` ni `hostname -i`: en Termux
  // esas devuelven loopback, que el guía no puede alcanzar.
  const lan = direccionesLan();
  if (lan.length) {
    for (const { nombre, address } of lan) {
      console.log(`  Guía (otro teléfono): http://${address}:${PORT}/guide.html   [${nombre}]`);
    }
  } else {
    console.log('  Guía: sin dirección de LAN. ¿El punto de acceso está encendido?');
  }
  console.log('');
  console.log('  El panel de depuración del ocular muestra esta URL como QR.');
});
