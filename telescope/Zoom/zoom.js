
function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(proportion, event) {
  const button = document.querySelector(
    '#lensContainer .active'
  );

  if (button) {
    button.classList.toggle('active')
  }

  event.target.classList.toggle('active');
  
  logFov = Math.log(MAX_FOV / proportion);

  updateDisplayFov();
}
