<script>
  let {
    value, min = 0, max = 150, step = 0.01, oninput = null, onChange = null,
    topLabel = null, bottomLabel = null, valueText = null, thumbSize = 36, style = '', ...rest
  } = $props();

  const id = 'vsl-' + Math.random().toString(36).slice(2, 9);
  let pct = $derived(((value - min) / (max - min)) * 100);

  let thumbBottom = $derived(`calc(${pct}% - ${(pct * thumbSize) / 100}px)`);
  let fillHeight = $derived(`calc(${pct}% - ${(pct * thumbSize) / 100}px + ${thumbSize / 2}px)`);

  function handle(e) {
    const v = parseFloat(e.currentTarget.value);
    onChange?.(v);
    oninput?.(e);
  }
</script>

<div class="vc-vslider" style="--thumb:{thumbSize}px;{style}" {...rest}>
  {#if topLabel}<span class="vc-vslider-end">{topLabel}</span>{/if}

  <div class="vc-vslider-track-wrap" style="width:max({thumbSize}px, 44px)">
    <div class="vc-vslider-track"></div>
    <div class="vc-vslider-fill" style="height:{fillHeight}"></div>
    <div
      aria-hidden="true"
      class="vc-vslider-thumb"
      style="bottom:{thumbBottom};width:{thumbSize}px;height:{thumbSize}px"
    >
      <span class="vc-vslider-grip"></span>
    </div>
    <input
      {id} type="range" {min} {max} {step} {value}
      aria-orientation="vertical" aria-valuetext={valueText || undefined}
      oninput={handle}
      class="vc-vslider-input"
    />
  </div>

  {#if valueText}<span class="vc-vslider-value">{valueText}</span>{/if}
  {#if bottomLabel}<span class="vc-vslider-end">{bottomLabel}</span>{/if}
</div>

<style>
  .vc-vslider {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    height: 100%;
  }
  .vc-vslider-end {
    font: var(--type-body-sm);
    color: var(--text-faint);
    text-align: center;
  }
  .vc-vslider-track-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
  }
  .vc-vslider-track {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    border-radius: var(--radius-track);
    background: var(--track-slider);
  }
  .vc-vslider-fill {
    position: absolute;
    bottom: 0;
    width: 6px;
    border-radius: var(--radius-track);
    background: linear-gradient(to top, var(--cielo), var(--digitale));
  }
  .vc-vslider-thumb {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border-radius: var(--radius-round);
    background: var(--thumb-slider);
    box-shadow: var(--shadow-thumb-lit);
    display: grid;
    place-items: center;
  }
  .vc-vslider-grip {
    width: 16px;
    height: 2px;
    background: var(--notte);
    border-radius: 2px;
    opacity: 0.35;
  }
  .vc-vslider-value {
    font-family: var(--font-mono);
    font-size: var(--text-13);
    color: var(--digitale);
    font-variant-numeric: tabular-nums;
  }
  .vc-vslider-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    writing-mode: vertical-rl;
    direction: rtl;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  .vc-vslider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border: none;
    background: transparent;
  }
  .vc-vslider-input::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: none;
    background: transparent;
  }
</style>
