/**
 * Enrutamiento de mensajes Protobject para visor (Viewer) y telescopio (Telescope).
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

// Filtra el evento de conexión inicial del relay para disparar solo ante conexiones remotas.
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

export const eventManager = {
  sendThrottled(payload, target, interval) {
    bus.sendThrottled(payload.msg, payload.values, target, interval);
  },
};

// ── Viewer-side message handler ────────────────────────────

let seeingOptionHandler = null;
export function setSeeingOptionHandler(fn) { seeingOptionHandler = fn; }

let connectionStatusHandler = null;
export function setConnectionStatusHandler(fn) {
  connectionStatusHandler = fn;
}

let viewerPeer = null;

export function initViewerProtobject() {
  bus.on('toggleEyepiece', toggleEyepieceOverlay);
  bus.on('updateFov', updateStellariumFov);
  bus.on('updateBlur', updateStellariumBlur);
  bus.on('updateView', (v) => {
    viewerPeer?.markSeen();
    updateStellariumView(v);
  });
  bus.on('telescopeConnected', () => {
    console.log('[Protobject] viewer: received telescopeConnected handshake');
    viewerPeer?.markSeen();
  });
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
