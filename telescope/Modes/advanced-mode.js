import { initializeStelEngine, removeStelEngine } from "../../util/initStel.js";
import { enableViewButton } from "../Menu/menu.js";
import { addBlurSliderEvent, removeEvent } from "../utils/events.js";
import { removeSimpleMode } from "./simple-mode.js";

let advancedModeInitialized = false;

export async function initAdvancedMode() {
  removeSimpleMode();
  enableViewButton(true);
  let advancedModeElement = document.getElementById('advancedMode');
  let simpleModeElement = document.getElementById('simpleMode');
  advancedModeElement.classList.add('active');
  simpleModeElement.classList.remove('active');
  initializeStelEngine(true);
  addBlurSliderEvent(document.getElementById('focusSlider'));

  advancedModeInitialized = true;
}

export async function removeAdvancedMode() {
  if (!advancedModeInitialized) return;
  removeStelEngine();
  removeEvent({
    element: document.getElementById('focusSlider'),
    elementStr: 'focusSlider-input',
    eventType: 'input'
  });

  advancedModeInitialized = true;
}