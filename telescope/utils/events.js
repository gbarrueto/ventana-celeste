import { applyPollution } from "../../util/location.js";
import { sliderToFov } from "../Slider/slider.js";
import { eventManager } from "./eventManager.js";
import { updateDisplayBlur } from "./updateDisplay.js";

function BlurSliderFunction(element) {
  currentBlur = parseFloat(element.value);
  updateDisplayBlur();
}

function ZoomSliderFunction(element) {
  const sliderValue = parseFloat(element.value);
  current_fov = sliderToFov(sliderValue);
  logFov = Math.log(current_fov);
  updateDisplayFov();
}

function PollutionSliderFunction(element) {
  pollution = element.value;
  const skyMag = bortleToMag(parseInt(pollution));

  applyPollution({ mag: skyMag });

  try {
    eventManager.sendThrottledProtobject(
      { msg: "updatePollution", values: { mag: skyMag } },
      "index.html",
      200
    );
  } catch (e) {
    Protobject.Core.send({
      msg: "updatePollution",
      values: { mag: skyMag },
    }).to("index.html");
  }
}

export function addBlurSliderEvent() {
  // Backwards-compatible wrapper: attach all three sliders if present
  addZoomSliderEvent();
  addBlurSliderEventFocused();
  addPollutionSliderEvent();
}

// Attach zoom slider listener. Accepts an Element or will use '#zoomSlider'
export function addZoomSliderEvent(element) {
  const selector = element && element.id ? `#${element.id}` : "#zoomSlider";
  eventManager.on(selector, "input", (e) => ZoomSliderFunction(e.target), {
    throttle: ZOOM_THROTTLE_MS,
  });
}

// Internal name to avoid clashing with original API name
export function addBlurSliderEventFocused(element) {
  const selector = element && element.id ? `#${element.id}` : "#focusSlider";
  eventManager.on(selector, "input", (e) => BlurSliderFunction(e.target), {
    throttle: 100,
  });
}

export function addPollutionSliderEvent(element) {
  const selector =
    element && element.id ? `#${element.id}` : "#pollutionSlider";
  eventManager.on(selector, "input", (e) => PollutionSliderFunction(e.target), {
    throttle: POLLUTION_THROTTLE_MS,
  });
}

export function cleanupSliderListeners() {
  eventManager.off("#zoomSlider", "input");
  eventManager.off("#focusSlider", "input");
  eventManager.off("#pollutionSlider", "input");
}

// Remove an attached listener. Accepts either an element or a selector string.
export function removeEvent({ element, elementStr, eventType }) {
  let selector = null;
  if (element && element.id) selector = `#${element.id}`;
  else if (elementStr)
    selector = elementStr.startsWith("#") ? elementStr : `#${elementStr}`;

  if (!selector) return;
  eventManager.off(selector, eventType || "input");
}

export function setupSliderListeners() {
  addZoomSliderEvent();
  addBlurSliderEventFocused();
  addPollutionSliderEvent();
}
