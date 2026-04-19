/**
 * Device orientation sensors (gyroscope + relative orientation).
 * Replaces: telescope/utils/stellarium.js
 *
 * Logic:
 * - Calibrates gyroscope bias over 3 seconds
 * - Uses RelativeOrientationSensor for wide FOV (> 0.8 rad)
 * - Switches to Gyroscope integration for narrow FOV (< 0.8 rad)
 * - "Dynamic zone" for very narrow FOV (< 0.02 rad) with precision gain + smoothing
 * - Debug overlay shows pitch, yaw, mode, FOV, status (hidden by default)
 * - Sends updateView messages to the viewer via Protobject
 */
import { updateStellariumView } from './stellarium.js';
import { eventManager } from './protobject.js';
import { logFov } from './stores.js';

function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// ── Calibration overlay (full-screen, shown at startup) ───

function createCalibOverlay() {
  const el = document.createElement('div');
  el.id = 'calib-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '999999',
    background: 'rgba(6, 8, 15, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e8ecf5',
    transition: 'opacity 0.4s',
  });

  const icon = document.createElement('div');
  Object.assign(icon.style, {
    fontSize: '40px',
    marginBottom: '8px',
  });
  icon.textContent = '\u{1F4F1}';

  const msg = document.createElement('div');
  msg.id = 'calib-msg';
  Object.assign(msg.style, {
    fontSize: '18px',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: '1.4',
  });

  const sub = document.createElement('div');
  sub.id = 'calib-sub';
  Object.assign(sub.style, {
    fontSize: '14px',
    opacity: '0.5',
    textAlign: 'center',
  });

  el.appendChild(icon);
  el.appendChild(msg);
  el.appendChild(sub);
  document.body.appendChild(el);

  return {
    el,
    setMessage(text, subtext = '') {
      msg.textContent = text;
      sub.textContent = subtext;
    },
    dismiss() {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    },
  };
}

// ── Debug overlay (hidden by default) ─────────────────────

function createDebugOverlay() {
  const ID = 'dbg-pitch-yaw';
  let el = document.getElementById(ID);
  if (!el) {
    el = document.createElement('div');
    el.id = ID;
    Object.assign(el.style, {
      position: 'fixed',
      left: '8px',
      bottom: '108px',
      zIndex: '214793647',
      background: 'rgba(0,0,0,0.85)',
      color: '#0f0',
      padding: '8px 10px',
      borderRadius: '6px',
      fontFamily: 'monospace, monospace',
      fontSize: '12px',
      lineHeight: '1.3',
      pointerEvents: 'auto',
      whiteSpace: 'pre',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      borderLeft: '3px solid #0f0',
      display: 'none', // hidden by default
    });
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  function updateDisplay(pitch, yaw, info = {}) {
    const p = (typeof pitch === 'number') ? pitch : 0;
    const y = (typeof yaw === 'number') ? yaw : 0;
    const vVal = info.vVal !== undefined ? info.vVal.toFixed(4) : '-';
    const mode = info.mode || '-';
    const status = info.status || '';

    el.textContent =
      `V (exp): ${vVal} [${mode.toUpperCase()}]\n` +
      `Pitch:   ${p.toFixed(5)}\n` +
      `Yaw:     ${y.toFixed(5)}\n` +
      `Status:  ${status}`;

    el.style.borderLeftColor = (mode === 'DYNAMIC') ? '#ff0' : '#0f0';
  }

  // Click to recalibrate
  el.addEventListener('click', () => {
    if (Orientation.running || Orientation.calibrating) {
      Orientation.startCalibration();
    }
  });

  return updateDisplay;
}

// ── Public: toggle debug overlay visibility ───────────────

export function showDebugOverlay() {
  const el = document.getElementById('dbg-pitch-yaw');
  if (el) el.style.display = 'block';
}

export function hideDebugOverlay() {
  const el = document.getElementById('dbg-pitch-yaw');
  if (el) el.style.display = 'none';
}

export function isDebugOverlayVisible() {
  const el = document.getElementById('dbg-pitch-yaw');
  return el ? el.style.display !== 'none' : false;
}

// ── Orientation controller ─────────────────────────────────

export const Orientation = {
  // --- General config ---
  gyroFreq: 100,
  relFreq: 30,
  calibDuration: 3,

  // --- Real zone config ---
  fovThreshold: 0.8,
  gyroDeadzone: 0.003,

  // --- Dynamic zone config ---
  dynamicThreshold: 0.02,
  dynamicGainMultiplier: 10.0,
  dynamicSmoothingFactor: 0.15,

  // --- State ---
  gyroSensor: null,
  relSensor: null,
  running: false,
  calibrating: false,
  gyroBias: { x: 0, y: 0, z: 0 },
  biasSamples: [],
  calibSamplesNeeded: 300,

  orient: { pitch: 0, yaw: 0 },
  relOrientLast: null,
  currentMode: 'relative',

  oldX: null,
  oldY: null,

  // Dynamic zone raw targets (for smoothing filter)
  rawDynamicX: null,
  rawDynamicY: null,

  lastTime: null,
  _pendingRAF: false,
  _updateDebug: null,
  _calibOverlay: null,
  _isFirstCalibration: true,

  quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return { yaw, pitch };
  },

  start() {
    this._updateDebug = createDebugOverlay();
    this._isFirstCalibration = true;
    this.onCalibReading = this.onCalibReading.bind(this);
    this.onSensorReading = this.onSensorReading.bind(this);
    this.onRelReading = this.onRelReading.bind(this);
    this.startSensors();
  },

  stop() {
    this.running = false;
    this.calibrating = false;
    try { this.gyroSensor?.stop(); } catch {}
    try { this.relSensor?.stop(); } catch {}
    const el = document.getElementById('dbg-pitch-yaw');
    if (el) el.remove();
    if (this._calibOverlay?.el?.parentNode) this._calibOverlay.el.remove();
  },

  async requestIOSPermissionIfNeeded() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  },

  async startSensors() {
    try {
      await this.requestIOSPermissionIfNeeded();
      if (!('Gyroscope' in window) || !('RelativeOrientationSensor' in window)) {
        throw new Error('Sensores necesarios no disponibles');
      }
      this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
      this.relSensor = new RelativeOrientationSensor({ frequency: this.relFreq });

      this.gyroSensor.addEventListener('error', (e) => console.error('Error Gyro:', e));
      this.relSensor.addEventListener('error', (e) => console.error('Error RelOrientation:', e));

      this.startCalibration();
    } catch (err) {
      console.error('Error al iniciar sensores:', err);
      this._updateDebug?.(0, 0, { status: 'Error: ' + err.message });
    }
  },

  startCalibration() {
    if (!this.gyroSensor || !this.relSensor) return;
    this.calibrating = true;
    this.running = false;
    this.biasSamples = [];
    this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;
    this.currentMode = 'relative';

    if (this._isFirstCalibration) {
      this._calibOverlay = createCalibOverlay();
      this._startCountdown();
    } else {
      this._updateDebug?.(0, 0, { status: 'Calibrating...' });
      this._beginSensorCalibration();
    }
  },

  _startCountdown() {
    let remaining = this.calibDuration;
    this._calibOverlay.setMessage(
      'Mantén el teléfono quieto',
      `Calibración en ${remaining}...`,
    );

    const countdownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        this._calibOverlay.setMessage(
          'Mantén el teléfono quieto',
          `Calibración en ${remaining}...`,
        );
      } else {
        clearInterval(countdownTimer);
        this._calibOverlay.setMessage('Calibrando...', 'No muevas el teléfono');
        this._beginSensorCalibration();
      }
    }, 1000);
  },

  _beginSensorCalibration() {
    this.biasSamples = [];
    this.gyroSensor.addEventListener('reading', this.onCalibReading);
    this.relSensor.addEventListener('reading', this.onRelReading);
    this.gyroSensor.start();
    this.relSensor.start();
  },

  onCalibReading() {
    if (this.biasSamples.length < this.calibSamplesNeeded) {
      this.biasSamples.push({
        x: this.gyroSensor.x,
        y: this.gyroSensor.y,
        z: this.gyroSensor.z,
      });
    } else {
      this.finishCalibration();
    }
  },

  finishCalibration() {
    this.calibrating = false;
    this.gyroSensor.removeEventListener('reading', this.onCalibReading);

    const avg = this.biasSamples.reduce(
      (acc, r) => ({ x: acc.x + r.x, y: acc.y + r.y, z: acc.z + r.z }),
      { x: 0, y: 0, z: 0 },
    );
    const len = this.biasSamples.length || 1;
    this.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };

    console.log('Calibración completada. Bias:', this.gyroBias);

    if (this.relOrientLast) {
      const euler = this.quaternionToEuler(this.relOrientLast);
      this.oldX = euler.yaw;
      this.oldY = euler.pitch;
    }

    this.lastTime = performance.now();
    this.gyroSensor.addEventListener('reading', this.onSensorReading);
    this.running = true;

    if (this._isFirstCalibration && this._calibOverlay) {
      this._calibOverlay.setMessage('Calibración completada');
      setTimeout(() => {
        this._calibOverlay.dismiss();
        this._calibOverlay = null;
      }, 2000);
      this._isFirstCalibration = false;
    }
  },

  onRelReading() {
    if (!this.relSensor) return;
    this.relOrientLast = this.relSensor.quaternion;
  },

  onSensorReading() {
    if (this.calibrating) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - this.lastTime) / 1000);
    this.lastTime = now;

    let currentV = 0.05;
    try { currentV = Math.exp(logFov); } catch {}

    const inDynamicZone = currentV < this.dynamicThreshold;

    if (inDynamicZone) {
      // =========================================================
      // DYNAMIC ZONE (< 0.02) - Precision + Smoothing
      // =========================================================

      let wx = this.gyroSensor.x - this.gyroBias.x;
      let wz = this.gyroSensor.z - this.gyroBias.z;

      let rawDeltaYaw = wz * dt;
      let rawDeltaPitch = wx * dt;

      // Gain calculation
      const zoomRatio = currentV / this.dynamicThreshold;
      const speed = Math.hypot(rawDeltaYaw, rawDeltaPitch);
      const noiseFloor = 0.002;

      let precisionGain;
      if (speed < noiseFloor) {
        precisionGain = 0.05;
      } else {
        precisionGain = Math.min(1.0, Math.pow(speed * 100, 2));
      }

      const totalFactor = zoomRatio * precisionGain * this.dynamicGainMultiplier;

      // Step 1: Update raw target
      if (this.rawDynamicX === null) {
        this.rawDynamicX = this.oldX;
        this.rawDynamicY = this.oldY;
      }

      this.rawDynamicX += rawDeltaYaw * totalFactor;
      this.rawDynamicY += rawDeltaPitch * totalFactor;

      // Step 2: Apply smoothing filter
      const k = this.dynamicSmoothingFactor;
      this.oldX += (this.rawDynamicX - this.oldX) * k;
      this.oldY += (this.rawDynamicY - this.oldY) * k;

      // Sync orient to avoid jumps when returning to real zone
      this.orient.yaw = this.oldX;
      this.orient.pitch = this.oldY;

      this.updateView(currentV, 'DYNAMIC');

    } else {
      // =========================================================
      // REAL ZONE (>= 0.02) - Relative or Gyro
      // =========================================================

      // Reset dynamic zone variables
      this.rawDynamicX = null;
      this.rawDynamicY = null;

      if (this.currentMode === 'relative' && this.relOrientLast) {
        const euler = this.quaternionToEuler(this.relOrientLast);
        this.orient.pitch = euler.pitch;
        this.orient.yaw = euler.yaw;
      } else {
        let wx = this.gyroSensor.x - this.gyroBias.x;
        let wz = this.gyroSensor.z - this.gyroBias.z;
        if (Math.abs(wx) < this.gyroDeadzone) wx = 0;
        if (Math.abs(wz) < this.gyroDeadzone) wz = 0;
        this.orient.pitch += wx * dt;
        this.orient.yaw += wz * dt;
      }

      this.runApplicationLogic(this.orient.pitch, this.orient.yaw, currentV);
    }
  },

  // --- Application logic (real zone) ---
  runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = (fov < this.fovThreshold) ? 'gyro' : 'relative';

    if (requiredMode !== this.currentMode) {
      this.transitionToMode(requiredMode);
    }

    const sensitivity = (this.currentMode === 'gyro') ? 0.1 : 0.5;

    if (this.oldX === null || this.oldY === null) {
      this.oldX = yaw;
      this.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, this.oldX);

    this.oldX += (adjustedYaw - this.oldX) * sensitivity;
    this.oldY += (pitch - this.oldY) * sensitivity;

    this.updateView(fov, this.currentMode);
  },

  transitionToMode(newMode) {
    if (newMode === 'gyro' && this.currentMode === 'relative') {
      if (this.relOrientLast) {
        const euler = this.quaternionToEuler(this.relOrientLast);
        this.orient.pitch = euler.pitch;
        this.orient.yaw = euler.yaw;
        this.oldX = euler.yaw;
        this.oldY = euler.pitch;
      }
    } else if (newMode === 'relative' && this.currentMode === 'gyro') {
      if (this.relOrientLast) {
        const euler = this.quaternionToEuler(this.relOrientLast);
        this.oldX = unwrapAngle(euler.yaw, this.oldX);
        this.oldY = euler.pitch;
      }
    }
    this.currentMode = newMode;
  },

  updateView(vVal, modeName) {
    const h = this.oldX;
    const v = this.oldY;

    // Update debug overlay
    this._updateDebug?.(v, h, {
      vVal: vVal,
      mode: modeName,
      status: 'Running',
    });

    // Send to viewer via throttled protobject
    try {
      eventManager.sendThrottled(
        { msg: 'updateView', values: { h, v } },
        'index.html',
        20,
      );
    } catch (e) {
      if (typeof Protobject !== 'undefined') {
        Protobject.Core.send({ msg: 'updateView', values: { h, v } }).to('index.html');
      }
    }

    // Update local guidescope at most once per animation frame
    if (!this._pendingRAF) {
      this._pendingRAF = true;
      requestAnimationFrame(() => {
        updateStellariumView({ h, v });
        this._pendingRAF = false;
      });
    }
  },
};
