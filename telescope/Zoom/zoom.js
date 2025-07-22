
function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(proportion) {
  logFov = Math.log(MAX_FOV / proportion);

  updateDisplayFov();
}
