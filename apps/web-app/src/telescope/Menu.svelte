<script>
  import { STEL_BUTTONS, setPollution, POLLUTION_THROTTLE_MS, modes, observerLat, observerLon } from '../lib/stores.js';
  import { applyPollution } from '../lib/stellarium.js';
  import { bortleToMag, magToBortle } from '../lib/fov.js';
  import { getMagFromLonLat } from '../lib/light-pollution.js';
  import { eventManager, sendSeeingValue } from '../lib/protobject.js';
  import DateTimePicker from './DateTimePicker.svelte';
  import GlobePicker from './GlobePicker.svelte';

  let { onclose } = $props();

  let activeTab = $state(null); // 'location' | 'datetime' | null
  let activeButtons = $state({ atmosphere: true, landscape: true });
  let pollutionValue = $state(9);
  let autoPollutionEnabled = $state(false);
  let isAdvanced = $state(false);
  let turbulenceValue = $state(5);

  modes.subscribe((m) => { isAdvanced = m.advanced; });

  const TAB_LABELS = { location: 'Ubicacion', datetime: 'Fecha y Tiempo' };

  function openTab(tab) { activeTab = tab; }
  function closeTab() { activeTab = null; }

  function toggleStelOption(name) {
    const info = STEL_BUTTONS[name];
    Protobject.Core.send({
      msg: 'stellariumOption',
      values: { path: info.path, attr: info.attr },
    }).to('index.html');
    activeButtons = { ...activeButtons, [name]: !activeButtons[name] };
  }

  function applyPollutionValue(bortle) {
    pollutionValue = bortle;
    setPollution(bortle);
    const skyMag = bortleToMag(bortle);
    applyPollution({ mag: skyMag });
    eventManager.sendThrottled(
      { msg: 'updatePollution', values: { mag: skyMag } },
      'index.html',
      POLLUTION_THROTTLE_MS,
    );
  }

  function onPollutionInput(e) {
    applyPollutionValue(parseInt(e.target.value));
  }

  async function toggleAutoPollution() {
    if (!autoPollutionEnabled) {
      // Turning on: fetch pollution from current location, apply, then disable slider
      try {
        console.log('Auto pollution: fetching for', observerLat, observerLon);
        const mag = await getMagFromLonLat({ lat: observerLat, lon: observerLon });
        console.log('Auto pollution: mag =', mag);
        if (mag != null) {
          const bortle = magToBortle(mag);
          applyPollutionValue(bortle);
        }
      } catch (err) {
        console.warn('Auto pollution fetch failed:', err);
      }
    }
    autoPollutionEnabled = !autoPollutionEnabled;
  }

  function onTurbulenceInput(e) {
    turbulenceValue = parseFloat(e.target.value);
    sendSeeingValue({ target: 'turbulence', value: turbulenceValue });
  }

  const IMG_MAP = {
    constellations: '/svg/btn-cst-lines.svg',
    atmosphere: '/svg/btn-atmosphere.svg',
    landscape: '/svg/btn-landscape.svg',
    azimuthal: '/svg/btn-azimuthal-grid.svg',
    equatorial: '/svg/btn-equatorial-grid.svg',
    nebulae: '/svg/btn-nebulae.svg',
  };
</script>

<div class="menu-overlay">
  <!-- Header -->
  <header class="menu-header">
    {#if activeTab === null}
      <button class="back-btn" onclick={onclose} aria-label="Cerrar menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <nav class="nav-tabs">
        <button class="nav-tab" onclick={() => openTab('location')}>Ubicacion</button>
        <button class="nav-tab" onclick={() => openTab('datetime')}>Fecha y Tiempo</button>
      </nav>
    {:else}
      <button class="back-btn" onclick={closeTab} aria-label="Volver">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <span class="page-title">{TAB_LABELS[activeTab]}</span>
    {/if}
  </header>

  <!-- Content -->
  <div class="menu-body">
    {#if activeTab === null}
      <div class="main-menu">
      <!-- Stellarium toggles -->
      <div class="stel-grid">
        {#each Object.entries(STEL_BUTTONS) as [name, info]}
          <button
            class="stel-btn"
            class:active={activeButtons[name]}
            onclick={() => toggleStelOption(name)}
          >
            <div class="stel-icon" style="background-image: url('{IMG_MAP[info.img]}')"></div>
            <span>{info.label}</span>
          </button>
        {/each}
      </div>

      <!-- Sliders -->
      <div class="sliders">
        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Contaminacion Luminica</span>
            <button
              class="auto-toggle"
              class:active={autoPollutionEnabled}
              onclick={toggleAutoPollution}
            >Auto</button>
          </div>
          <input
            class="styled-range"
            type="range"
            min="1" max="9"
            bind:value={pollutionValue}
            oninput={onPollutionInput}
            disabled={autoPollutionEnabled}
            class:dimmed={autoPollutionEnabled}
          />
        </div>

        {#if isAdvanced}
          <div class="slider-row">
            <span class="slider-title">Turbulencia</span>
            <input
              class="styled-range"
              type="range"
              min="0" max="10" step="0.1"
              bind:value={turbulenceValue}
              oninput={onTurbulenceInput}
            />
          </div>
        {/if}
      </div>
      </div>
    {:else if activeTab === 'location'}
      <GlobePicker />
    {:else if activeTab === 'datetime'}
      <DateTimePicker />
    {/if}
  </div>
</div>

<style>
  .menu-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #06080f;
    z-index: 50;
  }

  /* ── Header ── */
  .menu-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    height: 48px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: none;
    border: none;
    color: #e8ecf5;
    cursor: pointer;
    border-radius: 8px;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .back-btn:active { background: rgba(255,255,255,0.08); }

  .nav-tabs {
    display: flex;
    gap: 6px;
  }

  .nav-tab {
    background: none;
    border: none;
    color: #e8ecf5;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .nav-tab:active { background: rgba(255,255,255,0.1); }

  .page-title {
    font-size: 15px;
    font-weight: 600;
    color: #e8ecf5;
  }

  /* ── Body ── */
  .menu-body {
    flex: 1;
    overflow: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .main-menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 16px;
  }

  /* ── Stellarium grid ── */
  .stel-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stel-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 4px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    color: #e8ecf5;
    opacity: 0.4;
    transition: all 0.15s;
    cursor: pointer;
  }
  .stel-btn.active {
    opacity: 1;
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.15);
  }
  .stel-btn span { font-size: 11px; font-weight: 500; }

  .stel-icon {
    width: 40px;
    height: 40px;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  /* ── Sliders ── */
  .sliders {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .slider-title {
    font-size: 13px;
    font-weight: 500;
    opacity: 0.6;
  }

  .auto-toggle {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.15s;
  }
  .auto-toggle.active {
    background: rgba(59,130,246,0.25);
    border-color: rgba(59,130,246,0.4);
    color: #93bbfc;
  }

  .styled-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 36px;
    background: transparent;
    transition: opacity 0.2s;
  }
  .styled-range.dimmed {
    opacity: 0.25;
    pointer-events: none;
  }

  .styled-range::-webkit-slider-runnable-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    height: 4px;
  }
  .styled-range::-moz-range-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    height: 4px;
  }

  .styled-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    background: #e8ecf5;
    height: 24px;
    width: 24px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    margin-top: -10px;
  }
  .styled-range::-moz-range-thumb {
    background: #e8ecf5;
    height: 24px;
    width: 24px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
</style>
