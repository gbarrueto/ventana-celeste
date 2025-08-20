const advancedModeContent = `
  <div id="advancedMode" class="grid-container no-display">
    <section class="container">
      <button class="button">Telescopio</button>
      <button class="button">Guia</button>
    </section>

    <section class="container">
      <p>Oculares</p>
      <div class="grid-container">
        <button class="button">x1</button>
        <button class="button">x16</button>
        <button class="button">x64</button>
        <button class="button">x512</button>
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
