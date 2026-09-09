<script>
  let { icon = null, label, hint = null, active = false, onclick, style = '', ...rest } = $props();
  let pressed = $state(false);
</script>

<button
  type="button"
  role="switch"
  aria-checked={active}
  class="vc-tile"
  
  style="background:{active ? 'var(--surface-card)' : 'var(--azul-fill)'};border:1px solid {active ? 'var(--border-selected)' : 'var(--border-hairline)'};color:{active ? 'var(--azul-text)' : 'var(--text-muted)'};transform:{pressed ? 'scale(var(--press-scale-firm))' : 'none'};{style}"
  onpointerdown={() => (pressed = true)}
  onpointerup={() => (pressed = false)}
  onpointerleave={() => (pressed = false)}
  {onclick}
  {...rest}
>
  {#if icon}{@render icon()}{/if}
  <span class="vc-tile-label" style="color:{active ? 'var(--azul-text)' : 'var(--text-primary)'}">{label}</span>
  {#if hint}<span class="vc-tile-hint">{hint}</span>{/if}
</button>

<style>
  .vc-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
    padding: 14px 8px;
    min-height: 108px;
    cursor: pointer;
    border-radius: var(--radius-12);
    transition: all var(--dur-fast) var(--ease-standard);
  }
  .vc-tile-label {
    font: var(--type-label);
    font-size: var(--text-12);
    text-align: center;
  }
  .vc-tile-hint {
    font: var(--type-body-sm);
    font-size: var(--text-12);
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.3;
  }
</style>
