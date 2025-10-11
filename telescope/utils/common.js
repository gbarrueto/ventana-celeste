import simpleModeContent from '../Modes/Simple/index.js';
import advancedModeContent from '../Modes/Advanced/index.js';
import initializeStelEngine from "../../util/initStel.js";
import { addZoomSliderEvent } from './events.js';

function loadScript(url) {    
    const head = document.getElementsByTagName('head')[0];
    const script = document.createElement('script');
    script.type = 'text/javascript/module';
    script.src = url;
    head.appendChild(script);
}

async function loadScentialScripts() {
  let paths = [
    "telescope/utils/updateDisplay.js",
    "telescope/Menu/menu.js",
    "telescope/Slider/slider.js",
    "telescope/Zoom/zoom.js",
    "telescope/utils/stellarium.js",
    "telescope/utils/events.js",
    "util/time.js",
  ]

  paths.forEach((path) => {
    loadScript(path);
  })
}

async function loadExtraScripts() {
  let paths = [
    "https://unpkg.com/three",
    "https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js",
    "https://unpkg.com/browser-geo-tz@latest/dist/geotz.js",
    "telescope/utils/lp/pako_inflate.min.js",
    "telescope/utils/lp/getLpFromCoords.js",
    "telescope/Menu/DateTime/datetime.js",
    "telescope/Menu/Location/location.js",
    "telescope/Menu/Location/globe.js",
    "telescope/Menu/Seeing/seeing.js",
    "telescope/Menu/Pollution/pollution.js",
    "telescope/utils/luxon.js",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "util/Control.Geocoder.js",
    "util/L.Control.Range.js",
    "limit_mag/limit_magnitude.js",
    "util/overlay.js",
    "util/location.js",
    "util/stel.js",
    "telescope/utils/tz.js",
    "https://unpkg.com/globe.gl",
    "https://cdn.jsdelivr.net/npm/flatpickr",
  ]

  paths.forEach((path) => {
    loadScript(path);
  })
}

function setModeSettings(mode) {
  viewControlsButton.disabled = mode == 'simple';
  Protobject.Core.send({ msg: `${mode}Settings`, values: {} }).to(
    "index.html"
  );
}

function toggleMode() {
  simpleModeElement.classList.toggle("active");
  advancedModeElement.classList.toggle("active");
  modeButtonElement.classList.toggle("simple-mode-image");
  modeButtonElement.classList.toggle("advanced-mode-image");
  for (let mode in modes) {
    modes[mode] = !modes[mode];
    if (modes[mode] == true) {
      setModeSettings(mode);
    }
  }
}

function enableFinderMode() {
  if (advancedModeWarningText === undefined) {
    advancedModeWarningText = document.querySelector(
      "#advancedMode .alert-text"
    );
  }
  const buttons = document.querySelectorAll("#lensContainer button");

  advancedModeWarningText.style.opacity = 1;
  buttons.forEach((btn) => {
    btn.disabled = true;
  });
}

function disableFinderMode() {
  if (advancedModeWarningText === undefined) {
    advancedModeWarningText = document.querySelector(
      "#advancedMode .alert-text"
    );
  }
  advancedModeWarningText.style.opacity = 0;

  const buttons = document.querySelectorAll("#lensContainer button");

  buttons.forEach((btn) => {
    btn.disabled = false;
  });
}

function updateBlur(direction = 1) {
  currentBlur += direction * 0.001;
  currentBlur = Math.max(0, Math.min(10, currentBlur));

  updateDisplayBlur();
}

function autoPollution() {
  if (autoPollutionCheckbox.checked == true) {
    pollutionInput.style.opacity = 0;
    pollutionInput.style.pointerEvents = "none";
  } else {
    pollutionInput.style.opacity = 1;
    pollutionInput.style.pointerEvents = "auto";
  }
}

function unwrapAngle(newAngle, prevAngle) {
  let delta = newAngle - prevAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return prevAngle + delta;
}



/**************************  CÓDIGO  *************************************/

let modeContainer;
let blurSlider;
let zoomSlider;
let simpleModeElement;
let advancedModeElement;

async function main() {
  await loadScentialScripts();
  setTimeout(() => loadExtraScripts(), 2000);

  initializeStelEngine(true);

  const loadingScreenElement = document.getElementById('loadingScreen');

  // Esperar carga del DOM
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM is ready!");

    modeContainer = document.getElementById('modeContent');
    modeContainer.innerHTML = simpleModeContent + advancedModeContent;
    
    blurSlider = document.getElementById("focusSlider");
    zoomSlider = document.getElementById("zoomSlider");
    
    simpleModeElement = document.getElementById("simpleMode");
    advancedModeElement = document.getElementById("advancedMode");
    
    if (modes.simple === true) {
      simpleModeElement.classList.toggle("active");
      modeButtonElement.classList.toggle("simple-mode-image");
    } else {
      advancedModeElement.classList.toggle("active");
      modeButtonElement.classList.toggle("advanced-mode-image");
    }

    addZoomSliderEvent(zoomSlider);
    
    const stellariumOptionButtons = document.querySelectorAll(
      "#stellariumOptionsContainer button"
    );
    
    stellariumOptionButtons.forEach((btn) => {
      btn.onclick = () => {
        const info = BUTTONS[btn.name];
        Protobject.Core.send({
          msg: "stellariumOption",
          values: { path: info.path, attr: info.attr },
        }).to("index.html");
        btn.classList.toggle("active");
      };
    });

    loadingScreenElement.style.display = 'none';
    
  });
  
  
  
  // blurSlider.value = currentBlur;
  // updateDisplayFov();
}

main();
