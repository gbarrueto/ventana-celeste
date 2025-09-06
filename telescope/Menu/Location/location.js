// Variables para mapa y capas
let map;
let standard, lightpollution2024;
let control;

// Función para mostrar el mapa
function displayLocation(e) {
  optionSelection(e); // mantiene la selección de botón

  // Crear div del mapa si no existe
  let mapDiv = document.getElementById("map");
  if (!mapDiv) {
    mapDiv = document.createElement("div");
    mapDiv.id = "map";
    mapDiv.classList.add("active");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "600px";
    interactionSection.appendChild(mapDiv);
  } else {
    mapDiv.style.display = "block";
    mapDiv.classList.add("active");
  }

  // Inicializar Leaflet solo una vez
  if (!mapDiv._leaflet_id) {
    // Base OSM
    standard = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    );

    // Capa contaminación lumínica 2024
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

    // Crear mapa sin botones de zoom ni escala
    map = L.map("map", {
      center: [currentLat || -33.45, currentLon || -70.66],
      zoom: 6,
      layers: [standard, lightpollution2024],
      zoomControl: false,
      attributionControl: false,
    });

    // Geocoder (solo búsqueda, sin marcador en mapa)
    const geocoder = L.Control.geocoder({ defaultMarkGeocode: false })
      .on("markgeocode", function (e) {
        const center = e.geocode.center;
        map.flyTo(center, Math.max(map.getZoom(), 8));
        sendCoordinates({ lat: center.lat, lon: center.lng });
      })
      .addTo(map);

    // Click → enviar coordenadas directo
    map.on("click", function (e) {
      sendCoordinates({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    // Slider de opacidad
  }
}

// Enviar coordenadas a telescope
async function sendCoordinates({ lat, lon }) {
  const pollution = await getBortleIndex({ lat, lon });
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
    bortle_index: pollution,
  };

  Protobject.Core.send({ msg: "applyLocation", values: data }).to("index.html");
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
