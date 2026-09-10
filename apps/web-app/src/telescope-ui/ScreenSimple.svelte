<script>

  import  TARGETS  from './dictionaries/placeholders/targets.js';
  import { onMount } from 'svelte';
  import { sliderToFov, fovToSlider } from '@ventanaceleste/core';
  import { isLoading, setLogFov, setCurrentFov, FOV_SEND_MS, MIN_FOV, MAX_FOV } from '../lib/stores.js';
  import { eventManager, onTelescopeMessage, sendTelescopeMessage } from '../lib/protobject.js';

  import SkyBackdrop from './lib/SkyBackdrop.svelte';
  import Card from './lib/ds/Card.svelte';
  import SectionLabel from './lib/ds/SectionLabel.svelte';
  import HelpNote from './lib/ds/HelpNote.svelte';
  import Icon from './lib/ds/Icon.svelte';
  import Button from './lib/ds/Button.svelte';
  import Chip from './lib/ds/Chip.svelte';
  import VerticalSlider from './lib/ds/VerticalSlider.svelte';

  const FOV_RANGE = { minFov: MIN_FOV, maxFov: MAX_FOV };
  const ZOOM_MAX = 150;

  let zoomValue = $state(100);
  let target = $state(null);

  let t = $derived(TARGETS.find((x) => x.id === target));
  let fovDeg = $derived((sliderToFov(ZOOM_MAX - zoomValue, FOV_RANGE) * 180) / Math.PI);

  function onZoomInput(e) {
    const val = parseFloat(e.currentTarget.value);
    zoomValue = val;
    const fov = sliderToFov(ZOOM_MAX - val, FOV_RANGE);
    setCurrentFov(fov);
    setLogFov(Math.log(fov));
    eventManager.sendThrottled({ msg: 'updateFov', values: { fov } }, 'index.html', FOV_SEND_MS);
  }

  onMount(() => {
    sendTelescopeMessage('requestSynchronizeSimpleZoom', {});

    onTelescopeMessage('setSynchronizedSimpleZoom', (values) => {
      const { data } = values;
      if (data?.fov) {
        zoomValue = ZOOM_MAX - fovToSlider(data.fov, FOV_RANGE);
      }
    });

    isLoading.set(false);
  });
</script>

<div class="simple">
  <SkyBackdrop />

  <Card raised style="position:relative;display:flex;gap:14px;align-items:center">
    <span class="target-icon"><Icon name={t ? t.icon : 'telescope'} size={32} /></span>
    <div style="min-width:0">
      <SectionLabel tone="sky">Estás mirando</SectionLabel>
      <div class="target-name">{t ? t.name : 'El cielo abierto'}</div>
      <div class="target-desc">{t ? t.desc : 'Mueve el teléfono para apuntar a algo'}</div>
    </div>
  </Card>

  <div class="simple-mid">
    <div class="targets-col">
      <SectionLabel>Esta noche</SectionLabel>
      <div class="targets-list">
        {#each TARGETS as x (x.id)}
          <Button
            variant="option"
            size="md"
            selected={target === x.id}
            iconName={x.icon}
            onclick={() => (target = target === x.id ? null : x.id)}
            style="justify-content:flex-start;text-align:left;min-height:52px"
          >
            {x.name}
          </Button>
        {/each}
      </div>
      <HelpNote iconName="lightbulb" style="margin-top:auto">
        Toca un nombre y la pantalla grande te lleva hasta él.
      </HelpNote>
    </div>

    <div class="zoom-col">
      <SectionLabel>Zoom</SectionLabel>
      <VerticalSlider
        value={zoomValue}
        min={0}
        max={150}
        step={0.01}
        oninput={onZoomInput}
        topLabel="Más cerca"
        bottomLabel="Todo el cielo"
        valueText={'Campo ' + fovDeg.toFixed(1).replace('.', ',') + '°'}
      />
    </div>
  </div>

  <div class="simple-foot">
    <Chip as="span">Conectado</Chip>
    <span class="foot-hint">Mueve el teléfono despacio para no perder el rumbo.</span>
  </div>
</div>

<style>
  @import './styles/screen-simple.css';
</style>
