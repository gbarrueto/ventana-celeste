<script>
  import { onMount, onDestroy } from 'svelte';
  import { DateTime } from 'luxon';
  import { loadCdnScript, loadCss } from '../lib/lazy-load.js';
  import { isLoading, currentTZ, engineUTC } from '../lib/stores.js';
  import { engine } from '../lib/stores.js';

  let flatpickrInstance = null;
  let flatpickrLoaded = $state(false);
  let timeSpeed = $state(0);
  let syncInterval = null;
  let lastInteraction = 0;

  // Any user interaction with the picker pauses sync for a while
  function markInteraction() {
    lastInteraction = Date.now();
  }

  function isoToMJD(isoString) {
    const date = new Date(isoString);
    const jd = date.getTime() / 86400000 + 2440587.5;
    return jd - 2400000.5;
  }

  function fromMJDToLuxon(mjd, offsetHours = 0) {
    const JD = mjd + 2400000.5;
    const unixMs = (JD - 2440587.5) * 86400000;
    const zone = `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;
    return DateTime.fromMillis(unixMs, { zone: 'UTC' }).setZone(zone);
  }

  function getISOWithTZ(date) {
    const offset = currentTZ;
    const localOffset = -new Date().getTimezoneOffset() / 60;
    if (localOffset === offset) return date.toISOString();

    const zone = `UTC${offset >= 0 ? '+' : ''}${offset}`;
    const dt = DateTime.fromObject(
      { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
        hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() },
      { zone },
    );
    return dt.toUTC().toISO();
  }

  function updateStelDate(dateISO) {
    const mjd = isoToMJD(dateISO);
    Protobject.Core.send({ msg: 'updateDate', values: { date: mjd } }).to('index.html');
    if (engine?.core?.observer) engine.core.observer.utc = mjd;
  }

  function setSpeed(multiplier) {
    Protobject.Core.send({ msg: 'setSpeed', values: { speed: multiplier } }).to('index.html');
    timeSpeed = multiplier;
  }

  function applyCurrentDate() {
    const dateISO = getISOWithTZ(new Date());
    updateStelDate(dateISO);
    if (flatpickrInstance) flatpickrInstance.setDate(dateISO, false);
  }

  onMount(async () => {
    if (!window.flatpickr) {
      isLoading.set(true);
      await Promise.all([
        loadCss('https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'),
        loadCss('https://npmcdn.com/flatpickr/dist/themes/dark.css'),
        loadCdnScript('flatpickr', 'https://cdn.jsdelivr.net/npm/flatpickr'),
      ]);
      isLoading.set(false);
    }

    flatpickrLoaded = true;

    Protobject.Core.send({ msg: 'setDatetimeInterval', values: { active: true } }).to('index.html');

    setTimeout(() => {
      flatpickrInstance = flatpickr('#datetime-picker', {
        enableTime: true,
        dateFormat: 'Y-m-d\\TH:i:S',
        time_24hr: true,
        defaultDate: new Date(),
        inline: true,
        appendTo: document.getElementById('datetime-picker'),
        onChange(selectedDates) {
          if (selectedDates.length > 0) {
            markInteraction();
            const iso = getISOWithTZ(selectedDates[0]);
            console.log('DatePicker onChange:', selectedDates[0], '→ ISO:', iso, '→ MJD:', isoToMJD(iso));
            updateStelDate(iso);
          }
        },
        onMonthChange(selectedDates, _dateStr, instance) {
          markInteraction();
          // Re-apply the selected day in the new month/year context
          const current = selectedDates[0] || instance.now;
          const updated = new Date(instance.currentYear, instance.currentMonth, current.getDate(),
            current.getHours(), current.getMinutes(), current.getSeconds());
          instance.setDate(updated, true);
        },
        onYearChange(selectedDates, _dateStr, instance) {
          markInteraction();
          const current = selectedDates[0] || instance.now;
          const updated = new Date(instance.currentYear, instance.currentMonth, current.getDate(),
            current.getHours(), current.getMinutes(), current.getSeconds());
          instance.setDate(updated, true);
        },
      });

      // Pause sync while user touches the picker UI
      const pickerEl = document.getElementById('datetime-picker');
      if (pickerEl) {
        pickerEl.addEventListener('pointerdown', markInteraction);
        pickerEl.addEventListener('touchstart', markInteraction, { passive: true });
      }

      // Sync flatpickr display with engine time, but only if user hasn't
      // interacted for 3 seconds (enough time to navigate months/years)
      syncInterval = setInterval(() => {
        if (!flatpickrInstance || !engineUTC) return;
        if (Date.now() - lastInteraction > 3000) {
          const dt = fromMJDToLuxon(engineUTC, currentTZ);
          flatpickrInstance.setDate(dt.toISO(), false);
        }
      }, 500);
    }, 100);
  });

  onDestroy(() => {
    clearInterval(syncInterval);
    if (flatpickrInstance) flatpickrInstance.destroy();
    Protobject.Core.send({ msg: 'clearDatetimeInterval', values: {} }).to('index.html');
  });
</script>

<div class="datetime-page">
  {#if flatpickrLoaded}
    <div id="datetime-picker" class="picker-wrap"></div>

    <div class="speed-controls">
      <button class="speed-btn accent" onclick={applyCurrentDate}>Hora Actual</button>

      <div class="speed-row">
        <button class="speed-btn" class:active={timeSpeed === 0} onclick={() => setSpeed(0)}>Stop</button>
        <button class="speed-btn" class:active={timeSpeed === 1} onclick={() => setSpeed(1)}>Realtime</button>
      </div>
      <div class="speed-row">
        <button class="speed-btn" class:active={timeSpeed === 10} onclick={() => setSpeed(10)}>10s/s</button>
        <button class="speed-btn" class:active={timeSpeed === 60} onclick={() => setSpeed(60)}>1min/s</button>
        <button class="speed-btn" class:active={timeSpeed === 3600} onclick={() => setSpeed(3600)}>1h/s</button>
      </div>
    </div>
  {:else}
    <p style="opacity:0.4; text-align:center;">Cargando calendario...</p>
  {/if}
</div>

<style>
  .datetime-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    gap: 16px;
  }

  .picker-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .speed-controls {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .speed-row {
    display: grid;
    gap: 6px;
  }
  .speed-row:nth-child(2) { grid-template-columns: 1fr 1fr; }
  .speed-row:nth-child(3) { grid-template-columns: 1fr 1fr 1fr; }

  .speed-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #e8ecf5;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .speed-btn:active { transform: scale(0.97); }
  .speed-btn.active {
    background: rgba(59,130,246,0.25);
    border-color: rgba(59,130,246,0.5);
    color: #93bbfc;
    font-weight: 600;
  }
  .speed-btn.accent {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.15);
  }

  /* Flatpickr overrides */
  :global(.flatpickr-calendar) {
    background: #0d1117 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 12px !important;
    box-shadow: none !important;
  }
  :global(.flatpickr-days) { height: 260px; }
  :global(.dayContainer) { height: 100%; }
  :global(.flatpickr-time) {
    height: 60px !important;
    max-height: 60px;
    align-items: center;
    border-top: 1px solid rgba(255,255,255,0.08) !important;
  }
  :global(.flatpickr-time .numInputWrapper) {
    height: 100% !important;
  }
  :global(.flatpickr-time .arrowUp),
  :global(.flatpickr-time .arrowDown) {
    opacity: 1;
    width: 20%;
    border: none;
  }
</style>
