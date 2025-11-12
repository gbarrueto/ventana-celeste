import { eventManager } from "../../utils/eventManager.js";

let seeingLoaded = false;

export function displaySeeingOptions(e) {
  if (optionSelection(e)) return;

  if (!seeingLoaded) {
    setLoading(true);
    let sliderAttr = {
      type: "range",
      min: 0,
      max: 100,
      value: 0,
      step: 1,
      class: "slider h-slider",
    };
    let slider = document.createElement("input");
    setAttributes(slider, sliderAttr);
    slider.addEventListener("input", (e) =>
      sendSeeingValue({ target: "disturbance", value: e.target.value })
    );
    const label = document.createElement("label");
    label.textContent = "Intensidad turbulencia";
    const container = document.createElement("div");
    container.id = "Perturbacion Atmosferica";
    container.insertAdjacentElement("beforeend", label);
    container.insertAdjacentElement("beforeend", slider);
    const sectionEl = document.createElement("section");
    sectionEl.id = "seeingOptionSection";
    sectionEl.classList.add("active");
    sectionEl.insertAdjacentElement("beforeend", container);
    interactionSection.insertAdjacentElement("beforeend", sectionEl);
    seeingLoaded = true;
    setLoading(false);
  } else {
    let seeingOptionSection = document.getElementById("seeingOptionSection");
    seeingOptionSection.classList.add("active");
  }
}

export function sendSeeingValue({ target, value }) {
  try {
    eventManager.sendThrottledProtobject(
      { msg: "seeingOption", values: { target, value } },
      "index.html",
      SEEING_THROTTLE_MS
    );
  } catch (e) {
    Protobject.Core.send({ msg: "seeingOption", values: { target, value } }).to(
      "index.html"
    );
  }
}
