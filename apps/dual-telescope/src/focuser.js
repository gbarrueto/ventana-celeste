// Enfocador: potenciómetro por teclado USB -> desenfoque.
//
// La idea del instrumento es que el **punto de foco depende del ocular**: cada
// ocular enfoca en una posición distinta del recorrido, así que cambiar de ocular
// obliga a reenfocar. Eso es lo que pasa con un telescopio real, y es justamente
// lo que se quiere que la persona experimente.
//
// La placa se presenta como teclado y escribe una línea por lectura, así que acá
// no hay conexión que gestionar: ni permisos, ni emparejamiento, ni reconexión.
// Eso es lo que permite que el teléfono viva dentro del tubo, donde no se puede
// tocar la pantalla para autorizar nada.
//
// El valor crudo del ADC no sale de este archivo: se normaliza a 0..1 acá, en el
// borde. Cambiar de potenciómetro o de placa (el Leonardo da 0..1023, un ESP32
// daría 0..4095) es cambiar `raw`, y nada más se entera.
import { createKeyboardLineSource } from '@ventanaceleste/core';

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

// Tramos del ADC que identifican cada ocular. Provisionales: salen de medir las
// resistencias reales, y hasta entonces el canal `R` no puede resolverse a una
// clave. Ver la tarjeta de teclado de device-lab, que registra los valores
// estables para poder construir esta tabla.
export const TRAMOS_OCULAR = [];

export function createFocuser({
  onBlur = () => {},
  onStatus = () => {},
  // Qué ocular se detectó. Recibe la clave, o '' si no hay ninguno.
  onEyepiece = () => {},
  // Presencia de la cámara. Se reporta y nada más: qué hacer con eso todavía no
  // está decidido, así que la conexión queda hecha sin interpretarla.
  onCamera = () => {},
  raw = RAW_POR_DEFECTO,
  focusPoints = PUNTOS_DE_FOCO,
  eyepieceRanges = TRAMOS_OCULAR,
  // Desenfoque máximo, en píxeles de filtro CSS.
  maxBlur = 14,
  // Qué tan lejos del punto de foco hay que estar para llegar al desenfoque
  // máximo, como fracción del recorrido. Más chico = enfocar es más difícil.
  tolerancia = 0.35,
  // >1 hace que cerca del foco la imagen mejore rápido y lejos sature: se parece
  // más a enfocar de verdad que una rampa lineal.
  exponente = 1.6,
} = {}) {
  let ocular = '';
  let posicion = null;
  let fuente = null;

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

  function normalizar(crudo) {
    const span = (raw.max - raw.min) || 1;
    return Math.max(0, Math.min(1, (crudo - raw.min) / span));
  }

  // Del valor del ADC a la clave del ocular. Sin tramos medidos no se puede
  // resolver, así que se informa 'sin clasificar' en vez de inventar uno.
  function ocularDeValor(crudo) {
    for (const { min, max, key } of eyepieceRanges) {
      if (crudo >= min && crudo <= max) return key;
    }
    return null;
  }

  // El sketch manda una línea por lectura:
  //   P:<0..1023>    posición del enfocador
  //   R:<0..1023>    circuito del ocular
  //   C:TRUE|FALSE   presencia de la cámara
  //
  // Una línea que no calce se descarta: con teclado, un carácter perdido degrada
  // en vez de romper.
  function consumir(linea) {
    const m = linea.match(/^([PRC]):(.+)$/);
    if (!m) return;
    const [, canal, valor] = m;

    if (canal === 'P') {
      const crudo = Number(valor);
      if (Number.isFinite(crudo)) emitir(normalizar(crudo));
      return;
    }

    if (canal === 'R') {
      const crudo = Number(valor);
      if (!Number.isFinite(crudo)) return;
      const clave = ocularDeValor(crudo);
      if (clave === null) {
        onStatus({ message: `ocular sin clasificar (R:${crudo})`, raw: crudo });
        return;
      }
      if (clave !== ocular) setEyepiece(clave);
      return;
    }

    // Cámara: se refleja el estado y ahí termina.
    onCamera({ connected: valor === 'TRUE' });
  }

  // Cambiar de ocular mueve el punto de foco, así que lo que estaba nítido deja
  // de estarlo sin que el potenciómetro se haya movido.
  function setEyepiece(key) {
    ocular = key ?? '';
    onEyepiece({ eyepiece: ocular });
    if (posicion !== null) emitir(posicion);
  }

  return {
    start() {
      fuente = createKeyboardLineSource({
        onLine: consumir,
        // Las pulsaciones no deben además actuar sobre la página: un botón del
        // panel que conserve el foco se volvería a disparar con cada Enter que
        // manda la placa, y la placa manda hasta cincuenta por segundo.
        preventDefault: true,
      });
      if (!fuente.isSupported()) {
        onStatus({ message: 'sin teclado disponible' });
        return false;
      }
      fuente.connect();
      onStatus({ message: 'enfocador a la escucha' });
      return true;
    },

    setEyepiece,

    stop() {
      fuente?.disconnect();
      fuente = null;
    },

    get eyepiece() { return ocular; },
    get position() { return posicion; },
  };
}

// Engancha el desenfoque donde corresponda. Hoy va directo al canvas del cielo:
// con los efectos de seeing apagados, el filtro CSS es todo lo que hace falta y
// el pipeline WebGL de turbulencia no aportaría nada. Cuando ese overlay se
// traiga, esto pasa a apuntar a su canvas y nada más cambia.
export function aplicarBlur(el, blur) {
  if (!el) return;
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
}
