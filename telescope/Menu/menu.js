import { addPollutionSliderEvent } from "../utils/events.js";
import { pauseCesium } from "./Location/globe.js";

let listenerLoaded = false;

export function createMenuElement(menuElement) {
  const content = `
    <section class="header">
      <button class="image-button close-image" onclick="closeMenu()"></button>
      <div class="header-container">
        <!-- <button class="button" onclick="displayMap(event)">
          <p>Mapa</p>
          <i class="fa fa-caret-down" aria-hidden="true"></i>
        </button> -->
        <button class="button" onclick="displayGlobe(event)">
          <p>Globo</p>
          <i class="fa fa-caret-down" aria-hidden="true"></i>
        </button>
        <button class="button" onclick="displayDateTime(event)">
          <p>Fecha y Tiempo</p>
          <i class="fa fa-caret-down" aria-hidden="true"></i>
        </button>
        <!-- <button id="viewControlsButton" class="button" onclick="displaySeeingOptions(event)">
          <p>Vista</p>
          <i class="fa fa-caret-down" aria-hidden="true"></i>
        </button> -->
      </div>
    </section>
  
    <!-- Option Interaction -->
    <section id="menuInteractionSection">
      <section id="mainMenuSection" class="grid-container active">
        <!-- Stellarium Options -->
        <div id="stellariumOptionsContainer" class="grid-container">
          <button name="constellations" class="image-button stel-button">
            <div class="image-button constellations-image"></div>
            <p>Constelaciones</p>
          </button>
          <button name="atmosphere" class="image-button stel-button active">
            <div class="image-button atmosphere-image"></div>
            <p>Atmosfera</p>
          </button>
          <button name="landscape" class="image-button stel-button active">
            <div class="image-button landscape-image"></div>
            <p>Terreno</p>
          </button>
          <button name="azimuthal" class="image-button stel-button">
            <div class="image-button azimuthal-image"></div>
            <p>Azimuthal</p>
          </button>
          <button name="equatorial" class="image-button stel-button">
            <div class="image-button equatorial-image"></div>
            <p>Equatorial</p>
          </button>
          <button name="dss" class="image-button stel-button">
            <div class="image-button nebulae-image"></div>
            <p>Nebulosa</p>
          </button>
        </div>
  
        <!-- Pollution -->
        <div id="pollutionSection" class="container">
          <p>Contaminacion Luminica</p>
          <div style="display: flex; justify-content: center">
            <input
              id="autoPollutionCheckbox"
              type="checkbox"
              onclick="autoPollution()"
            />
            <p>Automatica</p>
          </div>
          <div class="slider-container">
            <input
              id="pollutionSlider"
              class="slider h-slider"
              type="range"
              min="1"
              max="9"
              value="9"
            />
          </div>
        </div>
      </section>

      <section id="interactionSection">
        <!-- Mapa -->
        <!-- <div id="map" class="tab"></div> -->
  
        <!-- Globo (Cesium) -->
        <div id="cesiumContainer" class="tab"></div>
      </section>
    </section>
  `

  menuElement.insertAdjacentHTML('beforeend', content);

  // return menuElement;
}

export function openMenu() {
  menu.classList.add("active");
  if (!listenerLoaded) {
    setLoading(true);
    addPollutionSliderEvent(pollutionInput);
    setLoading(false);
  }
}

export function closeMenu() {
  menu.classList.remove("active");
}

export function optionSelection(e) {
  const activeButton = document.querySelector(
    "#menuContainer .header-container .active"
  );
  const activeInteraction = document.querySelector(
    "#interactionSection > .active"
  );

  if (activeInteraction && activeInteraction.id === "cesiumContainer") {
    // Si estábamos en el globo y salimos, pausamos Cesium
    pauseCesium();
  }

  if (activeButton && activeButton !== e.currentTarget) {
    activeButton.classList.toggle("active");
  }

  e.currentTarget.classList.toggle("active");

  if (activeInteraction) {
    activeInteraction.classList.remove("active");
    activeInteraction.classList.add("exit");
    activeInteraction.addEventListener(
      "transitionend",
      () => {
        activeInteraction.classList.remove("exit");
      },
      { once: true }
    );
  }

  if (engineUTC !== null) {
    Protobject.Core.send({
      msg: "setDatetimeInterval",
      values: { active: false },
    }).to("index.html");
    engineUTC = null;
  }

  if (activeButton === e.currentTarget) {
    interactionSection.style.opacity = 0;
    interactionSection.style.pointerEvents = "none";
    e.currentTarget.style.transform = "translateY(0)";
    return 1;
  } else {
    interactionSection.style.opacity = 1;
    interactionSection.style.pointerEvents = "auto";
    return 0;
  }
}

export function displayMainMenu(e) {
  optionSelection(e);

  let mainMenuSection = document.getElementById("mainMenuSection");

  if (!mainMenuSection) {
    let section = `
      <section id="mainMenuSection" class="active" style="display: grid">
        <input 
          type="range"
          min=1
          max=9
          value=${pollution}>
      </section>
    `;

    menuInteractionSection.insertAdjacentHTML("beforeend", section);
    return;
  }

  mainMenuSection.style.display = "grid";
  mainMenuSection.classList.add("active");
}
