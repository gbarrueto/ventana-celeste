<script>
  export let debug = {};
  export let onRecalibrate = () => {};
  export let onSelectLens = () => {};
  export let onZoomIn = () => {};
  export let onZoomOut = () => {};
  export let onToggleVertical = () => {};
  export let onCancelCalibration = () => {};
  export let onSimulateCardChange = () => {};
  export let invertVertical = true;
  export let onAddHour;
  export let onSubHour;

  const f = (n) => n.toFixed(2);

  const lensLevels = [1, 2, 3, 4, 5, 6, 7, 8];
  const simulatedCardLevels = [1, 2, 3, 4];

  function fmt(value, digits = 4) {
    return Number.isFinite(value) ? value.toFixed(digits) : "-";
  }
</script>

<aside class="debug-panel" aria-label="Debug panel">
  <h3>Debug panel</h3>

  <section>
      <div class = "row">
        <div>
          <p><strong>Sensor activo:</strong> {debug.activeSensorMode || "-"}</p>
          <p><strong>Fuente:</strong> {debug.activeSource || "-"}</p>
          <p><strong>Calibrando:</strong> {debug.calibrating ? "si" : "no"}</p>
          <p><strong>Entorno:</strong> {debug.env || "-"}</p>
        </div>
        <div>
          <button type="button" on:click={onCancelCalibration}>Cancelar calibración</button>
        </div>
      </div>

  </section>

  <section>
    <h4>Lectura sensores</h4>
    <p>
      <strong>Gyro (rad/s):</strong>
      x {fmt(debug.gyro?.x)} | y {fmt(debug.gyro?.y)} | z {fmt(debug.gyro?.z)}
    </p>
    <p>
      <strong>Quat abs:</strong>
      x {fmt(debug.absQuat?.x)} | y {fmt(debug.absQuat?.y)} | z {fmt(debug.absQuat?.z)} | w {fmt(debug.absQuat?.w)}
    </p>
  </section>
  <section>
  <div class="row">
    <div>
      <h4>Conversion a coordenadas</h4>
      <p><strong>Yaw:</strong> {fmt(debug.coords?.yaw)} rad | {fmt(debug.coords?.yawDeg, 2)} deg</p>
      <p><strong>Pitch:</strong> {fmt(debug.coords?.pitch)} rad | {fmt(debug.coords?.pitchDeg, 2)} deg</p>
    </div>
    <div>
      <h4> Telescope </h4>
      <!-- <p><strong>Name:</strong> {debug.telescope?.name || "-"}</p>
      <p><strong>Type:</strong> {debug.telescope?.type || "-"}</p> -->
      <p><strong>Aperture:</strong> {fmt(debug.telescope?.aperture)}</p>
      <p><strong>Focal length:</strong> {fmt(debug.telescope?.focalLength)}</p>
      <p><strong>Eyepiece focal length:</strong> {fmt(debug.telescope?.eyepieceFocalLength)}</p>
      <p><strong>Magnification:</strong> {fmt(debug.telescope?.magnification)}</p>
      <!-- <p><strong>RA:</strong> {fmt(debug.telescope?.ra)}</p>
      <p><strong>DEC:</strong> {fmt(debug.telescope?.dec)}</p>
      <p><strong>ALT:</strong> {fmt(debug.telescope?.alt)}</p>
      <p><strong>AZ:</strong> {fmt(debug.telescope?.az)}</p> -->
    </div>
  </div>
  </section>
  <section>
    <h4>FOV</h4>
    <p><strong>Actual:</strong> {fmt(debug.fovRad)} rad | {fmt(debug.fovDeg, 2)} deg</p>
    <p><strong>Target log:</strong> {fmt(debug.targetLogFov)}</p>
    <p><strong>ID lente:</strong> {debug.currentLensLevel ?? "-"}</p>
  </section>

  <section>
  <h4>Tiempo Stellarium</h4>
  <p><strong>MJD:</strong> {debug.engineTime?.jdn || "-"}</p>
  <div class="row time-controls">
      <button type="button" on:click={onSubHour}>- 1 hora</button>
      <button type="button" on:click={onAddHour}>+ 1 hora</button>
  </div>
  </section>

  <section class="controls">
    <h4>Controles (simula teclado)</h4>
    <div class="row">
      <button type="button" on:click={onRecalibrate}>c recalibrar</button>
      <button type="button" on:click={onZoomIn}>+ zoom in</button>
      <button type="button" on:click={onZoomOut}>- zoom out</button>
      <button type="button" on:click={onToggleVertical}>
        Vertical: {invertVertical ? "invertida" : "normal"}
      </button>
    </div>

  </section>
</aside>

<style>
  .debug-panel {
    position: absolute;
    right: 12px;
    top: 50px;
    z-index: 40;
    width: min(94vw, 460px);
    height: 40%;
    overflow: auto;
    background: rgba(12, 16, 24, 0.88);
    border: 1px solid rgba(0, 212, 255, 0.45);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    color: #d8f7ff;
    padding: 12px;
    backdrop-filter: blur(6px);
    font: 12px/1.4 "Consolas", "Courier New", monospace;
  }

  h3,
  h4 {
    margin: 0 0 6px;
    color: #8beaff;
  }

  section + section {
    margin-top: 10px;
    border-top: 1px solid rgba(139, 234, 255, 0.2);
    padding-top: 10px;
  }

  p {
    margin: 2px 0;
  }

  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .lens-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(32px, 1fr));
    gap: 6px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    margin-top: 8px;
  }

  .card-remove-btn {
    width: 100%;
    margin-top: 8px;
    background: rgba(255, 80, 80, 0.14);
    border-color: rgba(255, 80, 80, 0.5);
  }

  .card-remove-btn:hover {
    background: rgba(255, 80, 80, 0.3);
  }

  button {
    background: rgba(0, 212, 255, 0.14);
    border: 1px solid rgba(0, 212, 255, 0.5);
    color: #e8fbff;
    border-radius: 8px;
    padding: 6px 8px;
    cursor: pointer;
    font: inherit;
  }

  button:hover {
    background: rgba(0, 212, 255, 0.3);
  }

  .time-controls button {
    flex: 1;
    background: rgba(255, 166, 0, 0.1); /* Un tocco di arancio/ambra per il tempo */
    border-color: rgba(255, 166, 0, 0.4);
  }

  .time-controls button:hover {
    background: rgba(255, 166, 0, 0.25);
  }
</style>
