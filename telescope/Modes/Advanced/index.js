const advancedModeContent = `
  <div id="advancedMode" class="grid-container no-display">
    <section id="viewModeContainer" class="container">

    <!--
      <button class="button" onclick="toggleEyepieceOverlay(true, event)">Telescopio</button>
      <button class="button active" onclick="toggleEyepieceOverlay(false, event)">Guia</button> -->
      
      
      <!-- agregado como guida-->
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
        <button class="button active" onclick="applyZoom(4, event)">x1</button>
        <button class="button" onclick="applyZoom(32, event)">x16</button>
        <button class="button" onclick="applyZoom(256, event)">x64</button>
        <button class="button" onclick="applyZoom(2028, event)">x512</button>
      </div>
    </section>

    <section class="container">
      <p>Enfocador</p>

      <div class="slider-container">
        <input 
          id="focusSlider"
          class="slider h-slider"
          type="range" 
          min="${MIN_FOCUS}" max="${MAX_FOCUS}" value="${current_focus}" step="${FOCUS_STEP}">
        </input>
      </div>
    </section>
  </div>
`
