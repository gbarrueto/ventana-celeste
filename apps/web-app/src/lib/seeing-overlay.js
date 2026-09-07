// Adaptador del overlay de seeing para web-app.
//
// El modelo vive en @ventanaceleste/core y no toca el DOM: recibe dos canvas ya
// colocados y dibuja en el segundo. Este archivo aporta lo que core no hace por
// diseño — crear el canvas de efecto, darle la geometría del canvas del motor y
// traducir los mensajes de Protobject a llamadas al overlay.
//
// La página de control es otro dispositivo, así que los valores llegan por
// mensaje y no por evento de un control local.

import { createSeeingOverlay, SEEING_DEFAULTS } from '@ventanaceleste/core';

/**
 * Monta el overlay sobre `#stel-canvas`. Devuelve el control que usa el manejador
 * de Protobject, o `null` si no hay canvas o WebGL.
 */
export function initializeSeeingOverlay({ getFov = null } = {}) {
  const stelCanvas = document.getElementById('stel-canvas');
  if (!stelCanvas) {
    console.error('[seeing] falta #stel-canvas');
    return null;
  }

  const style = document.createElement('style');
  style.textContent = `
    #effect-canvas {
      position: fixed; inset: 0; width: 100%; height: 100%;
      z-index: 1; pointer-events: none; background: transparent;
      visibility: hidden;
    }
  `;
  document.head.appendChild(style);

  const effectCanvas = document.createElement('canvas');
  effectCanvas.id = 'effect-canvas';
  stelCanvas.parentNode.insertBefore(effectCanvas, stelCanvas.nextSibling);

  const params = { ...SEEING_DEFAULTS };
  const overlay = createSeeingOverlay({
    skyCanvas: stelCanvas,
    effectCanvas,
    params,
    getFov,
    // El motor reporta el campo sobre el lado largo del lienzo. Tomarlo como el
    // alto escala todas las amplitudes por el factor de aspecto.
    fovAxis: 'width',
    onActiveChange: (activo) => {
      effectCanvas.style.visibility = activo ? 'visible' : 'hidden';
    },
  });

  if (!overlay) {
    effectCanvas.remove();
    return null;
  }

  // El desenfoque del enfocador es óptico y no atmosférico, así que va como
  // filtro CSS sobre el canvas visible en vez de entrar al shader: un filtro no
  // altera el buffer, y aplicarlo al canvas del motor sería invisible para el
  // overlay, que lee de ahí. La saturación sí es del modelo, porque va atada a
  // la apertura.
  let desenfoque = 0;
  const repintarFiltros = () => {
    effectCanvas.style.filter = desenfoque > 0.05 ? `blur(${desenfoque.toFixed(2)}px)` : '';
  };

  return {
    /**
     * Aplica un valor llegado por mensaje. `target` es una clave de
     * SEEING_DEFAULTS, o `focus`, que es del enfocador.
     * Devuelve `false` si la clave no existe, para que el emisor se entere.
     */
    set(target, value) {
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return false;
      if (target === 'focus') { desenfoque = Math.max(0, v); repintarFiltros(); return true; }
      if (!(target in SEEING_DEFAULTS)) return false;
      params[target] = v;
      overlay.setParams({ [target]: v });
      return true;
    },
    // El modo simple no lleva seeing. Apagarlo por acá, y no ocultando el canvas
    // desde fuera, evita que dos dueños peleen por la visibilidad: el overlay la
    // devolvía al activarse y el efecto reaparecía en modo simple.
    setEnabled: (on) => overlay.setEnabled(on),
    setFov: (rad) => overlay.setFov(rad),
    getParams: () => overlay.getParams(),
    stop: () => { overlay.stop(); effectCanvas.remove(); },
  };
}
