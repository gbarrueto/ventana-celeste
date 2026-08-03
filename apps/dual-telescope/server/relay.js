// Relay mínimo entre Ocular y Guía.
//
// Corre en el dispositivo Principal (el mismo que lleva los sensores, ver §5.1
// del plan). Hace dos cosas:
//
//   1. Sirve los estáticos, si existe un build. En desarrollo eso lo hace Vite y
//      este proceso queda sólo como relay.
//   2. Reenvía mensajes `{msg, values, target}` al rol destino.
//
// El enrutado es por **rol**, no por id de conexión: un cliente se anuncia con
// `?role=ocular` o `?role=guide` y los mensajes se dirigen con `target`. Así el
// contrato del messageBus (`send(msg, values, target)`) llega sin cambios.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');
const PORT = Number(process.env.PORT ?? 8080);

// Qué dispositivo lleva los sensores. Lo fija el script de arranque, así que
// mover la fuente de orientación al Guía es un flag y no una edición de código.
// El dispositivo que corre el script es el principal (§5.2b del plan).
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    // Cada página pregunta esto al cargar para saber si emite o sólo recibe.
    if (url.pathname === '/link-config') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ sensorSource: SENSOR_SOURCE }));
      return;
    }

    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    // normalize + prefix check: no servir nada fuera de dist
    const file = join(DIST, normalize(rel));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end('Prohibido');
      return;
    }
    await stat(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado. En desarrollo los estáticos los sirve Vite; este proceso es sólo el relay.');
  }
});

const wss = new WebSocketServer({ server });
/** @type {Map<string, Set<import('ws').WebSocket>>} */
const byRole = new Map();

function add(role, socket) {
  if (!byRole.has(role)) byRole.set(role, new Set());
  byRole.get(role).add(socket);
}

function remove(role, socket) {
  byRole.get(role)?.delete(socket);
}

wss.on('connection', (socket, req) => {
  const role = new URL(req.url, 'http://localhost').searchParams.get('role') ?? 'anon';
  add(role, socket);
  console.log(`[relay] + ${role} (${[...byRole].map(([r, s]) => `${r}:${s.size}`).join(' ')})`);

  socket.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return; // un frame ilegible no debe tirar abajo el relay
    }
    const { target, ...rest } = payload;
    // Sin target: difundir a todos menos al emisor. Con target: sólo a ese rol.
    const targets = target
      ? [...(byRole.get(target) ?? [])]
      : [...wss.clients].filter((c) => c !== socket);
    const frame = JSON.stringify(rest);
    for (const client of targets) {
      if (client.readyState === 1) client.send(frame);
    }
  });

  socket.on('close', () => {
    remove(role, socket);
    console.log(`[relay] - ${role}`);
  });
});

server.listen(PORT, () => {
  console.log(`[relay] http+ws en :${PORT}`);
  console.log(`[relay] fuente de sensores: ${SENSOR_SOURCE}`);
  console.log(`[relay] estáticos desde ${DIST} (si existen)`);
});
