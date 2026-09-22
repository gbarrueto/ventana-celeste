<script>
  let { left = null, center = null, right = null, style = '', ...rest } = $props();
</script>

<header class="vc-appbar" style={style} {...rest}>
  <div class="vc-appbar-side">{@render left?.()}</div>
  {@render center?.()}
  <div class="vc-appbar-side">{@render right?.()}</div>
</header>

<style>
  .vc-appbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-12);
    padding: 0 var(--space-8);
    min-height: var(--bar-height);
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-hairline);
    color: var(--text-primary);
  }
  .vc-appbar-side {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
</style>
