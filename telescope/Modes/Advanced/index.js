const advancedModeContent = `
  <div id="advancedMode" class="grid-container no-display">
    <section id="viewModeContainer" class="container">
      <button class="button" onclick="toggleEyepieceOverlay(true, event)">Telescopio</button>
      <button class="button active" onclick="toggleEyepieceOverlay(false, event)">Guia</button>
    </section>

    <section class="container">
      <p>Oculares</p>
      <div id="lensContainer" class="grid-container">
        <button class="button active" onclick="applyZoom(4, event)">x1</button>
        <button class="button" onclick="applyZoom(32, event)">x16</button>
        <button class="button" onclick="applyZoom(256, event)">x64</button>
        <button class="button" onclick="applyZoom(2028, event)">x512</button>
      </div>
    </section>

    <section class="container">
      <p>Enfocador</p>
      <input 
        id="focusSlider"
        class="slider h-slider"
        type="range" 
        min="${MIN_FOCUS}" max="${MAX_FOCUS}" value="${current_focus}" step="${FOCUS_STEP}">
      </input>
    </section>
  </div>
`
