import { removeStelEngine } from "../../util/initStel.js";
import { addZoomSliderEvent } from "../utils/events.js";

export async function initSimpleMode() {
  // Load only what's needed for simple mode
  // const { addZoomSliderEvent } = await import('../utils/events.js');
  // const { updateDisplayFov } = await import('../utils/updateDisplay.js');
  
  // Hide advanced features
  // document.getElementById('advancedMode').style.display = 'none';
  removeStelEngine();
  let simpleModeElement = document.getElementById('simpleMode');
  let advancedModeElement = document.getElementById('advancedMode');
  advancedModeElement.style.visible = 'hidden';
  simpleModeElement.style.display = 'block';
  simpleModeElement.classList.add('active');
  advancedModeElement.classList.remove('active');

  
  // Setup only simple slider
  addZoomSliderEvent(document.getElementById('zoomSlider'));
}