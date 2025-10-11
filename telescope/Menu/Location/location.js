let map;
let standard, lightpollution2024;
let lastSentCenter = null;
let sendInterval;

// Función para mostrar el mapa
function displayMap(e) {
  if (optionSelection(e)) return;

  let mapDiv = document.getElementById("map");
  mapDiv.classList.add("active");

  if (!mapDiv._leaflet_id) {
    standard = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    );
    lightpollution2024 = L.tileLayer(
      "https://telescope.alessiobellino.com/data/tiles2024/tile_{z}_{x}_{y}.png",
      {
        minZoom: 2,
        maxNativeZoom: 8,
        maxZoom: 19,
        tileSize: 1024,
        zoomOffset: -2,
        opacity: 0.5,
      }
    );

    map = L.map("map", {
      center: [currentLat || -33.45, currentLon || -70.66],
      zoom: 6,
      layers: [standard, lightpollution2024],
      zoomControl: false,
      attributionControl: false,
    });

    const geocoder = L.Control.geocoder({ defaultMarkGeocode: false })
      .on("markgeocode", function (e) {
        const center = e.geocode.center;
        map.flyTo(center, Math.max(map.getZoom(), 8));
        sendCoordinates({ lat: center.lat, lon: center.lng });
      })
      .addTo(map);

    // Quitar envío directo al click (opcional)
    // map.on("click", function (e) {
    //   sendCoordinates({ lat: e.latlng.lat, lon: e.latlng.lng });
    // });

    // Crear un icono fijo en el centro del mapa (superpuesto en el div)
    addCenterMarker();

    // Iniciar intervalo para enviar coordenadas del centro si cambian
    startCenterCoordinateSending();
  }
}

function addCenterMarker() {
  // Crea un div con la persona/flecha en el centro del mapa
  const mapDiv = document.getElementById("map");

  // Crear elemento sólo si no existe
  if (!document.getElementById("centerMarker")) {
    const markerDiv = document.createElement("div");
    markerDiv.id = "centerMarker";
    markerDiv.style.position = "absolute";
    markerDiv.style.top = "50%";
    markerDiv.style.left = "50%";
    markerDiv.style.height = "10px";
    markerDiv.style.width = "10px";
    markerDiv.style.backgroundColor = "red";
    markerDiv.style.borderRadius = "50%";
    markerDiv.style.transform = "translate(-50%, -50%)";
    markerDiv.style.pointerEvents = "none"; // Para que el div no interfiera con eventos del mapa
    markerDiv.style.zIndex = 1000;

    // Aquí puedes poner un icono o emoji o imagen para la persona

    mapDiv.appendChild(markerDiv);
  }
}

function startCenterCoordinateSending() {
  // Limpia intervalos anteriores
  if (sendInterval) clearInterval(sendInterval);

  sendInterval = setInterval(() => {
    if (!map) return;

    const center = map.getCenter();
    const lat = center.lat.toFixed(6);
    const lon = center.lng.toFixed(6);

    // Comparar con última coordenada enviada
    if (
      !lastSentCenter ||
      lastSentCenter.lat !== lat ||
      lastSentCenter.lon !== lon
    ) {
      lastSentCenter = { lat, lon };
      sendCoordinates({ lat: parseFloat(lat), lon: parseFloat(lon) });
    }
  }, 100);
}



// --- Funciones auxiliares mínimas ---
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
