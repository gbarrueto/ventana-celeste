
function updateDisplayFov() {
  const fov = Math.exp(logFov);
  fovDisplay.textContent = `FOV: ${fov.toFixed(6)}`;
  sliderValue.textContent = fov.toFixed(6);
  slider.value = logFov;
  

  if (oldFov !== fov) {
    Protobject.Core.send({ f: fov }).to("index.html");
  }
  oldFov = fov;
}