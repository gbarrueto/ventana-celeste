<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { wallClockToMJD, mjdToWallClockISO, setEngineTime } from '@ventanaceleste/core';
  import { loadCdnScript, loadCss } from '../lib/lazy-load.js';
  import { sendTelescopeMessage } from '../lib/protobject.js';
  import { isLoading, currentTZ, engineUTC, engine, } from '../lib/stores.js';
  import { SPEEDS, FIELDS, PARANAL } from './dictionaries/time&space_dicts.js';

  import Card from './lib/ds/Card.svelte';
  import SectionLabel from './lib/ds/SectionLabel.svelte';
  import HelpNote from './lib/ds/HelpNote.svelte';
  import Button from './lib/ds/Button.svelte';
  import IconButton from './lib/ds/IconButton.svelte';
  import Icon from './lib/ds/Icon.svelte';

  import {initGlobe, flyHome} from './screenPlaceTimeComponents.svelte/place.js';


  // ── Globe (Cesium) ────────────────────────────────────────
  let globeEl; // contenedor del globo, vía bind:this
  let cesiumViewer = null;
  let cesiumInterval = null;

  let placeLat = $state(PARANAL.lat);
  let placeLon = $state(PARANAL.lon);
  let placeNote = $state('Bortle 1 · uno de los cielos más oscuros del mundo');

  function fmtDeg(v) {
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(4).replace('.', ',') + '°';
  }


  // ── Time ──────────────────────────────────────────────────
  let timeSpeed = $state(0);
  let selected = $state(new Date());
  let readout = $state('—');

  let calendarOpen = $state(false);
  let flatpickrReady = $state(false);
  let flatpickrInstance = null;

  let syncInterval = null;
  let lastInteraction = 0;
  let destroyed = false;

  function markInteraction() {
    lastInteraction = Date.now();
  }

  function updateStelDate(mjd) {
    sendTelescopeMessage('updateDate', { date: mjd });
    setEngineTime(engine, mjd);
  }

  function setSpeed(multiplier) {
    sendTelescopeMessage('setSpeed', { speed: multiplier });
    timeSpeed = multiplier;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmtReadout(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fieldValue(key, d) {
    switch (key) {
      case 'year': return d.getFullYear();
      case 'month': return pad(d.getMonth() + 1);
      case 'day': return pad(d.getDate());
      case 'hour': return pad(d.getHours());
      case 'minute': return pad(d.getMinutes());
      default: return '';
    }
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function mjdToWallDate(mjd) {
    const [datePart, timePart] = mjdToWallClockISO(mjd, currentTZ).split('T');
    const [y, mo, da] = datePart.split('-').map(Number);
    const [h, mi, s = 0] = timePart.split(':').map(Number);
    return new Date(y, mo - 1, da, h, mi, Math.trunc(s) || 0);
  }

  function applySelected() {
    readout = fmtReadout(selected);
    updateStelDate(wallClockToMJD(selected, currentTZ));
    if (flatpickrInstance) flatpickrInstance.setDate(selected, false);
  }

  function stepField(key, delta) {
    markInteraction();
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const d = new Date(selected);
    switch (key) {
      case 'year':
        d.setFullYear(d.getFullYear() + delta);
        break;
      case 'month': {
        const m = (d.getMonth() + delta + 12) % 12;
        d.setDate(Math.min(d.getDate(), daysInMonth(d.getFullYear(), m)));
        d.setMonth(m);
        break;
      }
      case 'day': {
        const dim = daysInMonth(d.getFullYear(), d.getMonth());
        d.setDate(((d.getDate() - 1 + delta + dim) % dim) + 1);
        break;
      }
      case 'hour':
        d.setHours((d.getHours() + delta + 24) % 24);
        break;
      case 'minute':
        d.setMinutes((d.getMinutes() + delta + 60) % 60);
        break;
    }
    selected = d;
    applySelected();
  }

  

  // Fila 1: "Reset" vuelve a la fecha/hora actual del cliente.
  function resetToNow() {
    markInteraction();
    selected = new Date();
    applySelected();
  }

  // ── Calendario (flatpickr, on-demand) ─────────────────────
  async function openCalendar() {
    markInteraction();
    calendarOpen = true;
    if (!window.flatpickr) {
      await Promise.all([
        loadCss('https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'),
        loadCss('https://npmcdn.com/flatpickr/dist/themes/dark.css'),
        loadCdnScript('flatpickr', 'https://cdn.jsdelivr.net/npm/flatpickr'),
      ]);
    }
    await tick();
    if (!calendarOpen || destroyed) return; // cerrado mientras cargaba

    flatpickrInstance = window.flatpickr('#datetime-picker', {
      enableTime: true,
      dateFormat: 'Y-m-d\\TH:i:S',
      time_24hr: true,
      defaultDate: selected,
      inline: true,
      appendTo: document.getElementById('datetime-picker'),
      onChange(selectedDates) {
        if (selectedDates.length === 0) return;
        markInteraction();
        selected = selectedDates[0];
        readout = fmtReadout(selected);
        updateStelDate(wallClockToMJD(selected, currentTZ));
      },
      onMonthChange(selectedDates, _dateStr, instance) {
        markInteraction();
        const current = selectedDates[0] || instance.now;
        instance.setDate(new Date(instance.currentYear, instance.currentMonth, current.getDate(),
          current.getHours(), current.getMinutes(), current.getSeconds()), true);
      },
      onYearChange(selectedDates, _dateStr, instance) {
        markInteraction();
        const current = selectedDates[0] || instance.now;
        instance.setDate(new Date(instance.currentYear, instance.currentMonth, current.getDate(),
          current.getHours(), current.getMinutes(), current.getSeconds()), true);
      },
    });
    flatpickrReady = true;
  }

  function closeCalendar() {
    markInteraction();
    calendarOpen = false;
    flatpickrReady = false;
    if (flatpickrInstance) {
      flatpickrInstance.destroy();
      flatpickrInstance = null;
    }
    updateStelDate(wallClockToMJD(selected, currentTZ));
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && calendarOpen) closeCalendar();
  }

  onMount(async () => {
    isLoading.set(true);
    try {
      await initGlobe(globeEl, ({ lat, lon, note }) => {
        placeLat = lat;
        placeLon = lon;
        if (note) placeNote = note;
      });
    } finally {
      isLoading.set(false);
    }
    if (destroyed) return;

    sendTelescopeMessage('setDatetimeInterval', { active: true });
    readout = fmtReadout(selected);

    syncInterval = setInterval(() => {
      if (engineUTC == null) return;
      if (Date.now() - lastInteraction < 3000) return;
      selected = mjdToWallDate(engineUTC);
      readout = fmtReadout(selected);
      if (flatpickrInstance) flatpickrInstance.setDate(selected, false);
    }, 500);
  });

  onDestroy(() => {
    destroyed = true;
    clearInterval(syncInterval);
    if (flatpickrInstance) flatpickrInstance.destroy();
    sendTelescopeMessage('clearDatetimeInterval', {});

    if (cesiumViewer) {
      cesiumViewer.useDefaultRenderLoop = false;
      clearInterval(cesiumInterval);
    }
  });
</script>
<svelte:window onkeydown={onKeydown} />

<div class="place-time">
  <div class="group">
    <SectionLabel>Desde dónde miras</SectionLabel>
    <Card style="padding:0;overflow:hidden">
      <div class="globe-wrap">
        <div class="globe" bind:this={globeEl}></div>
        <div class="globe-dot"></div>
      </div>
      <div class="place-info">
        <span class="place-name">Personalizado</span>
        <span class="place-coords">{fmtDeg(placeLat)}  {fmtDeg(placeLon)}</span>
        <span class="place-note">{placeNote}</span>
      </div>
    </Card>
    <Button
      variant="neutral"
      size="md"
      iconName="map-pin"
      iconSize={18}
      style="justify-self:start"
      onclick={() => flyHome(6000000)}
    >
      Volver a la ubicación actual
    </Button>
  </div>

  <div class="group">
    <SectionLabel>Cuándo</SectionLabel>
    <Card raised style="display:grid;gap:14px">
      <!-- Fila 1: fecha y hora mostradas + reset y ±24 h -->
      <div class="when-integrated">
        <div class="when-display">
          
          <span class="when-readout">{readout}</span>
        
          <Button variant="neutral" size="md" iconName="rotate-cw" iconSize={15} onclick={resetToNow}>
            Ahora
          </Button>
        </div>

        <!-- Steppers compactos para cada campo -->
        <div class="field-steppers">
          {#each FIELDS as f (f.key)}
            <div class="stepper">
              <span class="stepper-label">{f.label}</span>
              <div class="stepper-btns">
                <button class="step-btn" onclick={() => stepField(f.key, -1)}>−</button>
                <span class="stepper-value" class:is-wide={f.key === 'year'}>
                  {fieldValue(f.key, selected)}
                </span>
                <button class="step-btn" onclick={() => stepField(f.key, 1)}>+</button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Fila 3: barra de velocidad -->
      <div class="speed-row speed-row--2">
        {#each SPEEDS.slice(0, 2) as s (s.value)}
          <Button variant="option" size="md" selected={timeSpeed === s.value} onclick={() => setSpeed(s.value)}>
            {s.label}
          </Button>
        {/each}
      </div>
      <div class="speed-row speed-row--3">
        {#each SPEEDS.slice(2) as s (s.value)}
          <Button variant="option" size="md" selected={timeSpeed === s.value} onclick={() => setSpeed(s.value)}>
            {s.label}
          </Button>
        {/each}
      </div>

      <!-- Fila 4: abrir el calendario (carga flatpickr on-demand) -->
      <Button
        variant="neutral"
        size="md"
        iconName="calendar-clock"
        iconSize={16}
        style="justify-self:start"
        onclick={openCalendar}
      >
        Elegir fecha
      </Button>

      <HelpNote iconName="calendar-clock">
        Adelanta el tiempo y verás cómo gira el cielo. En «1h/s», una noche entera pasa
        en unos segundos.
      </HelpNote>
    </Card>
  </div>
</div>

{#if calendarOpen}
  <div class="cal-backdrop">
    <button type="button" class="cal-dismiss" aria-label="Cerrar" onclick={closeCalendar}></button>
    <div
      class="cal-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir fecha y hora"
      tabindex="-1"
    >
      <div class="cal-modal-head">
        <span>Elegir fecha y hora</span>
        <IconButton label="Cerrar" size={36} onclick={closeCalendar}>
          <Icon name="x" size={20} />
        </IconButton>
      </div>

      <div id="datetime-picker" class="picker-wrap"></div>
      {#if !flatpickrReady}
        <p class="picker-loading">Cargando calendario…</p>
      {/if}

      <Button variant="primary" size="md" fullWidth onclick={closeCalendar}>Listo</Button>
    </div>
  </div>
{/if}

<style>
  @import './styles/place&time.css';
</style>