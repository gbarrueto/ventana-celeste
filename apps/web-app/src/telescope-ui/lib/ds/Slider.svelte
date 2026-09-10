<script>
  let {
    value, min = 0, max = 100, step = 1, oninput = null, onChange = null, disabled = false,
    label = null, valueText = null, minLabel = null, maxLabel = null, accent = null,
    thumbSize = 24, style = '', ...rest
  } = $props();

  const id = 'sl-' + Math.random().toString(36).slice(2, 9);
  let pct = $derived(((value - min) / (max - min)) * 100);
  let fill = $derived(accent || 'var(--digitale)');

  // El pulgar recorre la pista descontando su propio ancho, igual que hace el
  // navegador con el de un <input type=range>. Sin ese descuento el pulgar
  // dibujado sobresale media anchura por cada extremo — se monta sobre las
  // etiquetas y sobre el borde de la tarjeta — y además queda desplazado
  // respecto del pulgar nativo que de verdad sigue al dedo.
  let thumbLeft = $derived(`calc(${pct}% - ${(pct * thumbSize) / 100}px)`);
  let fillWidth = $derived(`calc(${pct}% - ${(pct * thumbSize) / 100}px + ${thumbSize / 2}px)`);

  function handle(e) {
    const v = parseFloat(e.currentTarget.value);
    onChange?.(v);
    oninput?.(e);
  }
</script>

<div
  class="vc-slider"
  style="--thumb:{thumbSize}px;opacity:{disabled ? 0.25 : 1};pointer-events:{disabled ? 'none' : 'auto'};{style}"
  {...rest}
>
  {#if label || valueText}
    <div class="vc-slider-head">
      {#if label}<label for={id} class="vc-slider-label">{label}</label>{/if}
      {#if valueText}<span class="vc-slider-value" style="color:{fill}">{valueText}</span>{/if}
    </div>
  {/if}

  <!-- La caja es al menos 36px de alto aunque el pulgar sea menor: el círculo se
       encogió para no chocar con el texto, pero el área que recibe el dedo no. -->
  <div class="vc-slider-track-wrap" style="height:max({thumbSize}px, 36px)">
    <div class="vc-slider-track"></div>
    <div class="vc-slider-fill" style="width:{fillWidth};background:{fill}"></div>
    <div
      aria-hidden="true"
      class="vc-slider-thumb"
      style="left:{thumbLeft};width:{thumbSize}px;height:{thumbSize}px"
    ></div>
    <input
      {id} type="range" {min} {max} {step} {value} {disabled}
      aria-valuetext={valueText || undefined}
      oninput={handle}
      class="vc-slider-input"
      style="height:max({thumbSize}px, 36px)"
    />
  </div>

  {#if minLabel || maxLabel}
    <div class="vc-slider-ends">
      <span>{minLabel}</span><span>{maxLabel}</span>
    </div>
  {/if}
</div>

<style>
  .vc-slider {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    transition: opacity var(--dur-medium);
  }
  .vc-slider-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-12);
  }
  .vc-slider-label {
    font: var(--type-label);
    color: var(--text-muted);
  }
  .vc-slider-value {
    font-family: var(--font-mono);
    font-size: var(--text-13);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .vc-slider-track-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .vc-slider-track {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: var(--radius-track);
    background: var(--track-slider);
  }
  .vc-slider-fill {
    position: absolute;
    left: 0;
    height: 4px;
    border-radius: var(--radius-track);
  }
  .vc-slider-thumb {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    border-radius: var(--radius-round);
    background: var(--thumb-slider);
    box-shadow: var(--shadow-thumb-lit);
  }
  .vc-slider-ends {
    display: flex;
    justify-content: space-between;
    gap: var(--space-12);
    font: var(--type-body-sm);
    color: var(--text-faint);
  }
  .vc-slider-input {
    position: relative;
    width: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  /* Invisible, pero el navegador calcula el recorrido con el ancho de SU pulgar.
     Dárselo igual que al dibujado es lo que hace que el dedo y el círculo
     blanco coincidan en toda la pista y no sólo en el centro. */
  .vc-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border: none;
    border-radius: var(--radius-round);
    background: transparent;
  }
  .vc-slider-input::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: none;
    border-radius: var(--radius-round);
    background: transparent;
  }
</style>
