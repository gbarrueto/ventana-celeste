import { sendSeeingValue } from "../Menu/Seeing/seeing.js";

let oldFov = 3;
let blurTarget = 5;

export function updateDisplayFov() {
  const fov = Math.exp(logFov);

  if (oldFov !== fov) {
    Protobject.Core.send({ msg: "updateFov", values: { fov: fov } }).to(
      "index.html"
    );
    // console.log("Sent fov:", fov);
  }
  oldFov = fov;

  // Aplicar desenfoque
  const zoomLevel =
    (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const blurVariation = 1 + zoomLevel * 4;

  blurTarget = 5 + (Math.random() - 0.5) * blurVariation;
  blurTarget = Math.max(0, Math.min(10, blurTarget));

  // Desenfoque desactivado momentaneamente

  //updateDisplayBlur();
}

export function updateDisplayBlur() {
  const diff = Math.abs(currentBlur - blurTarget);

  // Simula la sensibilidad del desenfoque según el nivel de zoom
  const zoomLevel =
    (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const sensitivity = 0.3 + zoomLevel * 2.0;

  // Simula el desenfoque como una función no lineal del error de enfoque
  const blurIntensity = Math.pow(diff * sensitivity, 1.5);

  // Limita el desenfoque a un rango razonable (0 a 100)
  const blurEffect = Math.min(blurIntensity, 100);

  sendSeeingValue({ target: "focus", value: blurEffect })
}
