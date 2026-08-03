// Lógica compartida por las dos entradas. Una sola app, dos páginas (§4.5): lo
// único que las diferencia es el rol, y ni siquiera eso decide quién lleva los
// sensores — eso lo dice el servidor, según el flag del script de arranque.
import { initializeStellariumEngine, createOrientationController } from '@ventanaceleste/core';
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';
import { connect, fetchLinkConfig } from './link.js';

// El guía simula un tubo buscador: campo amplio y fijo. El ocular va bastante
// más cerrado, que es el punto del instrumento.
const ROLE = {
  ocular: { fov: 0.05, extended: true, label: 'Ocular' },
  guide: { fov: 0.14, extended: false, label: 'Guía' },
};

// Catálogos remotos por ahora: todavía no hay copia local (§5.2d del plan). La
// red se usa para preparar, no para operar.
const SMALL = 'https://smalldata.ventanaceleste.com/';
const BIG = 'https://bigdata.ventanaceleste.com/';

export async function startSky({ role, statusEl, canvas }) {
  const cfg = ROLE[role];
  const other = role === 'ocular' ? 'guide' : 'ocular';
  const say = (t) => { if (statusEl) statusEl.textContent = t; };

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
      stel.core.landscapes.visible = false;
      stel.core.cardinals.visible = true;
      stel.core.constellations.lines_visible = true;
      stel.core.fov = cfg.fov;
    },
  });

  const bus = connect({ role, onStatus: (s) => say(`${cfg.label} · enlace ${s}`) });
  const { sensorSource } = await fetchLinkConfig();
  const isSource = sensorSource === role;

  const apply = (yaw, pitch) => {
    if (!engine?.core?.observer) return;
    engine.core.observer.yaw = yaw;
    engine.core.observer.pitch = pitch;
  };

  if (isSource) {
    // Modo vector y eje óptico +y: medido en el montaje. Sustituye al mapeo
    // dependiente de la elevación por una constante (§5.1a).
    const controller = createOrientationController({
      pointingMode: 'vector',
      opticalAxis: '+y',
      // Se queda en el camino del quaternion: la integración del giroscopio
      // todavía no corrige ejes con montaje rotado.
      fovThreshold: 1e9,
      dynamicThreshold: 0,
      readinessGate: 'immediate',
      calibDuration: 1,
      onView: ({ yaw, pitch }) => {
        apply(yaw, pitch);
        bus.sendThrottled('pose', { yaw, pitch }, other, 20);
      },
      onError: (e) => say(`sensor: ${e.message}`),
    });
    controller.start();
    say(`${cfg.label} · fuente de orientación`);
  } else {
    // Interpolación en el receptor: que se vea fluido aunque lleguen menos
    // paquetes de los esperados, en vez de subir la tasa de envío.
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

  bus.start({ onConnect: () => say(`${cfg.label} · conectado`) });
  return engine;
}
