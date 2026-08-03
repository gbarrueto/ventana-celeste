// Lógica del relay, compartida entre los dos modos de ejecución:
//
//   producción — `server/relay.js`, proceso propio que además sirve dist/
//   desarrollo — enganchada al dev server de Vite (ver vite.config.js)
//
// Que en desarrollo viva dentro de Vite no es capricho: los sensores exigen
// contexto seguro, así que la página se sirve por HTTPS, y una página HTTPS no
// puede abrir un WebSocket en claro. Compartiendo servidor, el socket queda en
// el mismo origen y es `wss://` sin configurar nada.
import { WebSocketServer } from 'ws';

export const RELAY_PATH = '/relay';

// Enruta por **rol**, no por id de conexión, así `send(msg, values, target)` del
// messageBus llega sin traducción.
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
        return; // un frame ilegible no debe tirar abajo el relay
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

  // Sólo se atiende RELAY_PATH: en desarrollo el mismo servidor lleva además el
  // WebSocket de HMR de Vite, y hay que dejarlo pasar.
  function handleUpgrade(req, socket, head) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== RELAY_PATH) return false;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    return true;
  }

  // Qué dispositivo lleva los sensores. Cada página lo consulta al cargar.
  function handleRequest(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/link-config') return false;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ sensorSource }));
    return true;
  }

  return { wss, handleUpgrade, handleRequest };
}
