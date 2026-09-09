<script>
  let { children, raised = false, padding = 16, style = '', ...rest } = $props();
</script>

<div
  class="vc-card"
  style="background:{raised ? 'var(--surface-card-raised)' : 'var(--surface-card)'};border:1px solid {raised ? 'var(--border-card)' : 'var(--border-hairline)'};padding:{typeof padding === 'number' ? padding + 'px' : padding};{style}"
  {...rest}
>
  {@render children?.()}
</div>

<style>
  .vc-card {
    border-radius: var(--radius-card);
    color: var(--text-primary);
  }
</style>
