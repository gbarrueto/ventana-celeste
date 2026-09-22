<script>
  let { children, selected = false, onclick = null, as = 'button', style = '', ...rest } = $props();
</script>

<svelte:element
  this={as}
  type={as === 'button' ? 'button' : undefined}
  aria-pressed={as === 'button' ? selected : undefined}
  class="vc-chip"
  style="border:1px solid {selected ? 'var(--azul-line-soft)' : 'var(--border-strong)'};background:{selected ? 'var(--azul-fill)' : 'transparent'};color:{selected ? 'var(--azul-text)' : 'rgba(255,255,255,0.5)'};cursor:{onclick ? 'pointer' : 'default'};{style}"
  {onclick}
  {...rest}
>
  {@render children?.()}
</svelte:element>

<style>
  .vc-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-6);
    font-family: var(--font-display);
    font-size: var(--text-11);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--track-button);
    padding: 6px 12px;
    border-radius: var(--radius-6);
    transition: all var(--dur-fast) var(--ease-standard);
  }
</style>
