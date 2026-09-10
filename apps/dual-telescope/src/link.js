import { createMessageBus, createWebSocketTransport } from '@ventanaceleste/core';

// Ruta del socket de relay sobre el mismo host y protocolo.
const RELAY_PATH = '/relay';
const socketUrl = () =>
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${RELAY_PATH}`;

export function connect({ role, onStatus }) {
  return createMessageBus(createWebSocketTransport({ url: socketUrl(), role, onStatus }));
}

// Obtiene la configuración de enlace y fuente de sensores desde el servidor.
export async function fetchLinkConfig() {
  try {
    const res = await fetch('/link-config');
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { sensorSource: 'ocular', addresses: [] };
  }
}
