<script>
  import { onMount } from 'svelte';
  import { initializeStelEngine, getObjAltAz, enableSimpleModeSettings } from '../lib/stellarium.js';
  import { initViewerProtobject, setSeeingOptionHandler, setConnectionHandler } from '../lib/protobject.js';
  import { initializeSeeingOverlay } from '../lib/seeing-overlay.js';
  import { loadCdnScript } from '../lib/lazy-load.js';
  import { engine } from '../lib/stores.js';

  let infoCard = $state({ visible: false, name: '', mag: '', ra: '', dec: '', alt: '', az: '' });
  let showQr = $state(true);
  let qrContainerEl = $state();

  function buildTelescopeUrl() {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('ptjuid');
    const base = `${window.location.protocol}//${window.location.host}/telescope.html`;
    return uid ? `${base}?ptjuid=${uid}` : base;
  }

  async function renderQr(url) {
    if (!window.QRCode) {
      await loadCdnScript('QRCode', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    }
    if (!qrContainerEl) return;
    qrContainerEl.innerHTML = '';
    new QRCode(qrContainerEl, {
      text: url,
      width: 260,
      height: 260,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  onMount(async () => {
    const stel = await initializeStelEngine(false);

    // Start in simple mode (show hints, hide overlays)
    enableSimpleModeSettings();

    // Render QR as soon as DOM is ready
    const telescopeUrl = buildTelescopeUrl();
    await renderQr(telescopeUrl);

    // Hide QR when a device connects
    setConnectionHandler(() => {
      showQr = false;
    });

    // Object click listener
    stel.change((obj, attr) => {
      if (attr === 'hovered') return;
      if (stel.core.selection) {
        const s = stel.core.selection;
        const name = s.designations()[0].replace(/^NAME /, '');
        const radec = stel.convertFrame(stel.core.observer, 'ICRF', 'CIRS', s.getInfo('radec'));
        const coords = stel.c2s(radec);
        const ra = stel.anp(coords[0]);
        const dec = stel.anpm(coords[1]);
        const mag = s.getInfo('vmag');
        const altaz = getObjAltAz(s);

        infoCard = {
          visible: true,
          name,
          mag: mag !== undefined ? mag.toFixed(2) : 'Unknown',
          ra: ra.toFixed(3),
          dec: dec.toFixed(3),
          alt: altaz?.alt.toFixed(3) ?? '?',
          az: altaz?.az.toFixed(3) ?? '?',
        };
      } else {
        infoCard = { ...infoCard, visible: false };
      }
    });

    // Initialize seeing overlay and connect to protobject
    const seeingTargets = initializeSeeingOverlay();
    if (seeingTargets) {
      setSeeingOptionHandler(({ target, value }) => {
        const control = seeingTargets[target];
        if (control) {
          control.value = value;
          control.dispatchEvent(new Event('input'));
        }
      });
    }

    // Start protobject message handling
    initViewerProtobject();
  });
</script>

<div id="stel">
  <canvas id="stel-canvas"></canvas>
  {#if infoCard.visible}
    <div id="info-card">
      <h3>{infoCard.name}</h3>
      <p><strong>Magnitude:</strong> {infoCard.mag}</p>
      <p><strong>Ra:</strong> {infoCard.ra}</p>
      <p><strong>Dec:</strong> {infoCard.dec}</p>
      <p><strong>Alt:</strong> {infoCard.alt}&deg;</p>
      <p><strong>Az:</strong> {infoCard.az}&deg;</p>
    </div>
  {/if}
</div>

<div id="eyepiece-overlay"></div>
<div id="nolens"></div>

{#if showQr}
  <div class="qr-overlay">
    <div class="qr-text">
      <p class="qr-title">Escanea con tu smartphone</p>
      <p class="qr-subtitle">para convertirlo en tu telescopio<br>y explorar el cielo estrellado</p>
    </div>
    <div class="qr-frame">
      <div bind:this={qrContainerEl} class="qr-container"></div>
    </div>
  </div>
{/if}

<style>
  :global(.dropdown-menu) {
    background-color: #000 !important;
    border-color: #333 !important;
    color: #e8ecf5 !important;
  }
  :global(.dropdown-menu div) {
    color: #e8ecf5 !important;
    border-color: #333 !important;
  }
  :global(.dropdown-menu div:hover) {
    background-color: #222 !important;
  }

  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    font-family: 'Roboto', sans-serif;
    background-color: #000;
    color: white;
    overflow: hidden;
  }

  #stel {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  :global(#stel-canvas) {
    width: 100%;
    height: 100%;
    display: block;
  }

  #info-card {
    position: absolute;
    top: 80px;
    left: 10px;
    width: 400px;
    background: rgba(0, 0, 0, 0.6);
    padding: 1rem;
    font-size: 0.9rem;
    border-radius: 10px;
    z-index: 9;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  #eyepiece-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, transparent 35%, black 40%);
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center;
    z-index: 4;
    opacity: 0;
  }

  #nolens {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: none;
    backdrop-filter: blur(90px);
    -webkit-backdrop-filter: blur(90px);
  }

  /* ── QR overlay ── */
  .qr-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .qr-text {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .qr-title {
    margin: 0;
    font-size: clamp(20px, 2.5vw, 32px);
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.8);
  }

  .qr-subtitle {
    margin: 0;
    font-size: clamp(13px, 1.5vw, 18px);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.5;
    text-shadow: 0 1px 8px rgba(0,0,0,0.8);
  }

  .qr-frame {
    background: #fff;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 0 0 8px rgba(255,255,255,0.15), 0 24px 60px rgba(0,0,0,0.6);
  }

  .qr-container {
    display: block;
    line-height: 0;
  }
</style>
