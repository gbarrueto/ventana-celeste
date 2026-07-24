import {
  MIN_FOV, MAX_FOV, FOCAL_LENGTH, DIAMETER, TELESCOPE_TYPE, COATING,
  CLEANLINESS, PUPIL, EXPERIENCE, SEEING_DISK_DIAMETER, ZENITH_DISTANCE,
  STAR_COLOR_INDEX, EXTINCTION, eyepieceFl, sqmReading,
} from './stores.js';

// ── Slider <-> FOV conversion ──────────────────────────────

const FACTOR = 5;
const MAX_SLIDER = 150;

export function sliderToFov(sliderValue) {
  const normalized = sliderValue / MAX_SLIDER;
  const maxExp = Math.exp(FACTOR) - 1;
  const exponential = (Math.exp(normalized * FACTOR) - 1) / maxExp;
  return MIN_FOV + exponential * (MAX_FOV - MIN_FOV);
}

export function fovToSlider(fov) {
  const normalizedFov = (fov - MIN_FOV) / (MAX_FOV - MIN_FOV);
  const maxExp = Math.exp(FACTOR) - 1;
  const logValue = Math.log(normalizedFov * maxExp + 1) / FACTOR;
  return logValue * MAX_SLIDER;
}

// ── Limiting magnitude ─────────────────────────────────────

function computeNELM() {
  const SQ = parseFloat(sqmReading);
  if (isNaN(SQ)) return undefined;
  const BS = 34.08 * Math.exp(20.7233 - 0.92104 * SQ);
  const MZ = 8.68 - 5 * Math.log(1 + 0.158 * Math.sqrt(BS)) / Math.LN10;
  return Math.round(MZ * 10) / 10;
}

export function calculateLimitMag() {
  const D = parseFloat(DIAMETER);
  const MG = parseFloat(FOCAL_LENGTH / eyepieceFl);
  const MZ = parseFloat(computeNELM());
  const CI = parseFloat(STAR_COLOR_INDEX);
  const Z = parseFloat(ZENITH_DISTANCE) * Math.PI / 180;
  const KV = parseFloat(EXTINCTION);
  const SE = parseFloat(SEEING_DISK_DIAMETER);
  const EX = EXPERIENCE;
  const DE = parseFloat(PUPIL);
  const TelescopeType = TELESCOPE_TYPE;
  const Reflectivity = 0.01 * COATING;
  const CL = parseFloat(CLEANLINESS);

  let DS, FL;
  if (TelescopeType === 2) {
    DS = 0;
    FL = Math.pow(0.99, 4);
  } else if (TelescopeType === 1) {
    DS = 0.20 * D;
    FL = Math.pow(Reflectivity, 2);
  } else {
    DS = 0.35 * D;
    FL = Math.pow(0.99 * Reflectivity, 2);
  }

  const FD = 1.0 - Math.pow(DS / D, 2);
  let FO = 0.94;
  if (TelescopeType !== 1) FO *= 0.97;
  FO *= (1 - CL);
  const FT = 1 / (FL * FD * FO);

  let FS = 1.0;
  const K = 1.2 * KV;
  const MZZ = MZ + K;
  let BS;
  if (MZZ >= 7) {
    BS = 54;
    FS = Math.pow(10, 0.4 * (7 - MZZ));
  } else {
    const XX = 0.2 * (8.68 - MZZ);
    BS = 39.7 * Math.pow(Math.pow(10, XX) - 1, 2);
  }

  const FB = Math.sqrt(2);
  const DP = D / MG;
  let FP = 1.0;
  if (DE < DP) FP = DP * DP / (DE * DE);
  const FA = DE * DE / (D * D);
  const FM = MG * MG;
  const FC = Math.pow(10, 0.4 * (CI / 2 - 1));
  BS = BS * (1 + 0.5 * Z * Z);
  const B = BS / (FB * FT * FP * FA * FM * FC);

  const CC = 1.58e-10;
  const KK = 0.0126;
  const FE = Math.pow(10, 0.4 * K / Math.cos(Z));
  const TH = SE * MG;
  let FR = 1.0;
  if (TH > 900) FR = Math.sqrt(TH / 900);
  const I = CC * Math.pow(1 + Math.sqrt(KK * B), 2);
  const IS = I * FB * FE * FT * FP * FA * FR * FC * FS;
  let M = -16.57 - 2.5 * Math.log(IS) / Math.LN10;
  M = M + (EX - 6) * 0.16;

  return Math.round(M * 10) / 10;
}

// ── Bortle scale conversions ───────────────────────────────

export function magToBortle(magArcsec2) {
  if (magArcsec2 > 21.99) return 1;
  if (magArcsec2 > 21.89) return 2;
  if (magArcsec2 > 21.69) return 3;
  if (magArcsec2 > 20.49) return 4;
  if (magArcsec2 > 19.5) return 5;
  if (magArcsec2 > 18.94) return 6;
  if (magArcsec2 > 18.38) return 7;
  if (magArcsec2 > 16.53) return 8;
  return 9;
}

export function bortleToMag(bortle) {
  const ranges = {
    1: [22.0, 21.99, 0.1],
    2: [21.99, 21.89, 0.1],
    3: [21.89, 21.69, 0.2],
    4: [21.69, 20.49, 1.2],
    5: [20.49, 19.5, 0.99],
    6: [19.5, 18.94, 0.56],
    7: [18.94, 18.38, 0.56],
    8: [18.38, 16.53, 1.85],
    9: [16.53, 15.0, 1.53],
  };
  const r = ranges[bortle];
  return r ? (r[0] + r[1]) / 2 + Math.random() * r[2] : null;
}
