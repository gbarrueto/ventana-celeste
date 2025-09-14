
/* FOV */

let oldFov;
const MIN_FOV = 0.000005;
const MAX_FOV = 3.228859;
const FOV_STEP = 0.000001;
const minLogFov = Math.log(MIN_FOV);
const maxLogFov = Math.log(MAX_FOV);
let logFov = maxLogFov;
let current_fov = 3;


/* FOCUS */

const MIN_FOCUS = 0;
const MAX_FOCUS = 10;
const FOCUS_STEP = 0.001;
let current_focus = 5;

let lastY = null;
const sensitivity = 0.5;

let currentBlur = 5;
let blurTarget = currentBlur;

let selectedCity = 'Santiago';
let cities = cities_data;

const defaultCityData = cities[selectedCity]
let currentLat = defaultCityData.lat;
let currentLon = defaultCityData.lon;
let currentElev = defaultCityData.elev;
let currentTZ = defaultCityData.tz;

const fovDisplay = document.getElementById("fovDisplay");
const touchArea = document.getElementById("touchArea");

// const blurSlider = document.getElementById('focusSlider');
// const blurText = document.getElementById('blurText');

const zoomOptions = document.getElementById('zoomOptions')

const menu = document.getElementById('menuContainer');
const interactionSection = document.getElementById('interactionSection');
const menuInteractionSection = document.getElementById('menuInteractionSection');

/********************************************************************
********************************************************************
 Cargar secciones interactivas del menu                   */

let section = `
  <section id="datetimeSection">
    <div id="datetime-picker" style="margin-bottom: 1rem; width: 100%; display: flex; justify-content: center;"></div>

    <div style="width: 90%;display: flex;flex-direction: column;align-self: center;">
      <button class="control-button" onclick="applyCurrentDate()">Hora Actual</button>
      <div class="grid-container" style="grid-template-columns: auto auto;">
        <button class="control-button" onclick="setSpeed(0)">🟥 Stop</button>
        <button class="control-button" onclick="setSpeed(1)">🕒 Realtime</button>
      </div>
      <div class="grid-container" style="grid-template-columns: 33% 33% 33%;justify-content: center;">
        <button class="control-button" onclick="setSpeed(10)">⏩ 10x</button>
        <button class="control-button" onclick="setSpeed(60)">⏩ 60x</button>
        <button class="control-button" onclick="setSpeed(3600)">⏩ 3600x</button>
      </div>
    </div>
  </section>
`;
interactionSection.insertAdjacentHTML("beforeend", section);

let globeDiv = document.createElement("div");
globeDiv.id = "globeViz";
globeDiv.style.width = "100%";
globeDiv.style.height = "98%";
globeDiv.style.position = "relative";
globeDiv.style.overflow = "hidden";
interactionSection.appendChild(globeDiv);

// Inicializar globo
let globePoint = [{ lat: -33.4489, lng: -70.6693, size: 1.5, color: "red" }];
let globe = Globe()(globeDiv)
  .globeImageUrl(
    "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  )
  .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
  .pointAltitude("size")
  .pointColor("color")
  .pointsData(globePoint);

// Mover la cámara al punto inicial
const { lat, lng } = globePoint[0];
globe.pointOfView({ lat, lng, altitude: 3 }, 1000); // 3 puede ajustarse según zoom

let mapDiv = document.createElement("div");
mapDiv.id = "map";
mapDiv.style.width = "100%";
mapDiv.style.height = "98%";
interactionSection.appendChild(mapDiv);

/*******************************************************************
********************************************************************/

const modeContainer = document.getElementById('modeContent');

const modeButtonElement = document.getElementById('modeButton');

let latInput = undefined;
let lonInput = undefined;
let elevInput = undefined;

let autoPollutionCheckbox = document.getElementById('autoPollutionCheckbox');
let pollutionInput = document.querySelector("#pollutionSlider");
pollutionInput.addEventListener("input", () => {
  pollution = pollutionInput.value;
  Protobject.Core.send({msg:"updatePollution", values: { bortle: pollutionInput.value }}).to("index.html");
  Protobject.Core.send({msg:"updatePollution", values: { bortle: pollutionInput.value }}).to("Lamp.html");
});

let advancedModeWarningText = undefined;

let flatpickrSyncInterval = null;
let activeFlatpickr = null;
let isUserTouchingCalendar = false;
let lastManualChange = 0;

let engineUTC = null;
let timeSpeed = 0;

let pollution = cities[selectedCity].contaminacion;

let modes = {
  simple: true,
  advanced: false
}

const BUTTONS = {
  constellations: {
    label: "Constellations",
    img: "https://telescope.alessiobellino.com/svg/btn-cst-lines.svg",
    path: "constellations",
    attr: "lines_visible",
  },
  atmosphere: {
    label: "Atmosphere",
    img: "https://telescope.alessiobellino.com/svg/btn-atmosphere.svg",
    path: "atmosphere",
    attr: "visible",
  },
  landscape: {
    label: "Landscape",
    img: "https://telescope.alessiobellino.com/svg/btn-landscape.svg",
    path: "landscapes",
    attr: "visible",
  },
  azimuthal: {
    label: "Azimuthal Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-azimuthal-grid.svg",
    path: "lines.azimuthal",
    attr: "visible",
  },
  equatorial: {
    label: "Equatorial Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-equatorial-grid.svg",
    path: "lines.equatorial",
    attr: "visible",
  },
  nebulae: {
    label: "Nebulae",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dsos",
    attr: "visible",
  },
  dss: {
    label: "DSS",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dss",
    attr: "visible",
  },
};