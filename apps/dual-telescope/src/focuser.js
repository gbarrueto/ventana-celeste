// Enfocador: simulación de desenfoque a partir de lecturas ADC del potenciómetro.
import { createKeyboardLineSource } from '@ventanaceleste/core';

const RAW_POR_DEFECTO = { min: 0, max: 1023 };

// Posición del recorrido (0..1) de foco para cada ocular.
export const PUNTOS_DE_FOCO = {
  '': 0.5,
  len1: 0.2,
  len2: 0.4,
  len3: 0.6,
  len4: 0.8,
};

// Tramos de ADC para identificar cada ocular.
export const TRAMOS_OCULAR = [];

export function createFocuser({
  onBlur = () => {},
  onStatus = () => {},
  onEyepiece = () => {},
  onCamera = () => {},
  raw = RAW_POR_DEFECTO,
  focusPoints = PUNTOS_DE_FOCO,
  eyepieceRanges = TRAMOS_OCULAR,
  maxBlur = 14,
  tolerancia = 0.35,
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

  function ocularDeValor(crudo) {
    for (const { min, max, key } of eyepieceRanges) {
      if (crudo >= min && crudo <= max) return key;
    }
    return null;
  }

  // Procesa líneas del sketch: P:<0..1023>, R:<0..1023>, C:TRUE|FALSE.
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

    onCamera({ connected: valor === 'TRUE' });
  }

  function setEyepiece(key) {
    ocular = key ?? '';
    onEyepiece({ eyepiece: ocular });
    if (posicion !== null) emitir(posicion);
  }

  return {
    start() {
      fuente = createKeyboardLineSource({
        onLine: consumir,
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

// Aplica filtro CSS de desenfoque al elemento.
export function aplicarBlur(el, blur) {
  if (!el) return;
  el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
}
