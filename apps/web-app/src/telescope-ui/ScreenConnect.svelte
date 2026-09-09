<script>
  import SkyBackdrop from './lib/SkyBackdrop.svelte';
  import Spinner from './lib/ds/Spinner.svelte';
  import Button from './lib/ds/Button.svelte';
  import Icon from './lib/ds/Icon.svelte';
  import Card from './lib/ds/Card.svelte';
  import SectionLabel from './lib/ds/SectionLabel.svelte';
  import Wordmark from './lib/ds/Wordmark.svelte';
  import HelpNote from './lib/ds/HelpNote.svelte';

  // Three states of the link to the big screen, from the source Telescope.svelte:
  // connecting -> connected, connecting -> timeout, connected -> lost.
  let { state = 'connecting', onRetry } = $props();
</script>

<div class="connect">
  <SkyBackdrop dense />

  <div class="connect-body">
    <Wordmark size={17} markSize={92} style="flex-direction:column;gap:18px" />

    {#if state === 'connecting'}
      <Spinner size={40} />
      <p class="msg">Conectando con la pantalla grande…</p>
    {:else if state === 'timeout'}
      <span class="danger-icon"><Icon name="wifi-off" size={40} /></span>
      <p class="msg msg--danger-title">No se pudo conectar</p>
      <p class="msg">
        Los dos aparatos tienen que estar en la misma red wifi. Vuelve a escanear el
        código QR de la pantalla grande.
      </p>
      <Button variant="primary" iconName="qr-code" onclick={onRetry}>Escanear otra vez</Button>
    {:else if state === 'lost'}
      <span class="danger-icon"><Icon name="wifi-off" size={40} /></span>
      <p class="msg msg--danger-title">Se perdió la conexión</p>
      <p class="msg">
        Recarga esta página para volver a conectarte. Si la pantalla grande se cerró y
        se abrió de nuevo, escanea el código QR otra vez.
      </p>
      <Button variant="primary" iconName="rotate-cw" onclick={onRetry}>Recargar</Button>
    {/if}
  </div>

  <div class="connect-foot">
    <Card>
      <SectionLabel tracking="label">Cómo funciona</SectionLabel>
      <div style="height:10px"></div>
      <HelpNote iconName="info">
        Este teléfono es el mando. La pantalla grande es el cielo: apuntas con el
        teléfono y el cielo se mueve contigo.
      </HelpNote>
    </Card>
  </div>
</div>

<style>
  @import './styles/screen-connect.css';
</style>
