<script>
  import { onMount, onDestroy } from 'svelte';
  import { modes, isLoading } from '../lib/stores.js';
  import {
    initTelescopeProtobject, sendTelescopeMessage, setTelescopeConnectionHandler,
    setTelescopeStatusHandler,
  } from '../lib/protobject.js';
  import { Orientation } from '../lib/orientation.js';
  import { pushSkySettings } from '../lib/sky-settings.js';

  import AppBar from './lib/ds/AppBar.svelte';
  import IconButton from './lib/ds/IconButton.svelte';
  import Icon from './lib/ds/Icon.svelte';
  import ModeSwitch from './lib/ds/ModeSwitch.svelte';
  import Spinner from './lib/ds/Spinner.svelte';
  import StatusScreen from './lib/ds/StatusScreen.svelte';
  import BottomNav from './lib/BottomNav.svelte';

  import ScreenConnect from './ScreenConnect.svelte';
  import ScreenSimple from './ScreenSimple.svelte';
  import ScreenAdvanced from './ScreenAdvanced.svelte';
  import ScreenSky from './ScreenSky.svelte';
  import ScreenPlaceTime from './ScreenPlaceTime.svelte';

  const CONNECTION_TIMEOUT_MS = 15000;

  // 'connecting' | 'connected' | 'timeout' | 'lost' — calibration must not start
  // until the WebRTC link to the viewer is actually up.
  let conn = $state('connecting');
  let mode = $state('simple');
  let tab = $state('mirar');
  let connectionTimer = null;

  const TITLES = { mirar: null, cielo: 'Ajustes del cielo', lugar: 'Lugar y hora' };

  function onModeChange(k) {
    if (k === mode) return;
    isLoading.set(true);
    modes.set({ simple: k === 'simple', advanced: k === 'advanced' });
    sendModeToViewer(k);
    mode = k;
  }

  function sendModeToViewer(k) {
    sendTelescopeMessage(k === 'advanced' ? 'advancedSettings' : 'simpleSettings', {});
  }

  // El teléfono es la fuente de verdad de los ajustes: el visor no origina
  // ninguno, sólo obedece. Así que al recuperar el enlace se le vuelve a contar
  // todo en vez de intentar averiguar qué se perdió. Los mensajes llevan
  // valores absolutos, no alternancias, de modo que repetirlos no hace daño.
  function resyncViewer() {
    sendModeToViewer(mode);
    pushSkySettings();
  }

  onMount(() => {
    setTelescopeConnectionHandler(() => {
      clearTimeout(connectionTimer);
      conn = 'connected';
      resyncViewer();
      Orientation.start();
    });

    connectionTimer = setTimeout(() => {
      if (conn === 'connecting') {
        conn = 'timeout';
      }
    }, CONNECTION_TIMEOUT_MS);

    // Ongoing link state. Sensors keep running through a drop.
    setTelescopeStatusHandler(({ alive, everAlive }) => {
      if (alive) {
        // Sólo tras una caída. La primera subida del enlace ya la atiende
        // setTelescopeConnectionHandler, y sin esta guarda se enviaría dos veces.
        if (conn === 'lost') resyncViewer();
        conn = 'connected';
      } else if (everAlive) {
        conn = 'lost';
      }
    });

    initTelescopeProtobject();
    isLoading.set(false);
  });

  onDestroy(() => {
    clearTimeout(connectionTimer);
    Orientation.stop();
  });
</script>

{#if conn !== 'connected'}
  <ScreenConnect state={conn} onRetry={() => window.location.reload()} />
{:else}
  <div class="shell">
    <AppBar>
      {#snippet left()}
        {#if tab === 'mirar'}
          <img src="/images/logo.svg" width="30" height="30" alt="Ventana Celeste" style="margin-left:6px" />
        {:else}
          <span class="appbar-title">{TITLES[tab]}</span>
        {/if}
      {/snippet}
      {#snippet right()}
        {#if tab === 'mirar'}
          <ModeSwitch value={mode} onChange={onModeChange} />
        {:else}
          <IconButton label="Volver a mirar" onclick={() => (tab = 'mirar')}>
            <Icon name="x" size={24} />
          </IconButton>
        {/if}
      {/snippet}
    </AppBar>

    <main class="content">
      <!-- The "Mirar" screen stays mounted while other tabs are open, so the
           Stellarium engine and its sync are not torn down on every tab switch
           (the source menu was an overlay, not a route). -->
      <div class="mirar-slot" class:is-hidden={tab !== 'mirar'}>
        {#if mode === 'simple'}
          <ScreenSimple />
        {:else}
          <ScreenAdvanced />
        {/if}
      </div>

      {#if tab === 'cielo'}
        <div class="sheet"><ScreenSky advanced={mode === 'advanced'} /></div>
      {:else if tab === 'lugar'}
        <div class="sheet"><ScreenPlaceTime /></div>
      {/if}
    </main>

    <BottomNav {tab} onTab={(t) => (tab = t)} />
  </div>

  {#if $isLoading}
    <StatusScreen>
      {#snippet icon()}<Spinner size={40} />{/snippet}
    </StatusScreen>
  {/if}
{/if}

<style>
  @import './styles/app.css';
</style>
