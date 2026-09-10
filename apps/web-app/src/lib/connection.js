/**
 * Monitor de disponibilidad de peer para Protobject vía heartbeat.
 */

export const HEARTBEAT_MS = 1000;
export const PEER_TIMEOUT_MS = 2500;
export const CHECK_MS = 250;

export function createPeerMonitor({
  sendHeartbeat,
  onChange,
  heartbeatMs = HEARTBEAT_MS,
  timeoutMs = PEER_TIMEOUT_MS,
}) {
  let lastSeen = 0;
  let alive = false;
  let everAlive = false;
  let beatTimer = null;
  let checkTimer = null;

  function setAlive(next) {
    if (next === alive) return;
    alive = next;
    if (next) everAlive = true;
    onChange({ alive: next, everAlive });
  }

  return {
    markSeen() {
      lastSeen = Date.now();
      setAlive(true);
    },

    start() {
      if (beatTimer) return;
      lastSeen = Date.now();
      beatTimer = setInterval(() => {
        try { sendHeartbeat(); } catch { /* no-op */ }
      }, heartbeatMs);
      checkTimer = setInterval(() => {
        if (Date.now() - lastSeen > timeoutMs) setAlive(false);
      }, CHECK_MS);
    },

    stop() {
      clearInterval(beatTimer);
      clearInterval(checkTimer);
      beatTimer = null;
      checkTimer = null;
    },

    get alive() {
      return alive;
    },
  };
}
