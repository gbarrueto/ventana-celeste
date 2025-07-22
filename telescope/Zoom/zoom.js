
function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(proportion) {
  zoomOptions.classList.toggle('visible');
  
  logFov = Math.log(MAX_FOV / proportion);

  updateDisplayFov();
}
