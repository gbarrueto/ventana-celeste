let oldFov = 3;
let blurTarget = 5;

import { eventManager } from "./eventManager.js";

export function updateDisplayFov() {
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

  eventManager.sendThrottledProtobject(
    { msg: "updateBlur", values: { blur: blurEffect } },
    "index.html",
    BLUR_SEND_MS
  );
}
