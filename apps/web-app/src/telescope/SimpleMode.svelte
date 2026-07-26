<script>
  import { onMount } from 'svelte';
  import { sliderToFov, fovToSlider } from '@ventanaceleste/core';
  import { isLoading, setLogFov, setCurrentFov, FOV_SEND_MS, MIN_FOV, MAX_FOV } from '../lib/stores.js';
  import { eventManager, onTelescopeMessage } from '../lib/protobject.js';

  const FOV_RANGE = { minFov: MIN_FOV, maxFov: MAX_FOV };

  let zoomValue = $state(100);

  function onZoomInput(e) {
    const val = parseFloat(e.target.value);
    zoomValue = val;
    const fov = sliderToFov(val, FOV_RANGE);
    setCurrentFov(fov);
    setLogFov(Math.log(fov));

    eventManager.sendThrottled(
      { msg: 'updateFov', values: { fov } },
      'index.html',
      FOV_SEND_MS,
    );
  }

  onMount(() => {
    Protobject.Core.send({
      msg: 'requestSynchronizeSimpleZoom',
      values: {},
    }).to('index.html');

    onTelescopeMessage('setSynchronizedSimpleZoom', (values) => {
      const { data } = values;
      if (data?.fov) {
        zoomValue = fovToSlider(data.fov, FOV_RANGE);
      }
    });

    isLoading.set(false);
  });
</script>

<div class="simple-mode">
  <div class="zoom-track">
    <input
      class="zoom-slider"
      type="range"
      min="0"
      max="150"
      step="0.01"
      bind:value={zoomValue}
      oninput={onZoomInput}
      orient="vertical"
    />
  </div>
  <span class="zoom-label">ZOOM</span>
</div>

<style>
  .simple-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 24px 0 16px;
    gap: 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .zoom-track {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
  }

  .zoom-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    opacity: 0.4;
  }

  .zoom-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    height: 100%;
    writing-mode: vertical-rl;
    width: 60px;
  }

  .zoom-slider::-webkit-slider-runnable-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    width: 4px;
  }
  .zoom-slider::-moz-range-track {
    background: rgba(255,255,255,0.12);
    border-radius: 100px;
    width: 4px;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    background: #e8ecf5;
    height: 36px;
    width: 36px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    margin-right: -16px;
  }
  .zoom-slider::-moz-range-thumb {
    background: #e8ecf5;
    height: 36px;
    width: 36px;
    border-radius: 50%;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  }
</style>
