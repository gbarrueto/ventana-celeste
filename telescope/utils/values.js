
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

const modeContainer = document.getElementById('modeContent');

const modeButtonElement = document.getElementById('modeButton');

let latInput = undefined;
let lonInput = undefined;
let elevInput = undefined;

let autoPollutionCheckbox = document.getElementById('autoPollutionCheckbox');
let pollutionInput = document.querySelector("#pollutionSlider");
pollutionInput.addEventListener("input", () => {
  // Bortle index 1-9
  pollution = pollutionInput.value;

  const skyMag = bortleToMag(parseInt(pollution));

  Protobject.Core.send({msg:"updatePollution", values: { mag: skyMag }}).to("index.html");
  // Protobject.Core.send({msg:"updatePollution", values: { bortle: pollutionInput.value }}).to("Lamp.html");
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

// Inverse conversion. Since mag is a range, return a random value in the range
function bortleToMag(bortle) {

  switch (bortle) {
    case 1:
      return (22.0 + 21.99) / 2 + Math.random() * 0.1; // Cielo prístino
    case 2:
      return (21.99 + 21.89) / 2 + Math.random() * 0.1; // Cielo excelente
    case 3:
      return (21.89 + 21.69) / 2 + Math.random() * 0.2; // Cielo rural
    case 4:
      return (21.69 + 20.49) / 2 + Math.random() * 1.2; // Suburbano oscuro
    case 5:
      return (20.49 + 19.5) / 2 + Math.random() * 0.99; // Suburbano intermedio
    case 6:
      return (19.5 + 18.94) / 2 + Math.random() * 0.56; // Suburbano brillante
    case 7:
      return (18.94 + 18.38) / 2 + Math.random() * 0.56; // Periurbano
    case 8:
      return (18.38 + 16.53) / 2 + Math.random() * 1.85; // Ciudad
    case 9:
      return (16.53 + 15.0) / 2 + Math.random() * 1.53; // Centro de Ciudad
    default:
      return null;
  }
}