<script>
  import { onMount, onDestroy } from 'svelte';
  import { initializeStelEngine, removeStelEngine } from '../lib/stellarium.js';
  import { eventManager, onTelescopeMessage, sendSeeingValue } from '../lib/protobject.js';
  import { showDebugOverlay, hideDebugOverlay, isDebugOverlayVisible } from '../lib/orientation.js';
  import {
    isLoading, FOCAL_LENGTH, logFov, setLogFov, currentBlur, setCurrentBlur,
    MIN_FOV, MAX_FOV, FOV_SEND_MS, engine,
  } from '../lib/stores.js';

  let longPressTimer = null;

  function onFinderDown() {
    longPressTimer = setTimeout(() => {
      if (isDebugOverlayVisible()) {
        hideDebugOverlay();
      } else {
        showDebugOverlay();
      }
      longPressTimer = null;
    }, 5000);
  }

  function onFinderUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  const LENSES = [
    { name: 'len1', fl: 40, label: '40mm' },
    { name: 'len2', fl: 24, label: '24mm' },
    { name: 'len3', fl: 10, label: '10mm' },
    { name: 'len4', fl: 4, label: '4mm' },
  ];

  const BLUR_TARGETS = { '': 0, len1: 2, len2: 4, len3: 6, len4: 8 };

  let activeLens = $state('');
  let focusValue = $state(0);
  let blurTarget = $state(0);

  function applyZoom(fl, lensName) {
    activeLens = lensName;
    const m = FOCAL_LENGTH / fl;
    let newFov = (100 / m) * Math.PI / 180;
    setLogFov(Math.log(newFov));
    updateDisplayFov(lensName);
  }

  function updateDisplayFov(len = '') {
    const fov = Math.exp(logFov);

    eventManager.sendThrottled(
      { msg: 'updateFov', values: { fov } },
      'index.html',
      FOV_SEND_MS,
    );

    blurTarget = BLUR_TARGETS[len] ?? 0;
    updateDisplayBlur();

    const minFov = 0.005, maxFov = 0.05;
    const clampedFov = Math.min(Math.max(fov, minFov), maxFov);
    const maxTurbulence = ((maxFov - clampedFov) / (maxFov - minFov)) * 9 + 1;

    setTimeout(() => sendSeeingValue({ target: 'turbulenceMax', value: maxTurbulence.toFixed(1) }), 100);
    setTimeout(() => sendSeeingValue({ target: 'turbulence', value: (maxTurbulence * 0.2).toFixed(1) }), 200);
  }

  function updateDisplayBlur() {
    const diff = Math.abs(currentBlur - blurTarget);
    const zoomLevel = (Math.log(MAX_FOV) - logFov) / (Math.log(MAX_FOV) - Math.log(MIN_FOV));
    const sensitivity = 0.4 + zoomLevel * 2.0;
    const blurIntensity = Math.pow(diff * sensitivity, 1.5);
    const blurEffect = Math.min(blurIntensity, 100);
    sendSeeingValue({ target: 'focus', value: blurEffect });
  }

  function onFocusInput(e) {
    focusValue = parseFloat(e.target.value);
    setCurrentBlur(focusValue);
    updateDisplayBlur();
  }

  onMount(async () => {
    await initializeStelEngine(true);

    Protobject.Core.send({ msg: 'requestSynchronizeData', values: {} }).to('index.html');

    onTelescopeMessage('setSynchronizedData', (values) => {
      const { data } = values;
      if (!engine?.core?.observer) {
        setTimeout(() => onTelescopeMessage('setSynchronizedData', () => {}), 500);
        return;
      }
      engine.core.observer.utc = data.time;
      engine.core.observer.latitude = data.location.lat;
      engine.core.observer.longitude = data.location.lon;
      engine.core.observer.elevation = data.location.elev;
      engine.core.observer.yaw = data.angle.yaw;
      engine.core.observer.pitch = data.angle.pitch;
    });

    if (activeLens) {
      const lens = LENSES.find((l) => l.name === activeLens);
      if (lens) applyZoom(lens.fl, lens.name);
    }

    isLoading.set(false);
  });

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
    removeStelEngine();
  });
</script>

<div class="advanced-mode">
  <!-- Finder / guidescope preview -->
  <section class="finder">
    <div
      class="finder-frame"
      role="button"
      tabindex="-1"
      aria-label="Mantieni premuto 5s per debug"
      ontouchstart={onFinderDown}
      ontouchend={onFinderUp}
      ontouchcancel={onFinderUp}
      onmousedown={onFinderDown}
      onmouseup={onFinderUp}
      onmouseleave={onFinderUp}
    >
      <div class="stel-wrapper">
        <canvas id="stel-canvas"></canvas>
      </div>
      <div class="crosshair"></div>
      <div class="crosshair crosshair-v"></div>
    </div>
  </section>

  <!-- Eyepiece / lens selector -->
  <section class="lenses">
    {#each LENSES as lens}
      <button
        class="lens-btn"
        class:active={activeLens === lens.name}
        onclick={() => applyZoom(lens.fl, lens.name)}
      >
        <span class="lens-fl">{lens.label}</span>
      </button>
    {/each}
  </section>

  <!-- Focus -->
  <section class="focus">
    <span class="section-label">ENFOCADOR</span>
    <div class="focus-track">
      <input
        class="focus-slider"
        type="range"
        min="0"
        max="10"
        step="0.01"
        bind:value={focusValue}
        oninput={onFocusInput}
      />
    </div>
  </section>
</div>

<style>
  .advanced-mode {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px;
    gap: 0;
    box-sizing: border-box;
  }

  /* ── Finder ── */
  .finder {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .finder-frame {
    position: relative;
    aspect-ratio: 1;
    height: 100%;
    max-height: min(60vw, 300px);
  }

  .stel-wrapper {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.08);
  }

  :global(#stel-canvas) {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }

  .crosshair {
    position: absolute;
    top: 50%;
    left: 12%;
    right: 12%;
    height: 1px;
    background: rgba(255, 50, 50, 0.5);
    pointer-events: none;
  }
  .crosshair-v {
    top: 12%;
    bottom: 12%;
    left: 50%;
    right: auto;
    width: 1px;
    height: 76%;
    background: rgba(255, 50, 50, 0.5);
  }

  /* ── Lenses ── */
  .lenses {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 16px 0;
    flex-shrink: 0;
  }

  .lens-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 40px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: #e8ecf5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .lens-btn:active { transform: scale(0.95); }
  .lens-btn.active {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
    color: #93bbfc;
    font-weight: 600;
  }

  .lens-fl { letter-spacing: 0.01em; }

  /* ── Focus ── */
  .focus {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-bottom: 20px;
    flex-shrink: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    opacity: 0.35;
  }

  .focus-track {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .focus-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    width: 85%;
    height: 36px;
  }

  .focus-slider::-webkit-slider-runnable-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    height: 4px;
  }
  .focus-slider::-moz-range-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    height: 4px;
  }

  .focus-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    background: #e8ecf5;
    height: 28px;
    width: 28px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    margin-top: -12px;
  }
  .focus-slider::-moz-range-thumb {
    background: #e8ecf5;
    height: 28px;
    width: 28px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  }
</style>
