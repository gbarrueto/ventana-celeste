<script>
  import { onMount, onDestroy } from 'svelte';
  import { loadCdnScript, loadCss } from '../lib/lazy-load.js';
  import { getMagFromLonLat } from '../lib/light-pollution.js';
  import { applyLocation } from '../lib/stellarium.js';
  import { isLoading, LOCATION_SEND_MS, setCurrentTZ, setPollution, setObserverLat, setObserverLon } from '../lib/stores.js';

  let cesiumViewer = null;
  let cesiumInterval = null;
  let lastSentCoords = { lat: null, lon: null };
  let containerEl;

  function getUtcOffset(lat, lon) {
    const tz = tzlookup(lat, lon);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
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
    setPollution(pollution);

    const data = { cityName: 'Custom', lon, lat, elev: 0, mag: pollution };
    applyLocation(data);
    Protobject.Core.send({ msg: 'applyLocation', values: data }).to('index.html');
  }

  function startCesiumInterval() {
    if (cesiumInterval) clearInterval(cesiumInterval);
    cesiumInterval = setInterval(() => {
      if (!cesiumViewer?.scene) return;
      const canvas = cesiumViewer.scene.canvas;
      const windowPos = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
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

  onMount(async () => {
    if (!window.Cesium) {
      isLoading.set(true);
      await Promise.all([
        loadCss('https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css'),
        loadCdnScript('Cesium', 'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js'),
      ]);
      isLoading.set(false);
    }

    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMTg3YjVkZS05YTI2LTQxMmUtOTI2YS0zMTYxOTMyYTBiNzgiLCJpZCI6MzQ2MzQ5LCJpYXQiOjE3NTkzMzM5Njh9.U3AGh0QR9gTk4v3NUzdOADFRHHlLh6Q6h3sYZ8NoB0Y';

    cesiumViewer = new Cesium.Viewer(containerEl, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false, timeline: false, baseLayerPicker: false,
      fullscreenButton: false, homeButton: false, navigationHelpButton: false,
      sceneModePicker: false, geocoder: true,
    });

    // Hide credits
    setTimeout(() => {
      const credits = containerEl.querySelector('.cesium-viewer-bottom');
      if (credits) credits.style.display = 'none';
    }, 200);

    // OSM layer
    cesiumViewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }),
    );
    cesiumViewer.scene.imageryLayers.add(Cesium.ImageryLayer.fromWorldImagery(), 0);

    // Light pollution overlay
    const lpLayer = cesiumViewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://app.ventanaceleste.com/data/tiles2024/tile_{z}_{x}_{y}.png',
        minimumLevel: 2, maximumLevel: 8, tileWidth: 1024, tileHeight: 1024,
      }),
    );
    lpLayer.alpha = 0.5;

    cesiumViewer.scene.requestRenderMode = true;
    cesiumViewer.scene.maximumRenderTimeChange = Infinity;

    cesiumViewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-71, -35, 10000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    });

    startCesiumInterval();
  });

  onDestroy(() => {
    if (cesiumViewer) {
      cesiumViewer.useDefaultRenderLoop = false;
      clearInterval(cesiumInterval);
    }
  });
</script>

<div class="globe-container" bind:this={containerEl}>
  <div class="center-dot"></div>
</div>

<style>
  .globe-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .center-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    background-color: red;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    pointer-events: none;
  }
</style>
