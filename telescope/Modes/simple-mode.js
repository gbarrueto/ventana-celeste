import { enableViewButton } from "../Menu/menu.js";
import { fovToSlider } from "../Slider/slider.js";
import { addZoomSliderEvent } from "../utils/events.js";
import { removeEvent } from "../utils/events.js";
import { removeAdvancedMode } from "./advanced-mode.js";

let simpleModeInitialized = false;

export async function initSimpleMode() {
  removeAdvancedMode();
  enableViewButton(false);
  let simpleModeElement = document.getElementById('simpleMode');
  let advancedModeElement = document.getElementById('advancedMode');
  simpleModeElement.classList.add('active');
  advancedModeElement.classList.remove('active');
  
  addZoomSliderEvent(document.getElementById('zoomSlider'));
  Protobject.Core.send({
    msg: "requestSynchronizeSimpleZoom",
    values: {},
  }).to("index.html");

  simpleModeInitialized = true;
}

export async function removeSimpleMode() {
  if (!simpleModeInitialized) return;
  removeEvent({
    element: document.getElementById('zoomSlider'),
    elementStr: 'zoomSlider-input',
    eventType: 'input'
  });

  let simpleModeElement = document.getElementById('simpleMode');
  simpleModeElement.classList.remove('active');

  simpleModeInitialized = false;
}

export function setSynchronizedSimpleZoom(values) {
  const { data } = values;
  let slider = document.getElementById('zoomSlider');
  if (!slider) {
    console.log('Slider not loaded, leaving...');
    return;
  }
  const newFov = fovToSlider(data.fov);
  slider.value = newFov;
}
