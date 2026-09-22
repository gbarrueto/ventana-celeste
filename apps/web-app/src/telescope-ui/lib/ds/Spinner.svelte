<script>
  let { size = 40, accent = 'var(--digitale)', style = '', ...rest } = $props();
</script>

<span
  role="status"
  aria-label="Cargando"
  class="vc-spinner"
  style="width:{size}px;height:{size}px;border-bottom-color:{accent};{style}"
  {...rest}
></span>

<style>
  .vc-spinner {
    display: block;
    box-sizing: border-box;
    border: 3px solid var(--white-10);
    border-radius: var(--radius-round);
    animation: vc-spin var(--dur-spin) linear infinite;
  }
</style>
