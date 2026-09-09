<script>
  let {
    value, min = 0, max = 100, step = 1, oninput = null, onChange = null, disabled = false,
    label = null, valueText = null, minLabel = null, maxLabel = null, accent = null,
    thumbSize = 28, style = '', ...rest
  } = $props();

  const id = 'sl-' + Math.random().toString(36).slice(2, 9);
  let pct = $derived(((value - min) / (max - min)) * 100);
  let fill = $derived(accent || 'var(--digitale)');

  function handle(e) {
    const v = parseFloat(e.currentTarget.value);
    onChange?.(v);
    oninput?.(e);
  }
</script>

<div
  class="vc-slider"
  style="opacity:{disabled ? 0.25 : 1};pointer-events:{disabled ? 'none' : 'auto'};{style}"
  {...rest}
>
  {#if label || valueText}
    <div class="vc-slider-head">
      {#if label}<label for={id} class="vc-slider-label">{label}</label>{/if}
      {#if valueText}<span class="vc-slider-value" style="color:{fill}">{valueText}</span>{/if}
    </div>
  {/if}

  <div class="vc-slider-track-wrap" style="height:{thumbSize}px">
    <div class="vc-slider-track"></div>
    <div class="vc-slider-fill" style="width:{pct}%;background:{fill}"></div>
    <div
      aria-hidden="true"
      class="vc-slider-thumb"
      style="left:calc({pct}% - {thumbSize / 2}px);width:{thumbSize}px;height:{thumbSize}px"
    ></div>
    <input
      {id} type="range" {min} {max} {step} {value} {disabled}
      aria-valuetext={valueText || undefined}
      oninput={handle}
      class="vc-slider-input"
      style="height:{thumbSize}px"
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
    border-radius: var(--radius-round);
    background: var(--thumb-slider);
    box-shadow: var(--shadow-thumb-lit);
  }
  .vc-slider-input {
    position: relative;
    width: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
