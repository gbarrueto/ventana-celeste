<script>
  let { children, label, size = 48, tone = 'default', style = '', onclick, ...rest } = $props();
  let pressed = $state(false);
</script>

<button
  type="button"
  aria-label={label}
  class="vc-iconbtn"
  style="width:{size}px;height:{size}px;background:{pressed ? 'var(--surface-pressed)' : 'none'};color:{tone === 'muted' ? 'var(--text-muted)' : 'var(--text-primary)'};{style}"
  onpointerdown={() => (pressed = true)}
  onpointerup={() => (pressed = false)}
  onpointerleave={() => (pressed = false)}
  {onclick}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .vc-iconbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-8);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-standard);
  }
</style>
