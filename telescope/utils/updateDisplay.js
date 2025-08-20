
function updateDisplayFov() {
  const fov = Math.exp(logFov);
  
  if (oldFov !== fov) {
    Protobject.Core.send({ f: fov }).to("index.html");
  }
  oldFov = fov;

  // Aplicar desenfoque
  const zoomLevel = (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const blurVariation = 1 + zoomLevel * 4;

  blurTarget = 5 + (Math.random() - 0.5) * blurVariation;
  blurTarget = Math.max(0, Math.min(10, blurTarget));

  updateDisplayBlur();
}


function updateDisplayBlur() {
  const diff = Math.abs(currentBlur - blurTarget);

  const zoomLevel = (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
  const sensitivity = 0.4 + zoomLevel * 1.6;

  const blurEffect = Math.min(diff * sensitivity, 1) * 10;

  blurSlider.value = currentBlur;
  // blurText.textContent = currentBlur;
  
  Protobject.Core.send({ blur: blurEffect }).to("index.html");
}

function toggleEyepieceOverlay(eyepieceSignal) {
  Protobject.Core.send({ eyepieceSignal }).to("index.html");
}