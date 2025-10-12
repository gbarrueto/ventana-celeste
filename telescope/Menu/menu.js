import { addPollutionSliderEvent } from "../utils/events.js";

let listenerLoaded = false;

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
