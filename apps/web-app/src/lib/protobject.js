/**
 * Protobject message routing for both viewer and telescope sides.
 * Consolidates: util/protobject.js, telescope/utils/protobject.js, eventManager.js
 *
 * The msg/handler dispatch and outgoing throttling live in
 * @ventanaceleste/core's transport-agnostic messageBus — this file just
 * plugs in the Protobject/WebRTC transport and registers this app's
 * message handlers. Swapping transports later (e.g. WebSocket for
 * dual-telescope) only touches the `createProtobjectTransport()` call below.
 */
import { createMessageBus, createProtobjectTransport } from '@ventanaceleste/core';
import { createPeerMonitor } from './connection.js';
import {
  updateStellariumFov, updateStellariumView, updateStellariumBlur,
  stellariumOption, enableSimpleModeSettings, enableAdvancedModeSettings,
  getSynchronizeData, getFov, toggleEyepieceOverlay,
  applyLocation, applyPollution, setEngineSpeed, updateDate,
  setDatetimeInterval, clearDatetimeInterval, noLenBlurry, yesLenNormal,
} from './stellarium.js';
import { setEngineUTC, setCurrentTZ, setPollution, setObserverLat, setObserverLon } from './stores.js';
import { getMagFromLonLat } from './light-pollution.js';

const bus = createMessageBus(createProtobjectTransport());

// Protobject.Core.onConnected fires once as soon as this page's own socket
// joins the Protobject relay — before any remote peer has paired — and then
// fires again for each real peer connection. Wrap onConnect handlers with
// this so "connected" means "a peer is actually here", not "we're online".
//
// Verified on-device: on telescope.html the second call fires reliably when
// the peer link to index.html comes up. On index.html the second call has
// NOT been observed to fire at all — the library appears asymmetric between
// "outgoing" and "incoming" sides. Because of that, the viewer does NOT rely
// on onConnect to detect the telescope; see the `telescopeConnected` message
// handshake below instead. Kept here (both sides) purely for diagnostics.
function skipFirstCall(fn) {
  let calls = 0;
  return (...args) => {
    calls += 1;
    if (calls === 1) {
      console.log('[Protobject] ignoring initial self-connect event');
      return;
    }
    fn(...args);
  };
}

// Kept as `eventManager.sendThrottled(payload, target, interval)` — the
// shape every call site in this app already uses.
export const eventManager = {
  sendThrottled(payload, target, interval) {
    bus.sendThrottled(payload.msg, payload.values, target, interval);
  },
};

// ── Viewer-side message handler ────────────────────────────

let seeingOptionHandler = null;
export function setSeeingOptionHandler(fn) { seeingOptionHandler = fn; }

// Reports ongoing link state to the viewer UI: { alive, everAlive }. Not a
// fire-once handler, so the QR can come back when the phone goes away.
let connectionStatusHandler = null;
export function setConnectionStatusHandler(fn) {
  connectionStatusHandler = fn;
}

let viewerPeer = null;

export function initViewerProtobject() {
  bus.on('toggleEyepiece', toggleEyepieceOverlay);
  bus.on('updateFov', updateStellariumFov);
  bus.on('updateBlur', updateStellariumBlur);
  bus.on('updateView', updateStellariumView);
  // Explicit handshake from the telescope (sent as soon as *its* connection
  // is confirmed — see initTelescopeProtobject below) — this is what actually
  // hides the QR. Not onConnect: see the note on skipFirstCall above.
  bus.on('telescopeConnected', () => {
    console.log('[Protobject] viewer: received telescopeConnected handshake');
    viewerPeer?.markSeen();
  });
  // Any heartbeat also proves the phone is alive — this is what brings the QR
  // back when it stops arriving, and what recovers if the phone reconnects
  // without a fresh handshake (e.g. it was briefly backgrounded).
  bus.on('telescopeHeartbeat', () => viewerPeer?.markSeen());
  bus.on('applyLocation', applyLocation);
  bus.on('setSpeed', setEngineSpeed);
  bus.on('updateDate', updateDate);
  bus.on('setDatetimeInterval', () => setDatetimeInterval());
  bus.on('clearDatetimeInterval', () => clearDatetimeInterval());
  bus.on('updatePollution', applyPollution);
  bus.on('stellariumOption', stellariumOption);
  bus.on('noLenBlurry', noLenBlurry);
  bus.on('yesLenNormal', yesLenNormal);
  bus.on('seeingOption', (v) => seeingOptionHandler?.(v));
  bus.on('simpleSettings', () => enableSimpleModeSettings());
  bus.on('advancedSettings', () => enableAdvancedModeSettings());
  bus.on('requestSynchronizeData', getSynchronizeData);
  bus.on('requestSynchronizeSimpleZoom', getFov);

  bus.start({
    onConnect: skipFirstCall(() => {
      console.log('[Protobject] viewer: onConnect fired a second time (unexpected but harmless)');
    }),
  });

  // Started immediately rather than on first pairing: before any phone arrives
  // the monitor simply reports "not alive", which is exactly the initial UI state
  // (QR showing). It also means a phone connecting to an already-running viewer is
  // picked up by its heartbeat alone.
  viewerPeer = createPeerMonitor({
    sendHeartbeat: () => bus.send('viewerHeartbeat', {}, 'telescope.html'),
    onChange: ({ alive, everAlive }) => {
      console.log(`[Protobject] viewer: telescope ${alive ? 'alive' : 'lost'}`);
      connectionStatusHandler?.({ alive, everAlive });
    },
  });
  viewerPeer.start();
}

// ── Telescope-side message handler ─────────────────────────
// Uses callback setters so Svelte components can register their handlers.

export function onTelescopeMessage(msg, handler) {
  bus.on(msg, handler);
}

let telescopeConnectionHandler = null;
export function setTelescopeConnectionHandler(fn) {
  telescopeConnectionHandler = fn;
}

// Reports ongoing link state to the telescope UI: { alive, everAlive }.
let telescopeStatusHandler = null;
export function setTelescopeStatusHandler(fn) {
  telescopeStatusHandler = fn;
}

let telescopePeer = null;

// ── Seeing value sender (used by telescope components) ─────

export function sendSeeingValue({ target, value }) {
  eventManager.sendThrottled(
    { msg: 'seeingOption', values: { target, value } },
    'index.html',
    100,
  );
}

function getUtcOffset(lat, lon) {
  const tz = tzlookup(lat, lon);
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(now);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const match = offsetPart.value.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
export function initTelescopeProtobject() {
  // Built-in handler for time sync
  onTelescopeMessage('syncTime', (values) => {
    setEngineUTC(values.engineUTC);
  });

  // Handle coordinates from Mapa.html / Pelota.html
  onTelescopeMessage('sendCoordinates', async (values) => {
    const { lat, lon } = values;
    setObserverLat(lat);
    setObserverLon(lon);
    const pollution = await getMagFromLonLat({ lat, lon });
    const tz = getUtcOffset(lat, lon);
    setCurrentTZ(tz);
    setPollution(pollution);

    const data = { cityName: 'Custom', lon, lat, elev: 0, mag: pollution };
    applyLocation(data);
    bus.send('applyLocation', data, 'index.html');
  });

  // The viewer's heartbeat is how the phone notices the viewer went away — e.g.
  // the main page was refreshed or closed. There is no disconnect event to rely on.
  onTelescopeMessage('viewerHeartbeat', () => telescopePeer?.markSeen());

  telescopePeer = createPeerMonitor({
    sendHeartbeat: () => bus.send('telescopeHeartbeat', {}, 'index.html'),
    onChange: ({ alive, everAlive }) => {
      console.log(`[Protobject] telescope: viewer ${alive ? 'alive' : 'lost'}`);
      telescopeStatusHandler?.({ alive, everAlive });
    },
  });

  bus.start({
    onConnect: skipFirstCall(() => {
      console.log('[Protobject] telescope: connected to viewer');
      bus.send('telescopeConnected', {}, 'index.html');
      telescopePeer.markSeen();
      telescopePeer.start();
      telescopeConnectionHandler?.();
      telescopeConnectionHandler = null;
    }),
  });
}
