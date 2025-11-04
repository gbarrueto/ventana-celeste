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

  const zoomLevel =
    (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const sensitivity = 0.4 + zoomLevel * 1.6;

  const blurEffect = Math.min(diff * sensitivity, 1) * 10;

  //blurSlider.value = currentBlur;
  // blurText.textContent = currentBlur;

  Protobject.Core.send({ msg: "updateBlur", values: { blur: blurEffect } }).to(
    "index.html"
  );
}
