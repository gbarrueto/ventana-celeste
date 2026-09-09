<script>
  let { size = null, blur = 0, reticle = true, children = null, style = '', ...rest } = $props();
</script>

<div
  class="vc-finder"
  style="width:{size ?? '100%'};max-width:{size ?? 'min(60vw, 300px)'};{style}"
  {...rest}
>
  <div class="vc-finder-window" style="filter:{blur ? `blur(${blur}px)` : 'none'}">
    {@render children?.()}
  </div>
  {#if reticle}
    <span aria-hidden="true" class="vc-finder-reticle vc-finder-reticle-h"></span>
    <span aria-hidden="true" class="vc-finder-reticle vc-finder-reticle-v"></span>
  {/if}
</div>

<style>
  .vc-finder {
    position: relative;
    aspect-ratio: 1;
  }
  .vc-finder-window {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-round);
    overflow: hidden;
    border: 2px solid var(--white-08);
    background: var(--notte-deep);
    transition: filter var(--dur-slow) var(--ease-out);
  }
  .vc-finder-reticle {
    position: absolute;
    background: var(--reticle);
    pointer-events: none;
  }
  .vc-finder-reticle-h {
    top: 50%;
    left: 12%;
    right: 12%;
    height: 1px;
  }
  .vc-finder-reticle-v {
    left: 50%;
    top: 12%;
    height: 76%;
    width: 1px;
  }
</style>
