
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

const modeContainer = document.getElementById('modeContent');

const modeButtonElement = document.getElementById('modeButton');

let latInput = undefined;
let lonInput = undefined;
let elevInput = undefined;

let pollutionInput = document.querySelector("#pollutionSlider");
pollutionInput.addEventListener("input", () => {
  pollution = pollutionInput.value;
  Protobject.Core.send({ bortle: pollutionInput.value }).to("index.html");
  Protobject.Core.send({ bortle: pollutionInput.value }).to("Lamp.html");
});

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