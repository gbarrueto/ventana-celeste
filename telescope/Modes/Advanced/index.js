const advancedModeContent = `
  <div id="advancedMode" class="grid-container">
    <section id="viewModeContainer" class="container">

      <div id="stel">
        <canvas id="stel-canvas"></canvas>
        <div id="info-card"></div> <!-- no creo que sirva pero lo dejo ya que no estoy seguro -->
        <div id="pollution-overlay"></div> <!-- no creo que sirva pero parece que busca este elemento -->
      </div>


    </section>

    <section class="container">
      <!--  <p>Oculares</p>
      <p class="alert-text" style="opacity: 1;"><i>Desactivado en modo guia</i></p> -->
      <div id="lensContainer" class="grid-container">
        <button class="button" onclick="applyZoom(40, event)">len 1</button>
        <button class="button" onclick="applyZoom(24, event)">len 2</button>
        <button class="button" onclick="applyZoom(10, event)">len 3</button>
        <button class="button" onclick="applyZoom(2, event)">len 4</button>
      </div>
    </section>

    <section class="container">
      <p>Enfocador</p>

      <div class="slider-container">
        <input 
          id="focusSlider"
          class="slider h-slider"
          type="range" 
          min="${0}" max="${10}" value="${5}" step="${0.001}">
        </input>
      </div>
    </section>
  </div>
`

export default advancedModeContent;
