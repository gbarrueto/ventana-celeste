/**
 * Protobject message routing for both viewer and telescope sides.
 * Consolidates: util/protobject.js, telescope/utils/protobject.js, eventManager.js
 */
import {
  updateStellariumFov, updateStellariumView, updateStellariumBlur,
  stellariumOption, enableSimpleModeSettings, enableAdvancedModeSettings,
  getSynchronizeData, getFov, toggleEyepieceOverlay,
  applyLocation, applyPollution, setEngineSpeed, updateDate,
  setDatetimeInterval, clearDatetimeInterval, noLenBlurry, yesLenNormal,
} from './stellarium.js';
import { setEngineUTC, setCurrentTZ, setPollution, setObserverLat, setObserverLon } from './stores.js';
import { getMagFromLonLat } from './light-pollution.js';

// ── Event manager (throttle/debounce for outgoing messages) ──

class EventManager {
  constructor() {
    this.handlers = new Map();
    this.timers = new Map();
    this.lastCalled = new Map();
    this.lastSent = new Map();
  }

  on(selector, event, handler, options = {}) {
    const key = `${event}:${selector}`;
    const delegatedHandler = (e) => {
      if (e.target.matches(selector)) {
        if (options.debounce > 0) {
          this._debounce(key, () => handler(e), options.debounce);
        } else if (options.throttle > 0) {
          this._throttle(key, () => handler(e), options.throttle);
        } else {
          handler(e);
        }
      }
    };
    if (!this.handlers.has(key)) {
      document.addEventListener(event, delegatedHandler);
      this.handlers.set(key, delegatedHandler);
    }
  }

  off(selector, event) {
    const key = `${event}:${selector}`;
    const handler = this.handlers.get(key);
    if (handler) {
      document.removeEventListener(event, handler);
      this.handlers.delete(key);
    }
    const timeout = this.timers.get(key);
    if (timeout) { clearTimeout(timeout); this.timers.delete(key); }
    this.lastCalled.delete(key);
  }

  cleanup() {
    this.handlers.forEach((handler, key) => {
      document.removeEventListener(key.split(':')[0], handler);
    });
    this.handlers.clear();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.lastCalled.clear();
    this.lastSent.clear();
  }

  sendThrottled(payload, target, interval) {
    const key = `proto:${payload.msg}:${target}`;
    const now = Date.now();
    if (now - (this.lastSent.get(key) || 0) >= interval) {
      Protobject.Core.send(payload).to(target);
      this.lastSent.set(key, now);
    }
  }

  _debounce(key, fn, delay) {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(key, setTimeout(() => { this.timers.delete(key); fn(); }, delay));
  }

  _throttle(key, fn, interval) {
    const now = Date.now();
    if (now - (this.lastCalled.get(key) || 0) >= interval) {
      fn();
      this.lastCalled.set(key, now);
    }
  }
}

export const eventManager = new EventManager();

// ── Viewer-side message handler ────────────────────────────

let seeingOptionHandler = null;
export function setSeeingOptionHandler(fn) { seeingOptionHandler = fn; }

let connectionHandler = null;
let connectionHandlerReadyAt = 0;
export function setConnectionHandler(fn) {
  connectionHandler = fn;
  connectionHandlerReadyAt = Date.now() + 2000; // ignore messages in the first 2s after registration
}

export function initViewerProtobject() {
  const functionMap = {
    toggleEyepiece: toggleEyepieceOverlay,
    updateFov: updateStellariumFov,
    updateBlur: updateStellariumBlur,
    updateView: (v) => {
      if (connectionHandler && Date.now() >= connectionHandlerReadyAt
          && v && typeof v.h === 'number' && typeof v.v === 'number') {
        console.log('[QR] Hiding QR — first real updateView received', v);
        connectionHandler();
        connectionHandler = null;
      }
      updateStellariumView(v);
    },
    applyLocation,
    setSpeed: setEngineSpeed,
    updateDate,
    setDatetimeInterval: () => setDatetimeInterval(),
    clearDatetimeInterval: () => clearDatetimeInterval(),
    updatePollution: applyPollution,
    stellariumOption,
    noLenBlurry,
    yesLenNormal,
    seeingOption: (v) => seeingOptionHandler?.(v),
    simpleSettings: () => enableSimpleModeSettings(),
    advancedSettings: () => enableAdvancedModeSettings(),
    requestSynchronizeData: getSynchronizeData,
    requestSynchronizeSimpleZoom: getFov,
  };

  Protobject.Core.onReceived((data) => {
    const { msg, values } = data;
    const fn = functionMap[msg];
    if (typeof fn === 'function') {
      fn(values);
    } else {
      console.warn(`Unknown viewer message: ${msg}`);
    }
  });

  Protobject.Core.onConnected(() => {
    console.log('New connection to viewer');
  });
}

// ── Telescope-side message handler ─────────────────────────
// Uses callback setters so Svelte components can register their handlers.

const telescopeHandlers = {};

export function onTelescopeMessage(msg, handler) {
  telescopeHandlers[msg] = handler;
}

// ── Seeing value sender (used by telescope components) ─────

export function sendSeeingValue({ target, value }) {
  try {
    eventManager.sendThrottled(
      { msg: 'seeingOption', values: { target, value } },
      'index.html',
      100,
    );
  } catch {
    Protobject.Core.send({
      msg: 'seeingOption',
      values: { target, value },
    }).to('index.html');
  }
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
    Protobject.Core.send({ msg: 'applyLocation', values: data }).to('index.html');
  });

  Protobject.Core.onReceived((data) => {
    const { msg, values } = data;
    const fn = telescopeHandlers[msg];
    if (typeof fn === 'function') {
      fn(values);
    } else {
      console.warn(`Unknown telescope message: ${msg}`);
    }
  });

  Protobject.Core.onConnected(() => {});
}
