<script>
  let { children, tone = 'muted', tracking = 'caps', style = '', ...rest } = $props();

  let color = $derived(
    tone === 'muted' ? 'var(--text-muted)'
    : tone === 'star' ? 'var(--text-star)'
    : tone === 'sky' ? 'var(--digitale)'
    : 'var(--text-faint)',
  );
</script>

<span
  class="vc-section-label"
  style="letter-spacing:{tracking === 'label' ? 'var(--track-label)' : 'var(--track-caps)'};color:{color};{style}"
  {...rest}
>
  {@render children?.()}
</span>

<style>
  .vc-section-label {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-11);
    font-weight: var(--weight-semibold);
    text-transform: uppercase;
  }
</style>
