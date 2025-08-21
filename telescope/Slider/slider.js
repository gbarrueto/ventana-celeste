
blurSlider.addEventListener('input', () => {
    currentBlur = parseFloat(blurSlider.value);

    updateDisplayBlur();
}); 


zoomSlider.addEventListener('input', () => {
    current_fov = parseFloat(zoomSlider.value);

    logFov = Math.log(zoomSlider.value);

    updateDisplayFov();
}); 

