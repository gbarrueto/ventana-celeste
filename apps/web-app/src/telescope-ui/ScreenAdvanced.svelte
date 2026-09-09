<script>
  import { LENSES, BLUR_TARGETS } from './dictionaries/placeholders/advanced.js';
  import { onMount, onDestroy } from 'svelte';
  import { computeFovFromEyepiece } from '@ventanaceleste/core';
  import { initializeStelEngine, removeStelEngine } from '../lib/stellarium.js';
  import { eventManager, onTelescopeMessage, sendSeeingValue, sendTelescopeMessage  } from '../lib/protobject.js';
  import { showDebugOverlay, hideDebugOverlay, isDebugOverlayVisible } from '../lib/orientation.js';
  import {
    isLoading, FOCAL_LENGTH, logFov, setLogFov, currentBlur, setCurrentBlur,
    MIN_FOV, MAX_FOV, FOV_SEND_MS, engine,
  } from '../lib/stores.js';

  import FinderView from './lib/ds/FinderView.svelte';
  import SegmentedControl from './lib/ds/SegmentedControl.svelte';
  import Slider from './lib/ds/Slider.svelte';
  import Card from './lib/ds/Card.svelte';
  import SectionLabel from './lib/ds/SectionLabel.svelte';
  import HelpNote from './lib/ds/HelpNote.svelte';

  let longPressTimer = null;

  let activeLens = $state('');
  let focusValue = $state(0);
  let blurTarget = $state(0);

  let lens = $derived(LENSES.find((l) => l.name === activeLens) || LENSES[2]);
  let sweet = $derived(BLUR_TARGETS[lens.name] ?? 0);
  let off = $derived(Math.abs(focusValue - sweet));
  // Cosmetic only (never sent): the phone's finder preview goes soft when the
  // focuser is off its sweet spot, but only once an eyepiece is actually chosen.
  let finderBlur = $derived(activeLens ? Math.min(off * 1.6, 9) : 0);
  let sharp = $derived(off < 0.6 ? 'Enfocado' : off < 2 ? 'Casi enfocado' : 'Borroso');
  let fovDeg = $derived((computeFovFromEyepiece(FOCAL_LENGTH, lens.fl) * 180) / Math.PI);

  function onFinderDown() {
    longPressTimer = setTimeout(() => {
      if (isDebugOverlayVisible()) hideDebugOverlay();
      else showDebugOverlay();
      longPressTimer = null;
    }, 5000);
  }

  function onFinderUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function applyZoom(fl, lensName) {
    activeLens = lensName;
    const newFov = computeFovFromEyepiece(FOCAL_LENGTH, fl);
    setLogFov(Math.log(newFov));
    updateDisplayFov(lensName);
  }

  function updateDisplayFov(len = '') {
    const fov = Math.exp(logFov);

    eventManager.sendThrottled({ msg: 'updateFov', values: { fov } }, 'index.html', FOV_SEND_MS);

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

  function onFocusChange(v) {
    focusValue = v;
    setCurrentBlur(v);
    updateDisplayBlur();
  }

  onMount(async () => {
    await initializeStelEngine(true);

    //Protobject.Core.send({ msg: 'requestSynchronizeData', values: {} }).to('index.html');
    const msg = 'requestSynchronizeData';
    sendTelescopeMessage(msg, {});

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
      const l = LENSES.find((x) => x.name === activeLens);
      if (l) applyZoom(l.fl, l.name);
    }

    isLoading.set(false);
  });

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
    removeStelEngine();
  });
</script>

<div class="advanced">
  <div class="finder-slot">
    <!-- Long-press 5s toggles the orientation debug overlay (source behaviour). -->
    <div
      class="finder-hit"
      role="button"
      tabindex="-1"
      aria-label="Mantén pulsado 5s para el modo de depuración"
      ontouchstart={onFinderDown}
      ontouchend={onFinderUp}
      ontouchcancel={onFinderUp}
      onmousedown={onFinderDown}
      onmouseup={onFinderUp}
      onmouseleave={onFinderUp}
    >
      <FinderView blur={finderBlur} style="width:100%;max-width:320px">
        <canvas id="stel-canvas"></canvas>
      </FinderView>
    </div>
  </div>

  <div class="lens-block">
    <SectionLabel>Ocular</SectionLabel>
    <SegmentedControl
      value={activeLens}
      size="md"
      options={LENSES.map((x) => ({ value: x.name, label: x.label }))}
      onChange={(name) => {
        const l = LENSES.find((x) => x.name === name);
        if (l) applyZoom(l.fl, l.name);
      }}
    />
    <span class="hint">Número más chico, más aumento y menos cielo a la vez.</span>
  </div>

  <Card raised style="display:grid;gap:12px">
    <Slider
      label="Enfocador"
      value={focusValue}
      min={0}
      max={10}
      step={0.1}
      onChange={onFocusChange}
      valueText={sharp}
      minLabel="Girar hacia dentro"
      maxLabel="Girar hacia fuera"
      accent={off < 0.6 ? 'var(--stella)' : 'var(--digitale)'}
    />
    <div class="readout">
      <span>campo {fovDeg.toFixed(2).replace('.', ',')}°</span>
      <span>enfoque {focusValue.toFixed(1).replace('.', ',')}</span>
    </div>
  </Card>

  <HelpNote iconName="focus">
    Mueve el enfocador hasta que las estrellas sean puntos y no manchas.
  </HelpNote>
</div>

<style>
  @import './styles/screen-advanced.css';
</style>
