import { sendSeeingValue } from "../Menu/Seeing/seeing.js";

import { eventManager } from "./eventManager.js";

let oldFov = 3;
let blurTarget = 0;
let blurTargets = {
  "": 0,
  len1: 2,
  len2: 4,
  len3: 6,
  len4: 8,
};

export function updateDisplayFov(len = "") {
  const fov = Math.exp(logFov);

  if (oldFov !== fov) {
    // Protobject.Core.send({ msg: "updateFov", values: { fov } }).to("index.html");

    eventManager.sendThrottledProtobject(
      { msg: "updateFov", values: { fov } },
      "index.html",
      FOV_SEND_MS
    );
  }
  oldFov = fov;

  // Aplicar desenfoque solo en modo avanzado
  if (modes.advanced == true) {
    blurTarget = blurTargets[len];
    updateDisplayBlur();

    // Actualizar intensidad maxima de turbulencia. Menor distancia focal -> Mayor turbulencia
    // Rango de turbulencia: 1 a 10
    // Esperado: un poco mayor a fov Luna (0.05 RAD) -> min turbulence (1)
    // Esperado: fov muy pequeño (0.005 rad) -> max turbulence (10)

    const minFov = 0.005; // Radianes
    const maxFov = 0.05; // Radianes

    let maxTurbulence =
      ((maxFov - Math.min(Math.max(fov, minFov), maxFov)) / (maxFov - minFov)) * 9 + 1;

    console.log("Sending Max Turbulence:", maxTurbulence.toFixed(1));
    // esperar un poco antes de enviar este valor para evitar saturar el canal
    setTimeout(() => {
      sendSeeingValue({ target: "turbulenceMax", value: maxTurbulence.toFixed(1) });
    }, 100);

    // enviar un valor de turbulencia de un 20% del maximo
    const turbulenceValue = (maxTurbulence * 20) / 100;
    setTimeout(() => {
      sendSeeingValue({ target: "turbulence", value: turbulenceValue.toFixed(1) });
    }, 200);

  }
}

export function updateDisplayBlur() {
  const diff = Math.abs(currentBlur - blurTarget);

  // Simula la sensibilidad del desenfoque según el nivel de zoom
  const zoomLevel =
    (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const sensitivity = 0.4 + zoomLevel * 2.0;

  // Simula el desenfoque como una función no lineal del error de enfoque
  const blurIntensity = Math.pow(diff * sensitivity, 1.5);

  // Limita el desenfoque a un rango razonable (0 a 100)
  const blurEffect = Math.min(blurIntensity, 100);

  //   eventManager.sendThrottledProtobject(
  //     { msg: "updateBlur", values: { blur: blurEffect } },
  //     "index.html",
  //     BLUR_SEND_MS
  //   );
  sendSeeingValue({ target: "focus", value: blurEffect }); // hay que implementar throttle a esta request
}
