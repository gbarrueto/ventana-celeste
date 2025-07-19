
const slider = document.getElementById('zoomSlider');
const value = document.getElementById('sliderValue');

value.innerHTML = slider.value;

slider.addEventListener('input', () => {
  value.innerHTML = slider.value;
}); 
