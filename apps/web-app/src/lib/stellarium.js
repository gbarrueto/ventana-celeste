/**
 * Stellarium engine: initialization, view control, overlays, location, time.
 * Consolidates: initStel.js, stel.js, overlay.js, location.js, time.js, getObject.js
 */
import {
  engine, setEngine, setBortle, setEyepieceFl, setSqmReading, setCitySqmReading,
  FOCAL_LENGTH, eyepieceFl, sqmReading, citySqmReading,
  setObserverLat, setObserverLon,
  DIAMETER, TELESCOPE_TYPE, COATING, CLEANLINESS, PUPIL, EXPERIENCE,
  SEEING_DISK_DIAMETER, ZENITH_DISTANCE, STAR_COLOR_INDEX, EXTINCTION,
} from './stores.js';
import {
  computeDefaultObservationTime,
  setEngineTime,
  setEngineSpeed as coreSetEngineSpeed,
  calculateLimitMag,
  magToBortle,
  initializeStellariumEngine,
  removeStellariumEngine,
} from '@ventanaceleste/core';
// El motor vive una sola vez, en core/assets. `?url` hace que Vite lo emita
// como asset y devuelva la URL final; ya no hay copia en public/ ni <script>
// en el HTML (ensureStellariumScript inyecta el tag cuando hace falta).
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';

function currentLimitMag() {
  return calculateLimitMag({
    aperture: DIAMETER,
    magnification: FOCAL_LENGTH / eyepieceFl,
    telescopeType: TELESCOPE_TYPE,
    coatingReflectivity: COATING,
    cleanliness: CLEANLINESS,
    sqmReading,
    starColorIndex: STAR_COLOR_INDEX,
    zenithDistanceDeg: ZENITH_DISTANCE,
    extinction: EXTINCTION,
    seeingDiskDiameter: SEEING_DISK_DIAMETER,
    observerExperience: EXPERIENCE,
    observerPupil: PUPIL,
  });
}

// Paranal is UTC-3 (Chile continental time, no DST).
const PARANAL_UTC_OFFSET_HOURS = -3;

// ── Engine initialization ──────────────────────────────────

export function initializeStelEngine(isTelescope = false) {
  return initializeStellariumEngine({
    canvas: document.getElementById('stel-canvas'),
    wasmFile: engineWasmUrl,
    scriptUrl: engineScriptUrl,
    smalldataBaseUrl: 'https://smalldata.ventanaceleste.com/',
    bigdataBaseUrl: 'https://bigdata.ventanaceleste.com/',
    extended: !isTelescope,
    time: { offsetHours: PARANAL_UTC_OFFSET_HOURS },
    strict: false, // a failed catalog fetch shouldn't block startup
    async onReady(stel) {
      setEngine(stel);
      const { core } = stel;
      core.planets.hints_visible = false;
      core.dsos.hints_visible = false;
      core.minor_planets.hints_visible = false;
      core.dss.hints_visible = false;
      core.stars.hints_visible = false;
      core.comets.hints_visible = false;
      core.cardinals.visible = false;
      core.exposure_scale = 2;

      applyLocation({ cityName: 'Paranal', lat: -24.6272, lon: -70.4042, elev: 2635, mag: 21.8 });
    },
  });
}

export function removeStelEngine() {
  removeStellariumEngine(engine, 'stel-canvas');
  setEngine(null);
}

// ── View & FOV control ─────────────────────────────────────

let warnedInvalidView = false;

export function updateStellariumView({ h, v }) {
  if (!engine?.core?.observer) return;
  // A malformed payload used to write NaN into observer.yaw/pitch, which looks
  // exactly like "no messages are arriving" — the view simply never moves. Warn
  // once (this runs per frame) instead of corrupting engine state silently.
  if (!Number.isFinite(h) || !Number.isFinite(v)) {
    if (!warnedInvalidView) {
      warnedInvalidView = true;
      console.warn('[stellarium] updateView ignorado: se esperaba { h, v } numérico, llegó', { h, v });
    }
    return;
  }
  engine.core.observer.yaw = -h;
  engine.core.observer.pitch = v;
}

export function updateStellariumFov({ fov }) {
  if (!engine?.core) return;
  engine.core.fov = fov;
  const degFov = (fov * 180) / Math.PI;
  setEyepieceFl(FOCAL_LENGTH * degFov / 100);
  engine.core.display_limit_mag = currentLimitMag();
}

export function stellariumOption({ path, attr }) {
  const obj = path.split('.').reduce((o, k) => o && o[k], engine.core);
  if (!obj) return;
  obj[attr] = !obj[attr];

  if (path === 'atmosphere' && attr === 'visible') {
    if (!obj[attr]) {
      applyPollution({ mag: 22 });
    } else {
      applyPollution({ mag: citySqmReading });
    }
  }
}

// ── Sync data ──────────────────────────────────────────────

export function getSynchronizeData() {
  if (!engine?.core?.observer) return;
  Protobject.Core.send({
    msg: 'setSynchronizedData',
    values: {
      data: {
        time: engine.core.observer.utc,
        location: {
          cityName: 'Custom',
          lat: engine.core.observer.latitude,
          lon: engine.core.observer.longitude,
          elev: engine.core.observer.elevation,
          mag: null,
        },
        angle: {
          yaw: engine.core.observer.yaw,
          pitch: engine.core.observer.pitch,
        },
      },
    },
  }).to('telescope.html');
}

export function getFov() {
  if (!engine?.core) return;
  Protobject.Core.send({
    msg: 'setSynchronizedSimpleZoom',
    values: { data: { fov: engine.core.fov } },
  }).to('telescope.html');
}

// ── Mode settings ──────────────────────────────────────────

export function enableSimpleModeSettings() {
  if (!engine?.core) return;
  engine.core.planets.hints_visible = true;
  engine.core.minor_planets.hints_visible = true;
  engine.core.stars.hints_visible = true;
  engine.core.cardinals.visible = true;
  setEyepieceOverlayOpacity(0);
  setSeeingOpacity(0);
  updateStellariumBlur({ blur: 0 });
  enableSeeingEffect(false);
}

export function enableAdvancedModeSettings() {
  if (!engine?.core) return;
  engine.core.planets.hints_visible = false;
  engine.core.minor_planets.hints_visible = false;
  engine.core.stars.hints_visible = false;
  engine.core.cardinals.visible = false;
  setEyepieceOverlayOpacity(1);
  setSeeingOpacity(1);
  enableSeeingEffect(true);
}

// ── Overlays ───────────────────────────────────────────────

export function updateStellariumBlur({ blur }) {
  const canvas = document.getElementById('stel-canvas');
  if (canvas) canvas.style.filter = `blur(${blur}px)`;
}

export function toggleEyepieceOverlay({ signal }) {
  const overlay = document.getElementById('finder-overlay');
  if (overlay) overlay.style.opacity = signal ? 0 : 1;
}

export function setEyepieceOverlayOpacity(opacity) {
  const overlay = document.getElementById('eyepiece-overlay');
  if (overlay) overlay.style.opacity = opacity;
}

export function setSeeingOpacity(opacity) {
  const el = document.getElementById('effect-canvas');
  if (el) el.style.opacity = opacity;
}

function enableSeeingEffect(enable) {
  const el = document.getElementById('effect-canvas');
  if (el) el.style.visibility = enable ? 'visible' : 'hidden';
}

// ── Location & Pollution ───────────────────────────────────

export function applyLocation({ lat = 0, lon = 0, elev = 0, mag = null }) {
  setObserverLat(lat);
  setObserverLon(lon);
  if (!engine) return;
  engine.core.observer.latitude = lat * (Math.PI / 180);
  engine.core.observer.longitude = lon * (Math.PI / 180);
  engine.core.observer.elevation = elev;
  setCitySqmReading(mag);
  applyPollution({ mag });
}

export function applyPollution({ mag = 20 }) {
  if (!engine?.core) return;
  setSqmReading(mag);
  const b = magToBortle(mag);
  setBortle(b);
  engine.core.bortle_index = b;
  engine.core.milkyway.visible = b < 6;
  engine.core.display_limit_mag = currentLimitMag();
  engine.core.star_relative_scale = 0.6;
}

// ── Time ───────────────────────────────────────────────────
// Conversions and engine-clock mutation live in @ventanaceleste/core's
// time/ module; these just adapt the Protobject message shape to it.

export function setEngineSpeed({ speed: multiplier }) {
  coreSetEngineSpeed(engine, multiplier);
}

export function updateDate({ date }) {
  setEngineTime(engine, date);
}

let datetimeInterval = null;

export function setDatetimeInterval() {
  datetimeInterval = setInterval(() => {
    Protobject.Core.send({
      msg: 'syncTime',
      values: { engineUTC: engine.core.observer.utc },
    }).to('telescope.html');
  }, 300);
}

export function clearDatetimeInterval() {
  clearInterval(datetimeInterval);
}

// ── Object queries ─────────────────────────────────────────

function radToDeg(val) {
  return val * (180 / Math.PI);
}

export function getObjAltAz(obj) {
  if (!engine) return null;
  const pvo = obj.getInfo('pvo', engine.observer);
  const altaz = engine.convertFrame(engine.observer, 'ICRF', 'OBSERVED', pvo[0]);
  const az = radToDeg(engine.anp(engine.c2s(altaz)[0]));
  let alt = radToDeg(engine.anp(engine.c2s(altaz)[1]));
  if (alt > 90) alt -= 360;
  return { alt, az };
}

export function isNightime() {
  if (!engine) return true;
  const sun = engine.getObj('NAME Sun');
  const sunPos = getObjAltAz(sun);
  return sunPos ? sunPos.alt <= -3 : true;
}

// ── No-lens blur (viewer side) ─────────────────────────────

export function noLenBlurry() {
  const el = document.getElementById('nolens');
  if (el) el.style.display = 'block';
}

export function yesLenNormal() {
  const el = document.getElementById('nolens');
  if (el) el.style.display = 'none';
}
