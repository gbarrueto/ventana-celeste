

import { loadCdnScript, loadCss } from '../../lib/lazy-load.js';
import { getMagFromLonLat } from '../../lib/light-pollution.js';
import { sendTelescopeMessage } from '../../lib/protobject.js';
import { applyLocation } from '../../lib/stellarium.js';
import { magToBortle } from '@ventanaceleste/core';
import tzlookup from 'tz-lookup';
import {
  LOCATION_SEND_MS,
  setCurrentTZ,
  updateSkySettings,
  setObserverLat,
  setObserverLon,
} from '../../lib/stores.js';
import { PARANAL } from '../dictionaries/time&space_dicts.js';



// ── Globe (Cesium) ────────────────────────────────────────
let globeEl = null;
let cesiumViewer = null;
let cesiumInterval = null;
let lastSentCoords = { lat: null, lon: null };
let onLocationChange = null;

function getUtcOffset(lat, lon) {
  const tz = tzlookup(lat, lon);
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(now);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const match = offsetPart.value.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function sendCoordinates({ lat, lon }) {
  setObserverLat(lat);
  setObserverLon(lon);
  const pollution = await getMagFromLonLat({ lat, lon });
  const tz = getUtcOffset(lat, lon);
  setCurrentTZ(tz);
  // El brillo del cielo es una propiedad del sitio, así que mover el observador
  // lo recalcula. Queda marcado como "viene del lugar" para que el deslizador de
  // luces de la ciudad lo muestre en vez de quedarse en el valor anterior.
  if (pollution != null) updateSkySettings({ skyMag: pollution, skyMagFromPlace: true });

  onLocationChange?.({
    lat,
    lon,
    note:
      pollution != null
        ? `Bortle ${magToBortle(pollution)} · luz del cielo estimada`
        : null,
  });

  const data = { cityName: 'Custom', lon, lat, elev: 0, mag: pollution };
  applyLocation(data);
  sendTelescopeMessage('applyLocation', data);
}

function startCesiumInterval() {
  if (cesiumInterval) clearInterval(cesiumInterval);
  cesiumInterval = setInterval(() => {
    if (!cesiumViewer?.scene) return;
    const canvas = cesiumViewer.scene.canvas;
    const windowPos = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2
    );
    const ray = cesiumViewer.camera.getPickRay(windowPos);
    const globePos = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
    if (!globePos) return;

    const carto = Cesium.Cartographic.fromCartesian(globePos);
    const lat = parseFloat(Cesium.Math.toDegrees(carto.latitude).toFixed(6));
    const lon = parseFloat(Cesium.Math.toDegrees(carto.longitude).toFixed(6));

    if (lastSentCoords.lat !== lat || lastSentCoords.lon !== lon) {
      lastSentCoords = { lat, lon };
      sendCoordinates({ lat, lon });
    }
  }, LOCATION_SEND_MS);
}

export async function initGlobe(element, locationChange) {
  globeEl = element;
  onLocationChange = locationChange;
  if (!window.Cesium) {
    await Promise.all([
      loadCss(
        'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css'
      ),
      loadCdnScript(
        'Cesium',
        'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js'
      ),
    ]);
  }

  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_API_KEY;
    
  cesiumViewer = new Cesium.Viewer(globeEl, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    geocoder: true,
  });

  setTimeout(() => {
    const credits = globeEl.querySelector('.cesium-viewer-bottom');
    if (credits) credits.style.display = 'none';
  }, 200);

  cesiumViewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    })
  );
  cesiumViewer.scene.imageryLayers.add(
    Cesium.ImageryLayer.fromWorldImagery(),
    0
  );

  const lpLayer = cesiumViewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://app.ventanaceleste.com/data/tiles2024/tile_{z}_{x}_{y}.png',
      minimumLevel: 2,
      maximumLevel: 8,
      tileWidth: 1024,
      tileHeight: 1024,
    })
  );
  lpLayer.alpha = 0.5;

  cesiumViewer.scene.requestRenderMode = true;
  cesiumViewer.scene.maximumRenderTimeChange = Infinity;

  flyHome(3000000);
  startCesiumInterval();
}

export function flyHome(height = 3000000) {
  cesiumViewer?.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      PARANAL.lon,
      PARANAL.lat,
      height
    ),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
  });
}
