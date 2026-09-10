<script module>
  // Presentation for each Stellarium toggle. The keys and on/off defaults are the
  // source of truth in stores.js (STEL_BUTTONS); this only adds an icon and a
  // one-line description per the redesign.
  const PRESENT = {
    constellations: { icon: 'sparkles', label: 'Constelaciones', hint: 'Une las estrellas con líneas' },
    atmosphere: { icon: 'cloud', label: 'Atmósfera', hint: 'Cielo con aire y colores' },
    landscape: { icon: 'mountain-snow', label: 'Paisaje', hint: 'El horizonte y los cerros' },
    azimuthal: { icon: 'grid-3x3', label: 'Rejilla del suelo', hint: 'Norte, sur, este, oeste' },
    equatorial: { icon: 'globe', label: 'Rejilla del cielo', hint: 'Coordenadas de las estrellas' },
    dss: { icon: 'orbit', label: 'Nebulosas', hint: 'Nubes de gas y polvo' },
  };
  const BORTLE = [
    '', 'cielo perfecto', 'muy oscuro', 'rural', 'rural con brillo', 'suburbio',
    'suburbio brillante', 'borde de ciudad', 'ciudad', 'centro de la ciudad',
  ];
</script>

<script>
  import {
    STEL_BUTTONS, POLLUTION_THROTTLE_MS, observerLat, observerLon,
    skySettings, updateSkySettings, setSkyLayer,
  } from '../lib/stores.js';
  import { applyPollution } from '../lib/stellarium.js';
  import { bortleToMag, magToBortle } from '@ventanaceleste/core';
  import { getMagFromLonLat } from '../lib/light-pollution.js';
  import { eventManager, sendSeeingValue, sendTelescopeMessage } from '../lib/protobject.js';

  import ToggleTile from './lib/ds/ToggleTile.svelte';
  import Slider from './lib/ds/Slider.svelte';
  import Card from './lib/ds/Card.svelte';
  import SectionLabel from './lib/ds/SectionLabel.svelte';
  import HelpNote from './lib/ds/HelpNote.svelte';
  import Chip from './lib/ds/Chip.svelte';
  import Icon from './lib/ds/Icon.svelte';

  let { advanced = false } = $props();

  const LAYERS = Object.entries(STEL_BUTTONS).map(([name, info]) => ({ name, info, ...PRESENT[name] }));

  let layers = $derived($skySettings.layers);
  let bortle = $derived(magToBortle($skySettings.skyMag));
  let seeingValue = $derived($skySettings.seeing);
  let desdeLugar = $derived($skySettings.skyMagFromPlace);

  function toggleStelOption(name) {
    const info = STEL_BUTTONS[name];
    const visible = !layers[name];
    setSkyLayer(name, visible);
    sendTelescopeMessage('stellariumOption', { path: info.path, attr: info.attr, value: visible });
  }

  function applySkyMag(mag, { fromPlace }) {
    updateSkySettings({ skyMag: mag, skyMagFromPlace: fromPlace });
    applyPollution({ mag });
    eventManager.sendThrottled(
      { msg: 'updatePollution', values: { mag } },
      'index.html',
      POLLUTION_THROTTLE_MS,
    );
  }

  function onPollutionChange(v) {
    applySkyMag(bortleToMag(Math.round(v)), { fromPlace: false });
  }

  async function usarLuzDelLugar() {
    try {
      const mag = await getMagFromLonLat({ lat: observerLat, lon: observerLon });
      if (mag != null) applySkyMag(mag, { fromPlace: true });
    } catch (err) {
      console.warn('Auto pollution fetch failed:', err);
    }
  }

  function onSeeingChange(v) {
    updateSkySettings({ seeing: v });
    sendSeeingValue({ target: 'seeing', value: v });
  }
</script>

<div class="sky">
  <div class="sky-group">
    <SectionLabel>Qué se dibuja</SectionLabel>
    <div class="tile-grid">
      {#each LAYERS as l (l.name)}
        <ToggleTile
          label={l.label}
          hint={l.hint}
          active={layers[l.name]}
          onclick={() => toggleStelOption(l.name)}
        >
          {#snippet icon()}<Icon name={l.icon} size={28} />{/snippet}
        </ToggleTile>
      {/each}
    </div>
  </div>

  <Card raised style="display:grid;gap:12px">
    <div class="row-between">
      <SectionLabel tone="muted">Luces de la ciudad</SectionLabel>
      <Chip selected={desdeLugar} onclick={usarLuzDelLugar}>Luz del lugar</Chip>
    </div>
    <Slider
      value={bortle}
      min={1}
      max={9}
      onChange={onPollutionChange}
      valueText={'Efecto polución ' + bortle + ' · ' + BORTLE[bortle]}
      minLabel="Cielo oscuro"
      maxLabel="Centro de la ciudad"
    />
    <HelpNote iconName="lightbulb">
      Mientras más luz haya alrededor, menos estrellas se ven. Al elegir un lugar
      se ajusta solo; muévelo si quieres probar otro cielo.
    </HelpNote>
  </Card>

  {#if advanced}
    <Card raised style="display:grid;gap:12px">
      <SectionLabel tone="muted">Turbulencia del aire</SectionLabel>
      <Slider
        value={seeingValue}
        min={0.3}
        max={3}
        step={0.05}
        onChange={onSeeingChange}
        valueText={seeingValue.toFixed(2).replace('.', ',') + '″'}
        minLabel="Aire quieto"
        maxLabel="Aire revuelto"
        accent="var(--stella)"
      />
      <HelpNote iconName="info">
        Es el temblor del aire. Súbela y las estrellas parpadean y se ven menos nítidas.
      </HelpNote>
    </Card>
  {/if}
</div>

<style>
  .sky {
    display: grid;
    gap: 18px;
    padding: 16px 16px 24px;
  }
  .sky-group {
    display: grid;
    gap: 8px;
  }
  .tile-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--gap-tile-grid);
  }
  .row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
</style>
