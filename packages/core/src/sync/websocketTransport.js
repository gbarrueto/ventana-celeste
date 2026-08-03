// WebSocket transport for `createMessageBus`.
//
// Implements the same three-method contract as `createProtobjectTransport`, so
// the bus, the `{msg, values}` shape and every handler stay untouched — swapping
// transports is a constructor argument, not a rewrite.
//
// Two differences from the Protobject transport are worth knowing, because they
// simplify things here:
//
//  1. WebSocket has real `close`/`error` events. Protobject exposes no disconnect
//     signal at all, which is why `web-app` had to infer liveness from a
//     heartbeat. Nothing like that is needed here.
//  2. `onConnect` fires on every (re)connection, and it is genuinely a peer
//     event. Protobject's fires once for the page's own relay join, which is why
//     the app had to discard the first call.

const DEFAULT_RECONNECT_MS = 2000;

export function createWebSocketTransport({
  url,
  // Identifies this client to the relay so messages can be addressed to a role
  // ('ocular' / 'guide') instead of a connection id.
  role,
  reconnectMs = DEFAULT_RECONNECT_MS,
  // Lifecycle for the UI: 'connecting' | 'open' | 'closed' | 'error'.
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
        return; // un frame ilegible no debe tirar abajo el stream
      }
      if (payload && typeof payload.msg === 'string') {
        receiveHandler?.({ msg: payload.msg, values: payload.values });
      }
    });

    // Reconnection lives here rather than in the app: the Guide is expected to
    // start before the Ocular and simply keep retrying until the server exists.
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
      // Dropped rather than queued on purpose: this carries orientation at ~50 Hz,
      // and delivering a stale pose late is worse than skipping it.
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
