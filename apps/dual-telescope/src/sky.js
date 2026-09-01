// Lógica compartida para las vistas de Ocular y Guía.
import { initializeStellariumEngine, createOrientationController } from '@ventanaceleste/core';
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';
import { connect, fetchLinkConfig } from './link.js';
import { createFocuser, aplicarBlur } from './focuser.js';
import { cargarAjustes, crearPanel, PANTALLA_GRANDE, UMBRAL_DINAMICO } from './panel.js';

const ROLE = {
  ocular: { extended: true, label: 'Ocular' },
  guide: { extended: false, label: 'Guía' },
};

const SUAVIZADO = 0.10;

const SMALL = 'https://smalldata.ventanaceleste.com/';
const BIG = 'https://bigdata.ventanaceleste.com/';

// Ajusta tamaño, posición y rotación del canvas según el rol y recorte de pantalla.
function acomodarVista(canvas, ajustes, { recortarSiempre }) {
  const mira = document.querySelector('.crosshair');
  const grande = window.matchMedia(PANTALLA_GRANDE);

  const aplicar = () => {
    if (!recortarSiempre && grande.matches) {
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
      if (mira) mira.style.top = '50%';
      return;
    }

    const altoArea = window.innerHeight * ajustes.fraccion;
    const anchoArea = window.innerWidth;
    const rotado = Math.abs(ajustes.rot % 180) === 90;
    const centro = window.innerHeight * ajustes.pos;
    canvas.style.position = 'fixed';
    canvas.style.inset = 'auto';
    canvas.style.left = '50%';
    canvas.style.top = `${centro}px`;
    canvas.style.width = `${rotado ? altoArea : anchoArea}px`;
    canvas.style.height = `${rotado ? anchoArea : altoArea}px`;
    canvas.style.transform = `translate(-50%, -50%) rotate(${ajustes.rot}deg)`;
    canvas.style.transformOrigin = 'center';
    if (mira) mira.style.top = `${centro}px`;
  };

  aplicar();
  window.addEventListener('resize', aplicar);
  window.addEventListener('orientationchange', aplicar);
  grande.addEventListener('change', aplicar);
  return aplicar;
}

// Aviso de calibración en pantalla.
function crearAvisoCalibracion() {
  const el = document.createElement('div');
  el.className = 'calib-aviso';
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

export async function startSky({ role, statusEl, canvas }) {
  const cfg = ROLE[role];
  const other = role === 'ocular' ? 'guide' : 'ocular';
  const say = (t) => { if (statusEl) statusEl.textContent = t; };

  const avisoCalib = crearAvisoCalibracion();
  const mostrarCalibracion = (visible) => {
    avisoCalib.style.display = visible ? 'block' : 'none';
    if (visible && !avisoCalib.textContent) avisoCalib.textContent = 'calibrando…';
  };
  const textoCalibracion = (t) => { avisoCalib.textContent = t; };

  // Antes de arrancar el motor: los dos roles retoman el zoom guardado. Los
  // valores por defecto por rol son los de ROLE, sólo que ahora ajustables.
  const ajustes = cargarAjustes(role);
  const fovInicial = ajustes.fov;

  say('cargando motor…');
  const engine = await initializeStellariumEngine({
    canvas,
    wasmFile: engineWasmUrl,
    scriptUrl: engineScriptUrl,
    smalldataBaseUrl: SMALL,
    bigdataBaseUrl: BIG,
    extended: cfg.extended,
    location: { lat: -24.6272, lon: -70.4042, elev: 2635 },
    time: { offsetHours: -3 },
    strict: false,
    onReady(stel) {
      stel.core.atmosphere.visible = false;
      stel.core.landscapes.visible = true;
      stel.core.cardinals.visible = true;
      stel.core.constellations.lines_visible = true;
      stel.core.fov = fovInicial;
    },
  });

  // Se vuelve a fijar después de que la inicialización resolvió: setearlo sólo
  // dentro de onReady no alcanzaba y el guía quedaba con el FOV por defecto.
  if (engine?.core) engine.core.fov = fovInicial;

  let controller = null;
  let focuser = null;
  let panel = null;

  // El zoom se lleva en logaritmo porque es lo que consume el controlador para
  // decidir si está en la zona dinámica.
  let logFov = Math.log(fovInicial);
  const aplicarFov = (fov) => {
    logFov = Math.log(fov);
    if (engine?.core) engine.core.fov = fov;
  };

  // El ocular se recorta siempre, porque va dentro del tubo. El guía sólo en
  // pantalla chica: en el monitor conviene a pantalla completa.
  const reacomodar = acomodarVista(canvas, ajustes, { recortarSiempre: role === 'ocular' });

  const bus = connect({ role, onStatus: (s) => say(`${cfg.label} · enlace ${s}`) });
  const { sensorSource, addresses } = await fetchLinkConfig();
  const isSource = sensorSource === role;

  const apply = (yaw, pitch) => {
    if (!engine?.core?.observer) return;
    engine.core.observer.yaw = yaw;
    engine.core.observer.pitch = pitch;
  };

  if (isSource) {
    controller = createOrientationController({
      pointingMode: 'vector',
      opticalAxis: '-y',
      sensorReference: 'absolute',
      fovThreshold: 0,
      dynamicThreshold: UMBRAL_DINAMICO,
      getLogFov: () => logFov,
      readinessGate: 'stillness',
      stillnessHoldSeconds: 2,
      calibDuration: 2,
      persistBiasKey: 'dual-telescope:gyro-bias',
      onCalibrationVisibility: (visible) => mostrarCalibracion(visible),
      onDebug: ({ preCalibStatus, preCalibCountdown }) => {
        if (preCalibStatus === 'moving') textoCalibracion('mantén el telescopio quieto');
        else if (preCalibStatus === 'countdown') textoCalibracion(`calibrando en ${Math.max(0, preCalibCountdown)}…`);
      },
      smoothing: { relative: SUAVIZADO, gyro: SUAVIZADO },
      onView: ({ yaw, pitch }) => {
        apply(yaw, pitch);
        bus.sendThrottled('pose', { yaw, pitch }, other, 20);
      },
      onError: (e) => say(`sensor: ${e.message}`),
    });
    controller.start();
    say(`${cfg.label} · fuente de orientación`);
  } else {
    // Interpolación en el receptor.
    let target = null;
    let current = null;
    bus.on('pose', (v) => { target = v; });

    const step = () => {
      if (target) {
        if (!current) current = { ...target };
        else {
          const k = 0.25;
          let d = target.yaw - current.yaw;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          current.yaw += d * k;
          current.pitch += (target.pitch - current.pitch) * k;
        }
        apply(current.yaw, current.pitch);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    say(`${cfg.label} · recibiendo de ${sensorSource}`);
  }

  // --- Panel de depuración ---------------------------------------------
  panel = crearPanel({
    role,
    ajustes,
    esFuente: isSource,
    onChange: (clave) => {
      if (clave === 'fov') { aplicarFov(ajustes.fov); return; }
      if (clave === 'fraccion') ajustes.pos = ajustes.fraccion / 2;
      reacomodar();
    },
    onRecalibrar: () => controller?.startCalibration(),
  });
  panel.setDirecciones(addresses);

  if (statusEl) {
    statusEl.style.cssText = 'position:static;background:none;border:none;padding:0';
    panel.caja.appendChild(statusEl);
  }

  // --- Enfocador -------------------------------------------------------
  if (role === 'ocular') {
    focuser = createFocuser({
      onBlur: ({ blur, position }) => {
        aplicarBlur(canvas, blur);
        bus.sendThrottled('focus', { blur, position }, other, 100);
      },
      onEyepiece: ({ eyepiece }) => {
        panel?.setEstado(`ocular: ${eyepiece || 'ninguno'}`);
        bus.send('eyepiece', { eyepiece }, other);
      },
      onCamera: ({ connected }) => {
        bus.send('camera', { connected }, other);
      },
      onStatus: ({ message }) => {
        panel?.setEstado(`enfocador: ${message}`);
        bus.send('focusStatus', { message }, other);
      },
    });

    focuser.start();
    window.addEventListener('beforeunload', () => focuser.stop());
  } else {
    bus.on('focus', ({ blur }) => say(`${cfg.label} · enfoque ${blur.toFixed(1)}px`));
    bus.on('focusStatus', ({ message }) => say(`${cfg.label} · enfocador: ${message}`));
    bus.on('eyepiece', ({ eyepiece }) => say(`${cfg.label} · ocular ${eyepiece || 'ninguno'}`));
    bus.on('camera', ({ connected }) => say(`${cfg.label} · cámara ${connected ? 'conectada' : 'ausente'}`));
  }

  bus.start({ onConnect: () => say(`${cfg.label} · conectado`) });
  return engine;
}
