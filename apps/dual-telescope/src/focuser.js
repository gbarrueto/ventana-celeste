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
  // Cada cuánto se reintenta abrir cuando no hay conexión. Es el respaldo del
  // evento `connect`, no la vía principal, así que no hace falta que sea corto.
  reintentoMs = 2000,
} = {}) {
  let device = null;
  let leyendo = false;
  let conectando = false;
  let supervisando = false;
  let temporizador = null;
  let ultimoEstado = null;
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

  // ── Ciclo de conexión ──────────────────────────────────────
  //
  // El permiso de WebUSB no se pierde al desenchufar el cable: queda atado al
  // par (origen, dispositivo). O sea que reenchufar puede recuperarse solo, sin
  // gesto del usuario, que es lo que permite que el teléfono viva dentro del
  // tubo.
  //
  // Se combinan dos mecanismos a propósito. El evento `connect` reacciona al
  // instante, y un reintento periódico cubre el caso de que no llegue: el
  // dispositivo puede tardar en enumerar, o el evento puede perderse con la
  // página en segundo plano. Sin el reintento, un evento perdido deja el
  // enfocador muerto hasta recargar, que es justo lo que no se puede hacer con
  // el teléfono montado.

  function reportar(connected, message, extra = {}) {
    // Sin deduplicar, el reintento periódico emitiría un mensaje cada dos
    // segundos, y `onStatus` viaja por el relay hasta el guía.
    const clave = `${connected}:${message}`;
    if (clave === ultimoEstado) return;
    ultimoEstado = clave;
    onStatus({ connected, message, requierePairing: false, ...extra });
  }

  function programarReintento() {
    if (!supervisando) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(intentarAbrir, reintentoMs);
  }

  function caida(motivo) {
    const estabaLeyendo = leyendo;
    leyendo = false;
    buffer = '';
    try { device?.close().catch(() => {}); } catch { /* ya cerrado */ }
    device = null;
    if (estabaLeyendo) reportar(false, `enfocador desconectado (${motivo})`);
    programarReintento();
  }

  async function intentarAbrir() {
    if (leyendo || conectando || !supervisando) return;
    conectando = true;
    try {
      const devs = await navigator.usb.getDevices();
      if (!devs.length) {
        // Chrome revoca el permiso al desenchufar un dispositivo que no reporta
        // número de serie, así que acá no hay nada que reabrir y tampoco va a
        // llegar un evento `connect`. La única salida es volver a emparejar con
        // gesto, y para eso el botón tiene que reaparecer solo.
        reportar(false, 'enfocador sin emparejar', { requierePairing: true });
        programarReintento();
        return;
      }
      // Siempre desde getDevices() y no desde la referencia guardada: al
      // reenchufar, el objeto anterior quedó obsoleto.
      await abrir(devs[0]);
    } catch (e) {
      reportar(false, `enfocador no disponible (${e.message})`);
      programarReintento();
    } finally {
      conectando = false;
    }
  }

  const alConectar = () => { intentarAbrir(); };
  const alDesconectar = (e) => { if (!device || e.device === device) caida('cable'); };

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
    reportar(true, 'enfocador conectado');
    // El bucle corre de fondo: `abrir` tiene que resolver para que quien la
    // llamó suelte el flag de conexión en curso.
    bucle(dev, epIn);
  }

  async function bucle(dev, epIn) {
    try {
      while (leyendo) {
        const r = await dev.transferIn(epIn, 64);
        // Un stall no se limpia solo: sin clearHalt el bucle gira en vacío
        // consumiendo CPU y sin volver a leer nunca.
        if (r.status === 'stall') { await dev.clearHalt('in', epIn); continue; }
        if (r.status !== 'ok' || !r.data?.byteLength) continue;
        consumir(new TextDecoder().decode(r.data));
      }
    } catch (e) {
      // Desenchufar el cable hace que transferIn rechace. Antes el error se
      // reportaba pero `leyendo` quedaba en true, así que el enfocador se creía
      // conectado para siempre y nada reintentaba.
      caida(e.message);
    }
  }

  return {
    // Arranca la supervisión y devuelve si hay algún dispositivo ya autorizado
    // para este origen. El emparejamiento se hace una vez, antes de montar, y en
    // la MISMA URL que se usa después: el permiso va atado al origen.
    //
    // A partir de acá el enfocador se recupera solo de cualquier desconexión
    // física, sin gesto y sin intervención de otro dispositivo.
    async autoConnect() {
      if (!('usb' in navigator)) {
        reportar(false, 'WebUSB no disponible');
        return false;
      }
      supervisando = true;
      navigator.usb.addEventListener('connect', alConectar);
      navigator.usb.addEventListener('disconnect', alDesconectar);

      const devs = await navigator.usb.getDevices();
      intentarAbrir();
      return devs.length > 0;
    },

    // Con gesto: el emparejamiento inicial. Deja la supervisión andando, así que
    // después de esto no vuelve a hacer falta tocar nada.
    async pair() {
      await navigator.usb.requestDevice({ filters: [] });
      supervisando = true;
      navigator.usb.addEventListener('connect', alConectar);
      navigator.usb.addEventListener('disconnect', alDesconectar);
      await intentarAbrir();
    },

    // Cambiar de ocular mueve el punto de foco, así que lo que estaba nítido deja
    // de estarlo sin que el potenciómetro se haya movido.
    setEyepiece(key) {
      ocular = key ?? '';
      if (posicion !== null) emitir(posicion);
    },

    stop() {
      supervisando = false;
      leyendo = false;
      clearTimeout(temporizador);
      if ('usb' in navigator) {
        navigator.usb.removeEventListener('connect', alConectar);
        navigator.usb.removeEventListener('disconnect', alDesconectar);
      }
      try { device?.close().catch(() => {}); } catch { /* ya cerrado */ }
      device = null;
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
