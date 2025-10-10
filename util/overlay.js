function updateStellariumBlur({ blur }) {
  const canvas_blur = document.getElementById("stel-canvas");
  canvas_blur.style.filter = `blur(${blur}px)`;
}

// function updatePollutionOverlay({ bortle }) {
// const pollutionOverlay = document.getElementById("pollution-overlay");
// if (!pollutionOverlay) return;
//
// pollutionOverlay.style.opacity = 0.1 * bortle;
//
//
// pollutionOverlay.style.background = `radial-gradient(ellipse 100% 50% at bottom,
//   rgba(255,200,100,${0.02 + 0.06 * (bortle - 1)}) 0%,
//   rgba(255,150,50,${0.015 + 0.045 * (bortle - 1)}) 20%,
//   rgba(200,100,50,${0.01 + 0.015 * (bortle - 1)}) 50%,
//   rgba(100,50,25,${0.0 + 0.0035 * (bortle - 1)}) 65%,
//   rgba(100,50,25,${0.0 + 0.001 * (bortle - 1)}) 80%,
//   rgba(0,0,0,0.0) 100%)`;
// }

function enableFinderOverlay() {
  const overlay = document.getElementById("finder-overlay");
  if (overlay) {
    overlay.style.opacity = 1;
  }
}

function disableFinderOverlay() {
  const overlay = document.getElementById("finder-overlay");
  if (overlay) {
    overlay.style.opacity = 0;
  }
}

function toggleEyepieceOverlay({ signal }) {
  signal ? disableFinderOverlay() : enableFinderOverlay();
}
