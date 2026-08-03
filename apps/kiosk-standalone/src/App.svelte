<script>
  import { onMount } from "svelte";
  import DebugPanel from "./components/DebugPanel.svelte";
  import {
    Telescope, TelescopeType, formatMJDForDisplay, nudgeEngineHours,
    createOrientationController, initializeStellariumEngine,
    createKeyboardConnector,
  } from "@ventanaceleste/core";
  // Copia única del motor en core/assets; antes se resolvía por la ruta por
  // defecto de core, que apuntaba a la copia en public/ de esta app.
  import engineWasmUrl from "@ventanaceleste/core/assets/stellarium-web-engine.wasm?url";
  import engineScriptUrl from "@ventanaceleste/core/assets/stellarium-web-engine.js?url";
  import { loadConfig } from "./config";

  let canvasEl;
  let overlayEl;
  let onDebugRecalibrate = () => {};
  let onDebugCancelCalibration = () => {};
  let onDebugSelectLens = () => {};
  let onDebugSimulateCardChange = () => {};
  let onDebugZoomIn = () => {};
  let onDebugZoomOut = () => {};
  let onDebugToggleVertical = () => {};

  function addHour() {
    nudgeEngineHours(window.currentStelEngine, 1);
  }

  function subHour() {
    nudgeEngineHours(window.currentStelEngine, -1);
  }

  let isDebugPanelVisible = false; // será actualizado según config
  let invertVerticalMotion = true;
  let appConfig = null;
  const telescope = new Telescope({
    name: "Prototipo",
    type: TelescopeType.REFRACTOR,
    aperture: 200,
    focalLength: 1200,
  });

  const RAD_TO_DEG = 180 / Math.PI;

  function getEngineTime() {
    const utc = window.currentStelEngine?.core?.observer?.utc;
    if (!utc) return { jdn: null, date: "-" };
    return {
      jdn: utc.toFixed(6),
      date: formatMJDForDisplay(utc),
    };
  }

  function telescopeSnapshot() {
    return {
      // name: telescope.name,
      // type: telescope.type,
      aperture: telescope.aperture,
      focalLength: telescope.focalLength,
      eyepieceFocalLength: telescope.eyepieceFocalLength,
      magnification: telescope.magnification,
      // ra: telescope.ra,
      // dec: telescope.dec,
      // alt: telescope.alt,
      // az: telescope.az,
    };
  }

  function createDebugState() {
    return {
      activeSensorMode: "absolute",
      activeSource: "boot",
      calibrating: false,
      preCalibrating: false,
      preCalibStatus: "moving",
      preCalibCountdown: 2,
      gyro: { x: 0, y: 0, z: 0 },
      absQuat: { x: 0, y: 0, z: 0, w: 0 },
      coords: { yaw: 0, pitch: 0, yawDeg: 0, pitchDeg: 0 },
      fovRad: 0,
      fovDeg: 0,
      targetLogFov: 0,
      currentLensLevel: 0,
      telescope: telescopeSnapshot(),
      engineTime: getEngineTime(),
      env: "-",
    };
  }

  let debugState = createDebugState();

  function toDegrees(radians) {
    return radians * RAD_TO_DEG;
  }

  function setDebug(partial) {
    debugState = { ...debugState, ...partial };
  }

  function setDebugCoords(yaw, pitch) {
    telescope.setAltAz(pitch, yaw);
    debugState = {
      ...debugState,
      coords: {
        yaw,
        pitch,
        yawDeg: toDegrees(yaw),
        pitchDeg: toDegrees(pitch),
      },
      telescope: telescopeSnapshot(),
    };
  }

  onMount(async () => {
    // Load environment-specific configuration
    appConfig = await loadConfig();

    console.log("Configuración cargada en App:", appConfig);

    debugState.env = appConfig.env;

    isDebugPanelVisible = appConfig.enableDebugPanel;

    let engine;

    const CALIBRATE_ON_START = appConfig.calibrateOnStart;

    const MAX_FOV = 3.228859;
    const MIN_FOV = 0.000005;
    const FOV_STEP = 0.1;
    const LENS_FOCAL_LENGTHS = {
      1: "eye",
      2: 40,
      3: 6,
      4: 0.5,
      5: "eye",
      6: 40,
      7: 6,
      8: 0.5,
    };
    const NO_LENS_BLUR = 5;
    const HUMAN_EYE_FOV = Math.PI / 3;

    let currentLensLevel = 0;
    let currentFov = MAX_FOV;
    let logFov = Math.log(MAX_FOV);

    setDebug({
      fovRad: currentFov,
      fovDeg: toDegrees(currentFov),
      targetLogFov: logFov,
      currentLensLevel,
    });

    let warnedInvalidView = false;

    function updateStellariumView({ h, v }) {
      if (!engine || !engine.core || !engine.core.observer) return;
      // A malformed payload used to write NaN into observer.yaw/pitch, which looks
      // exactly like "no readings are arriving" — the view simply never moves.
      // Warn once (this runs per frame) instead of corrupting engine state.
      if (!Number.isFinite(h) || !Number.isFinite(v)) {
        if (!warnedInvalidView) {
          warnedInvalidView = true;
          console.warn("[stellarium] updateView ignorado: se esperaba { h, v } numérico, llegó", { h, v });
        }
        return;
      }
      engine.core.observer.yaw = -h;
      engine.core.observer.pitch = invertVerticalMotion ? -v : v;
      registerZoomMotion(h, v);
    }

    function updateStellariumFov({ fov }) {
      if (!engine || !engine.core) return;
      engine.core.fov = fov;
      const degFov = (fov * 180) / Math.PI;
      telescope.setEyepieceFocalLength((telescope.focalLength * degFov) / 100);
      setDebug({ fovRad: fov, fovDeg: degFov, telescope: telescopeSnapshot() });
    }



    async function initEngine() {
      await initializeStellariumEngine({
        canvas: canvasEl,
        wasmFile: engineWasmUrl,
        scriptUrl: engineScriptUrl,
        smalldataBaseUrl: appConfig.smallDataPath,
        bigdataBaseUrl: appConfig.bigDataPath,
        location: { cityName: "Santiago", lat: -33.45, lon: -70.67, elev: 520, mag: 17.13 },
        time: { offsetHours: -4 },
        includeGaia: false,
        onReady(stel) {
          engine = stel;
          const { core } = stel;
          core.planets.hints_visible = true;
          core.dsos.hints_visible = true;
          core.minor_planets.hints_visible = false;
          core.dss.hints_visible = false;
          core.stars.hints_visible = true;
          core.comets.hints_visible = false;
          core.cardinals.visible = false;
          core.constellations.lines_visible = true;
          core.constellations.images_visible = false;
          core.constellations.labels_visible = true;
          core.star_relative_scale = 1.0;
          core.stars.label_amount = 3.0;
          core.exposure_scale = 1;
        },
      });
    }

    function applyLensLevel(level) {
      currentLensLevel = level;

      if (level === 0) {
        // currentFov = MAX_FOV;
        // logFov = Math.log(currentFov);
        // updateStellariumFov({ fov: currentFov });
        telescope.setEyepieceFocalLength(0);
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
          telescope: telescopeSnapshot(),
        });
        return;
      }

      const lens = LENS_FOCAL_LENGTHS[level];

      if (lens === "eye") {
        currentFov = HUMAN_EYE_FOV;
        logFov = Math.log(currentFov);
        updateStellariumFov({ fov: currentFov });
        telescope.setEyepieceFocalLength(0);
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
          telescope: telescopeSnapshot(),
        });
        return;
      }

      if (!lens) return;

      telescope.setEyepieceFocalLength(lens);
      const fov = telescope.fovFromEyepiece(lens);
      currentFov = fov;
      logFov = Math.log(fov);
      updateStellariumFov({ fov });
      setDebug({
        currentLensLevel,
        targetLogFov: logFov,
        fovRad: currentFov,
        fovDeg: toDegrees(currentFov),
        telescope: telescopeSnapshot(),
      });
    }

    let targetLogFov = logFov;
    const ZOOM_SMOOTHING = 0.12;
    let zoomAnimating = false;
    const ZOOM_MOTION_THRESHOLD = 0.015;
    let lastZoomMotion = null;

    function startZoomLoop() {
      if (zoomAnimating) return;
      zoomAnimating = true;

      const step = () => {
        const delta = targetLogFov - logFov;
        if (Math.abs(delta) < 1e-4) {
          logFov = targetLogFov;
          zoomAnimating = false;
          setDebug({ targetLogFov });
          return;
        }
        logFov += delta * ZOOM_SMOOTHING;

        currentFov = Math.exp(logFov);
        updateStellariumFov({ fov: currentFov });
        setDebug({ targetLogFov });

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }



    function registerZoomMotion(h, v) {
      if (!Number.isFinite(h) || !Number.isFinite(v)) return;

      if (!lastZoomMotion) {
        lastZoomMotion = { h, v };
        return;
      }

      const deltaH = h - lastZoomMotion.h;
      const deltaV = v - lastZoomMotion.v;
      const motionDistance = Math.hypot(deltaH, deltaV);

      if (motionDistance < ZOOM_MOTION_THRESHOLD) return;

      lastZoomMotion = { h, v };
    }

    function applyZoomDelta(delta) {
      targetLogFov += delta;
      targetLogFov = Math.min(Math.log(MAX_FOV), Math.max(Math.log(MIN_FOV), targetLogFov));
      setDebug({ targetLogFov });
      startZoomLoop();
    }

    function triggerRecalibration() {
      orientation.startCalibration();
    }

    function triggerCancelCalibration() {
      orientation.cancelCalibration();
    }

    function triggerLens(level) {
      applyLensLevel(level);
      targetLogFov = logFov;
      setDebug({ targetLogFov });
    }

    function triggerCardChange(level) {
      triggerLens(level);
    }

    function triggerZoomIn() {
      applyZoomDelta(-FOV_STEP);
    }

    function triggerZoomOut() {
      applyZoomDelta(FOV_STEP);
    }

    function toggleVerticalMotion() {
      invertVerticalMotion = !invertVerticalMotion;
    }

    const orientation = createOrientationController({
      persistBiasKey: "astrovis_gyro_bias",
      getLogFov: () => logFov,
      onDebug: (partial) => setDebug(partial),
      onCoords: ({ yaw, pitch }) => setDebugCoords(yaw, pitch),
      // core's onView emits { yaw, pitch } — its own vocabulary, same as onCoords
      // right above. This app speaks { h, v } toward Stellarium, so the
      // translation belongs here. Destructuring { h, v } off the callback yields
      // undefined and the view never moves.
      onView: ({ yaw, pitch }) => updateStellariumView({ h: yaw, v: pitch }),
      onCalibrationVisibility: (visible) => {
        if (overlayEl) overlayEl.style.display = visible ? "block" : "none";
      },
      onError: (error) => console.error("Sensor error:", error),
    });

    onDebugRecalibrate = triggerRecalibration;
    onDebugCancelCalibration = triggerCancelCalibration;
    onDebugSelectLens = triggerLens;
    onDebugSimulateCardChange = triggerCardChange;
    onDebugZoomIn = triggerZoomIn;
    onDebugZoomOut = triggerZoomOut;
    onDebugToggleVertical = toggleVerticalMotion;

    const keyboardConnector = createKeyboardConnector({
      bindings: {
        c: () => triggerRecalibration(),
        1: () => triggerLens(1),
        2: () => triggerLens(2),
        3: () => triggerLens(3),
        4: () => triggerLens(4),
        5: () => triggerLens(5),
        6: () => triggerLens(6),
        7: () => triggerLens(7),
        8: () => triggerLens(8),
        "+": () => triggerZoomIn(),
        "=": () => triggerZoomIn(),
        "-": () => triggerZoomOut(),
      },
      onError: (error) => console.error("Keyboard connector error:", error),
    });
    keyboardConnector.connect();

    initEngine().catch((err) => {
      console.error("Engine initialization failed:", err);
    });

    orientation.start( CALIBRATE_ON_START );
    const initialLensLevel = appConfig.calibrateOnStart ? 0 : 1;
    applyLensLevel(initialLensLevel);

    const timeUpdateInterval = setInterval(() => {
      setDebug({ engineTime: getEngineTime() });
    }, 1000);

    return () => {
      keyboardConnector.disconnect();
      orientation.stop();
      clearInterval(timeUpdateInterval);
      lastZoomMotion = null;
      onDebugRecalibrate = () => {};
      onDebugCancelCalibration = () => {};
      onDebugSelectLens = () => {};
      onDebugSimulateCardChange = () => {};
      onDebugZoomIn = () => {};
      onDebugZoomOut = () => {};
      onDebugToggleVertical = () => {};
      
    };
  });
</script>

<main>
  <canvas id="stel-canvas" bind:this={canvasEl}></canvas>
  <button
    id="debug-toggle"
    type="button"
    aria-pressed={isDebugPanelVisible}
    on:click={() => (isDebugPanelVisible = !isDebugPanelVisible)}
  >
    {isDebugPanelVisible ? "Ocultar debug" : "Mostrar debug"}
  </button>
  <div class="crosshair" aria-hidden="true"></div>
  <div id="calibration-overlay" bind:this={overlayEl}>
    {#if debugState.preCalibrating}
      {#if debugState.preCalibStatus === "moving"}
        <h2 class="pulse warning-text">MOVIMIENTO DETECTADO</h2>
        <p>Mantenere fermo il telefono...</p>
      {:else}
        <h2 class="pulse">PREPARANDO</h2>
        <p>La calibración empieza en {debugState.preCalibCountdown}...</p>
      {/if}
    {:else if debugState.calibrating}
      <h2 class="pulse">CALIBRANDO SENSORES</h2>
      <p>Mantenga el dispositivo estatico...</p>
    {/if}
  </div>
  {#if isDebugPanelVisible}
    <DebugPanel
      debug={debugState}
      invertVertical={invertVerticalMotion}
      onRecalibrate={onDebugRecalibrate}
      onCancelCalibration={onDebugCancelCalibration}
      onSelectLens={onDebugSelectLens}
      onSimulateCardChange={onDebugSimulateCardChange}
      onZoomIn={onDebugZoomIn}
      onZoomOut={onDebugZoomOut}
      onToggleVertical={onDebugToggleVertical}
      onAddHour={addHour} 
      onSubHour={subHour}
    />
  {/if}
</main>

<style>


  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;

  }

  :global(html),
  :global(body),
  :global(#app) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    transform: rotate(180deg);
  }

  main {
    width: 100%;
    height: 100%;
    position: relative;
  }

  #stel-canvas {
    width: 100%;
    height: 50%;
    display: block;
    position: absolute;
    top:50%;
  }

  #debug-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 50;
    background: rgba(12, 16, 24, 0.82);
    border: 1px solid rgba(0, 212, 255, 0.5);
    color: #d8f7ff;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    font: 12px/1.2 "Consolas", "Courier New", monospace;
  }

  #debug-toggle:hover {
    background: rgba(0, 212, 255, 0.28);
  }

  .crosshair {
    position: absolute;
    top: 75%;
    left: 50%;
    width: 40px;
    height: 40px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 20;
  }

  .crosshair::before,
  .crosshair::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
  }

  .crosshair::before {
    width: 28px;
    height: 2px;
    transform: translate(-50%, -50%);
  }

  .crosshair::after {
    width: 2px;
    height: 28px;
    transform: translate(-50%, -50%);
  }

  #calibration-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #00d4ff;
    padding: 30px 50px;
    border-radius: 15px;
    border: 1px solid #00d4ff;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    text-align: center;
    z-index: 9999;
    display: none;
    pointer-events: none;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    backdrop-filter: blur(5px);
  }

  #calibration-overlay p {
    color: white;
    margin-top: 10px;
    font-size: 1.2rem;
  }

  .warning-text {
    color: #ff3333 !important;
  }

  .pulse {
    animation: pulse-animation 1.5s infinite;
  }

  @keyframes pulse-animation {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }

    @media (min-width: 600px) {
  :global(#app) {
    transform: rotate(0deg);

  }
  #stel-canvas {
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top:0%;
  }

  .crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 20;
  }
}
</style>
