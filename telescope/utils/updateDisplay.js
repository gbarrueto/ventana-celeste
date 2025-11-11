import { sendSeeingValue } from "../Menu/Seeing/seeing.js";

let oldFov = 3;
let blurTarget = 0;
let blurTargets = {
  '': 0,
  'len1': 2,
  'len2': 4,
  'len3': 6,
  'len4': 8,
};

export function updateDisplayFov(len='') {
  const fov = Math.exp(logFov);

  if (oldFov !== fov) {
    Protobject.Core.send({ msg: "updateFov", values: { fov: fov } }).to(
      "index.html"
    );
    // console.log("Sent fov:", fov);
  }
  oldFov = fov;

  // Aplicar desenfoque solo en modo avanzado
  if (modes.advanced == true) {
    blurTarget = blurTargets[len];
    updateDisplayBlur();
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

  sendSeeingValue({ target: "focus", value: blurEffect })
}
