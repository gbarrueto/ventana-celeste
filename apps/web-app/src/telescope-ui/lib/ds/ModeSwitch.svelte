<script>
  let {
    value, onChange = null, simpleLabel = 'Sencillo', advancedLabel = 'Avanzado', style = '', ...rest
  } = $props();

  let items = $derived([
    ['simple', simpleLabel],
    ['advanced', advancedLabel],
  ]);
</script>

<div role="group" aria-label="Modo de la aplicación" class="vc-modeswitch" style={style} {...rest}>
  {#each items as [k, l] (k)}
    {@const on = value === k}
    <button
      type="button"
      aria-pressed={on}
      class="vc-modeswitch-btn"
      style="font-weight:{on ? 'var(--weight-bold)' : 'var(--weight-medium)'};color:{on ? 'var(--notte)' : 'var(--text-muted)'};background:{on ? 'var(--digitale)' : 'transparent'}"
      onclick={() => onChange?.(k)}
    >
      {l}
    </button>
  {/each}
</div>

<style>
  .vc-modeswitch {
    display: inline-flex;
    gap: var(--space-4);
    padding: 3px;
    background: var(--surface-card);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-pill);
  }
  .vc-modeswitch-btn {
    min-height: 36px;
    padding: 0 14px;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: var(--text-13);
    letter-spacing: var(--track-wide);
    border: none;
    border-radius: var(--radius-pill);
    transition: all var(--dur-fast) var(--ease-standard);
  }
</style>
