/**
 * Stellarium engine: initialization, view control, overlays, location, time.
 * Consolidates: initStel.js, stel.js, overlay.js, location.js, time.js, getObject.js
 */
import { calculateLimitMag, magToBortle } from './fov.js';
import {
  engine, setEngine, setBortle, setEyepieceFl, setSqmReading, setCitySqmReading,
  FOCAL_LENGTH, eyepieceFl, sqmReading, citySqmReading,
  setObserverLat, setObserverLon,
} from './stores.js';

// ── Engine initialization ──────────────────────────────────

export function initializeStelEngine(isTelescope = false) {
  return new Promise((resolve) => {
    StelWebEngine({
      wasmFile: 'stellarium-web-engine.wasm',
      canvas: document.getElementById('stel-canvas'),
      async onReady(stel) {
        setEngine(stel);
        const core = stel.core;

        core.observer.utc = toJulianDateIso(new Date().toISOString());

        const defaultLocation = {
          cityName: 'Santiago', lat: -33.4489, lon: -70.6693, elev: 570, mag: 17.13,
        };

        const baseUrl = 'https://smalldata.ventanaceleste.com/';
        const baseUrlBig = 'https://bigdata.ventanaceleste.com/';
        const promises = [];

        // Basic data sources (both pages)
        promises.push(
          core.stars.addDataSource({ url: baseUrl + 'swe-data-packs/minimal/2020-09-01/minimal_2020-09-01_186e7ee2/stars', key: 'minimal' }),
          core.stars.addDataSource({ url: baseUrl + 'swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/stars', key: 'base' }),
          core.landscapes.addDataSource({ url: baseUrl + 'landscapes/v1/guereins', key: 'guereins' }),
        );

        ['moon', 'sun', 'jupiter', 'mercury', 'venus', 'mars', 'saturn', 'uranus', 'neptune', 'io', 'europa', 'ganymede', 'callisto', 'moon-normal'].forEach((p) => {
          promises.push(core.planets.addDataSource({ url: baseUrl + `surveys/sso/${p}/v1`, key: p }));
        });

        // Extended data only for the viewer
        if (!isTelescope) {
          promises.push(
            core.stars.addDataSource({ url: baseUrl + 'swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/stars', key: 'extended' }),
            core.dss.addDataSource({ url: baseUrlBig + 'surveys/gaia/v1', key: 'gaia' }),
            core.skycultures.addDataSource({ url: baseUrl + 'skycultures/v3/western', key: 'western' }),
            core.dsos.addDataSource({ url: baseUrl + 'swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso' }),
            core.dsos.addDataSource({ url: baseUrl + 'swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/dso' }),
            core.milkyway.addDataSource({ url: baseUrl + 'surveys/milkyway/v1' }),
            core.dss.addDataSource({ url: baseUrlBig + 'surveys/dss/v1' }),
            core.minor_planets.addDataSource({ url: baseUrl + 'mpc/v1/mpcorb.dat', key: 'mpc_asteroids' }),
            core.comets.addDataSource({ url: baseUrl + 'mpc/v1/CometEls.txt?v=2019-12-17', key: 'mpc_comets' }),
          );
        }

        try {
          await Promise.all(promises);
          core.planets.hints_visible = false;
          core.dsos.hints_visible = false;
          core.minor_planets.hints_visible = false;
          core.dss.hints_visible = false;
          core.stars.hints_visible = false;
          core.comets.hints_visible = false;
          core.cardinals.visible = false;
          core.exposure_scale = 2;
        } catch (err) {
          console.error('Error loading data sources:', err);
        }

        applyLocation(defaultLocation);
        resolve(stel);
      },
    });
  });
}

export function removeStelEngine() {
  if (!engine) return;
  if (engine.stop) engine.stop();

  engine.core.selection = null;
  engine.core.observer = null;

  const oldCanvas = engine.canvas;
  const gl = oldCanvas.getContext('webgl2') || oldCanvas.getContext('webgl');
  if (gl?.getExtension('WEBGL_lose_context')) {
    gl.getExtension('WEBGL_lose_context').loseContext();
  }

  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'stel-canvas';
  oldCanvas.replaceWith(newCanvas);
  setEngine(null);
}

// ── View & FOV control ─────────────────────────────────────

export function updateStellariumView({ h, v }) {
  if (!engine?.core?.observer) return;
  engine.core.observer.yaw = -h;
  engine.core.observer.pitch = v;
}

export function updateStellariumFov({ fov }) {
  if (!engine?.core) return;
  engine.core.fov = fov;
  const degFov = (fov * 180) / Math.PI;
  setEyepieceFl(FOCAL_LENGTH * degFov / 100);
  engine.core.display_limit_mag = calculateLimitMag();
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
  engine.core.display_limit_mag = calculateLimitMag();
  engine.core.star_relative_scale = 0.6;
}

// ── Time ───────────────────────────────────────────────────

export function toJulianDateIso(iso) {
  const now = new Date(iso);
  const jd = now.getTime() / 86400000 + 2440587.5;
  return jd - 2400000.5;
}

export function setEngineSpeed({ speed: multiplier }) {
  if (!engine?.core) return;
  engine.core.time_speed = parseInt(multiplier);
}

export function updateDate({ date }) {
  if (!engine?.core?.observer) return;
  engine.core.observer.utc = date;
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
