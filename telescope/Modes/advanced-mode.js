import { initializeStelEngine, removeStelEngine } from "../../util/initStel.js";
import { enableViewButton } from "../Menu/menu.js";
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

  advancedModeInitialized = true;
}

export async function removeAdvancedMode() {
  if (!advancedModeInitialized) return;
  removeStelEngine();

  advancedModeInitialized = true;
}