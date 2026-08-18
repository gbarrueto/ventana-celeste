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
import { networkInterfaces } from 'node:os';

export const RELAY_PATH = '/relay';

// IPv4 de LAN del equipo, para que el guía pueda alcanzarlo.
//
// Sale del propio Node y no de `ip route` ni `hostname -i`: en Termux esas dos
// devuelven una dirección de loopback, que es inalcanzable desde el otro
// teléfono aunque este equipo sea el punto de acceso.
//
// Se devuelven todas porque el teléfono puede tener a la vez la interfaz del
// punto de acceso y una de wifi, y cuál sirve depende de a cuál esté conectado
// el guía. El orden pone primero los rangos privados habituales de un punto de
// acceso de teléfono.
export function direccionesLan() {
  const salida = [];
  for (const [nombre, entradas] of Object.entries(networkInterfaces())) {
    for (const e of entradas ?? []) {
      // `family` es 'IPv4' en Node moderno y 4 en versiones viejas.
      if (e.internal || (e.family !== 'IPv4' && e.family !== 4)) continue;
      salida.push({ nombre, address: e.address });
    }
  }
  const prioridad = (a) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : 2);
  return salida.sort((a, b) => prioridad(a.address) - prioridad(b.address));
}

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

  // Qué dispositivo lleva los sensores, y por dónde se alcanza a este equipo.
  // Cada página lo consulta al cargar.
  //
  // Sólo van las direcciones: el protocolo y el puerto los sabe la página, así
  // que la URL se arma del lado del cliente y sirve igual en desarrollo, sobre
  // el servidor de Vite, que en producción.
  function handleRequest(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/link-config') return false;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ sensorSource, addresses: direccionesLan().map((d) => d.address) }));
    return true;
  }

  return { wss, handleUpgrade, handleRequest };
}
