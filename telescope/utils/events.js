import { applyPollution } from "../../util/location.js";
import { sliderToFov } from "../Slider/slider.js";
import { eventManager } from "./eventManager.js";

// --- Funciones de Lógica Pura ---
// (Estas funciones no cambian, solo definen QUÉ hacer)

function BlurSliderFunction(element) {
  // Asumo que 'currentBlur' y 'updateDisplayBlur' están definidos
  // en un alcance superior o global.
  currentBlur = parseFloat(element.value);
  updateDisplayBlur();
}

function ZoomSliderFunction(element) {
  // Asumo que 'current_fov', 'logFov' y 'updateDisplayFov'
  // están definidos en un alcance superior.
  const sliderValue = parseFloat(element.value);
  current_fov = sliderToFov(sliderValue);
  logFov = Math.log(current_fov);
  updateDisplayFov();
}

function PollutionSliderFunction(element) {
  // Asumo que 'pollution' y 'bortleToMag' están definidos
  // en un alcance superior.
  pollution = element.value;
  const skyMag = bortleToMag(parseInt(pollution));

  // To guidescope
  applyPollution({ mag: skyMag });
  // To telescope (throttled via eventManager)
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

// --- Configuración y Limpieza de Eventos ---
// (Exportamos solo las funciones que controlan el setup y cleanup)

/**
 * Adjunta todos los listeners de los sliders usando el eventManager
 * para aplicar debounce y optimizar el rendimiento.
 */
export function setupSliderListeners() {
  eventManager.on(
    "#zoomSlider",
    "input",
    (e) => ZoomSliderFunction(e.target),
    { debounce: 50 } // Espera 50ms después de que el usuario deja de ajustar
  );

  eventManager.on(
    "#focusSlider", // Este ID debe corresponder al slider de blur
    "input",
    (e) => BlurSliderFunction(e.target),
    { debounce: 100 }
  );

  eventManager.on(
    "#pollutionSlider",
    "input",
    (e) => PollutionSliderFunction(e.target),
    { debounce: 200 }
  );
}

/**
 * Limpia todos los listeners de los sliders que fueron
 * adjuntados por el eventManager.
 */
export function cleanupSliderListeners() {
  eventManager.off("#zoomSlider", "input");
  eventManager.off("#focusSlider", "input");
  eventManager.off("#pollutionSlider", "input");
}
