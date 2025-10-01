// Variable global para evitar múltiples inicializaciones
let cesiumViewer = null;
let cesiumInterval = null;
let lastSentCesiumCoords = { lat: null, lon: null };

async function displayGlobe(e) {
  if (optionSelection && optionSelection(e)) return;

  // Ocultar otros elementos si es necesario (mapa, canvas, etc.)
  const mapDiv = document.getElementById("map");
  if (mapDiv) mapDiv.classList.remove("active");

  const stelCanvas = document.getElementById("stel-canvas");
  if (stelCanvas) stelCanvas.style.display = "none";

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
    return;
  }

  // Configurar token de Cesium Ion
  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMTg3YjVkZS05YTI2LTQxMmUtOTI2YS0zMTYxOTMyYTBiNzgiLCJpZCI6MzQ2MzQ5LCJpYXQiOjE3NTkzMzM5Njh9.U3AGh0QR9gTk4v3NUzdOADFRHHlLh6Q6h3sYZ8NoB0Y"; // Reemplaza esto

  // Inicializar Cesium Viewer
  cesiumViewer = new Cesium.Viewer("cesiumContainer", {
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

  // Posición inicial de la cámara (puedes ajustarla)
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 15000000), // Altura de ~15.000 km
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0), // Mirando directo al centro
      roll: 0.0,
    },
  });
  // ⏱️ Iniciar intervalo de envío de coordenadas del centro cada 100ms
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
    const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
    const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);

    const latNum = parseFloat(
      Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)
    );
    const lonNum = parseFloat(
      Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)
    );

    // Comparación segura con floats
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

async function sendCoordinates({ lat, lon }) {
  const pollution = await getMagFromLonLat({ lat, lon });
  console.log("Pollution level:", pollution);

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

  Protobject.Core.send({ msg: "applyLocation", values: data }).to("index.html");
}
