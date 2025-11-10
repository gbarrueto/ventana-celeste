import { enableViewButton } from "../Menu/menu.js";
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