// Variable global para evitar múltiples inicializaciones
let cesiumViewer = null;
let cesiumInterval = null;
let lastSentCesiumCoords = { lat: null, lon: null };

async function displayGlobe(e) {
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
    url: "https://telescope.alessiobellino.com/data/tiles2024/tile_{z}_{x}_{y}.png",
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
  // ⏱️ Iniciar intervalo de envío de coordenadas del centro cada 100ms
  startCesiumInterval();
}

function pauseCesium() {
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
      console.log("Centro del globo:", { lat: latNum, lon: lonNum });

      lastSentCesiumCoords = { lat: latNum, lon: lonNum };
      sendCoordinates({ lat: latNum, lon: lonNum });
    }
  }, 100);
}
