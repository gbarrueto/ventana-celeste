import { Temporal } from '@js-temporal/polyfill';

// MJD at the Unix epoch (1970-01-01T00:00:00Z). MJD = JD - 2400000.5,
// and JD at the Unix epoch is 2440587.5, so MJD = epochMs/86400000 + 2440587.5 - 2400000.5.
const UNIX_EPOCH_MJD = 40587;
const MS_PER_DAY = 86400000;

function formatOffset(offsetHours) {
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = Math.abs(offsetHours);
  const hh = String(Math.floor(abs)).padStart(2, '0');
  const mm = String(Math.round((abs % 1) * 60)).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// ── Instant ⇄ MJD ───────────────────────────────────────────

export function instantToMJD(instant) {
  return instant.epochMilliseconds / MS_PER_DAY + UNIX_EPOCH_MJD;
}

export function mjdToInstant(mjd) {
  return Temporal.Instant.fromEpochMilliseconds(Math.round((mjd - UNIX_EPOCH_MJD) * MS_PER_DAY));
}

// ── ISO (absolute, with offset/Z) ⇄ MJD ────────────────────

export function isoToMJD(isoString) {
  return instantToMJD(Temporal.Instant.from(isoString));
}

export function mjdToISO(mjd) {
  return mjdToInstant(mjd).toString();
}

// ── Wall-clock (naive JS Date fields) ⇄ MJD at a fixed offset ──
// Bridges UI widgets (e.g. flatpickr) that hand back a plain JS Date whose
// getFullYear/getMonth/etc. fields represent a wall-clock reading, not an
// instant. `offsetHours` is the fixed UTC offset the reading should be
// interpreted at (e.g. -3 for Chile), independent of the browser's own zone.

export function wallClockToMJD(date, offsetHours) {
  const zdt = Temporal.ZonedDateTime.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    timeZone: formatOffset(offsetHours),
  });
  return instantToMJD(zdt.toInstant());
}

// Inverse of wallClockToMJD: MJD -> ISO-like plain string (no offset suffix),
// suitable for handing back to a UI widget as the displayed wall-clock value.
export function mjdToWallClockISO(mjd, offsetHours) {
  const zdt = mjdToInstant(mjd).toZonedDateTimeISO(formatOffset(offsetHours));
  return zdt.toPlainDateTime().toString();
}

// ── Display formatting ─────────────────────────────────────

export function formatMJDForDisplay(mjd, offsetHours = 0) {
  const zdt = mjdToInstant(mjd).toZonedDateTimeISO(formatOffset(offsetHours));
  return zdt.toPlainDateTime().toString().replace('T', ' ');
}
