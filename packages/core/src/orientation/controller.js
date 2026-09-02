/**
 * Control de orientación por fusión de sensores (giroscopio + RelativeOrientationSensor / AbsoluteOrientationSensor).
 *
 * Estados: idle -> [readiness gate] -> calibrating -> running.
 * Readiness gates: 'stillness', 'countdown', 'immediate'.
 */

function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function quaternionToEuler(q) {
  if (!q) return { yaw: 0, pitch: 0 };
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return { yaw, pitch };
}

// Hamilton product, [x, y, z, w] — same layout the sensor uses.
function quaternionMultiply(a, b) {
  const [x1, y1, z1, w1] = a;
  const [x2, y2, z2, w2] = b;
  return [
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
  ];
}

// Rota un vector por un quaternion (v' = q v q*).
export function rotateVectorByQuaternion(q, v) {
  const [x, y, z, w] = q;
  const [a, b, c] = v;
  const tx = 2 * (y * c - z * b);
  const ty = 2 * (z * a - x * c);
  const tz = 2 * (x * b - y * a);
  return [a + w * tx + (y * tz - z * ty), b + w * ty + (z * tx - x * tz), c + w * tz + (x * ty - y * tx)];
}

export const OPTICAL_AXES = {
  '+x': [1, 0, 0], '-x': [-1, 0, 0],
  '+y': [0, 1, 0], '-y': [0, -1, 0],
  '+z': [0, 0, 1], '-z': [0, 0, -1],
};

export function quaternionFromAxisAngle(axis, degrees) {
  const half = (degrees * Math.PI) / 360;
  const s = Math.sin(half);
  const c = Math.cos(half);
  if (axis === 'x') return [s, 0, 0, c];
  if (axis === 'y') return [0, s, 0, c];
  if (axis === 'z') return [0, 0, s, c];
  throw new Error(`quaternionFromAxisAngle: eje inválido "${axis}"`);
}

export function createOrientationController({
  gyroFreq = 100,
  relFreq = 30,
  calibDuration = 1,

  fovThreshold = 0.2,
  gyroDeadzone = 0.003,

  dynamicThreshold = 0.06,
  dynamicSmoothingFactor = 0.15,

  readinessGate = 'stillness',
  stillnessThreshold = 0.05,
  stillnessHoldSeconds = 2,
  countdownSeconds = 3,

  persistBiasKey = null,

  // 'relative': RelativeOrientationSensor. 'absolute': AbsoluteOrientationSensor (norte magnético).
  sensorReference = 'relative',

  mountingTransform = (yaw, pitch) => ({ yaw, pitch }),

  // Rotación previa aplicada al quaternion antes de descomponer a Euler.
  mountQuaternion = null,

  // 'euler' (descomposición Euler) o 'vector' (rotación del eje óptico).
  smoothing = { relative: 0.5, gyro: 0.1 },

  pointingMode = 'euler',
  // Clave de OPTICAL_AXES o vector [x, y, z] para modo 'vector'.
  opticalAxis = '+y',

  // Límite de elevación (grados) para acotar la tasa de giro azimutal cerca del cenit.
  zenithRateGuardDeg = 85,

  getLogFov = () => 0.05,
  onDebug = () => {},
  onCoords = () => {},
  onView = () => {},
  onCalibrationVisibility = () => {},
  onError = () => {},
} = {}) {
  const state = {
    gyroSensor: null,
    relSensor: null,
    sensorsStarted: false,

    running: false,
    calibrating: false,
    preCalibrating: false,
    preCalibStatus: 'moving',
    preCalibCountdown: readinessGate === 'countdown' ? countdownSeconds : 2,
    preCalibLastTime: 0,

    gyroBias: { x: 0, y: 0, z: 0 },
    biasSamples: [],
    calibSamplesNeeded: gyroFreq * calibDuration,

    orient: { pitch: 0, yaw: 0 },
    relOrientLast: null,
    currentMode: 'relative',

    oldX: null,
    oldY: null,
    rawDynamicX: null,
    rawDynamicY: null,

    lastTime: null,
    lastV: undefined,
    pendingRAF: false,

    countdownTimer: null,
  };

  const suavizado = { relative: 0.5, gyro: 0.1, ...smoothing };
  let umbralDinamico = dynamicThreshold;

  const opticalVector = Array.isArray(opticalAxis) ? opticalAxis : OPTICAL_AXES[opticalAxis];
  if (pointingMode === 'vector' && !opticalVector) {
    throw new Error(`createOrientationController: opticalAxis inválido "${opticalAxis}"`);
  }

  // Convierte el quaternion a yaw/pitch según pointingMode.
  function quaternionToPointing(q) {
    if (pointingMode !== 'vector') return quaternionToEuler(q);
    const v = rotateVectorByQuaternion(q, opticalVector);
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return {
      pitch: Math.asin(Math.max(-1, Math.min(1, v[2] / n))),
      yaw: Math.atan2(v[0] / n, v[1] / n),
    };
  }

  const TAN_MAX = Math.tan((zenithRateGuardDeg * Math.PI) / 180);

  // Calcula tasas de acimut y altura a partir de la velocidad angular del giroscopio.
  function angularRates(omega, yaw, pitch) {
    if (pointingMode !== 'vector' || !state.relOrientLast) {
      return { yawRate: omega[2], pitchRate: omega[0] };
    }
    const w = rotateVectorByQuaternion(state.relOrientLast, omega);
    const tan = Math.max(-TAN_MAX, Math.min(TAN_MAX, Math.tan(pitch)));
    return {
      pitchRate: w[0] * Math.cos(yaw) - w[1] * Math.sin(yaw),
      yawRate: tan * (w[0] * Math.sin(yaw) + w[1] * Math.cos(yaw)) - w[2],
    };
  }

  // Aplica bias y deadzone en el marco del dispositivo.
  function omegaCorregida() {
    const w = [
      state.gyroSensor.x - state.gyroBias.x,
      state.gyroSensor.y - state.gyroBias.y,
      state.gyroSensor.z - state.gyroBias.z,
    ];
    for (let i = 0; i < 3; i += 1) {
      if (Math.abs(w[i]) < gyroDeadzone) w[i] = 0;
    }
    return w;
  }

  function emitDebug(partial) {
    onDebug(partial);
  }

  function emitCoords(yaw, pitch) {
    const out = mountingTransform(yaw, pitch);
    onCoords({
      yaw: out.yaw,
      pitch: out.pitch,
      yawDeg: (out.yaw * 180) / Math.PI,
      pitchDeg: (out.pitch * 180) / Math.PI,
    });
  }

  function updateView() {
    if (state.pendingRAF) return;
    state.pendingRAF = true;
    requestAnimationFrame(() => {
      const out = mountingTransform(state.oldX, state.oldY);
      onView(out);
      state.pendingRAF = false;
    });
  }

  // ── Bias persistence ─────────────────────────────────────

  function loadPersistedBias() {
    if (!persistBiasKey) return null;
    try {
      const saved = localStorage.getItem(persistBiasKey);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number' && typeof parsed.z === 'number') {
        return parsed;
      }
    } catch (e) {
      onError(e);
    }
    return null;
  }

  function persistBias(bias) {
    if (!persistBiasKey) return;
    try {
      localStorage.setItem(persistBiasKey, JSON.stringify(bias));
    } catch (e) {
      onError(e);
    }
  }

  // ── Calibration: actual sample collection ───────────────

  function startActualCalibration() {
    state.calibrating = true;
    state.biasSamples = [];
    state.calibSamplesNeeded = gyroFreq * calibDuration;
    state.currentMode = 'relative';
    emitDebug({ calibrating: true, preCalibrating: false, activeSource: 'calibration' });
    state.gyroSensor.addEventListener('reading', onCalibReading);
  }

  function onCalibReading() {
    emitDebug({ gyro: { x: state.gyroSensor.x, y: state.gyroSensor.y, z: state.gyroSensor.z } });
    if (state.biasSamples.length < state.calibSamplesNeeded) {
      state.biasSamples.push({ x: state.gyroSensor.x, y: state.gyroSensor.y, z: state.gyroSensor.z });
    } else {
      finishCalibration();
    }
  }

  function finishCalibration() {
    state.calibrating = false;
    onCalibrationVisibility(false);
    state.gyroSensor.removeEventListener('reading', onCalibReading);

    const avg = state.biasSamples.reduce(
      (acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y, z: acc.z + s.z }),
      { x: 0, y: 0, z: 0 },
    );
    const len = state.biasSamples.length || 1;
    state.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };
    persistBias(state.gyroBias);

    if (state.relOrientLast) {
      const euler = quaternionToPointing(state.relOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    } else {
      state.oldX = 0;
      state.oldY = 0;
    }

    state.lastTime = performance.now();
    state.gyroSensor.addEventListener('reading', onSensorReading);
    state.running = true;
    emitDebug({ calibrating: false, activeSource: 'calibration-finished' });
  }

  // ── Readiness gate ────────────────────────────────────────

  function onStillnessReading() {
    const speed = Math.hypot(state.gyroSensor.x, state.gyroSensor.y, state.gyroSensor.z);
    const isMoving = speed > stillnessThreshold;
    const now = performance.now();

    if (isMoving) {
      state.preCalibStatus = 'moving';
      state.preCalibCountdown = stillnessHoldSeconds;
      state.preCalibLastTime = now;
    } else {
      state.preCalibStatus = 'countdown';
      if (now - state.preCalibLastTime >= 1000) {
        state.preCalibLastTime = now;
        state.preCalibCountdown -= 1;
        if (state.preCalibCountdown < 0) {
          state.preCalibrating = false;
          state.gyroSensor.removeEventListener('reading', onStillnessReading);
          startActualCalibration();
          return;
        }
      }
    }

    emitDebug({
      preCalibrating: true,
      preCalibStatus: state.preCalibStatus,
      preCalibCountdown: state.preCalibCountdown,
      activeSource: 'pre-calibration',
    });
  }

  function beginReadinessGate() {
    state.preCalibrating = readinessGate !== 'immediate';
    state.preCalibStatus = readinessGate === 'countdown' ? 'countdown' : 'moving';
    state.preCalibCountdown = readinessGate === 'countdown' ? countdownSeconds : stillnessHoldSeconds;
    state.preCalibLastTime = performance.now();

    if (readinessGate === 'immediate') {
      startActualCalibration();
      return;
    }

    emitDebug({
      preCalibrating: true,
      preCalibStatus: state.preCalibStatus,
      preCalibCountdown: state.preCalibCountdown,
      calibrating: false,
      activeSource: 'pre-calibration',
    });

    if (readinessGate === 'stillness') {
      state.gyroSensor.addEventListener('reading', onStillnessReading);
      return;
    }

    // 'countdown': fixed timer, independent of sensor readings.
    state.countdownTimer = setInterval(() => {
      state.preCalibCountdown -= 1;
      emitDebug({
        preCalibrating: true,
        preCalibStatus: 'countdown',
        preCalibCountdown: state.preCalibCountdown,
        activeSource: 'pre-calibration',
      });
      if (state.preCalibCountdown <= 0) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        state.preCalibrating = false;
        startActualCalibration();
      }
    }, 1000);
  }

  function startCalibration() {
    if (!state.gyroSensor || !state.relSensor) return;

    onCalibrationVisibility(true);
    state.calibrating = false;
    state.running = false;

    state.gyroSensor.removeEventListener('reading', onSensorReading);
    state.gyroSensor.removeEventListener('reading', onCalibReading);
    state.gyroSensor.removeEventListener('reading', onStillnessReading);
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }

    if (!state.sensorsStarted) {
      state.gyroSensor.start();
      state.relSensor.start();
      state.sensorsStarted = true;
    }

    beginReadinessGate();
  }

  function cancelCalibration() {
    if (!state.calibrating && !state.preCalibrating) return;

    state.calibrating = false;
    state.preCalibrating = false;
    state.running = true;
    onCalibrationVisibility(false);

    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }

    if (state.gyroSensor) {
      state.gyroSensor.removeEventListener('reading', onStillnessReading);
      state.gyroSensor.removeEventListener('reading', onCalibReading);
      state.gyroSensor.removeEventListener('reading', onSensorReading);
      state.gyroSensor.addEventListener('reading', onSensorReading);
    }

    if (state.relOrientLast) {
      const euler = quaternionToPointing(state.relOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    }

    state.lastTime = performance.now();
    emitDebug({ calibrating: false, preCalibrating: false, activeSource: 'calibration-cancelled' });
  }

  // ── Live sensor fusion ────────────────────────────────────

  function onRelReading() {
    if (!state.relSensor) return;
    const q = state.relSensor.quaternion;
    // Applied here, at the one place the quaternion is stored, so every consumer
    // downstream decomposes the corrected orientation.
    state.relOrientLast = mountQuaternion ? quaternionMultiply(q, mountQuaternion) : q;
  }

  function runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = fov < fovThreshold ? 'gyro' : 'relative';
    if (requiredMode !== state.currentMode) transitionToMode(requiredMode);

    emitDebug({ activeSensorMode: state.currentMode });

    const sensitivity = state.currentMode === 'gyro' ? suavizado.gyro : suavizado.relative;
    if (state.oldX === null || state.oldY === null) {
      state.oldX = yaw;
      state.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, state.oldX);
    state.oldX += (adjustedYaw - state.oldX) * sensitivity;
    state.oldY += (pitch - state.oldY) * sensitivity;
    updateView();
  }

  function transitionToMode(newMode) {
    if (newMode === 'gyro' && state.currentMode === 'relative') {
      if (state.relOrientLast) {
        const euler = quaternionToPointing(state.relOrientLast);
        state.orient.pitch = euler.pitch;
        state.orient.yaw = euler.yaw;
        state.oldX = euler.yaw;
        state.oldY = euler.pitch;
      }
    } else if (newMode === 'relative' && state.currentMode === 'gyro') {
      if (state.relOrientLast) {
        const euler = quaternionToPointing(state.relOrientLast);
        state.oldX = unwrapAngle(euler.yaw, state.oldX);
        state.oldY = euler.pitch;
      }
    }
    state.currentMode = newMode;
  }

  function onSensorReading() {
    emitDebug({ gyro: { x: state.gyroSensor.x, y: state.gyroSensor.y, z: state.gyroSensor.z } });

    if (state.calibrating) {
      state.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - state.lastTime) / 1000);
    state.lastTime = now;

    let currentV = 0.05;
    try {
      currentV = Math.exp(getLogFov());
    } catch {
      currentV = 0.05;
    }

    const inDynamicZone = currentV < umbralDinamico;

    if (inDynamicZone) {
      if (state.oldX === null || state.oldY === null) {
        if (!state.relOrientLast) return;
        const euler = quaternionToPointing(state.relOrientLast);
        state.oldX = euler.yaw;
        state.oldY = euler.pitch;
        return;
      }

      const { yawRate, pitchRate } = angularRates(omegaCorregida(), state.oldX, state.oldY);

      const rawDeltaYaw = yawRate * dt;
      const rawDeltaPitch = pitchRate * dt;

      const rawZoomRatio = currentV / umbralDinamico;
      let zoomRatio = Math.pow(rawZoomRatio, 1.8);

      const thresholdV = 0.003;
      const minFactor = Math.pow(thresholdV / umbralDinamico, 1.8);
      if (currentV < thresholdV) {
        zoomRatio = minFactor * (currentV / thresholdV);
      }

      const totalFactor = zoomRatio;

      if (state.rawDynamicX === null) {
        state.rawDynamicX = state.oldX;
        state.rawDynamicY = state.oldY;
      }

      state.rawDynamicX += rawDeltaYaw * totalFactor;
      state.rawDynamicY += rawDeltaPitch * totalFactor;

      const k = dynamicSmoothingFactor;
      state.oldX += (state.rawDynamicX - state.oldX) * k;
      state.oldY += (state.rawDynamicY - state.oldY) * k;
      state.orient.yaw = state.oldX;
      state.orient.pitch = state.oldY;

      blendTowardRelativeOnZoomIn(currentV);
      state.lastV = currentV;

      emitDebug({ activeSensorMode: 'dynamic', activeSource: 'gyroscope' });
      emitCoords(state.oldX, state.oldY);
      updateView();
      return;
    }

    state.rawDynamicX = null;
    state.rawDynamicY = null;

    if (state.currentMode === 'relative' && state.relOrientLast) {
      const euler = quaternionToPointing(state.relOrientLast);
      state.orient.pitch = euler.pitch;
      state.orient.yaw = euler.yaw;
      emitDebug({ activeSource: 'relative-orientation' });
    } else {
      const { yawRate, pitchRate } = angularRates(omegaCorregida(), state.orient.yaw, state.orient.pitch);
      state.orient.pitch += pitchRate * dt;
      state.orient.yaw += yawRate * dt;

      blendTowardRelativeOnZoomIn(currentV);
      emitDebug({ activeSource: 'gyroscope' });
    }
    state.lastV = currentV;

    emitCoords(state.orient.yaw, state.orient.pitch);
    runApplicationLogic(state.orient.pitch, state.orient.yaw, currentV);
  }

  // Corrige la deriva acumulada por integración al salir de la zona dinámica.
  function blendTowardRelativeOnZoomIn(currentV) {
    const umbral = Math.max(fovThreshold, umbralDinamico);
    if (umbral <= 0) return;

    if (state.lastV === undefined) state.lastV = currentV;
    const deltaV = currentV - state.lastV;
    if (!(deltaV > 0.000001 && state.relOrientLast && state.lastV < umbral)) return;

    const euler = quaternionToPointing(state.relOrientLast);
    const f = (v) => Math.max(0, 1.0 - Math.pow(v / umbral, 2.5));
    const fLast = f(state.lastV);
    const fCurr = f(currentV);
    const progress = Math.max(0, Math.min(1, fLast > 0.0001 ? 1.0 - fCurr / fLast : 1.0));

    state.orient.pitch += (euler.pitch - state.orient.pitch) * progress;
    const targetYaw = unwrapAngle(euler.yaw, state.orient.yaw);
    state.orient.yaw += (targetYaw - state.orient.yaw) * progress;

    state.oldX = state.orient.yaw;
    state.oldY = state.orient.pitch;
    state.rawDynamicX = state.orient.yaw;
    state.rawDynamicY = state.orient.pitch;
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async function requestIOSPermissionIfNeeded() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  }

  function handleSensorError(sensorName, event) {
    const cause = event?.error;
    const message = cause ? `${cause.name}: ${cause.message}` : 'unknown error';
    onError(new Error(`${sensorName} sensor error (${message}) — check motion sensor permissions`));
    emitDebug({ activeSource: 'sensor-error', failedSensor: sensorName });
  }

  async function startSensors() {
    try {
      emitDebug({ activeSource: 'requesting-permission' });
      await requestIOSPermissionIfNeeded();
      const RefSensor = sensorReference === 'absolute' ? window.AbsoluteOrientationSensor : window.RelativeOrientationSensor;
      const refSensorName = sensorReference === 'absolute' ? 'AbsoluteOrientationSensor' : 'RelativeOrientationSensor';
      if (!('Gyroscope' in window) || typeof RefSensor !== 'function') {
        throw new Error(`Required sensors not available in this browser (${refSensorName})`);
      }

      state.gyroSensor = new Gyroscope({ frequency: gyroFreq });
      state.relSensor = new RefSensor({ frequency: relFreq });
      state.gyroSensor.addEventListener('error', (event) => handleSensorError('gyroscope', event));
      state.relSensor.addEventListener('error', (event) => handleSensorError(refSensorName, event));
      state.relSensor.addEventListener('reading', onRelReading);
      emitDebug({ activeSource: 'sensors-created' });

      const savedBias = loadPersistedBias();
      if (savedBias) {
        state.gyroBias = savedBias;
        if (!state.sensorsStarted) {
          state.lastTime = performance.now();
          state.gyroSensor.addEventListener('reading', onSensorReading);
          state.gyroSensor.start();
          state.relSensor.start();
          state.sensorsStarted = true;
          state.running = true;
        }
      } else {
        startCalibration();
      }
    } catch (error) {
      onError(error);
      emitDebug({ activeSource: 'sensor-error' });
    }
  }

  function start(calibrateOnStart = true) {
    if (!calibrateOnStart) return;
    emitDebug({ activeSource: 'sensor-start' });
    startSensors();
  }

  function stop() {
    state.running = false;
    state.calibrating = false;
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    try { state.gyroSensor?.stop(); } catch { /* no-op */ }
    try { state.relSensor?.stop(); } catch { /* no-op */ }
  }

  return {
    start,
    stop,
    startCalibration,
    cancelCalibration,
    setSmoothing(partial) { Object.assign(suavizado, partial); },
    getSmoothing() { return { ...suavizado }; },
    setDynamicThreshold(v) { umbralDinamico = v; },
    getDynamicThreshold() { return umbralDinamico; },
  };
}
