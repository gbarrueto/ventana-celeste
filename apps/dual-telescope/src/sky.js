// Lógica compartida por las dos entradas. Una sola app, dos páginas (§4.5): lo
// único que las diferencia es el rol, y ni siquiera eso decide quién lleva los
// sensores — eso lo dice el servidor, según el flag del script de arranque.
import { initializeStellariumEngine, createOrientationController } from '@ventanaceleste/core';
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';
import { connect, fetchLinkConfig } from './link.js';
import { createFocuser, aplicarBlur } from './focuser.js';

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

// Ajustables desde la URL, porque el teléfono del ocular queda dentro del tubo y
// no se le puede poner un panel de controles: se abre con el valor y listo.
//   ?smooth=0.15   suavizado del seguimiento (1 = crudo, más chico = más suave)
//   ?canvas=0.5    fracción de alto de pantalla que ocupa la vista
//   ?rot=90        rotación del canvas en grados
function param(nombre, porDefecto) {
  const v = parseFloat(new URLSearchParams(location.search).get(nombre));
  return Number.isFinite(v) ? v : porDefecto;
}

// El ocular físico es chico y queda abajo, y el teléfono va rotado en el tubo.
// Se calcula en JS y no en CSS porque al rotar 90° hay que **intercambiar** ancho
// y alto: el canvas se dibuja apaisado y la rotación lo pone como se ve por el
// ocular.
function acomodarOcular(canvas, fraccion, rotacion) {
  const aplicar = () => {
    const altoArea = window.innerHeight * fraccion;
    const anchoArea = window.innerWidth;
    const rotado = Math.abs(rotacion % 180) === 90;
    canvas.style.position = 'fixed';
    canvas.style.left = '50%';
    canvas.style.top = `${window.innerHeight - altoArea / 2}px`;
    canvas.style.width = `${rotado ? altoArea : anchoArea}px`;
    canvas.style.height = `${rotado ? anchoArea : altoArea}px`;
    canvas.style.transform = `translate(-50%, -50%) rotate(${rotacion}deg)`;
    canvas.style.transformOrigin = 'center';
  };
  aplicar();
  window.addEventListener('resize', aplicar);
  window.addEventListener('orientationchange', aplicar);
}

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
      stel.core.landscapes.visible = true;
      stel.core.cardinals.visible = true;
      stel.core.constellations.lines_visible = true;
      stel.core.fov = cfg.fov;
    },
  });

  // Se vuelve a fijar después de que la inicialización resolvió: setearlo sólo
  // dentro de onReady no alcanzaba y el guía quedaba con el FOV por defecto.
  if (engine?.core) engine.core.fov = cfg.fov;

  // Sólo el ocular va montado en el tubo; el guía se mira de frente.
  if (role === 'ocular') {
    acomodarOcular(canvas, param('canvas', 0.5), param('rot', 90));
  }

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
      // OJO con el sentido de la comparación: core elige modo con
      // `fov < fovThreshold ? 'gyro' : 'relative'`, así que un umbral **alto**
      // fuerza giroscopio, no quaternion. Con 0 nunca se cumple (el FOV siempre
      // es positivo) y se queda en 'relative', que es el camino del quaternion —
      // el único con la corrección de montaje. En giroscopio se integran los ejes
      // crudos del dispositivo: deriva con el aparato quieto y, con el montaje
      // rotado 90°, arriba-abajo e izquierda-derecha salen cambiados.
      fovThreshold: 0,
      dynamicThreshold: 0,
      readinessGate: 'immediate',
      calibDuration: 1,
      // Con zoom alto un temblor de la mano se amplifica, así que hace falta
      // bastante más suavizado que el 0.5 que traía por defecto. Ajustable con
      // ?smooth= para encontrar el punto entre realismo y usabilidad.
      smoothing: { relative: param('smooth', 0.18), gyro: param('smooth', 0.18) },
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

  // --- Enfocador -------------------------------------------------------
  // El hardware vive en el ocular, así que sólo ese rol lo abre. El guía no
  // enfoca: en un tubo guía la imagen está siempre nítida.
  if (role === 'ocular') {
    const focuser = createFocuser({
      onBlur: ({ blur, position }) => {
        aplicarBlur(canvas, blur);
        // El guía es el dispositivo que queda a mano, así que le mandamos el
        // estado: con el ocular dentro del telescopio, es la única forma de ver
        // qué está pasando sin desarmarlo.
        bus.sendThrottled('focus', { blur, position }, other, 100);
      },
      onStatus: ({ connected, message }) => {
        say(`${cfg.label} · ${message}`);
        bus.send('focusStatus', { connected, message }, other);
      },
    });

    // Sin gesto: si ya se emparejó en este origen, arranca solo.
    const auto = await focuser.autoConnect();
    if (!auto) {
      // Sólo hace falta una vez en la vida del equipo, y con el teléfono en la
      // mano. Después de esto el permiso queda para este origen.
      const btn = document.createElement('button');
      btn.textContent = 'Emparejar enfocador';
      btn.className = 'pair-btn';
      btn.onclick = async () => {
        try { await focuser.pair(); btn.remove(); } catch (e) { say(`enfocador: ${e.message}`); }
      };
      document.body.appendChild(btn);
    }

    window.addEventListener('beforeunload', () => focuser.stop());
  } else {
    // El guía sólo refleja el estado, para poder diagnosticar sin sacar el
    // teléfono del tubo.
    bus.on('focus', ({ blur }) => say(`${cfg.label} · enfoque ${blur.toFixed(1)}px`));
    bus.on('focusStatus', ({ message }) => say(`${cfg.label} · enfocador: ${message}`));
  }

  bus.start({ onConnect: () => say(`${cfg.label} · conectado`) });
  return engine;
}
