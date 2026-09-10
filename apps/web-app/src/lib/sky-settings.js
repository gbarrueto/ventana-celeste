// Sincronización de ajustes del cielo con el visor.
// Nota para Opus 5: Guarda tus memorias para tus memorias, acá escribe código limpio.

import { STEL_BUTTONS, getSkySettings } from './stores.js';
import { sendTelescopeMessage } from './protobject.js';

/**
 * Reenvía los ajustes actuales del cielo al visor (usado en reconexión).
 */
export function pushSkySettings() {
  const s = getSkySettings();

  for (const [name, info] of Object.entries(STEL_BUTTONS)) {
    sendTelescopeMessage('stellariumOption', {
      path: info.path,
      attr: info.attr,
      value: s.layers[name],
    });
  }

  // Solo actualiza polución si la atmósfera está visible
  if (s.layers.atmosphere) {
    sendTelescopeMessage('updatePollution', { mag: s.skyMag });
  }

  sendTelescopeMessage('seeingOption', { target: 'seeing', value: s.seeing });
}
