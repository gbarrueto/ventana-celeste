import { lazyLoader } from "../../utils/lazyLoad.js";

// function initializeGlobe() {
//   // Inicializar globo
//   let globePoint = [{ lat: -33.4489, lng: -70.6693, size: 1.5, color: "red" }];
//   let globe = Globe()(globeDiv)
//     .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
//     .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
//     .pointAltitude("size")
//     .pointColor("color")
//     .pointsData(globePoint);

//   // Mover la cámara al punto inicial
//   const { lat, lng } = globePoint[0];
//   globe.pointOfView({ lat, lng, altitude: 3 }, 1000); // 3 puede ajustarse según zoom
// }

// Variable global para evitar múltiples inicializaciones
let cesiumViewer = null;
let cesiumInterval = null;
let lastSentCesiumCoords = { lat: null, lon: null };

export async function displayGlobe(e) {
  if (optionSelection && optionSelection(e)) return;

  // Obtener o crear el contenedor
  let container = document.getElementById("cesiumContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "cesiumContainer";
    container.style.top = 0;
    container.style.left = 0;
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.zIndex = 999;
    container.classList.add("active");
    document.body.appendChild(container);
  } else {
    container.classList.add("active");
  }

  // Load Cesium on demand
  if (!window.Cesium) {
    try {
      setLoading(true); // Mostrar spinner

      // Load both Cesium AND CSS
      const cesiumCssPromise = new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css';
        link.onload = resolve;
        document.head.appendChild(link);
      });

      const cesiumJsPromise = lazyLoader.loadCdnScript(
        'Cesium',
        'https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js'
      );

      await Promise.all([cesiumCssPromise, cesiumJsPromise]);

    } catch (error) {
      console.error('Failed to load Cesium:', error);
      alert('Error al cargar mapa 3D. Por favor intenta de nuevo.');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  }

  // No inicializar Cesium de nuevo si ya está
  if (cesiumViewer) {
    console.warn("Cesium ya está inicializado.");
    resumeCesium();
    return;
  }

  // Agregar punto rojo en el centro del div
  let centerDot = document.createElement("div");
  centerDot.id = "centerDot";
  centerDot.style.position = "absolute";
  centerDot.style.top = "50%";
  centerDot.style.left = "50%";
  centerDot.style.width = "10px";
  centerDot.style.height = "10px";
  centerDot.style.backgroundColor = "red";
  centerDot.style.borderRadius = "50%";
  centerDot.style.transform = "translate(-50%, -50%)";
  centerDot.style.zIndex = "1000"; // Mayor que el zIndex del globo

  container.appendChild(centerDot);

  // Configurar token de Cesium Ion
  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMTg3YjVkZS05YTI2LTQxMmUtOTI2YS0zMTYxOTMyYTBiNzgiLCJpZCI6MzQ2MzQ5LCJpYXQiOjE3NTkzMzM5Njh9.U3AGh0QR9gTk4v3NUzdOADFRHHlLh6Q6h3sYZ8NoB0Y"; // Reemplaza esto

  // Inicializar Cesium Viewer
  cesiumViewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    addImageryProviders: false,
    fullscreenButton: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    geocoder: true,
  });

  setTimeout(() => {
    const credits = document.querySelector(".cesium-viewer-bottom");
    if (credits) {
      credits.style.display = "none";
    }
  }, 200);

  const osm = new Cesium.OpenStreetMapImageryProvider({
    url: "https://tile.openstreetmap.org/", // tiles OSM oficiales
  });
  cesiumViewer.imageryLayers.addImageryProvider(osm);

  const baseLayer = Cesium.ImageryLayer.fromWorldImagery();
  cesiumViewer.scene.imageryLayers.add(baseLayer, 0); // índice 0 => la pones abajo. (documentado)
  // Ejemplo alternativo: usar OpenStreetMap
  // const osm = new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }));
  // cesiumViewer.scene.imageryLayers.add(osm, 0);

  // tu proveedor de contaminación lumínica (ya lo tienes)
  const lightPollutionProvider = new Cesium.UrlTemplateImageryProvider({
    url: "https://app.ventanaceleste.com/data/tiles2024/tile_{z}_{x}_{y}.png",
    minimumLevel: 2,
    maximumLevel: 8,
    tileWidth: 1024,
    tileHeight: 1024,
  });

  // addImageryProvider devuelve el ImageryLayer creado; así puedes ajustar su alpha.
  const lpLayer = cesiumViewer.imageryLayers.addImageryProvider(
    lightPollutionProvider
  );

  // cesiumViewer.scene.globe.enableLighting = true;
  // lpLayer.dayAlpha = 0.0;  // casi invisible de día
  // lpLayer.nightAlpha = 1.0; // visible en la noche

  lpLayer.alpha = 0.5;

  cesiumViewer.scene.requestRenderMode = true;
  cesiumViewer.scene.maximumRenderTimeChange = Infinity;

  // Posición inicial de la cámara (puedes ajustarla)
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-71, -35, 10000000), // Altura de ~15.000 km
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0), // Mirando directo al centro
      roll: 0.0,
    },
  });
  // Iniciar intervalo de envío de coordenadas del centro cada 100ms
  startCesiumInterval();
}

export function pauseCesium() {
  if (cesiumViewer) {
    cesiumViewer.useDefaultRenderLoop = false;
    clearInterval(cesiumInterval);
  }
}

function resumeCesium() {
  if (cesiumViewer) {
    cesiumViewer.useDefaultRenderLoop = true;
    startCesiumInterval();
    // Opcional: reiniciar intervalo si lo necesitas
  }
}

function destroyCesium() {
  if (cesiumViewer) {
    cesiumViewer.destroy();
    cesiumViewer = null;
    clearInterval(cesiumInterval);
    cesiumInterval = null;
    lastSentCesiumCoords = { lat: null, lon: null };
    const container = document.getElementById("cesiumContainer");
    if (container) container.remove();
  }
}

function startCesiumInterval() {
  if (cesiumInterval) clearInterval(cesiumInterval);

  cesiumInterval = setInterval(() => {
    if (!cesiumViewer || !cesiumViewer.scene) return;

    const scene = cesiumViewer.scene;
    const canvas = scene.canvas;

    const windowPosition = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2
    );

    const ray = cesiumViewer.camera.getPickRay(windowPosition);
    const globePosition = scene.globe.pick(ray, scene);

    if (!globePosition) return;

    const cartographic = Cesium.Cartographic.fromCartesian(globePosition);

    const latNum = parseFloat(
      Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)
    );
    const lonNum = parseFloat(
      Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)
    );

    if (
      lastSentCesiumCoords.lat !== latNum ||
      lastSentCesiumCoords.lon !== lonNum
    ) {
      // console.log("Centro del globo:", { lat: latNum, lon: lonNum });

      lastSentCesiumCoords = { lat: latNum, lon: lonNum };
      sendCoordinates({ lat: latNum, lon: lonNum });
    }
  }, LOCATION_SEND_MS);
}

async function sendCoordinates({ lat, lon }) {
  const pollution = await getMagFromLonLat({ lat, lon });

  const elev = 0;
  const tz = getUtcOffset(lat, lon);

  updateTimeZone(tz);
  updatePollution();

  const data = {
    cityName: "Custom",
    lon,
    lat,
    elev,
    mag: pollution,
  };

  // // Actualizar el punto en el globo
  // if (globe) {
  //   globePoint = [{ lat, lng: lon, size: 1, color: "red" }];
  //   globe.pointsData(globePoint);

  //   // Mover la cámara al nuevo punto
  //   globe.pointOfView({ lat, lng: lon, altitude: 3 }, 3000); // 3 puede ajustarse según zoom
  // }

  applyLocation(data); // para guidescope
  Protobject.Core.send({ msg: "applyLocation", values: data }).to("index.html");
}

function getUtcOffset(lat, lon) {
  const tz = tzlookup(lat, lon);
  const now = new Date();
  const options = { timeZone: tz, timeZoneName: "shortOffset" };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(now);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  const match = offsetPart.value.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function updateTimeZone(newTZ) {
  currentTZ = newTZ;
}
