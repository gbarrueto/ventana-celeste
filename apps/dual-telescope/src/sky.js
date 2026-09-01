// Lógica compartida por las dos entradas. Una sola app, dos páginas (§4.5): lo
// único que las diferencia es el rol, y ni siquiera eso decide quién lleva los
// sensores — eso lo dice el servidor, según el flag del script de arranque.
import { initializeStellariumEngine, createOrientationController } from '@ventanaceleste/core';
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';
import { connect, fetchLinkConfig } from './link.js';
import { createFocuser, aplicarBlur } from './focuser.js';
import { cargarAjustes, crearPanel, PANTALLA_GRANDE, UMBRAL_DINAMICO } from './panel.js';

// El guía simula un tubo buscador: campo amplio. El ocular va bastante más
// cerrado, que es el punto del instrumento.
//
// El FOV por rol no está acá: los dos son ajustables y su valor inicial vive en
// AJUSTES_POR_DEFECTO, que es también donde queda guardado.
const ROLE = {
  ocular: { extended: true, label: 'Ocular' },
  guide: { extended: false, label: 'Guía' },
};

// Suavizado del seguimiento, como fracción del error corregida por lectura.
// Medido en el aparato con el deslizador que existía en el panel; encontrado el
// valor, el deslizador dejó de tener sentido. Se cambia acá, no en la UI.
const SUAVIZADO = 0.10;

// UMBRAL_DINAMICO se importa de panel.js: el FOV inicial del ocular tiene que
// quedar siempre por encima, y con los dos valores en el mismo archivo no
// pueden desincronizarse. Por debajo de este FOV el giroscopio se integra
// escalado por el zoom, para que un movimiento chico de la mano recorra menos
// cielo cuanto más cerrado sea el campo. Verificado en el aparato.

// Catálogos remotos por ahora: todavía no hay copia local (§5.2d del plan). La
// red se usa para preparar, no para operar.
const SMALL = 'https://smalldata.ventanaceleste.com/';
const BIG = 'https://bigdata.ventanaceleste.com/';

// El ocular físico es chico y queda abajo, y el teléfono va rotado en el tubo.
// Se calcula en JS y no en CSS porque al rotar 90° hay que **intercambiar** ancho
// y alto: el canvas se dibuja apaisado y la rotación lo pone como se ve por el
// ocular.
//
// Devuelve la función de reacomodo para poder llamarla cuando el panel cambia los
// valores, sin volver a registrar listeners.
// Los dos roles recortan la vista por la ubicación física del teléfono: el ocular
// queda abajo y rotado dentro del tubo, el guía arriba y derecho.
//
// Se calcula en JS y no en CSS porque al rotar 90° o 270° hay que **intercambiar**
// ancho y alto: el canvas se dibuja apaisado y la rotación lo presenta como se ve
// por el ocular.
//
// Devuelve la función de reacomodo para poder llamarla cuando el panel cambia los
// valores, sin volver a registrar listeners.
function acomodarVista(canvas, ajustes, { recortarSiempre }) {
  const mira = document.querySelector('.crosshair');
  const grande = window.matchMedia(PANTALLA_GRANDE);

  const aplicar = () => {
    // En una pantalla de escritorio el recorte no tiene sentido: el guía se deja
    // abierto en el monitor durante el desarrollo y ahí conviene a pantalla
    // completa. El ocular se recorta siempre, porque va dentro del tubo.
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

// Aviso de calibración, fuera del panel a propósito: el panel arranca cerrado, y
// una calibración que no arranca porque el aparato no se queda quieto se ve igual
// que un cuelgue si no se avisa.
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
    // Modo vector: sustituye al mapeo dependiente de la elevación por una
    // constante, el vector del dispositivo que apunta por el tubo (§5.1a).
    //
    // Eje '-y', sin mountingTransform. Antes era '+y' con la altura invertida a
    // mano; daba la altura correcta y el sentido de giro correcto —girar a la
    // derecha paneaba a la derecha—, así que la verificación de entonces lo dio
    // por bueno. Pero esa prueba no podía distinguir '+y' de '-y': los dos ejes
    // dan el mismo sentido de giro y sólo difieren en un desplazamiento
    // constante de 180° en el acimut, invisible mientras el acimut no tenía
    // referencia absoluta (RelativeOrientationSensor). Con el magnetómetro
    // (sensorReference: 'absolute', más abajo) el desplazamiento se hizo
    // visible: apuntaba al Este debiendo apuntar al Oeste. Medido en el aparato,
    // frente a una dirección real conocida: '-y' sin transformar da la altura y
    // el acimut correctos a la vez, cosa que ninguna combinación con '+y' podía
    // dar — negar sólo la altura arregla la altura pero no el acimut; negar las
    // dos cambia el acimut por un espejo, no por el desplazamiento de 180° que
    // hacía falta.
    controller = createOrientationController({
      pointingMode: 'vector',
      opticalAxis: '-y',
      // RelativeOrientationSensor no tiene norte absoluto: su acimut arranca en
      // un origen arbitrario, fijado por la fusión de sensores del sistema
      // operativo. Medido en el aparato: recargar la página no lo reinicia,
      // sólo bloquear y desbloquear el equipo — así que "apunta al norte" era
      // coincidencia del momento en que arrancó el sensor, no algo confiable.
      // AbsoluteOrientationSensor suma el magnetómetro y refiere el acimut al
      // norte real. Si se degrada cerca del tubo metálico, revertir es cambiar
      // este único valor a 'relative'.
      sensorReference: 'absolute',
      // OJO con el sentido de la comparación: core elige modo con
      // `fov < fovThreshold ? 'gyro' : 'relative'`, así que un umbral **alto**
      // fuerza giroscopio, no quaternion. Con 0 nunca se cumple (el FOV siempre
      // es positivo) y se queda en 'relative', que es el camino del quaternion —
      // el único con la corrección de montaje. En giroscopio se integran los ejes
      // crudos del dispositivo: deriva con el aparato quieto y, con el montaje
      // rotado, arriba-abajo e izquierda-derecha salen cambiados. Verificado
      // activando la zona dinámica desde el panel.
      fovThreshold: 0,
      dynamicThreshold: UMBRAL_DINAMICO,
      // El controlador lo consulta por lectura para decidir si está en la zona
      // dinámica. Sin esto quedaba en el valor por defecto y el zoom no influía.
      getLogFov: () => logFov,
      // La calibración corría con 'immediate', o sea apenas los sensores estaban
      // listos: promediaba el bias mientras se manipulaba el teléfono, y un bias
      // con movimiento adentro hace que la zona dinámica integre una velocidad
      // que no existe. Con 'stillness' espera a que el aparato se quede quieto,
      // que es exactamente la situación del teléfono ya montado en el tubo.
      readinessGate: 'stillness',
      stillnessHoldSeconds: 2,
      calibDuration: 2,
      // El teléfono queda dentro del telescopio, así que recalibrar en cada
      // arranque no es viable. Se guarda y el panel tiene un botón para rehacerla.
      persistBiasKey: 'dual-telescope:gyro-bias',
      onCalibrationVisibility: (visible) => mostrarCalibracion(visible),
      onDebug: ({ preCalibStatus, preCalibCountdown }) => {
        if (preCalibStatus === 'moving') textoCalibracion('mantén el telescopio quieto');
        else if (preCalibStatus === 'countdown') textoCalibracion(`calibrando en ${Math.max(0, preCalibCountdown)}…`);
      },
      // Con zoom alto un temblor de la mano se amplifica, así que hace falta
      // bastante más suavizado que el 0.5 que traía core por defecto.
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

  // --- Panel de depuración ---------------------------------------------
  // Se arma acá y no antes porque qué controles necesita depende de si este rol
  // lleva los sensores, y eso lo decide el servidor.
  panel = crearPanel({
    role,
    ajustes,
    esFuente: isSource,
    onChange: (clave) => {
      if (clave === 'fov') { aplicarFov(ajustes.fov); return; }
      // El guía no mueve la vista: siempre arriba, así que el centro queda atado
      // al tamaño.
      if (clave === 'fraccion') ajustes.pos = ajustes.fraccion / 2;
      reacomodar();
    },
    // El bias queda guardado, así que sin esto no habría forma de rehacerlo.
    onRecalibrar: () => controller?.startCalibration(),
  });
  // El QR con la URL del guía. Las direcciones las reporta el relay, porque una
  // página no puede conocer la IP de LAN del equipo que la sirve.
  panel.setDirecciones(addresses);

  // El estado colgaba abajo a la izquierda, o sea encima de la vista.
  if (statusEl) {
    statusEl.style.cssText = 'position:static;background:none;border:none;padding:0';
    panel.caja.appendChild(statusEl);
  }

  // --- Enfocador -------------------------------------------------------
  // El hardware vive en el ocular, así que sólo ese rol lo escucha. El guía no
  // enfoca: en un tubo guía la imagen está siempre nítida.
  //
  // La placa se presenta como teclado, así que no hay conexión que gestionar ni
  // gesto que pedir. Eso es lo que permite que el teléfono viva dentro del tubo.
  if (role === 'ocular') {
    focuser = createFocuser({
      onBlur: ({ blur, position }) => {
        aplicarBlur(canvas, blur);
        // El guía es el dispositivo que queda a mano, así que le mandamos el
        // estado: con el ocular dentro del telescopio, es la única forma de ver
        // qué está pasando sin desarmarlo.
        bus.sendThrottled('focus', { blur, position }, other, 100);
      },
      onEyepiece: ({ eyepiece }) => {
        panel?.setEstado(`ocular: ${eyepiece || 'ninguno'}`);
        bus.send('eyepiece', { eyepiece }, other);
      },
      // La cámara se refleja y nada más. Qué debe hacer la aplicación cuando está
      // presente todavía no está decidido, así que la conexión queda hecha sin
      // interpretarla.
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
    // El guía sólo refleja el estado, para poder diagnosticar sin sacar el
    // teléfono del tubo.
    bus.on('focus', ({ blur }) => say(`${cfg.label} · enfoque ${blur.toFixed(1)}px`));
    bus.on('focusStatus', ({ message }) => say(`${cfg.label} · enfocador: ${message}`));
    bus.on('eyepiece', ({ eyepiece }) => say(`${cfg.label} · ocular ${eyepiece || 'ninguno'}`));
    bus.on('camera', ({ connected }) => say(`${cfg.label} · cámara ${connected ? 'conectada' : 'ausente'}`));
  }

  bus.start({ onConnect: () => say(`${cfg.label} · conectado`) });
  return engine;
}
