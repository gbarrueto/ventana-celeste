// Transporte WebSocket para `createMessageBus`.

const DEFAULT_RECONNECT_MS = 2000;

export function createWebSocketTransport({
  url,
  // Identificador de rol ('ocular' | 'guide') para enrutamiento en el relay.
  role,
  reconnectMs = DEFAULT_RECONNECT_MS,
  // Callback de estado: 'connecting' | 'open' | 'closed' | 'error'.
  onStatus = () => {},
} = {}) {
  if (!url) throw new Error('createWebSocketTransport: falta `url`');

  let socket = null;
  let receiveHandler = null;
  let connectHandler = null;
  let retryTimer = null;
  let disposed = false;

  function open() {
    if (disposed) return;
    onStatus('connecting');
    socket = new WebSocket(role ? `${url}?role=${encodeURIComponent(role)}` : url);

    socket.addEventListener('open', () => {
      onStatus('open');
      connectHandler?.();
    });

    socket.addEventListener('message', (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload && typeof payload.msg === 'string') {
        receiveHandler?.({ msg: payload.msg, values: payload.values });
      }
    });

    socket.addEventListener('close', () => {
      onStatus('closed');
      if (disposed) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(open, reconnectMs);
    });

    socket.addEventListener('error', () => onStatus('error'));
  }

  open();

  return {
    send(payload, target) {
      if (socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ ...payload, target }));
    },
    onReceive(handler) { receiveHandler = handler; },
    onConnect(handler) { connectHandler = handler; },
    close() {
      disposed = true;
      clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
