<script>
  let { tone = 'waiting', title = null, body = null, icon = null, children = null, style = '', ...rest } = $props();
</script>

<div class="vc-status-screen" role="status" aria-live="polite" style={style} {...rest}>
  {#if icon}{@render icon()}{/if}
  {#if title}
    <p
      class="vc-status-title"
      style="color:{tone === 'error' ? 'var(--text-danger)' : 'var(--text-primary)'};font-weight:{tone === 'error' ? 'var(--weight-bold)' : 'var(--weight-semibold)'}"
    >{title}</p>
  {/if}
  {#if body}<p class="vc-status-body">{body}</p>{/if}
  {@render children?.()}
</div>

<style>
  .vc-status-screen {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: var(--scrim-loading);
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-16);
    padding: var(--space-32);
    box-sizing: border-box;
    text-align: center;
  }
  .vc-status-title {
    margin: 0;
    font: var(--type-subheading);
    max-width: 300px;
  }
  .vc-status-body {
    margin: 0;
    font: var(--type-body);
    color: var(--text-secondary);
    max-width: 300px;
  }
</style>
