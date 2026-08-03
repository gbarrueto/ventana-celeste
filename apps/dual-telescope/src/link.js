// Único punto donde se elige el transporte. Cambiar de WebSocket a otra cosa es
// cambiar esta línea, no los handlers.
import { createMessageBus, createWebSocketTransport } from '@ventanaceleste/core';

// Mismo origen que la página, siempre: en producción el relay sirve los
// estáticos, y en desarrollo va montado sobre Vite. Eso evita el puerto
// hardcodeado y, sobre todo, hace que con HTTPS el socket sea wss:// solo — una
// página https no puede abrir ws:// en claro.
const RELAY_PATH = '/relay';
const socketUrl = () =>
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${RELAY_PATH}`;

export function connect({ role, onStatus }) {
  return createMessageBus(createWebSocketTransport({ url: socketUrl(), role, onStatus }));
}

// Qué rol lleva los sensores. Lo decide el servidor (lo fija el script de
// arranque), no la página, así que cambiar la fuente no requiere editar código.
export async function fetchLinkConfig() {
  try {
    const res = await fetch('/link-config');
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { sensorSource: 'ocular' };
  }
}
