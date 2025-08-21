// --- Light Pollution Map 2024 ---
const mapLink =
  '<a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a>';
const infoLink =
  '<a href="https://djlorenz.github.io/astronomy/lp/" target="_blank">Light Pollution Atlas Information</a>';

// Variables para mapa y capas
let map;
let standard, lightpollution2024;
let popup;
let popuplatlng;
let control;

// Función para mostrar el mapa dentro del menú
function displayLocation(e) {
  optionSelection(e); // mantiene la selección de botón

  // Menú desplegable simple de ciudades
  let citySelect = document.getElementById("city-select");
  if (!citySelect) {
    const select = document.createElement("select");
    select.id = "city-select";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a city";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    for (const cityName in cities) {
      const opt = document.createElement("option");
      opt.value = cityName;
      opt.textContent = cityName;
      select.appendChild(opt);
    }
    select.addEventListener("change", function() {
      const cityName = this.value;
      if (cityName) {
        applyLocation({
          cityName
        });
      }
    });
    interactionSection.insertBefore(select, interactionSection.firstChild);
  }

  // Crear div del mapa si no existe
  let mapDiv = document.getElementById("map");
  if (!mapDiv) {
    mapDiv = document.createElement("div");
    mapDiv.id = "map";
    mapDiv.classList.add('active')
    mapDiv.style.width = "100%";
    mapDiv.style.height = "400px"; // ajusta a tu preferencia
    interactionSection.appendChild(mapDiv);
  }
  else {
    mapDiv.style.display = 'block';
    mapDiv.classList.add('active');
  }


// Inicializar Leaflet solo una vez
  if (!mapDiv._leaflet_id) {
    // Base OSM
    standard = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; " + mapLink + " Contributors | " + infoLink,
        maxZoom: 19,
      }
    );

    // Capa 2024
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

    // Mapa
    map = L.map("map", {
      center: [currentLat || -33.45, currentLon || -70.66],
      zoom: 5,
      layers: [standard, lightpollution2024],
      tap: false,
    });

    // Control escala
    L.control.scale({ maxWidth: 200, position: "topright" }).addTo(map);

    // Geocoder
    const geocoder = L.control.geocoder({
      defaultMarkGeocode: false,
    })
      .on("markgeocode", function (e) {
        const center = e.geocode.center;
        const lat = center.lat;
        const lng = center.lng;
        if (lat >= -80 && lat <= 80 && lng >= -360 && lng <= 360) {
          L.marker([lat, lng], {
            title: "Lat, Lon = " + lat + ", " + lng,
            opacity: 0.7,
          }).addTo(map);
          map.flyTo([lat, lng], Math.max(map.getZoom(), 8));
          getInfoFromLonLat(center, 2024);
        }
      })
      .addTo(map);

    // Click para info
    map.on("click", function (e) {
      getInfoFromLonLat(e.latlng, 2024);
      popuplatlng = e.latlng;
    });

    // Slider opacidad
    control = L.control.range({
      position: "topright",
      min: 0,
      max: 100,
      value: 50,
      step: 1,
      orient: "vertical",
      icon: false,
    });
    control.on("change input", function (e) {
      lightpollution2024.setOpacity(e.value / 100);
    });
    map.addControl(control);
  }
}

async function applyLocation({ cityName = 'Custom', lon, lat, elev, tz }) {
  //if (e) {
  //  const activeButton = document.querySelector(
  //    '.control-button.active'
  //  );
  //
  //  if (activeButton) activeButton.classList.remove('active');
  //  e.currentTarget.classList.add('active');
  //}

  selectedCity = cityName;

  if (cities[cityName]) {
    lon = cities[cityName].lon;
    lat = cities[cityName].lat;
    elev = cities[cityName].elev;
    pollution = cities[cityName].contaminacion;
    tz = cities[cityName].tz;
  }
  else {
    pollution = await getBortleIndex({ lat, lon });
    // console.log("This location calculaterd pollution:", pollution);
  }
  // pollution = cities[cityName] ? cities[cityName].contaminacion : await getBortleIndex({ lat, lon });

  updateTimeZone(tz || -4);
  updatePollution();

    const data = {
    cityName: cityName,
    lon,
    lat,
    elev,
    bortle_index: pollution
  }

  Protobject.Core.send(data).to("index.html");

}

// --- Funciones auxiliares ---
function getInfoFromLonLat(elatlng, year) {
  if (year !== 2024) return;

  const lonFromDateLine = mod(elatlng.lng + 180.0, 360.0);
  const latFromStart = elatlng.lat + 65.0;
  const tilex = Math.floor(lonFromDateLine / 5.0) + 1;
  const tiley = Math.floor(latFromStart / 5.0) + 1;

  if (tiley >= 1 && tiley <= 28) {
    const url =
      "https://telescope.alessiobellino.com/data/binary_tiles/" +
      "binary_tile_" +
      tilex +
      "_" +
      tiley +
      ".dat.gz";

    const ix = Math.round(
      120 * (lonFromDateLine - 5.0 * (tilex - 1) + 1 / 240)
    );
    const iy = Math.round(120 * (latFromStart - 5.0 * (tiley - 1) + 1 / 240));

    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
      const data_array = new Int8Array(pako.ungzip(xhr.response));
      const first_number = 128 * Number(data_array[0]) + Number(data_array[1]);

      let change = 0.0;
      for (let i = 1; i < iy; i++) {
        change += Number(data_array[600 * i + 1]);
      }
      for (let i = 1; i < ix; i++) {
        change += Number(data_array[600 * (iy - 1) + 1 + i]);
      }

      const compressed = first_number + change;
      const brightnessRatio = compressed2full(compressed);
      const mpsas =
        22.0 - (5.0 * Math.log(1.0 + brightnessRatio)) / Math.log(100);

      popup = L.popup()
        .setLatLng(elatlng)
        .setContent(
          "<b>Year:</b> " +
            year +
            "<br><b>Lat, Lon:</b><br>" +
            elatlng.lat.toFixed(4) +
            ", " +
            (lonFromDateLine - 180).toFixed(4) +
            "<br><b>Brightness:</b><br> " +
            mpsas.toFixed(2) +
            " mag/arcsec<sup>2</sup><br>" +
            round_brightness(brightnessRatio) +
            " ratio (= artificial / natural)"
        )
        .openOn(map);
    };
    xhr.open("GET", url, true);
    xhr.send();
  } else {
    L.popup()
      .setLatLng(elatlng)
      .setContent(
        "<b>Lat, Lon:</b><br>" +
          elatlng.lat.toFixed(4) +
          ", " +
          (lonFromDateLine - 180).toFixed(4) +
          "<br>Clicked location is out of bounds.<br>Atlas covers 65S to 75N latitude."
      )
      .openOn(map);
  }
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function compressed2full(x) {
  return (5.0 / 195.0) * (Math.exp(0.0195 * x) - 1.0);
}

function round_brightness(b) {
  if (b < 0.1) return b.toFixed(3);
  else if (b < 3) return b.toFixed(2);
  else return b.toFixed(1);
}

function updateTimeZone(newTZ) {
  currentTZ = newTZ;
  console.log("Time zone updated to:", currentTZ);
}