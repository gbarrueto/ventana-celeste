
function updateDisplayFov() {
  const fov = Math.exp(logFov);
  fovDisplay.textContent = `FOV: ${fov.toFixed(6)}`;
  
  if (oldFov !== fov) {
    Protobject.Core.send({ f: fov }).to("index.html");
  }
  oldFov = fov;
}


function updateDisplayBlur() {
  blurSlider.value = currentBlur;
  blurText.textContent = currentBlur;
  
  Protobject.Core.send({ blur: currentBlur }).to("index.html");
}
