// Transport-agnostic {msg, values} message bus.
//
// The message SHAPE stays the same regardless of transport — only the
// transport adapter changes (Protobject/WebRTC today, WebSocket for
// dual-telescope later, or none at all for a single-device app like kiosk).
//
// A transport adapter must implement:
//   send(payload, target)   -- payload is { msg, values }
//   onReceive(handler)      -- handler receives { msg, values }
//   onConnect(handler)      -- optional; called when a peer connects

export function createMessageBus(transport) {
  const handlers = new Map();
  const lastSent = new Map();

  function on(msg, handler) {
    handlers.set(msg, handler);
  }

  function send(msg, values, target) {
    transport.send({ msg, values }, target);
  }

  // Drops sends that happen more often than `interval` ms for the same
  // (msg, target) pair — used for high-frequency updates like orientation.
  function sendThrottled(msg, values, target, interval) {
    const key = `${msg}:${target}`;
    const now = Date.now();
    if (now - (lastSent.get(key) || 0) >= interval) {
      send(msg, values, target);
      lastSent.set(key, now);
    }
  }

  function start({ onConnect } = {}) {
    transport.onReceive(({ msg, values }) => {
      const handler = handlers.get(msg);
      if (handler) {
        handler(values);
      } else {
        console.warn(`[messageBus] unhandled message: ${msg}`);
      }
    });
    if (onConnect) transport.onConnect?.(onConnect);
  }

  return { on, send, sendThrottled, start };
}

// ── Built-in transport adapters ─────────────────────────────

// Wraps the global Protobject WebRTC framework (loaded as a page-level
// script, not an npm dependency — see each app's index.html).
export function createProtobjectTransport() {
  return {
    send(payload, target) {
      Protobject.Core.send(payload).to(target);
    },
    onReceive(handler) {
      Protobject.Core.onReceived((data) => handler(data));
    },
    onConnect(handler) {
      Protobject.Core.onConnected(handler);
    },
  };
}

// No cross-device transport: for single-page apps (e.g. kiosk) that never
// need to sync with another device. send() is a no-op; nothing is received.
export function createNullTransport() {
  return {
    send() {},
    onReceive() {},
    onConnect() {},
  };
}
