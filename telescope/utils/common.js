import initializeStelEngine from "../../util/initStel.js";
import { setupSliderListeners } from "./events.js";
import { updateDisplayFov } from "./updateDisplay.js";
import {
  closeMenu,
  createMenuElement,
  openMenu,
  optionSelection,
} from "../Menu/menu.js";
import {
  applyCurrentDate,
  displayDateTime,
  setSpeed,
} from "../Menu/DateTime/datetime.js";
import { displayGlobe } from "../Menu/Location/globe.js";
import { displaySeeingOptions } from "../Menu/Seeing/seeing.js";
import { getMagFromLonLat } from "./lp/getLpFromCoords.js";
import { applyLocation } from "../../util/location.js";
import { initSimpleMode } from "../Modes/simple-mode.js";
import { initAdvancedMode } from "../Modes/advanced-mode.js";

function loadScript(url, type) {
  const head = document.getElementsByTagName("head")[0];
  const script = document.createElement("script");
  script.type = type;
  script.src = url;
  head.appendChild(script);
}

async function loadScentialScripts() {
  let paths = [{ path: "telescope/utils/stellarium.js", type: "module" }];

  paths.forEach((content) => {
    loadScript(content.path, content.type);
  });
}

function setLoading(state = true) {
  if (state === true) mainLoadingScreenElement.style.display = "block";
  else mainLoadingScreenElement.style.display = "none";
}

function setModeSettings(mode) {
  Protobject.Core.send({ msg: `${mode}Settings`, values: {} }).to("index.html");
}

async function toggleMode() {
  setLoading(true);

  try {
    if (modes.simple === true) {
      // Switching to advanced mode
      await initAdvancedMode();
    } else {
      // Switching to simple mode
      await initSimpleMode();
    }
    
    // Toggle mode state
    for (let mode in modes) {
      modes[mode] = !modes[mode];
      if (modes[mode] == true) {
        setModeSettings(mode);
      }
    }
  }

  catch(error) {
    console.error('Error toggling mode:', error);
  }

  finally {
    setLoading(false);
  }
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

function applyZoom(selected_eyepiece_fl, event) {
  const button = document.querySelector("#lensContainer .active");
  let buttonName = ''

  if (button) {
    button.classList.toggle("active");
  }

  event.target.classList.toggle("active");
  buttonName = event.target.name;

  EYEPIECE_FL = selected_eyepiece_fl;

  // Calcular nuevo FOV

  const m = FOCAL_LENGTH / EYEPIECE_FL; // Magnification
  const proyection_const = 100; // Ni idea de porqué es 100, pero asi funciona

  // new_fov es fov de stellarium, no fov aparente del ocular

  let new_fov = proyection_const / m;
  // Convertir a radianes
  new_fov = (new_fov * Math.PI) / 180;

  logFov = Math.log(new_fov);
  updateDisplayFov(buttonName);
}

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

function updatePollution() {
  if (!pollutionInput) return;

  pollutionInput.value = pollution;
}

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

function setAttributes(element, attributes) {
  Object.keys(attributes).forEach((attr) => {
    element.setAttribute(attr, attributes[attr]);
  });
}

function setWindowFunctions() {
  window.toggleMode = toggleMode;
  window.applyZoom = applyZoom;
  window.updateDisplayFov = updateDisplayFov;
  window.autoPollution = autoPollution;
  window.openMenu = openMenu;
  window.setLoading = setLoading;
  window.closeMenu = closeMenu;
  window.displayDateTime = displayDateTime;
  window.displayGlobe = displayGlobe;
  window.displaySeeingOptions = displaySeeingOptions;
  window.optionSelection = optionSelection;
  window.bortleToMag = bortleToMag;
  window.getMagFromLonLat = getMagFromLonLat;
  window.getUtcOffset = getUtcOffset;
  window.updateTimeZone = updateTimeZone;
  window.updatePollution = updatePollution;
  window.applyLocation = applyLocation;
  window.setSpeed = setSpeed;
  window.applyCurrentDate = applyCurrentDate;
  window.unwrapAngle = unwrapAngle;
  window.setAttributes = setAttributes;
}

function addMenuElement() {
  // const element = document.getElementById('startContainer');
  const menuElement = document.getElementById("menuContainer");
  createMenuElement(menuElement);
  // element.after(menuElement);
  const pollutionInput = document.getElementById("pollutionSlider");
  window.pollutionInput = pollutionInput;
  window.menu = menuElement;
  window.interactionSection = document.getElementById("interactionSection");
  window.menuLoadingElement = document.getElementById("menuLoadingScreen");
  setStellariumOptionButtons();
}

function setStellariumOptionButtons() {
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
}

/**************************  CÓDIGO  *************************************/

window.MIN_FOV = 0.000005;
window.MAX_FOV = 3.228859;
window.FOV_STEP = 0.000001;
window.logFov = Math.log(MAX_FOV);
window.current_fov = 3;

window.currentBlur = 5;

window.engine = null;
window.bortle = null;

window.currentTZ = -4;
window.engineUTC = null;
window.pollution = 9;

window.modes = {
  simple: true,
  advanced: false,
};

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

let blurSlider;
let mainLoadingScreenElement = null;
let modeTextElement;
let modeButtonElement;

async function main() {
  await loadScentialScripts();

  mainLoadingScreenElement = document.getElementById("mainLoadingScreen");

  // Esperar carga del DOM
  document.addEventListener("DOMContentLoaded", () => {
    // console.log("DOM is ready!");

    addMenuElement();

    modeButtonElement = document.getElementById("modeButton");
    modeTextElement = document.getElementById("modeText");
    modeButtonElement.classList.toggle("simple-mode-image");
    modeTextElement.textContent = "Avanzado";

    setupSliderListeners();
    initSimpleMode();
    setWindowFunctions();
    setLoading(false);
  });
}

main();
