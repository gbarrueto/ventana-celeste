import { Temporal } from '@js-temporal/polyfill';
import { instantToMJD } from './conversions.js';

function formatOffset(offsetHours) {
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = Math.abs(offsetHours);
  const hh = String(Math.floor(abs)).padStart(2, '0');
  const mm = String(Math.round((abs % 1) * 60)).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// Midnight "today" at a fixed UTC offset, as MJD. Generalizes the old
// per-app getParanalMidnightISO()-style helpers.
export function computeMidnightMJD(offsetHours = 0) {
  const zdt = Temporal.Now.instant().toZonedDateTimeISO(formatOffset(offsetHours));
  const midnight = zdt.with({ hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return instantToMJD(midnight.toInstant());
}

// Default observation time for a deployment: either a fixed MJD pinned in
// config (useful for demos/testing), or midnight-today at the deployment's
// UTC offset. Apps should get this from their config, not hardcode a value.
export function computeDefaultObservationTime({ offsetHours = 0, fixedMJD = null } = {}) {
  return fixedMJD != null ? fixedMJD : computeMidnightMJD(offsetHours);
}

// ── Engine clock mutation ───────────────────────────────────

export function setEngineTime(engine, mjd) {
  if (!engine?.core?.observer) return;
  engine.core.observer.utc = mjd;
}

export function setEngineSpeed(engine, multiplier) {
  if (!engine?.core) return;
  engine.core.time_speed = parseInt(multiplier, 10);
}

export function nudgeEngineHours(engine, hours) {
  if (!engine?.core?.observer) return;
  engine.core.observer.utc += hours / 24;
}

export function getEngineMJD(engine) {
  return engine?.core?.observer?.utc ?? null;
}
