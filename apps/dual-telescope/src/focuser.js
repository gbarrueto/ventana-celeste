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
export const TRAMOS_OCULAR = [
  { key: 'len1', min: 100, max: 180 },
  { key: 'len2', min: 300, max: 380 },
  { key: 'len3', min: 500, max: 580 },
  { key: 'len4', min: 700, max: 780 },
];

// R:1023 (el divisor queda a 5 V) significa que no hay ocular puesto. Se deja
// un margen por el ruido del ADC.
export const TRAMO_SIN_OCULAR = { key: '', min: 1015, max: 1023 };

// Campo de visión (radianes) de cada ocular. len1 acerca un poco más que el
// guía (~8°, 0.14 rad) y cada ocular siguiente cierra más el campo.
export const FOV_POR_OCULAR = {
  len1: 0.10,   // ~5.7°
  len2: 0.06,   // ~3.4°
  len3: 0.03,   // ~1.7°
  len4: 0.015,  // ~0.9°
};

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
  // Hasta que llega la primera lectura no se sabe si hay ocular: el sketch
  // sólo manda R: cuando el valor cambia, y una página recargada no recibe
  // ninguna hasta el próximo cambio.
  let confirmado = false;
  // Arranca en el centro del recorrido para que un cambio de ocular (por el
  // Arduino o por los botones de depuración) se note antes de la primera
  // lectura real del potenciómetro.
  let posicion = 0.5;
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
    for (const { min, max, key } of [...eyepieceRanges, TRAMO_SIN_OCULAR]) {
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
      if (clave !== ocular || !confirmado) setEyepiece(clave);
      return;
    }

    onCamera({ connected: valor === 'TRUE' });
  }

  function setEyepiece(key) {
    ocular = key ?? '';
    confirmado = true;
    onEyepiece({ eyepiece: ocular });
    emitir(posicion);
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

    // Procesa una línea como si la hubiera mandado el Arduino (p. ej.
    // "R:301"). La usa el panel de depuración para probar sin hardware.
    simularLinea: consumir,

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
