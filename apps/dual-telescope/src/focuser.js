// Enfocador: potenciómetro por WebUSB -> desenfoque.
//
// La idea del instrumento es que el **punto de foco depende del ocular**: cada
// ocular enfoca en una posición distinta del recorrido, así que cambiar de ocular
// obliga a reenfocar. Eso es lo que pasa con un telescopio real, y es justamente
// lo que se quiere que la persona experimente.
//
// El valor crudo del ADC no sale de este archivo: se normaliza a 0..1 acá, en el
// borde. Cambiar de potenciómetro o de placa (el Leonardo da 0..1023, un ESP32
// daría 0..4095) es cambiar `raw`, y nada más se entera.

const RAW_POR_DEFECTO = { min: 0, max: 1023 };

// Posición del recorrido (0..1) en la que cada ocular queda enfocado.
// La clave vacía es "sin ocular". Los valores son provisionales hasta poder
// medirlos contra el hardware real.
export const PUNTOS_DE_FOCO = {
  '': 0.5,
  len1: 0.2,
  len2: 0.4,
  len3: 0.6,
  len4: 0.8,
};

export function createFocuser({
  onBlur = () => {},
  onStatus = () => {},
  raw = RAW_POR_DEFECTO,
  focusPoints = PUNTOS_DE_FOCO,
  // Desenfoque máximo, en píxeles de filtro CSS.
  maxBlur = 14,
  // Qué tan lejos del punto de foco hay que estar para llegar al desenfoque
  // máximo, como fracción del recorrido. Más chico = enfocar es más difícil.
  tolerancia = 0.35,
  // >1 hace que cerca del foco la imagen mejore rápido y lejos sature: se parece
  // más a enfocar de verdad que una rampa lineal.
  exponente = 1.6,
} = {}) {
  let device = null;
  let leyendo = false;
  let ocular = '';
  let posicion = null;

  function calcularBlur(pos) {
    const foco = focusPoints[ocular] ?? focusPoints[''] ?? 0.5;
    const dist = Math.abs(pos - foco);
    const k = Math.min(1, dist / tolerancia);
    return maxBlur * Math.pow(k, exponente);
  }

  function emitir(pos) {
    posicion = pos;
    onBlur({ blur: calcularBlur(pos), position: pos, eyepiece: ocular });
  }

  // El sketch manda líneas "P:<n>". Se acumula porque un paquete USB puede
  // cortar una línea por la mitad.
  let buffer = '';
  function consumir(texto) {
    buffer = (buffer + texto).slice(-200);
    const lineas = buffer.split('\n');
    buffer = lineas.pop() ?? '';
    for (const linea of lineas) {
      const m = linea.match(/P:(-?\d+)/);
      if (!m) continue;
      const crudo = Number(m[1]);
      const span = (raw.max - raw.min) || 1;
      emitir(Math.max(0, Math.min(1, (crudo - raw.min) / span)));
    }
  }

  async function abrir(dev) {
    device = dev;
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);

    // La interfaz vendor-specific (clase 255) es la de WebUSB. Un Leonardo
    // expone además las dos de CDC, y la de datos CDC también tiene un bulk de
    // entrada — reclamar esa deja todo aparentemente bien y sin datos.
    let iface = null;
    let epIn = null;
    for (const it of dev.configuration.interfaces) {
      for (const alt of it.alternates) {
        const bulkIn = alt.endpoints.find((e) => e.direction === 'in' && e.type === 'bulk');
        if (bulkIn && alt.interfaceClass === 255) { iface = it.interfaceNumber; epIn = bulkIn.endpointNumber; }
      }
    }
    if (iface === null) throw new Error('la placa no expone la interfaz WebUSB');

    await dev.claimInterface(iface);
    try { await dev.selectAlternateInterface(iface, 0); } catch { /* no siempre hace falta */ }
    // La librería de Arduino no manda nada hasta que el host se anuncia.
    await dev.controlTransferOut({
      requestType: 'class', recipient: 'interface', request: 0x22, value: 0x01, index: iface,
    });

    leyendo = true;
    onStatus({ connected: true, message: 'enfocador conectado' });

    while (leyendo) {
      const r = await dev.transferIn(epIn, 64);
      if (r.status !== 'ok' || !r.data?.byteLength) continue;
      consumir(new TextDecoder().decode(r.data));
    }
  }

  return {
    // Sin gesto del usuario: sólo dispositivos ya autorizados para este origen.
    // Es lo que permite que el teléfono viva dentro del telescopio, donde tocar
    // un botón no es viable. El emparejamiento se hace una vez, antes de montar,
    // y en la MISMA URL que se usa después: el permiso va atado al origen.
    async autoConnect() {
      if (!('usb' in navigator)) {
        onStatus({ connected: false, message: 'WebUSB no disponible' });
        return false;
      }
      const devs = await navigator.usb.getDevices();
      if (!devs.length) {
        onStatus({ connected: false, message: 'enfocador sin emparejar' });
        return false;
      }
      try {
        abrir(devs[0]).catch((e) => onStatus({ connected: false, message: e.message }));
        return true;
      } catch (e) {
        onStatus({ connected: false, message: e.message });
        return false;
      }
    },

    // Con gesto: el emparejamiento inicial.
    async pair() {
      const dev = await navigator.usb.requestDevice({ filters: [] });
      abrir(dev).catch((e) => onStatus({ connected: false, message: e.message }));
    },

    // Cambiar de ocular mueve el punto de foco, así que lo que estaba nítido deja
    // de estarlo sin que el potenciómetro se haya movido.
    setEyepiece(key) {
      ocular = key ?? '';
      if (posicion !== null) emitir(posicion);
    },

    stop() {
      leyendo = false;
      device?.close().catch(() => {});
    },

    get connected() { return leyendo; },
  };
}

// Engancha el desenfoque donde corresponda. Hoy va directo al canvas del cielo:
// con los efectos de seeing apagados, el filtro CSS es todo lo que hace falta y
// el pipeline WebGL de turbulencia no aportaría nada. Cuando ese overlay se
// traiga (y se mejore, que falta), esto pasa a apuntar a su canvas y nada más
// cambia.
export function aplicarBlur(el, blur) {
  if (!el) return;
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
}
