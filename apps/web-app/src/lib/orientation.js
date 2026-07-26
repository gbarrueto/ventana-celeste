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
import { createOrientationController } from '@ventanaceleste/core';
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
    background: 'rgba(6, 8, 15, 0.97)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    padding: '32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e8ecf5',
    transition: 'opacity 0.4s',
    boxSizing: 'border-box',
  });

  const icon = document.createElement('div');
  Object.assign(icon.style, { fontSize: '48px', lineHeight: '1' });
  icon.textContent = '📱';

  const msg = document.createElement('div');
  Object.assign(msg.style, {
    fontSize: '20px',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: '1.3',
    color: '#ffffff',
  });

  const sub = document.createElement('div');
  Object.assign(sub.style, {
    fontSize: '15px',
    color: 'rgba(232,236,245,0.6)',
    textAlign: 'center',
    lineHeight: '1.5',
    maxWidth: '300px',
  });

  // Calibrate button (only shown in instruction phase)
  const btn = document.createElement('button');
  btn.textContent = 'Calibrar';
  Object.assign(btn.style, {
    marginTop: '12px',
    padding: '14px 48px',
    fontSize: '16px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff7a0d, #ff5500)',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    boxShadow: '0 4px 20px rgba(255,122,13,0.4)',
    display: 'none',
  });

  // Progress dots (shown during calibration)
  const dots = document.createElement('div');
  Object.assign(dots.style, {
    display: 'none',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
  });
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    Object.assign(d.style, {
      width: '8px', height: '8px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.25)',
      transition: 'background 0.3s',
    });
    dots.appendChild(d);
  }

  el.appendChild(icon);
  el.appendChild(msg);
  el.appendChild(sub);
  el.appendChild(btn);
  el.appendChild(dots);
  document.body.appendChild(el);

  let dotsInterval = null;
  let dotIdx = 0;

  function startDots() {
    dots.style.display = 'flex';
    const dotEls = dots.querySelectorAll('div');
    dotsInterval = setInterval(() => {
      dotEls.forEach((d, i) => {
        d.style.background = i === dotIdx % 3 ? '#ff7a0d' : 'rgba(255,255,255,0.25)';
      });
      dotIdx++;
    }, 300);
  }

  function stopDots() {
    clearInterval(dotsInterval);
    dots.style.display = 'none';
  }

  return {
    el,
    // Phase: 'instruction' | 'countdown' | 'calibrating' | 'done'
    setPhase(phase, extra = '') {
      btn.style.display = 'none';
      stopDots();
      switch (phase) {
        case 'instruction':
          icon.textContent = '📱';
          msg.textContent = 'Calibración necesaria';
          sub.textContent = 'Apoya el teléfono sobre una superficie plana y, sin moverlo, pulsa el botón para calibrar.';
          btn.textContent = 'Calibrar';
          btn.style.display = 'block';
          break;
        case 'countdown':
          icon.textContent = '⏱';
          msg.textContent = 'Mantén el teléfono completamente inmóvil';
          sub.textContent = extra || 'Comenzando...';
          break;
        case 'calibrating':
          icon.textContent = '⚙️';
          msg.textContent = 'Calibrando sensores';
          sub.textContent = 'No muevas el teléfono...';
          startDots();
          break;
        case 'done':
          icon.textContent = '✅';
          msg.textContent = '¡Listo!';
          sub.textContent = 'Ya puedes apuntar el telescopio hacia el cielo.';
          break;
        case 'error':
          icon.textContent = '⚠️';
          msg.textContent = 'No se pudo calibrar';
          sub.textContent = extra || 'Revisá los permisos de sensores de movimiento del navegador.';
          btn.textContent = 'Reintentar';
          btn.style.display = 'block';
          break;
      }
    },
    onCalibrate(callback) {
      // No { once: true }: the same button is reused for the initial "Calibrar"
      // tap and for "Reintentar" after an error (see the 'error' phase).
      btn.addEventListener('click', callback);
    },
    // Legacy compat
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

// ── Orientation: web-app adapter around @ventanaceleste/core ──
// DOM/overlay concerns (above) and Protobject transport (sendView) stay
// here; the sensor fusion/calibration state machine itself lives in
// @ventanaceleste/core so it's shared with the other apps.

let controller = null;
let updateDebug = null;
let calibOverlay = null;
let isFirstCalibration = true;
let isRunning = false;
let isCalibrating = false;
let lastYaw = 0;
let lastPitch = 0;
let debugState = {};

function sendView({ h, v }) {
  eventManager.sendThrottled({ msg: 'updateView', values: { h, v } }, 'index.html', 20);
  updateStellariumView({ h, v });
}

function handleDebug(partial) {
  debugState = { ...debugState, ...partial };
  if (typeof partial.calibrating === 'boolean') isCalibrating = partial.calibrating;
  if (partial.activeSource === 'calibration-finished') isRunning = true;

  if (partial.activeSource) {
    console.info('[Orientation]', partial.activeSource, partial.failedSensor ?? '');
  }

  if (partial.preCalibrating) {
    calibOverlay?.setPhase('countdown', `Comenzando en ${partial.preCalibCountdown}...`);
  } else if (partial.calibrating) {
    calibOverlay?.setPhase('calibrating');
  } else if (partial.activeSource === 'sensor-error') {
    updateDebug?.(0, 0, { status: 'Error: sensor no disponible' });
    return;
  }

  updateDebug?.(lastPitch, lastYaw, {
    vVal: Math.exp(logFov),
    mode: debugState.activeSensorMode,
    status: isRunning ? 'Running' : 'Calibrating',
  });
}

function beginCalibrationFlow() {
  if (isFirstCalibration) {
    calibOverlay = createCalibOverlay();
    calibOverlay.setPhase('instruction');
    calibOverlay.onCalibrate(() => {
      calibOverlay.setPhase('countdown', 'Comenzando...');
      // First run: sensors haven't been created yet, so we need controller.start()
      // (which creates + starts them, then triggers the readiness gate/calibration),
      // not startCalibration() (which assumes sensors already exist and no-ops otherwise).
      console.info('[Orientation] requesting sensor access...');
      controller.start();
    });
  } else {
    // Recalibrations triggered from the debug overlay skip the full-screen
    // instruction/countdown UI entirely — only the small debug readout
    // (driven by handleDebug) shows progress, matching the original flow.
    calibOverlay = null;
    controller.startCalibration();
  }
}

export const Orientation = {
  get running() {
    return isRunning;
  },
  get calibrating() {
    return isCalibrating;
  },

  start() {
    updateDebug = createDebugOverlay();
    isFirstCalibration = true;
    isRunning = false;
    isCalibrating = false;
    debugState = {};

    controller = createOrientationController({
      readinessGate: 'countdown',
      countdownSeconds: 3,
      calibDuration: 3,
      fovThreshold: 0.8,
      gyroDeadzone: 0.003,
      dynamicThreshold: 0.02,
      dynamicSmoothingFactor: 0.15,
      getLogFov: () => logFov,
      onDebug: handleDebug,
      onCoords: ({ yaw, pitch }) => {
        lastYaw = yaw;
        lastPitch = pitch;
      },
      onView: sendView,
      onCalibrationVisibility: (visible) => {
        if (visible) return;
        calibOverlay?.setPhase('done');
        const overlay = calibOverlay;
        setTimeout(() => {
          overlay?.dismiss();
          if (calibOverlay === overlay) calibOverlay = null;
        }, 1800);
        isFirstCalibration = false;
      },
      onError: (err) => {
        console.error('[Orientation] error:', err);
        updateDebug?.(0, 0, { status: 'Error: ' + err.message });
        calibOverlay?.setPhase('error', err.message);
      },
    });

    beginCalibrationFlow();
  },

  stop() {
    controller?.stop();
    const el = document.getElementById('dbg-pitch-yaw');
    if (el) el.remove();
    if (calibOverlay?.el?.parentNode) calibOverlay.el.remove();
    calibOverlay = null;
  },

  // Triggered by clicking the debug overlay to recalibrate.
  startCalibration() {
    if (!controller) return;
    beginCalibrationFlow();
  },
};
