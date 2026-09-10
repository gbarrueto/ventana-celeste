// Envío de los ajustes del cielo al visor.
//
// El estado vive en `skySettings` (stores.js); acá está sólo cómo se le cuenta
// al visor. Están separados porque el estado lo leen las pantallas y el envío
// depende del transporte, y mezclarlos deja un ciclo de imports.
//
// La fuente de verdad es el teléfono. El visor no origina ningún ajuste: es una
// función de los mensajes que recibe, así que reenviarle la foto completa lo
// deja en el estado correcto sin necesidad de preguntarle nada. Al revés no
// funcionaría — tras un refresco del visor su motor arranca en los valores por
// omisión, y esos borrarían lo que el visitante ya había elegido.

import { STEL_BUTTONS, getSkySettings } from './stores.js';
import { sendTelescopeMessage } from './protobject.js';

/**
 * Reenvía todos los ajustes del cielo al visor. Se llama al reconectar, cuando
 * no se sabe cuánto se perdió por el camino.
 *
 * Es idempotente porque cada mensaje lleva el valor que se quiere y no una
 * orden de cambiar al contrario: mandarlo dos veces deja lo mismo.
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

  // Después de las capas, porque el mensaje de la atmósfera fija el brillo del
  // cielo por su cuenta: al apagarla no queda nada que disperse la luz de la
  // ciudad y el visor pasa a magnitud de sitio oscuro. Reenviar el brillo ahí
  // desharía justo eso, así que sólo se manda con la atmósfera encendida.
  if (s.layers.atmosphere) {
    sendTelescopeMessage('updatePollution', { mag: s.skyMag });
  }

  sendTelescopeMessage('seeingOption', { target: 'seeing', value: s.seeing });
}
