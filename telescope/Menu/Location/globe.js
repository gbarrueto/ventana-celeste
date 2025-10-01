// Variable global para evitar múltiples inicializaciones
let cesiumViewer = null;

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
    destination: Cesium.Cartesian3.fromDegrees(-122.4175, 37.655, 300000),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-15.0),
    },
  });

  // Agregar edificios (opcional)
  try {
    const buildings = await Cesium.createOsmBuildingsAsync();
    cesiumViewer.scene.primitives.add(buildings);
  } catch (error) {
    console.error("Error cargando edificios:", error);
  }
}
