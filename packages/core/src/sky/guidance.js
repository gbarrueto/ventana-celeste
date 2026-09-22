// Guía hacia un objeto que está fuera de la vista.
//
// Marcar un objeto en el cielo no sirve de nada si quien observa apunta para
// otro lado: hace falta decirle hacia dónde girar. Todo lo que la UI necesita
// para eso es una dirección en pantalla y una distancia angular, y las dos
// salen de la misma cuenta: dónde cae el objeto respecto del centro de vista.
//
// Es geometría pura, sin DOM. La UI decide con qué dibuja la flecha.
//
// Convenciones:
//   · Ángulos de entrada en grados, altura y acimut.
//   · `angleDeg` es dirección en pantalla: 0 arriba, positivo horario.
//   · El eje y de pantalla crece hacia abajo, como en CSS.
//   · `fovRad` es el ALTO del campo, la misma convención que usa el overlay de
//     seeing (computeSeeingPhysics).

import { getTargetPosition } from './objects.js';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

/**
 * Componentes del objeto en la base de la vista.
 *
 * Vector unitario de una dirección alt/az en un marco con x al norte, y al este
 * y z al cenit. La base local en el centro de vista tiene `arriba` hacia altura
 * creciente y `derecha` hacia acimut creciente, que es como el motor presenta
 * el cielo sin alabeo.
 *
 * @returns {{right: number, up: number, forward: number}}
 */
export function altAzToViewVector({ object, view }) {
  const alt = object.alt * RAD, az = object.az * RAD;
  const altC = view.alt * RAD, azC = view.az * RAD;

  const cosAlt = Math.cos(alt), sinAlt = Math.sin(alt);
  const v = [cosAlt * Math.cos(az), cosAlt * Math.sin(az), sinAlt];

  const cosC = Math.cos(altC), sinC = Math.sin(altC);
  const c = [cosC * Math.cos(azC), cosC * Math.sin(azC), sinC];
  const eUp = [-sinC * Math.cos(azC), -sinC * Math.sin(azC), cosC];
  const eRight = [-Math.sin(azC), Math.cos(azC), 0];

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { right: dot(v, eRight), up: dot(v, eUp), forward: dot(v, c) };
}

/**
 * Guía a partir de las componentes del objeto en la base de la vista.
 *
 * @param {object} p
 * @param {number} p.right                    componente hacia la derecha de pantalla
 * @param {number} p.up                       componente hacia arriba de pantalla
 * @param {number} p.forward                  componente sobre el eje de la vista
 * @param {number} p.fovRad                   alto del campo
 * @param {number} [p.aspect]                 ancho/alto de la vista
 * @param {number} [p.rotationDeg]            rotación del recorte en pantalla
 * @param {number} [p.width], [p.height]      tamaño de la vista en px
 * @param {{x,y}}  [p.center]                 centro de la vista en px
 * @param {number} [p.marginPx]               separación de la flecha al borde
 * @returns {{
 *   separationDeg: number, behind: boolean, inView: boolean,
 *   x: number|null, y: number|null,
 *   angleDeg: number, dx: number, dy: number,
 *   edge: {x: number, y: number}|null,
 * }}
 */
export function computeGuidance({
  right, up, forward,
  fovRad,
  aspect = 1,
  rotationDeg = 0,
  width = null,
  height = null,
  center = null,
  marginPx = 28,
}) {
  const separationDeg = Math.acos(Math.min(1, Math.max(-1, forward))) * DEG;
  const behind = forward <= 0;

  // La dirección en pantalla sale de las componentes crudas y no de la
  // proyección: la proyección diverge al acercarse a 90° del centro y cambia de
  // signo detrás del observador, mientras que (right, up) apunta bien siempre.
  // Las dos únicas direcciones sin ángulo definido son el centro exacto de la
  // vista y su antípoda: ahí (right, up) es (0, 0) y el resultado es arbitrario.
  const angulo = (Math.atan2(right, up) * DEG + rotationDeg + 360) % 360;
  const dx = Math.sin(angulo * RAD);
  const dy = -Math.cos(angulo * RAD);

  // Proyección gnomónica, en fracción de media pantalla: 1 es justo el borde.
  // El motor proyecta estereográfico a campo amplio, así que por encima de unos
  // 60° de FOV el borde calculado y el dibujado no coinciden del todo.
  const medioAlto = Math.tan(fovRad / 2);
  const medioAncho = medioAlto * aspect;
  let x = null, y = null, inView = false;
  if (!behind) {
    x = (right / forward) / medioAncho;
    y = (up / forward) / medioAlto;
    inView = Math.abs(x) <= 1 && Math.abs(y) <= 1;
  }

  let edge = null;
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const cx = center?.x ?? width / 2;
    const cy = center?.y ?? height / 2;
    // Cuánto se puede avanzar en cada eje antes de salirse del rectángulo. El
    // menor de los dos es el cruce con el borde.
    const alcanceX = Math.max(0, width / 2 - marginPx);
    const alcanceY = Math.max(0, height / 2 - marginPx);
    const tX = Math.abs(dx) > 1e-6 ? alcanceX / Math.abs(dx) : Infinity;
    const tY = Math.abs(dy) > 1e-6 ? alcanceY / Math.abs(dy) : Infinity;
    const t = Math.min(tX, tY);
    edge = Number.isFinite(t)
      ? { x: cx + dx * t, y: cy + dy * t }
      : { x: cx, y: cy };
  }

  return { separationDeg, behind, inView, x, y, angleDeg: angulo, dx, dy, edge };
}

/**
 * Guía a partir de dos pares alt/az en grados. Envoltura de `computeGuidance`
 * para quien ya tiene las posiciones y no el motor.
 */
export function computeViewGuidance({ object, view, ...resto }) {
  return computeGuidance({ ...altAzToViewVector({ object, view }), ...resto });
}

/**
 * Centro de vista del motor, en grados.
 *
 * `observer.yaw` es el acimut de la vista en la convención del motor y
 * `observer.pitch` su altura; el acimut del objeto sale del marco OBSERVED. Si
 * las dos convenciones no coincidieran, este es el único lugar a corregir.
 */
export function getViewAltAz(engine) {
  const obs = engine?.core?.observer;
  if (!obs) return null;
  const yaw = obs.yaw, pitch = obs.pitch;
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  return { alt: pitch * DEG, az: ((yaw * DEG) % 360 + 360) % 360 };
}

/**
 * Guía hacia un objetivo del catálogo, leyéndole al motor la vista y el campo.
 * `null` si el motor no reconoce el objetivo o todavía no tiene vista.
 *
 * Las opciones que van a `computeGuidance` —`rotationDeg`, `width`, `height`,
 * `center`, `marginPx`— describen cómo la app dibuja el cielo en pantalla, así
 * que las pone la app. `fovRad` sale del motor salvo que se pise.
 *
 * `aspect` cae por defecto en `width/height`, que sirve cuando el cielo ocupa
 * el mismo rectángulo donde va la flecha. Con el recorte rotado no es el caso:
 * ahí hay que pasar el aspecto del canvas, porque `width`/`height` describen el
 * área donde se dibuja la flecha y no el encuadre del cielo.
 */
export function getTargetGuidance(engine, target, opciones = {}) {
  const view = getViewAltAz(engine);
  if (!view) return null;
  const pos = getTargetPosition(engine, target);
  if (!pos || !Number.isFinite(pos.alt)) return null;

  const fovRad = opciones.fovRad ?? engine?.core?.fov;
  if (!Number.isFinite(fovRad) || fovRad <= 0) return null;

  const { width, height } = opciones;
  const aspect = opciones.aspect
    ?? (Number.isFinite(width) && Number.isFinite(height) && height > 0 ? width / height : 1);

  const guia = computeViewGuidance({
    object: { alt: pos.alt, az: pos.az },
    view,
    ...opciones,
    fovRad,
    aspect,
  });
  return { ...guia, target, alt: pos.alt, az: pos.az, magnitude: pos.magnitude };
}
