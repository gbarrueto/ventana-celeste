const simpleModeContent = `
  <div id="simpleMode" class="container">
    <p>Zoom</p>

    <div class="slider-container">
      <input 
      id="zoomSlider"
      class="slider v-slider"
      type="range" 
      min="${MIN_FOV}" max="${MAX_FOV}" value="${current_fov}" step="${FOV_STEP}"
      orient="vertical">
    </div>
  </div>
`
