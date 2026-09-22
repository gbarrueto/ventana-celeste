// Detección y selección de objetos del cielo sobre el motor de Stellarium.
//
// El motor consulta por nombre y no enumera: getObj() devuelve un objeto o
// nada. Descubrir "qué se ve esta noche" es entonces recorrer un catálogo fijo
// —SKY_TARGETS en targets.js— resolviendo cada entrada y filtrando por altura
// sobre el horizonte en la fecha del motor.
//
// No toca el DOM. Recibe siempre el motor por parámetro: quién lo guarda es
// asunto de cada app.

import { SKY_TARGETS } from './targets.js';

const DEG = 180 / Math.PI;

/** El observador que el motor usa para calcular posiciones. */
function observerOf(engine) {
  return engine?.observer ?? engine?.core?.observer ?? null;
}

// ── Resolución de nombres ──────────────────────────────────────────────

// Caché por motor. La clave es el motor y no el id porque los SweObj son
// punteros a memoria wasm: cuando removeStellariumEngine() se lleva el motor,
// el WeakMap suelta sus objetos y no quedan punteros muertos apuntando a un
// contexto que ya no existe.
const cachePorMotor = new WeakMap();

// Los fallos se reintentan pasado este tiempo. Un acierto es definitivo, pero un
// fallo no: los catálogos se cargan por red después de que el motor avisa que
// está listo, así que una designación que no resuelve ahora puede resolver en
// un minuto. Cachear el fallo para siempre dejaría medio catálogo afuera según
// cuándo se hizo la primera consulta.
const REINTENTO_MS = 10000;

function cacheDe(engine) {
  let c = cachePorMotor.get(engine);
  if (!c) { c = new Map(); cachePorMotor.set(engine, c); }
  return c;
}

/**
 * Primer SweObj que el motor reconoce entre las designaciones del objetivo, o
 * `null` si no reconoce ninguna.
 */
export function resolveTarget(engine, target) {
  if (!engine || !target) return null;
  const cache = cacheDe(engine);
  const previo = cache.get(target.id);
  if (previo?.obj) return previo.obj;
  if (previo && Date.now() - previo.at < REINTENTO_MS) return null;

  let obj = null;
  for (const designation of target.designations ?? []) {
    try {
      obj = engine.getObj(designation);
    } catch {
      obj = null;   // getObj lanza si el motor todavía no terminó de arrancar
    }
    if (obj) break;
  }
  cache.set(target.id, { obj, at: Date.now() });
  return obj;
}

/** Vacía el caché de resolución de un motor. Útil al agregar fuentes de datos. */
export function clearTargetCache(engine) {
  cachePorMotor.delete(engine);
}

/**
 * Reparto del catálogo entre lo que el motor reconoce y lo que no. El segundo
 * grupo dice qué designaciones faltan para los catálogos cargados.
 */
export function resolveCatalog(engine, catalog = SKY_TARGETS) {
  const resolved = [];
  const unresolved = [];
  for (const target of catalog) {
    (resolveTarget(engine, target) ? resolved : unresolved).push(target);
  }
  return { resolved, unresolved };
}

// ── Posición ───────────────────────────────────────────────────────────

/**
 * Altura y acimut de un SweObj, en grados. Misma conversión de marco que usa el
 * visor: posición ICRF del objeto, cambio a OBSERVED, esféricas.
 */
export function getObjectAltAz(engine, obj) {
  const observer = observerOf(engine);
  if (!observer || !obj) return null;
  let pvo;
  try {
    pvo = obj.getInfo('pvo', observer);
  } catch {
    return null;   // no todo tipo de objeto informa posición y velocidad
  }
  if (!pvo) return null;
  const altaz = engine.convertFrame(observer, 'ICRF', 'OBSERVED', pvo[0]);
  const sph = engine.c2s(altaz);
  const az = engine.anp(sph[0]) * DEG;
  // anp() normaliza a [0, 2π): una altura negativa vuelve como algo cercano a
  // 360° y hay que devolverla al rango [-90, 90].
  let alt = engine.anp(sph[1]) * DEG;
  if (alt > 90) alt -= 360;
  return { alt, az };
}

/** Magnitud visual del objeto, o `null` si el motor no la informa. */
function magnitudeOf(obj) {
  let mag;
  try {
    mag = obj.getInfo('vmag');
  } catch {
    return null;   // las constelaciones y varios objetos extensos no la tienen
  }
  return Number.isFinite(mag) ? mag : null;
}

/**
 * Altura, acimut y magnitud de un objetivo del catálogo. `null` si el motor no
 * reconoce ninguna de sus designaciones.
 */
export function getTargetPosition(engine, target) {
  const obj = resolveTarget(engine, target);
  if (!obj) return null;
  const altaz = getObjectAltAz(engine, obj);
  if (!altaz) return null;
  return { obj, alt: altaz.alt, az: altaz.az, magnitude: magnitudeOf(obj) };
}

// ── Detección ──────────────────────────────────────────────────────────

/**
 * Objetivos del catálogo que están sobre el horizonte ahora mismo, ordenados de
 * más alto a más bajo.
 *
 * @param {object} engine  motor de Stellarium
 * @param {object} [opciones]
 * @param {Array}  [opciones.catalog]         catálogo a recorrer
 * @param {number} [opciones.minAltitudeDeg]  altura mínima sobre el horizonte
 * @param {string[]} [opciones.kinds]         tipos a incluir; todos si se omite
 * @param {number} [opciones.maxMagnitude]    magnitud límite; sin límite si se omite
 * @returns {Array<{target, obj, alt, az, magnitude}>}
 */
export function listVisibleTargets(engine, {
  catalog = SKY_TARGETS,
  minAltitudeDeg = 10,
  kinds = null,
  maxMagnitude = null,
} = {}) {
  if (!engine) return [];
  const tipos = kinds ? new Set(kinds) : null;
  const visibles = [];

  for (const target of catalog) {
    if (tipos && !tipos.has(target.kind)) continue;
    const pos = getTargetPosition(engine, target);
    if (!pos || !Number.isFinite(pos.alt)) continue;
    if (pos.alt < minAltitudeDeg) continue;
    // Una magnitud ausente no descarta: las constelaciones y varios cúmulos
    // extensos no la informan y son justamente objetivos a simple vista.
    if (maxMagnitude !== null && pos.magnitude !== null && pos.magnitude > maxMagnitude) continue;
    visibles.push({ target, ...pos });
  }

  return visibles.sort((a, b) => b.alt - a.alt);
}

/** Altura del Sol en grados, o `null`. Sirve para decidir si es de noche. */
export function getSunAltitude(engine) {
  if (!engine) return null;
  const sun = engine.getObj('NAME Sun');
  return sun ? (getObjectAltAz(engine, sun)?.alt ?? null) : null;
}

// ── Selección ──────────────────────────────────────────────────────────

/**
 * Marca el objetivo en el cielo escribiendo `core.selection`. No mueve la
 * vista: quien observa lo busca con el aparato. Devuelve el SweObj marcado o
 * `null` si el motor no reconoce el objetivo.
 */
export function selectTarget(engine, target) {
  if (!engine?.core) return null;
  const obj = resolveTarget(engine, target);
  engine.core.selection = obj ?? null;
  return obj;
}

/** Quita el marcado. */
export function clearSelection(engine) {
  if (engine?.core) engine.core.selection = null;
}

/**
 * Objetivo del catálogo que corresponde a lo que el motor tiene marcado, o
 * `null`. Reconoce también las selecciones nacidas de un toque en el cielo,
 * comparando las designaciones que informa el propio objeto.
 */
export function getSelectedTarget(engine, catalog = SKY_TARGETS) {
  const selection = engine?.core?.selection;
  if (!selection) return null;

  // Los SweObj son envoltorios sobre un puntero wasm: dos envoltorios del mismo
  // objeto comparten `.v`. Es la comparación exacta, y cuando falla —porque el
  // toque en el cielo produjo otra instancia— quedan las designaciones.
  let designaciones;
  try {
    designaciones = new Set(selection.designations());
  } catch {
    designaciones = null;
  }

  return catalog.find((target) => {
    const obj = resolveTarget(engine, target);
    if (!obj) return false;
    if (obj.v !== undefined && obj.v === selection.v) return true;
    return designaciones !== null
      && (target.designations ?? []).some((d) => designaciones.has(d));
  }) ?? null;
}
