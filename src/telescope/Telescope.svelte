<script>
  import { onMount, onDestroy } from 'svelte';
  import { modes, isLoading, isMenuOpen } from '../lib/stores.js';
  import { initTelescopeProtobject } from '../lib/protobject.js';
  import { Orientation } from '../lib/orientation.js';
  import SimpleMode from './SimpleMode.svelte';
  import AdvancedMode from './AdvancedMode.svelte';
  import Menu from './Menu.svelte';

  let currentModes = $state({ simple: true, advanced: false });
  let loading = $state(true);
  let menuOpen = $state(false);

  modes.subscribe((v) => (currentModes = v));
  isLoading.subscribe((v) => (loading = v));
  isMenuOpen.subscribe((v) => (menuOpen = v));

  function toggleMode() {
    isLoading.set(true);
    const wasSimple = currentModes.simple;
    modes.set({ simple: !wasSimple, advanced: wasSimple });

    const modeMsg = wasSimple ? 'advancedSettings' : 'simpleSettings';
    Protobject.Core.send({ msg: modeMsg, values: {} }).to('index.html');
  }

  function openMenu() {
    isMenuOpen.set(true);
  }

  function closeMenu() {
    isMenuOpen.set(false);
  }

  onMount(() => {
    initTelescopeProtobject();
    Orientation.start();
    isLoading.set(false);
  });

  onDestroy(() => {
    Orientation.stop();
  });
</script>

{#if loading}
  <div class="loading-screen">
    <div class="loader"></div>
  </div>
{/if}

<div class="main-container" class:hidden={menuOpen}>
  <header class="header">
    <button class="header-btn" onclick={openMenu} aria-label="Abrir menu">
      <img src="/images/menu.png" alt="" class="header-icon" />
    </button>
    <button class="header-btn mode-toggle" onclick={toggleMode} aria-label="Cambiar modo">
      <span class="mode-label">{currentModes.simple ? 'Avanzado' : 'Simple'}</span>
      <img
        src={currentModes.simple ? '/images/simple.png' : '/images/advanced.png'}
        alt=""
        class="header-icon"
      />
    </button>
  </header>

  <main class="content">
    {#if currentModes.simple}
      <SimpleMode />
    {:else}
      <AdvancedMode />
    {/if}
  </main>
</div>

{#if menuOpen}
  <Menu onclose={closeMenu} />
{/if}

<style>
  :global(html), :global(body) {
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #06080f;
    color: #e8ecf5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .main-container {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
  }
  .main-container.hidden { display: none; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    height: 48px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .header-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .header-btn:active { background: rgba(255,255,255,0.08); }

  .header-icon {
    height: 24px;
    width: auto;
    opacity: 0.85;
  }

  .mode-label {
    font-size: 13px;
    font-weight: 500;
    opacity: 0.7;
    letter-spacing: 0.02em;
  }

  .content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .loading-screen {
    z-index: 100;
    position: fixed;
    inset: 0;
    background: rgba(6, 8, 15, 0.95);
    display: grid;
    place-items: center;
  }

  .loader {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255,255,255,0.1);
    border-bottom-color: #ff7a0d;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
