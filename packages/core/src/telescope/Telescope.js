// Optics: FOV from eyepiece/magnification, limiting magnitude (NELM), Bortle
// scale, and a stateful Telescope wrapper for apps that want to track one.
//
// Design: the math is exposed as plain functions first (no instance
// required) so any app can use it with whatever numbers it already tracks.
// `Telescope` is an optional convenience wrapper around the same functions
// for apps that want to hold telescope state as an object.

export const TelescopeType = {
  REFLECTOR: 1,
  REFRACTOR: 2,
  CATADIOPTRIC: 3,
};

// ── Pure optics ─────────────────────────────────────────────

export function computeMagnification(focalLength, eyepieceFocalLength) {
  return eyepieceFocalLength > 0 ? focalLength / eyepieceFocalLength : null;
}

// FOV as seen through a given eyepiece focal length (mm), in radians.
export function computeFovFromEyepiece(focalLength, eyepieceFocalLength, projectionConstant = 100) {
  const magnification = computeMagnification(focalLength, eyepieceFocalLength);
  return (projectionConstant / magnification) * (Math.PI / 180);
}

// ── Simple-mode slider <-> FOV (exponential mapping) ───────

const SLIDER_FACTOR = 5;

export function sliderToFov(sliderValue, { minFov, maxFov, maxSlider = 150 }) {
  const normalized = sliderValue / maxSlider;
  const maxExp = Math.exp(SLIDER_FACTOR) - 1;
  const exponential = (Math.exp(normalized * SLIDER_FACTOR) - 1) / maxExp;
  return minFov + exponential * (maxFov - minFov);
}

export function fovToSlider(fov, { minFov, maxFov, maxSlider = 150 }) {
  const normalizedFov = (fov - minFov) / (maxFov - minFov);
  const maxExp = Math.exp(SLIDER_FACTOR) - 1;
  const logValue = Math.log(normalizedFov * maxExp + 1) / SLIDER_FACTOR;
  return logValue * maxSlider;
}

// ── Limiting magnitude (NELM) + Bortle scale ───────────────

function computeNELM(sqmReading) {
  const SQ = parseFloat(sqmReading);
  if (isNaN(SQ)) return undefined;
  const BS = 34.08 * Math.exp(20.7233 - 0.92104 * SQ);
  const MZ = 8.68 - 5 * Math.log(1 + 0.158 * Math.sqrt(BS)) / Math.LN10;
  return Math.round(MZ * 10) / 10;
}

// Nautical/naked-eye limiting magnitude adjusted for a telescope + sky
// conditions. `aperture`/`magnification` describe the telescope; the rest
// describe the sky and the observer, not the instrument itself.
export function calculateLimitMag({
  aperture,
  magnification,
  telescopeType = TelescopeType.REFRACTOR,
  coatingReflectivity = 88,
  cleanliness = 0,
  sqmReading,
  starColorIndex = 0,
  zenithDistanceDeg = 30,
  extinction = 0.3,
  seeingDiskDiameter = 1,
  observerExperience = 3,
  observerPupil = 7,
}) {
  const D = parseFloat(aperture);
  const MG = parseFloat(magnification);
  const MZ = parseFloat(computeNELM(sqmReading));
  const CI = parseFloat(starColorIndex);
  const Z = (parseFloat(zenithDistanceDeg) * Math.PI) / 180;
  const KV = parseFloat(extinction);
  const SE = parseFloat(seeingDiskDiameter);
  const EX = observerExperience;
  const DE = parseFloat(observerPupil);
  const Reflectivity = 0.01 * coatingReflectivity;
  const CL = parseFloat(cleanliness);

  let DS, FL;
  if (telescopeType === TelescopeType.REFRACTOR) {
    DS = 0;
    FL = Math.pow(0.99, 4);
  } else if (telescopeType === TelescopeType.REFLECTOR) {
    DS = 0.20 * D;
    FL = Math.pow(Reflectivity, 2);
  } else {
    DS = 0.35 * D;
    FL = Math.pow(0.99 * Reflectivity, 2);
  }

  const FD = 1.0 - Math.pow(DS / D, 2);
  let FO = 0.94;
  if (telescopeType !== TelescopeType.REFLECTOR) FO *= 0.97;
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
  if (DE < DP) FP = (DP * DP) / (DE * DE);
  const FA = (DE * DE) / (D * D);
  const FM = MG * MG;
  const FC = Math.pow(10, 0.4 * (CI / 2 - 1));
  BS = BS * (1 + 0.5 * Z * Z);
  const B = BS / (FB * FT * FP * FA * FM * FC);

  const CC = 1.58e-10;
  const KK = 0.0126;
  const FE = Math.pow(10, (0.4 * K) / Math.cos(Z));
  const TH = SE * MG;
  let FR = 1.0;
  if (TH > 900) FR = Math.sqrt(TH / 900);
  const I = CC * Math.pow(1 + Math.sqrt(KK * B), 2);
  const IS = I * FB * FE * FT * FP * FA * FR * FC * FS;
  let M = -16.57 - (2.5 * Math.log(IS)) / Math.LN10;
  M = M + (EX - 6) * 0.16;

  return Math.round(M * 10) / 10;
}

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

// ── Telescope: stateful convenience wrapper ────────────────

export class Telescope {
  constructor({
    name = 'Telescope',
    type = TelescopeType.REFRACTOR,
    aperture,
    focalLength,
    coatingReflectivity = 88,
    cleanliness = 0,
  } = {}) {
    this.name = name;
    this.type = type;
    this.aperture = aperture;
    this.focalLength = focalLength;
    this.coatingReflectivity = coatingReflectivity;
    this.cleanliness = cleanliness;

    this.eyepieceFocalLength = null;
    this.magnification = null;

    this.ra = null;
    this.dec = null;
    this.alt = null;
    this.az = null;
  }

  setEyepieceFocalLength(eyepieceFocalLength) {
    this.eyepieceFocalLength = eyepieceFocalLength;
    this.magnification = computeMagnification(this.focalLength, eyepieceFocalLength);
  }

  fovFromEyepiece(eyepieceFocalLength, projectionConstant = 100) {
    return computeFovFromEyepiece(this.focalLength, eyepieceFocalLength, projectionConstant);
  }

  limitMag(conditions = {}) {
    return calculateLimitMag({
      aperture: this.aperture,
      magnification: this.magnification,
      telescopeType: this.type,
      coatingReflectivity: this.coatingReflectivity,
      cleanliness: this.cleanliness,
      ...conditions,
    });
  }

  setPosition(ra, dec) {
    this.ra = ra;
    this.dec = dec;
  }

  setAltAz(alt, az) {
    this.alt = alt;
    this.az = az;
  }

  getRaDec() {
    return { ra: this.ra, dec: this.dec };
  }

  getAltAz() {
    return { alt: this.alt, az: this.az };
  }
}

export function createDefaultTelescope(overrides = {}) {
  return new Telescope({
    name: 'Ventana Celeste',
    type: TelescopeType.REFRACTOR,
    aperture: 100,
    focalLength: 1200,
    ...overrides,
  });
}
