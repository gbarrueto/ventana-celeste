import simpleModeContent from '../Modes/Simple/index.js';
import advancedModeContent from '../Modes/Advanced/index.js';
import initializeStelEngine from "../../util/initStel.js";
import { addZoomSliderEvent } from './events.js';
import { updateDisplayFov } from './updateDisplay.js';
import { closeMenu, openMenu } from '../Menu/menu.js';

function loadScript(url, type) {    
    const head = document.getElementsByTagName('head')[0];
    const script = document.createElement('script');
    script.type = type;
    script.src = url;
    head.appendChild(script);
}

async function loadScentialScripts() {
  let paths = [
    { path: "telescope/utils/updateDisplay.js", type: 'module'},
    { path: "telescope/Menu/menu.js", type: 'module'},
    { path: "telescope/Slider/slider.js", type: 'module'},
    { path: "telescope/utils/stellarium.js", type: 'module'},
    { path: "telescope/utils/events.js", type: 'module'},
    { path: "util/time.js", type: 'module'},
  ]

  paths.forEach((content) => {
    loadScript(content.path, content.type);
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

function setLoading(state = true) {
  if (state === true) loadingScreenElement.style.display = 'block';
  else loadingScreenElement.style.display = 'none';
}

function setModeSettings(mode) {
  viewControlsButton.disabled = mode == 'simple';
  Protobject.Core.send({ msg: `${mode}Settings`, values: {} }).to(
    "index.html"
  );
}

function toggleMode() {
  // Cambiar a avanzado
  if (modes.simple === true) {
    if (!advancedModeElement) {
      modeContainer.insertAdjacentHTML('beforeend', advancedModeContent);
      advancedModeElement = document.getElementById('advancedMode');
      if (!stelInitialized) {
        setLoading(true);
        setTimeout(() => setLoading(false), 500);
        initializeStelEngine(true);
        stelInitialized = true;
      };
    }
    modeTextElement.textContent = 'Simple';
    advancedModeElement.classList.add("active");
    simpleModeElement.classList.remove("active");
    modeButtonElement.classList.add("simple-mode-image");
    modeButtonElement.classList.remove("advanced-mode-image");
  }
  // Cambiar a simple
  else {
    if (!simpleModeElement) {
      modeContainer.insertAdjacentHTML('beforeend', simpleModeContent);
      simpleModeElement = document.getElementById('simpleMode');
    }
    modeTextElement.textContent = 'Avanzado';
    simpleModeElement.classList.add("active");
    advancedModeElement.classList.remove("active");
    modeButtonElement.classList.add("advanced-mode-image");
    modeButtonElement.classList.remove("simple-mode-image");
  }

  // Intercambiar modo activo
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


function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(selected_eyepiece_fl, event) {
  const button = document.querySelector(
    '#lensContainer .active'
  );

  if (button) {
    button.classList.toggle('active')
  }

  event.target.classList.toggle('active');
  
  EYEPIECE_FL = selected_eyepiece_fl;

  // Calcular nuevo FOV

  const m = FOCAL_LENGTH / EYEPIECE_FL; // Magnification
  const proyection_const = 100; // Ni idea de porqué es 100, pero asi funciona
  
  // new_fov es fov de stellarium, no fov aparente del ocular
  
  let new_fov = (proyection_const / m)
  // Convertir a radianes
  new_fov = new_fov * Math.PI / 180;
  
  logFov = new_fov;
  updateDisplayFov();
}

function setWindowFunctions() {
  window.toggleMode = toggleMode;
  window.applyZoom = applyZoom;
  window.updateDisplayFov = updateDisplayFov;
  window.autoPollution = autoPollution;
  window.openMenu = openMenu;
  window.setLoading = setLoading;
  window.closeMenu = closeMenu;
}



/**************************  CÓDIGO  *************************************/

let modeContainer;
let blurSlider;
let zoomSlider;
let simpleModeElement = null;
let advancedModeElement = null;
let loadingScreenElement;
let stelInitialized = false;
let modeTextElement;

async function main() {
  await loadScentialScripts();
  setTimeout(() => loadExtraScripts(), 1000);

  loadingScreenElement = document.getElementById('loadingScreen');

  // Esperar carga del DOM
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM is ready!");

    modeContainer = document.getElementById('modeContent');
    modeContainer.innerHTML = simpleModeContent;
    
    // blurSlider = document.getElementById("focusSlider");
    zoomSlider = document.getElementById("zoomSlider");
    
    simpleModeElement = document.getElementById("simpleMode");
    // advancedModeElement = document.getElementById("advancedMode");

    modeTextElement = document.getElementById('modeText');

    simpleModeElement.classList.toggle("active");
    modeButtonElement.classList.toggle("simple-mode-image");
    modeTextElement.textContent = 'Avanzado';

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

    setWindowFunctions();
    setLoading(false);
    
  });
  
  
  
  // blurSlider.value = currentBlur;
  // updateDisplayFov();
}

main();
