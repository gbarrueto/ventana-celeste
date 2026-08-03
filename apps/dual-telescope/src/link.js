// Único punto donde se elige el transporte. Cambiar de WebSocket a otra cosa
// es cambiar esta línea, no los handlers.
import { createMessageBus, createWebSocketTransport } from '@ventanaceleste/core';

const RELAY_PORT = 8080;

export function connect({ role, onStatus }) {
  const url = `ws://${location.hostname}:${RELAY_PORT}`;
  const bus = createMessageBus(createWebSocketTransport({ url, role, onStatus }));
  return bus;
}
