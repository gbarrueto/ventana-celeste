
blurSlider.addEventListener('input', () => {
    currentBlur = parseFloat(blurSlider.value);

    updateDisplayBlur();
}); 
