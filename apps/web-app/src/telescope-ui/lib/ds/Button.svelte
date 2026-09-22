<script module>
  const SIZES = {
    md: 'min-height:40px;padding:10px 16px;font-size:var(--text-13);border-radius:var(--radius-10)',
    lg: 'min-height:var(--hit-comfortable);padding:14px 22px;font-size:var(--text-15);border-radius:var(--radius-12)',
  };
  const VARIANTS = {
    primary: 'background:var(--fuego-grad);color:#fff;border-color:transparent;border-radius:var(--radius-pill);font-weight:var(--weight-bold);letter-spacing:var(--track-button)',
    option: 'background:var(--surface-card-raised);color:var(--text-primary);border-color:var(--border-card);font-weight:var(--weight-medium);letter-spacing:var(--track-normal)',
    neutral: 'background:var(--surface-pressed);color:var(--text-primary);border-color:var(--border-strong);font-weight:var(--weight-medium)',
    ghost: 'background:none;color:var(--text-primary);border-color:transparent;font-weight:var(--weight-semibold);border-radius:var(--radius-8)',
  };
  const SELECTED = 'background:var(--surface-selected);border-color:var(--border-selected);color:var(--text-selected);font-weight:var(--weight-semibold)';
</script>

<script>
  import Icon from './Icon.svelte';

  let {
    children, variant = 'option', size = 'lg', selected = false, disabled = false,
    fullWidth = false, iconName = null, iconSize = 20, icon = null, iconRight = null,
    style = '', onclick, ...rest
  } = $props();

  let pressed = $state(false);

  let composed = $derived([
    SIZES[size], VARIANTS[variant], selected ? SELECTED : '',
    fullWidth ? 'width:100%' : '',
    disabled ? 'opacity:0.35;pointer-events:none' : 'opacity:1',
    pressed ? 'transform:scale(var(--press-scale))' : 'transform:none',
    style,
  ].filter(Boolean).join(';'));
</script>

<button
  type="button"
  {disabled}
  aria-pressed={selected || undefined}
  class="vc-btn"
  style={composed}
  onpointerdown={() => (pressed = true)}
  onpointerup={() => (pressed = false)}
  onpointerleave={() => (pressed = false)}
  {onclick}
  {...rest}
>
  {#if iconName}<Icon name={iconName} size={iconSize} />{/if}
  {#if icon}{@render icon()}{/if}
  {#if children}{@render children()}{/if}
  {#if iconRight}{@render iconRight()}{/if}
</button>

<style>
  .vc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    border: 1px solid transparent;
    cursor: pointer;
    font-family: var(--font-display);
    text-align: center;
    transition: background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard),
      color var(--dur-fast) var(--ease-standard),
      transform var(--dur-fast) var(--ease-standard),
      opacity var(--dur-medium);
  }
</style>
