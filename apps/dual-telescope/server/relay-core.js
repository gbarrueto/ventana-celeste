// Lógica del relay WebSocket y configuración de red para dual-telescope.
import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'node:os';

export const RELAY_PATH = '/relay';

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

// Enruta mensajes por rol de destino ('ocular' | 'guide').
export function createRelay({ sensorSource = 'ocular', log = console.log } = {}) {
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const byRole = new Map();

  wss.on('connection', (socket, req) => {
    const role = new URL(req.url, 'http://localhost').searchParams.get('role') ?? 'anon';
    if (!byRole.has(role)) byRole.set(role, new Set());
    byRole.get(role).add(socket);
    log(`[relay] + ${role} (${[...byRole].map(([r, s]) => `${r}:${s.size}`).join(' ')})`);

    socket.on('message', (data) => {
      let payload;
      try {
        payload = JSON.parse(data.toString());
      } catch {
        return;
      }
      const { target, ...rest } = payload;
      const targets = target
        ? [...(byRole.get(target) ?? [])]
        : [...wss.clients].filter((c) => c !== socket);
      const frame = JSON.stringify(rest);
      for (const client of targets) {
        if (client.readyState === 1) client.send(frame);
      }
    });

    socket.on('close', () => {
      byRole.get(role)?.delete(socket);
      log(`[relay] - ${role}`);
    });
  });

  // Maneja upgrade WebSocket en RELAY_PATH.
  function handleUpgrade(req, socket, head) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== RELAY_PATH) return false;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    return true;
  }

  // Endpoint de configuración de enlace (/link-config).
  function handleRequest(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/link-config') return false;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ sensorSource, addresses: direccionesLan().map((d) => d.address) }));
    return true;
  }

  return { wss, handleUpgrade, handleRequest };
}
