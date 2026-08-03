// Único punto donde se elige el transporte. Cambiar de WebSocket a otra cosa
// es cambiar esta línea, no los handlers.
import { createMessageBus, createWebSocketTransport } from '@ventanaceleste/core';

const RELAY_PORT = 8080;

export function connect({ role, onStatus }) {
  const url = `ws://${location.hostname}:${RELAY_PORT}`;
  const bus = createMessageBus(createWebSocketTransport({ url, role, onStatus }));
  return bus;
}

// Qué rol lleva los sensores. Lo decide el servidor (lo fija el script de
// arranque), no la página, así que cambiar la fuente no requiere editar código.
export async function fetchLinkConfig() {
  try {
    const res = await fetch(`${location.protocol}//${location.hostname}:${RELAY_PORT}/link-config`);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    // Si el relay todavía no está, se asume el reparto por defecto y se reintenta
    // cuando la conexión se establezca.
    return { sensorSource: 'ocular' };
  }
}
