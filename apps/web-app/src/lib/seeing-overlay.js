// Adaptador del overlay de seeing para web-app.

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
    fovAxis: 'width',
    onActiveChange: (activo) => {
      effectCanvas.style.visibility = activo ? 'visible' : 'hidden';
    },
  });

  if (!overlay) {
    effectCanvas.remove();
    return null;
  }

  // Desenfoque óptico aplicado como filtro CSS sobre el canvas visible
  let desenfoque = 0;
  const repintarFiltros = () => {
    effectCanvas.style.filter = desenfoque > 0.05 ? `blur(${desenfoque.toFixed(2)}px)` : '';
  };

  return {
    set(target, value) {
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return false;
      if (target === 'focus') { desenfoque = Math.max(0, v); repintarFiltros(); return true; }
      if (!(target in SEEING_DEFAULTS)) return false;
      params[target] = v;
      overlay.setParams({ [target]: v });
      return true;
    },
    setEnabled: (on) => overlay.setEnabled(on),
    setFov: (rad) => overlay.setFov(rad),
    getParams: () => overlay.getParams(),
    stop: () => { overlay.stop(); effectCanvas.remove(); },
  };
}
