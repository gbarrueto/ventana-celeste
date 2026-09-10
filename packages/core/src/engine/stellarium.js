// Inicialización de script y fuentes de datos de Stellarium Web Engine.

import { computeDefaultObservationTime } from '../time/engineTime.js';

const PLANETS = [
  'moon', 'sun', 'jupiter', 'mercury', 'venus', 'mars', 'saturn', 'uranus',
  'neptune', 'io', 'europa', 'ganymede', 'callisto', 'moon-normal',
];

function buildDataSources(smalldataBaseUrl, bigdataBaseUrl, { extended = true, includeGaia = extended } = {}) {
  const sources = [
    { loader: 'stars', config: { url: `${smalldataBaseUrl}swe-data-packs/minimal/2020-09-01/minimal_2020-09-01_186e7ee2/stars`, key: 'minimal' } },
    { loader: 'stars', config: { url: `${smalldataBaseUrl}swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/stars`, key: 'base' } },
    { loader: 'landscapes', config: { url: `${smalldataBaseUrl}landscapes/v1/guereins`, key: 'guereins' } },
  ];

  PLANETS.forEach((planet) => {
    sources.push({ loader: 'planets', config: { url: `${smalldataBaseUrl}surveys/sso/${planet}/v1`, key: planet } });
  });

  // Gaia debe preceder a surveys/dss/v1 en core.dss para que DSS se renderice.
  if (includeGaia) {
    sources.push({ loader: 'dss', config: { url: `${bigdataBaseUrl}surveys/gaia/v1`, key: 'gaia' } });
  }

  if (extended) {
    sources.push(
      { loader: 'stars', config: { url: `${smalldataBaseUrl}swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/stars`, key: 'extended' } },
      { loader: 'skycultures', config: { url: `${smalldataBaseUrl}skycultures/v3/western`, key: 'western' } },
      { loader: 'dsos', config: { url: `${smalldataBaseUrl}swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso` } },
      { loader: 'dsos', config: { url: `${smalldataBaseUrl}swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/dso` } },
      { loader: 'milkyway', config: { url: `${smalldataBaseUrl}surveys/milkyway/v1` } },
      { loader: 'dss', config: { url: `${bigdataBaseUrl}surveys/dss/v1` } },
      { loader: 'minor_planets', config: { url: `${smalldataBaseUrl}mpc/v1/mpcorb.dat`, key: 'mpc_asteroids' } },
      { loader: 'comets', config: { url: `${smalldataBaseUrl}mpc/v1/CometEls.txt?v=2019-12-17`, key: 'mpc_comets' } },
    );
  }

  return sources;
}

// Inyecta el <script> del motor si window.StelWebEngine no existe.
export function ensureStellariumScript(scriptUrl = '/stellarium-web-engine.js') {
  if (typeof window.StelWebEngine === 'function') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-stellarium='1']");
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stellarium script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.dataset.stellarium = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stellarium script'));
    document.head.appendChild(script);
  });
}

export async function loadStellariumDataSources(core, { smalldataBaseUrl, bigdataBaseUrl, extended = true, includeGaia } = {}) {
  const sources = buildDataSources(smalldataBaseUrl, bigdataBaseUrl, { extended, includeGaia });
  await Promise.all(sources.map(({ loader, config }) => core[loader].addDataSource(config)));
}

// location: { lat, lon, elev }. time: opciones para computeDefaultObservationTime.
export async function initializeStellariumEngine({
  canvas,
  wasmFile = '/stellarium-web-engine.wasm',
  scriptUrl = '/stellarium-web-engine.js',
  smalldataBaseUrl,
  bigdataBaseUrl,
  extended = true,
  includeGaia,
  location,
  time,
  // Si es true, fallos al cargar catálogos rechazan la inicialización.
  strict = true,
  onReady = () => {},
  onError = () => {},
} = {}) {
  await ensureStellariumScript(scriptUrl);

  if (typeof window.StelWebEngine !== 'function') {
    throw new Error('Stellarium engine script not available');
  }

  return new Promise((resolve, reject) => {
    window.StelWebEngine({
      wasmFile,
      canvas,
      async onReady(stel) {
        try {
          window.currentStelEngine = stel;
          const { core } = stel;

          if (location) {
            core.observer.latitude = location.lat * (Math.PI / 180);
            core.observer.longitude = location.lon * (Math.PI / 180);
            core.observer.elevation = location.elev ?? 0;
          }
          if (time) {
            core.observer.utc = computeDefaultObservationTime(time);
          }

          try {
            await loadStellariumDataSources(core, { smalldataBaseUrl, bigdataBaseUrl, extended, includeGaia });
          } catch (error) {
            if (strict) throw error;
            console.error('Error loading Stellarium data sources:', error);
          }

          await onReady(stel);
          resolve(stel);
        } catch (error) {
          onError(error);
          reject(error);
        }
      },
    });
  });
}

export function removeStellariumEngine(engine, canvasId = 'stel-canvas') {
  if (!engine) return;
  if (engine.stop) engine.stop();

  engine.core.selection = null;
  engine.core.observer = null;

  const oldCanvas = engine.canvas;
  const gl = oldCanvas?.getContext('webgl2') || oldCanvas?.getContext('webgl');
  if (gl?.getExtension('WEBGL_lose_context')) {
    gl.getExtension('WEBGL_lose_context').loseContext();
  }

  if (oldCanvas) {
    const newCanvas = document.createElement('canvas');
    newCanvas.id = canvasId;
    oldCanvas.replaceWith(newCanvas);
  }

  if (window.currentStelEngine === engine) window.currentStelEngine = null;
}
