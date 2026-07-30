/**
 * Peer liveness for the Protobject link.
 *
 * `Protobject.Core` exposes only `onConnected` and `onReceived` — there is no
 * disconnect event (verified against the shipped `p.js`). So liveness is inferred
 * from a heartbeat: each side emits one periodically, and treats the peer as lost
 * when none has arrived within `timeoutMs`.
 *
 * A timeout is also strictly more reliable than a close event would be. It
 * catches a dropped network, a frozen page and a backgrounded tab — none of which
 * necessarily produce a clean close.
 *
 * Kept at 1 Hz with a tiny payload on purpose: this shares a WebRTC data channel
 * with the ~50 Hz orientation stream, and flooding that channel has already been
 * shown to make orientation feel laggy.
 *
 * App-scoped for now. If `dual-telescope` needs the same thing over WebSocket,
 * this is the piece to promote into `core`'s `sync/`.
 */

export const HEARTBEAT_MS = 1000;
// 2.5 beats of tolerance: survives one dropped heartbeat plus jitter, without
// waiting a full extra second like a 3 s timeout did.
export const PEER_TIMEOUT_MS = 2500;
// Checked independently of the heartbeat rate — this is pure local bookkeeping,
// no traffic, so a tight interval only costs the comparison itself.
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
    // `everAlive` lets the UI distinguish "never connected yet" from "was
    // connected and dropped", which need different wording.
    onChange({ alive: next, everAlive });
  }

  return {
    // Call whenever a message proves the peer is present.
    markSeen() {
      lastSeen = Date.now();
      setAlive(true);
    },

    start() {
      if (beatTimer) return;
      lastSeen = Date.now();
      beatTimer = setInterval(() => {
        // The peer may legitimately not be there yet; a failed send is not an error.
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
