/**
 * Device orientation sensors (gyroscope + RelativeOrientationSensor fusion).
 *
 * Framework-agnostic: no DOM, no Svelte, no transport. A factory + callbacks,
 * so each app wires its own UI/transport around it.
 *
 * State machine: idle -> [readiness gate] -> calibrating (sampling) -> running.
 * The readiness gate is how each app decides *when* to start sampling:
 *   - 'stillness'  : wait until the device stops moving for N seconds (kiosk's
 *                    original behavior — good for an unattended installed device).
 *   - 'countdown'  : fixed N-second "get ready" timer, no motion check (web-app's
 *                    original behavior — good right after a user taps "Calibrate").
 *   - 'immediate'  : skip the gate, start sampling as soon as sensors are ready.
 *
 * Mounting transform: different physical mountings (phone in hand vs. taped
 * sideways to a Newtonian eyepiece, etc.) need different offsets applied to
 * the raw sensor reading before it becomes canonical yaw/pitch. Rather than
 * one controller implementation per mounting, `mountingTransform` adapts a
 * single implementation — it's applied only at the two output points
 * (onView/onCoords), never to the internal state used for continuity math.
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

  mountingTransform = (yaw, pitch) => ({ yaw, pitch }),

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
      const euler = quaternionToEuler(state.relOrientLast);
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
      const euler = quaternionToEuler(state.relOrientLast);
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
    state.relOrientLast = state.relSensor.quaternion;
  }

  function runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = fov < fovThreshold ? 'gyro' : 'relative';
    if (requiredMode !== state.currentMode) transitionToMode(requiredMode);

    emitDebug({ activeSensorMode: state.currentMode });

    const sensitivity = state.currentMode === 'gyro' ? 0.1 : 0.5;
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
        const euler = quaternionToEuler(state.relOrientLast);
        state.orient.pitch = euler.pitch;
        state.orient.yaw = euler.yaw;
        state.oldX = euler.yaw;
        state.oldY = euler.pitch;
      }
    } else if (newMode === 'relative' && state.currentMode === 'gyro') {
      if (state.relOrientLast) {
        const euler = quaternionToEuler(state.relOrientLast);
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

    const inDynamicZone = currentV < dynamicThreshold;

    if (inDynamicZone) {
      const wx = state.gyroSensor.x - state.gyroBias.x;
      const wz = state.gyroSensor.z - state.gyroBias.z;
      let effWx = wx;
      let effWz = wz;
      if (Math.abs(effWx) < gyroDeadzone) effWx = 0;
      if (Math.abs(effWz) < gyroDeadzone) effWz = 0;

      const rawDeltaYaw = effWz * dt;
      const rawDeltaPitch = effWx * dt;

      const rawZoomRatio = currentV / dynamicThreshold;
      let zoomRatio = Math.pow(rawZoomRatio, 1.8);

      const thresholdV = 0.003;
      const minFactor = Math.pow(thresholdV / dynamicThreshold, 1.8);
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
      const euler = quaternionToEuler(state.relOrientLast);
      state.orient.pitch = euler.pitch;
      state.orient.yaw = euler.yaw;
      emitDebug({ activeSource: 'relative-orientation' });
    } else {
      let wx = state.gyroSensor.x - state.gyroBias.x;
      let wz = state.gyroSensor.z - state.gyroBias.z;
      if (Math.abs(wx) < gyroDeadzone) wx = 0;
      if (Math.abs(wz) < gyroDeadzone) wz = 0;
      state.orient.pitch += wx * dt;
      state.orient.yaw += wz * dt;

      blendTowardRelativeOnZoomIn(currentV);
      emitDebug({ activeSource: 'gyroscope' });
    }
    state.lastV = currentV;

    emitCoords(state.orient.yaw, state.orient.pitch);
    runApplicationLogic(state.orient.pitch, state.orient.yaw, currentV);
  }

  // When zooming back out through the dynamic-zone boundary, blend the
  // dynamic-zone drift back toward the real relative-orientation reading
  // instead of snapping, so the view doesn't jump.
  function blendTowardRelativeOnZoomIn(currentV) {
    if (state.lastV === undefined) state.lastV = currentV;
    const deltaV = currentV - state.lastV;
    if (!(deltaV > 0.000001 && state.relOrientLast && state.lastV < fovThreshold)) return;

    const euler = quaternionToEuler(state.relOrientLast);
    const f = (v) => Math.max(0, 1.0 - Math.pow(v / fovThreshold, 2.5));
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
      if (!('Gyroscope' in window) || !('RelativeOrientationSensor' in window)) {
        throw new Error('Required sensors not available in this browser');
      }

      state.gyroSensor = new Gyroscope({ frequency: gyroFreq });
      state.relSensor = new RelativeOrientationSensor({ frequency: relFreq });
      state.gyroSensor.addEventListener('error', (event) => handleSensorError('gyroscope', event));
      state.relSensor.addEventListener('error', (event) => handleSensorError('relative-orientation', event));
      state.relSensor.addEventListener('reading', onRelReading);
      emitDebug({ activeSource: 'sensors-created' });

      const savedBias = loadPersistedBias();
      if (savedBias) {
        state.gyroBias = savedBias;
        if (!state.sensorsStarted) {
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

  return { start, stop, startCalibration, cancelCalibration };
}
