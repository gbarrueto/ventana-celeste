<script>
  // Sin prop de desenfoque a propósito: el buscador reproduce lo que ve el
  // teléfono para apuntar, y una imagen blanda ahí no simula nada, sólo
  // estorba. El desenfoque del enfocador vive en el visor.
  let { size = null, reticle = true, children = null, style = '', ...rest } = $props();
</script>

<div
  class="vc-finder"
  style="width:{size ?? '100%'};max-width:{size ?? 'min(60vw, 300px)'};{style}"
  {...rest}
>
  <div class="vc-finder-window">
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
