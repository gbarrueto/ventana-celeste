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
    STEL_BUTTONS, setPollution, POLLUTION_THROTTLE_MS, observerLat, observerLon,
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

  let activeButtons = $state(
    Object.fromEntries(Object.entries(STEL_BUTTONS).map(([name, info]) => [name, info.on])),
  );
  let pollutionValue = $state(9);
  let autoPollutionEnabled = $state(false);
  // Único parámetro de seeing que se ofrece al público: el FWHM del disco, en
  // arcosegundos. 0.3 es una noche excelente y 3 una mala. El resto del modelo
  // se ajusta en desarrollo.
  let turbulenceValue = $state(1);
  // Fix: Los botones se aclaran cuando se desactivan, y se desaclaran cuando se activan. Poco 
  // intuitivo. 
  function toggleStelOption(name) {
    const info = STEL_BUTTONS[name];
    const msg = 'stellariumOption';
    const values = { path: info.path, attr: info.attr };
    sendTelescopeMessage(msg, values);
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

  function onPollutionChange(v) {
    applyPollutionValue(Math.round(v));
  }

  async function toggleAutoPollution() {
    if (!autoPollutionEnabled) {
      try {
        const mag = await getMagFromLonLat({ lat: observerLat, lon: observerLon });
        if (mag != null) {
          applyPollutionValue(magToBortle(mag));
        }
      } catch (err) {
        console.warn('Auto pollution fetch failed:', err);
      }
    }
    autoPollutionEnabled = !autoPollutionEnabled;
  }

  function onTurbulenceChange(v) {
    turbulenceValue = v;
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
          active={!activeButtons[l.name]}
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
      <Chip selected={autoPollutionEnabled} onclick={toggleAutoPollution}>Auto</Chip>
    </div>
    <Slider
      value={pollutionValue}
      min={1}
      max={9}
      onChange={onPollutionChange}
      disabled={autoPollutionEnabled}
      valueText={'Efecto polución ' + pollutionValue + ' · ' + BORTLE[pollutionValue]}
      minLabel="Cielo oscuro"
      maxLabel="Centro de la ciudad"
    />
    <HelpNote iconName="lightbulb">
      Mientras más luz haya alrededor, menos estrellas se ven. Con Auto lo calculamos
      desde tu ubicación.
    </HelpNote>
  </Card>

  {#if advanced}
    <Card raised style="display:grid;gap:12px">
      <SectionLabel tone="muted">Turbulencia del aire</SectionLabel>
      <Slider
        value={turbulenceValue}
        min={0.3}
        max={3}
        step={0.05}
        onChange={onTurbulenceChange}
        valueText={turbulenceValue.toFixed(2).replace('.', ',') + '″'}
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
