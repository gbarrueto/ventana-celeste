import { applyPollution } from "../../util/location.js";
import { sliderToFov } from "../Slider/slider.js";

function BlurSliderFunction(element) {
  currentBlur = parseFloat(element.value);
  updateDisplayBlur();
}
export function addBlurSliderEvent(element) {
  element.addEventListener('input', () => BlurSliderFunction(element)); 
}

function ZoomSliderFunction(element) {
  const sliderValue = parseFloat(element.value);
  current_fov = sliderToFov(sliderValue);
  
  logFov = current_fov;
  
  // console.log("Slider:", sliderValue, "FOV:", current_fov);

  updateDisplayFov();
}
export function addZoomSliderEvent(element) {
  element.addEventListener('input', () => ZoomSliderFunction(element));
}

function PollutionSliderFunction(element) {
  // Bortle index 1-9
  pollution = element.value;
  
  const skyMag = bortleToMag(parseInt(pollution));

  // To guidescope
  applyPollution({ mag: skyMag });
  // To telescope
  Protobject.Core.send({ msg: "updatePollution", values: { mag: skyMag } }).to("index.html");
}
export function addPollutionSliderEvent(element) {
  element.addEventListener("input", () => PollutionSliderFunction(element));
}


const eventsMap = {
  /* "element-eventType": function */
  "blurSlider-input": BlurSliderFunction,
  "zoomSlider-input": ZoomSliderFunction,
  "pollutionSlider-input": PollutionSliderFunction
}

export function removeEvent({ element, elementStr, eventType }) {
  element.removeEventListener(eventType, () => eventsMap[`${elementStr}-${eventType}`](element));
}

