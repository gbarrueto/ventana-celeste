<script>
  let { size = 15, mark = '/images/logo.svg', markSize = 56, tone = 'dark', style = '', ...rest } = $props();
</script>

<span class="vc-wordmark-row" style={style} {...rest}>
  {#if mark !== false}
    <img src={mark} alt="" width={markSize} height={markSize} class="vc-wordmark-mark" />
  {/if}
  <span class="vc-wordmark" style="font-size:{size}px">
    <b style="color:{tone === 'dark' ? '#fff' : 'var(--notte)'}">VENTANA</b>
    <i>Celeste</i>
  </span>
</span>

<style>
  .vc-wordmark-row {
    display: inline-flex;
    align-items: center;
    gap: var(--space-14);
  }
  .vc-wordmark-mark {
    display: block;
    flex-shrink: 0;
  }
</style>
