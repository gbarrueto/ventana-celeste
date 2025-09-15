
function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(selected_eyepiece_fl, event) {
  const button = document.querySelector(
    '#lensContainer .active'
  );

  if (button) {
    button.classList.toggle('active')
  }

  event.target.classList.toggle('active');
  
  EYEPIECE_FL = selected_eyepiece_fl;

  // Calcular nuevo FOV

  const m = FOCAL_LENGTH / EYEPIECE_FL; // Magnification
  const proyection_const = 100; // Ni idea de porqué es 100, pero asi funciona
  
  // new_fov es fov de stellarium, no fov aparente del ocular
  
  let new_fov = (proyection_const / m)
  // Convertir a radianes
  new_fov = new_fov * Math.PI / 180;
  
  logFov = new_fov;
  updateDisplayFov();
}
