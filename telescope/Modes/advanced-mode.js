import initializeStelEngine from "../../util/initStel.js";
import { removeEvent } from "../utils/events.js";

export async function initAdvancedMode() {
  // Lazily load heavy dependencies only when needed
  // const { lazyLoader } = await import('../utils/lazyLoad.js');
  
  // Load Cesium only for advanced mode
  // await lazyLoader.loadCdnScript('Cesium', 'https://cesium.com/.../Cesium.js');
  
  // Load menu systems
  // await Promise.all([
  //   import('../Menu/DateTime/datetime.js'),
  //   import('../Menu/Location/globe.js'),
  //   import('../Menu/Seeing/seeing.js')
  // ]);
  
  // Show advanced UI
  let advancedModeElement = document.getElementById('advancedMode');
  let simpleModeElement = document.getElementById('simpleMode');
  removeEvent({
    element: document.getElementById('zoomSlider'),
    elementStr: 'zoomSlider-input',
    eventType: 'input'
  });
  simpleModeElement.style.visible = 'hidden';
  advancedModeElement.style.display = 'grid';
  advancedModeElement.classList.add('active');
  simpleModeElement.classList.remove('active');
  initializeStelEngine(true);
  
  // Initialize advanced mode UI
  // const { createMenuElement } = await import('../Menu/menu.js');
  // createMenuElement(document.getElementById('menuContainer'));
}