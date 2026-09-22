<script>
  import Icon from './Icon.svelte';

  let { options, value, onChange = null, size = 'lg', style = '', ...rest } = $props();
</script>

<div
  role="tablist"
  class="vc-seg"
  style="grid-template-columns:repeat({options.length}, 1fr);{style}"
  {...rest}
>
  {#each options as o (o.value)}
    {@const on = o.value === value}
    <button
      type="button"
      role="tab"
      aria-selected={on}
      class="vc-seg-btn"
      style="min-height:{size === 'md' ? 40 : 48}px;font-weight:{on ? 'var(--weight-semibold)' : 'var(--weight-medium)'};color:{on ? 'var(--azul-text)' : 'var(--text-muted)'};background:{on ? 'var(--azul-fill)' : 'transparent'};border:1px solid {on ? 'var(--border-selected)' : 'transparent'}"
      onclick={() => onChange?.(o.value)}
    >
      {#if o.iconName}<Icon name={o.iconName} size={16} />{/if}{o.label}
    </button>
  {/each}
</div>

<style>
  .vc-seg {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-4);
    background: var(--surface-card);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-12);
  }
  .vc-seg-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
    padding: 0 10px;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: var(--text-14);
    border-radius: var(--radius-10);
    transition: all var(--dur-fast) var(--ease-standard);
  }
</style>
