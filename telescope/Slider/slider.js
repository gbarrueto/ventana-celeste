
// const slider = document.getElementById('zoomSlider');
// const value = document.getElementById('sliderValue');

sliderValue.textContent = Math.exp(slider.value).toFixed(6);

slider.addEventListener('input', () => {
  // value.innerHTML = slider.value;
  // e.preventDefault();
  // if (e.touches.length === 1 && lastY !== null) {
  //   const currentY = e.touches[0].clientY;
  //   const deltaY = currentY - lastY;
    // logFov += deltaY * sensitivity * 0.01;
    // logFov = slider.value;
    // logFov = Math.max(minLogFov, Math.min(maxLogFov, logFov));
    logFov = parseFloat(slider.value);
    updateDisplayFov();
    // lastY = currentY;
  // }
  // logFov = slider.value;
  // updateDisplayFov();
}); 
