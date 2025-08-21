const simpleModeContent = `
  <div id="simpleMode" class="container no-display">
    <p>Zoom</p>

    <input 
    id="zoomSlider"
    class="slider v-slider"
    type="range" 
    min="${MIN_FOV}" max="${MAX_FOV}" value="${current_fov}" step="${FOV_STEP}"
    orient="vertical">
  </div>
`
