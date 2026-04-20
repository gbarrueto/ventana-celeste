import { writable } from 'svelte/store';

// ── Constants ──────────────────────────────────────────────
export const MIN_FOV = 0.000005;
export const MAX_FOV = 3.228859;
export const FOV_STEP = 0.000001;
export const FOCAL_LENGTH = 1200;
export const ZOOM_PROJECTION_CONST = 100;

// Telescope parameters (limit magnitude calculation)
export const DIAMETER = 100;
export const TELESCOPE_TYPE = 2; // Refractor
export const COATING = 88;
export const CLEANLINESS = 0;
export const PUPIL = 7;
export const AGE = 30;
export const EXPERIENCE = 3;
export const SEEING_DISK_DIAMETER = 1;
export const ZENITH_DISTANCE = 30;
export const STAR_COLOR_INDEX = 0;
export const EXTINCTION = 0.3;

// Throttle rates (ms)
export const ZOOM_THROTTLE_MS = 100;
export const FOV_SEND_MS = 50;
export const BLUR_SEND_MS = 100;
export const ORIENTATION_SEND_MS = 50;
export const SEEING_THROTTLE_MS = 100;
export const POLLUTION_THROTTLE_MS = 100;
export const LOCATION_SEND_MS = 50;

// Stellarium option button config
export const STEL_BUTTONS = {
  constellations: { label: 'Constelaciones', img: 'constellations', path: 'constellations', attr: 'lines_visible' },
  atmosphere: { label: 'Atmosfera', img: 'atmosphere', path: 'atmosphere', attr: 'visible' },
  landscape: { label: 'Terreno', img: 'landscape', path: 'landscapes', attr: 'visible' },
  azimuthal: { label: 'Azimuthal', img: 'azimuthal', path: 'lines.azimuthal', attr: 'visible' },
  equatorial: { label: 'Equatorial', img: 'equatorial', path: 'lines.equatorial', attr: 'visible' },
  dss: { label: 'Nebulosa', img: 'nebulae', path: 'dss', attr: 'visible' },
};

// ── Mutable shared state ───────────────────────────────────
// These are module-level variables shared across lib files.
// Not Svelte-reactive; use stores below for UI reactivity.

export let engine = null;
export function setEngine(e) { engine = e; }

export let bortle = null;
export function setBortle(b) { bortle = b; }

export let eyepieceFl = 25;
export function setEyepieceFl(fl) { eyepieceFl = fl; }

export let sqmReading = 20;
export function setSqmReading(v) { sqmReading = v; }

export let citySqmReading = 20;
export function setCitySqmReading(v) { citySqmReading = v; }

export let logFov = Math.log(MAX_FOV);
export function setLogFov(v) { logFov = v; }

export let currentFov = 3;
export function setCurrentFov(v) { currentFov = v; }

export let currentBlur = 5;
export function setCurrentBlur(v) { currentBlur = v; }

export let currentTZ = -3;
export function setCurrentTZ(v) { currentTZ = v; }

export let engineUTC = null;
export function setEngineUTC(v) { engineUTC = v; }

export let pollution = 9;
export function setPollution(v) { pollution = v; }

export let observerLat = -24.6272;
export function setObserverLat(v) { observerLat = v; }

export let observerLon = -70.4042;
export function setObserverLon(v) { observerLon = v; }

// ── Svelte stores (UI-reactive) ────────────────────────────

export const modes = writable({ simple: true, advanced: false });
export const isLoading = writable(true);
export const isMenuOpen = writable(false);
