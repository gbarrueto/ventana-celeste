// Simulación de seeing atmosférico como post-proceso sobre el canvas del motor.
//
// El modelo es de tres términos, y la razón de que sean tres es física. El ángulo
// isoplanático de una capa turbulenta vale θ₀ = 0.314·r₀ℓ/h y su frecuencia
// f = v/(0.314·r₀ℓ), o sea que el tamaño angular de celda depende de la altura y
// la velocidad de hervor no. Al meter alturas reales las capas se parten en dos
// grupos que no tienen nada que ver entre sí:
//
//   capa límite   h ≈ 100 m   →  celdas de 2–6′ a 10–30 Hz   →  se ve deformando
//   capas altas   h ≥ 5 km    →  celdas de 1–4″ a >150 Hz    →  no se ve deformar
//
// Todo lo que está por encima de un kilómetro cae por debajo del límite de
// resolución y por encima de la fusión de parpadeo, así que no aporta warp sino
// desenfoque y modulación de brillo. Modelar las dos cosas con un mismo término
// obliga a elegir una escala intermedia que no es ninguna de las dos, y el
// resultado se lee como un frente de olas en vez de un temblor local.
//
// Tres decisiones que sostienen el resto:
//
//   · El desplazamiento es el GRADIENTE de un campo de fase, no ruido usado
//     directo como offset. El ángulo de llegada de un rayo es el gradiente del
//     frente de onda, así que es la relación correcta, y de regalo la
//     divergencia de ese mismo campo da la compresión del haz — las cáusticas —
//     sin muestrear nada nuevo. Un campo curl-noise sería la elección
//     equivocada justamente por tener divergencia cero.
//
//   · Se deforma primero y se difumina después (Chan 2022, "Tilt-then-Blur or
//     Blur-then-Tilt?"). Al revés se destruyen las PSF en vez de trasladarlas.
//
//   · Las amplitudes se expresan en arcosegundos y se convierten a píxeles con
//     el FOV. Así el efecto crece solo al hacer zoom y desaparece solo a campo
//     amplio, sin rampas ad-hoc, y los parámetros son magnitudes que quien
//     observa puede estimar mirando el cielo.
//
// No toca el DOM: recibe dos canvas ya posicionados y dibuja adentro del
// segundo. Quién los coloca y qué filtros CSS llevan es asunto de cada app.

import { createDefaultTelescope } from '../telescope/Telescope.js';

// Las características del instrumento viven en Telescope.js. De ahí sale la
// apertura, que es de lo que dependen D/r₀ y el límite de difracción.
const TELESCOPIO = createDefaultTelescope();

const ARCSEC = 4.8481368e-6;   // radianes por arcosegundo
const LAMBDA = 550e-9;         // longitud de onda visual de referencia, m
const H_SUELO = 100;           // altura asumida de la capa límite, m
const GATE_FADE = 1.8;         // factor de FOV en que se desvanece la compuerta
const D_REFERENCIA = TELESCOPIO.aperture / 1000;   // apertura donde satAperture vale 1

export const SEEING_DEFAULTS = {
  // Ajustados en el banco de device-lab contra el motor, en el rango de campo
  // que dual-telescope alcanza de verdad (1.72′ a 10′). Describen una noche
  // corriente; SEEING_PRESETS cubre el resto de la escala.

  // Atmósfera
  seeing: 1.0,          // FWHM en arcosegundos. Rango operativo 0.3 a 3.
  intermit: 0.35,       // 0..1 — rachas y calmas en escala de segundos.

  // Cuánto del efecto físico se muestra. Va por debajo de 1 a propósito: el
  // seeing real a gran aumento marea en una pieza de museo. Separado de `seeing`
  // porque de él dependen r₀, D/r₀ y la atenuación del centelleo.
  intensity: 0.3,

  // Capa límite: la única que produce deformación visible.
  cellArcmin: 0.57,     // tamaño angular de celda
  boilHz: 40,           // frecuencia de decorrelación
  octaves: 3,           // 1..4 — escalas superpuestas. Ver OCTAVAS.
  // 0 = puro hervor en el lugar, 1 = puro arrastre por viento. Queda en 0 por
  // precisión, no por gusto: el arrastre es el único término que empuja la
  // coordenada espacial del ruido lejos del origen, y ahí el fract() de las
  // GPU móviles se queda sin bits. Medido en el aparato, la diferencia visual
  // entre 0 y 0.4 es imperceptible. Ver la trampa sobre precisión.
  frozen: 0,
  windDir: 227,         // grados

  // Capas altas: desenfoque y brillo, nunca deformación. Valores altos granulan
  // la Luna antes de que las estrellas lleguen a titilar.
  compress: 0.1,        // multiplica la divergencia del warp, cuya base ya es física
  scint: 0.34,          // amplitud antes de la supresión por altura y apertura
  scintArcsec: 7,       // θc = √(λ/h). Implica capa baja y poco centelleo.
  jetDrift: 7,          // arcmin/s con que barren las bandas de brillo
  jetDir: 186,          // grados

  // Instrumento y percepción
  aperture: TELESCOPIO.aperture,   // mm, desde Telescope.js
  tipTilt: 0.97,        // multiplicador sobre el movimiento global calculado
  blurMul: 0.72,        // desenfoque residual, sobre la fracción que deja D/r₀
  diffMul: 0.4,           // límite de difracción del instrumento. 0 lo desactiva.
  lucky: 0.5,           // profundidad de los instantes de nitidez

  // Saturación del resultado, por debajo de 1 a propósito. El motor pinta color
  // en nebulosas y estrellas que el ojo no percibe a esos niveles de luz: a
  // brillo bajo la visión es escotópica y ve en gris. Va atada a la apertura
  // porque más apertura entrega más luz y con ella algo más de color. En la
  // apertura de referencia el factor vale 1 y este número es la saturación final.
  saturation: 0.25,

  // Compuerta por campo. No es física — el seeing existe a todo campo, sólo que
  // por debajo de un píxel de desplazamiento no hay nada que ver. Sirve para
  // elegir a partir de qué aumento aparece y para no gastar GPU antes de eso.
  // 0 la desactiva y el efecto corre siempre.
  fovGateArcmin: 0,

  // Render
  model: 3,             // 3 = modelo completo. 0..2 existen para comparar en el banco.
  legacyAmount: 80,     // amplitud del modelo 0, el shader de ondas original
  resolutionScale: 1,   // < 1 renderiza a menos píxeles y estira, para equipos lentos
  maxFps: 60,           // 0 lo deja al ritmo de la pantalla
};

// Metadatos de cada parámetro: rango, unidad y a quién se le expone. `scope`
// separa lo que ve el público de lo que sólo toca quien desarrolla. La app
// pública muestra únicamente los de scope 'user' — hoy el seeing y nada más — y
// el resto va detrás de un panel de depuración. Los paneles se construyen desde
// aquí para que no haya dos listas que se desincronicen.
export const SEEING_PARAMS = [
  { k: 'seeing',        scope: 'user',  grupo: 'Atmósfera',    lbl: 'Seeing FWHM',        min: 0.3, max: 3,   step: 0.05, u: '″' },

  { k: 'intensity',     scope: 'debug', grupo: 'Atmósfera',    lbl: 'Intensidad',         min: 0,   max: 1.5, step: 0.01, u: '×' },
  { k: 'intermit',      scope: 'debug', grupo: 'Atmósfera',    lbl: 'Intermitencia',      min: 0,   max: 1,   step: 0.01, u: ''  },

  { k: 'cellArcmin',    scope: 'debug', grupo: 'Capa límite',  lbl: 'Tamaño de celda',    min: 0.1, max: 14,  step: 0.01, u: '′' },
  { k: 'boilHz',        scope: 'debug', grupo: 'Capa límite',  lbl: 'Frecuencia hervor',  min: 1,   max: 45,  step: 0.5,  u: ' Hz' },
  { k: 'octaves',       scope: 'debug', grupo: 'Capa límite',  lbl: 'Octavas',            min: 1,   max: 4,   step: 1,    u: ''  },
  { k: 'frozen',        scope: 'debug', grupo: 'Capa límite',  lbl: 'Flujo congelado',    min: 0,   max: 1,   step: 0.01, u: ''  },
  { k: 'windDir',       scope: 'debug', grupo: 'Capa límite',  lbl: 'Dirección',          min: 0,   max: 360, step: 1,    u: '°' },

  { k: 'compress',      scope: 'debug', grupo: 'Capas altas',  lbl: 'Compresión geom.',   min: 0,   max: 6,   step: 0.05, u: '×' },
  { k: 'scint',         scope: 'debug', grupo: 'Capas altas',  lbl: 'Centelleo',          min: 0,   max: 1,   step: 0.01, u: ''  },
  { k: 'scintArcsec',   scope: 'debug', grupo: 'Capas altas',  lbl: 'Escala centelleo',   min: 1,   max: 15,  step: 0.25, u: '″' },
  { k: 'jetDrift',      scope: 'debug', grupo: 'Capas altas',  lbl: 'Deriva del jet',     min: 0,   max: 30,  step: 0.5,  u: ' ′/s' },
  { k: 'jetDir',        scope: 'debug', grupo: 'Capas altas',  lbl: 'Dirección del jet',  min: 0,   max: 360, step: 1,    u: '°' },

  // La apertura sale de Telescope.js. Aparece aquí para poder compararla en el
  // banco, no para que la app la ofrezca.
  { k: 'aperture',      scope: 'debug', grupo: 'Óptica',       lbl: 'Apertura',           min: 50,  max: 400, step: 5,    u: ' mm' },
  { k: 'tipTilt',       scope: 'debug', grupo: 'Óptica',       lbl: 'Tip/tilt global',    min: 0,   max: 2,   step: 0.01, u: '×' },
  { k: 'blurMul',       scope: 'debug', grupo: 'Óptica',       lbl: 'Desenfoque residual',min: 0,   max: 3,   step: 0.01, u: '×' },
  { k: 'diffMul',       scope: 'debug', grupo: 'Óptica',       lbl: 'Difracción',         min: 0,   max: 2,   step: 0.05, u: '×' },
  { k: 'lucky',         scope: 'debug', grupo: 'Óptica',       lbl: 'Lucky imaging',      min: 0,   max: 1,   step: 0.01, u: ''  },
  { k: 'saturation',    scope: 'debug', grupo: 'Óptica',       lbl: 'Saturación',         min: 0,   max: 2,   step: 0.05, u: '×' },

  { k: 'fovGateArcmin', scope: 'debug', grupo: 'Render',       lbl: 'Aparece bajo',       min: 0,   max: 120, step: 1,    u: '′' },
  { k: 'resolutionScale', scope: 'debug', grupo: 'Render',     lbl: 'Resolución',         min: 0.4, max: 1,   step: 0.05, u: '×' },
  { k: 'maxFps',        scope: 'debug', grupo: 'Render',       lbl: 'Tope de cuadros',    min: 0,   max: 120, step: 5,    u: ' fps' },
  { k: 'model',         scope: 'debug', grupo: 'Render',       lbl: 'Modelo',             min: 0,   max: 3,   step: 1,    u: ''  },
  { k: 'legacyAmount',  scope: 'debug', grupo: 'Render',       lbl: 'Amplitud modelo 0',  min: 0,   max: 200, step: 1,    u: ''  },
];

// Antoniadi I a V es la escala con que se anota el seeing en la bitácora, así que
// sirve de preset con nombre en vez de exponer el número crudo. Sólo varía lo que
// cambia de una noche a otra: el tamaño de celda, la dirección del viento y la
// apertura describen el sitio y el instrumento, y se quedan en los defaults.
export const SEEING_PRESETS = {
  antoniadi1: { seeing: 0.4, intensity: 0.22, intermit: 0.15, boilHz: 30,
                blurMul: 0.90, lucky: 0.72, compress: 0.04, scint: 0.05, jetDrift: 12 },
  antoniadi3: { seeing: 1.0, intensity: 0.30, intermit: 0.35, boilHz: 40,
                blurMul: 1.00, lucky: 0.50, compress: 0.05, scint: 0.06, jetDrift: 20 },
  antoniadi5: { seeing: 3.0, intensity: 0.45, intermit: 0.58, boilHz: 45,
                blurMul: 1.10, lucky: 0.18, compress: 0.08, scint: 0.09, jetDrift: 27 },
  jetStream:  { seeing: 1.6, intensity: 0.34, intermit: 0.30, boilHz: 38,
                blurMul: 1.00, lucky: 0.35, compress: 0.05, scint: 0.11,
                scintArcsec: 1.6, jetDrift: 30 },
  calorSuelo: { seeing: 2.2, intensity: 0.40, intermit: 0.52, boilHz: 22,
                blurMul: 1.00, lucky: 0.45, compress: 0.10, scint: 0.05,
                cellArcmin: 1.2, frozen: 0.2, jetDrift: 6 },
};

/**
 * Magnitudes derivadas de los parámetros. Función pura: la usa el propio overlay
 * para armar sus uniforms y el banco de pruebas para mostrar en qué se traduce
 * cada slider, sin necesidad de una instancia.
 *
 * `fov` en radianes (el alto del campo), `viewHeightPx` en píxeles físicos.
 */
export function computeSeeingPhysics(params, fov, viewHeightPx) {
  const p = { ...SEEING_DEFAULTS, ...params };

  // r₀ desde el seeing: FWHM = 0.98 λ / r₀
  const r0 = (0.98 * LAMBDA) / (Math.max(0.05, p.seeing) * ARCSEC);
  const D = p.aperture / 1000;
  const DR = D / r0;

  // Movimiento de imagen: σ ≈ 0.43 (λ/D)(D/r₀)^(5/6). Depende muy débilmente de
  // la apertura, pero el desenfoque residual no, así que a mayor apertura la
  // imagen baila proporcionalmente menos de lo que se difumina.
  const tiltArcsec = (0.43 * (LAMBDA / D) * Math.pow(DR, 5 / 6)) / ARCSEC;

  const fovArcsec = Math.max(1e-6, fov / ARCSEC);
  const pxPerArcsec = viewHeightPx / fovArcsec;   // viewHeightPx = el lado que abarca el FOV

  // Capa límite: de θ₀ y f salen el r₀ de la capa, su viento y su deriva angular.
  // Sirven para avisar cuando una combinación de sliders pide un viento absurdo.
  const r0Suelo = ((p.cellArcmin * 60 * ARCSEC) * H_SUELO) / 0.314;
  const vSuelo = p.boilHz * 0.314 * r0Suelo;
  const driftArcminPerSec = ((vSuelo / H_SUELO) / ARCSEC) / 60;

  // Centelleo: θc = √(λ/h), así que la escala elegida implica una altura de capa.
  const thetaC = p.scintArcsec * ARCSEC;
  const hCentelleo = LAMBDA / (thetaC * thetaC);

  // El disco de seeing promedia cualquier estructura más fina que él. Es el mismo
  // mecanismo que en el cielo real apaga el centelleo de los planetas.
  // La escala elegida fija la altura de la capa, y de ahí salen las dos
  // supresiones que faltaban. La intensidad de centelleo crece con la altura
  // como h^(5/12), y la apertura promedia sobre los parches de Fresnel que le
  // entran, con (r_F/D)^(7/6). Juntas explican por qué una capa baja vista con
  // 150 mm casi no centellea: la combinación vale 0.02, no 1.
  const altFactor = Math.pow(hCentelleo / 10000, 5 / 12);
  const rFresnel = Math.sqrt(LAMBDA * hCentelleo);
  const apFactor = D <= rFresnel ? 1 : Math.pow(rFresnel / D, 7 / 6);
  const scintAtten = Math.min(1, p.scintArcsec / Math.max(0.3, p.seeing))
                   * altFactor * apFactor;

  // Fraccion del seeing que sobrevive como desenfoque despues de quitar el tilt.
  // La varianza residual vale 0.134 (D/r0)^(5/3), asi que con D por debajo de r0
  // el instrumento queda limitado por difraccion y casi no hay desenfoque
  // atmosferico, mientras que con D muy por encima se satura en el disco
  // completo. Es la via por la que la apertura afecta algo mas que el tip/tilt.
  const blurFrac = 1 - Math.exp(-0.134 * Math.pow(DR, 5 / 3));

  // Límite de difracción, FWHM del disco de Airy. Es del instrumento y no de la
  // atmósfera, así que ni la intensidad ni la intermitencia lo tocan, y el lucky
  // imaging no puede bajar de él: alcanzarlo en los buenos momentos es
  // exactamente lo que significa esa técnica. Sin este término la apertura sólo
  // empeoraba la imagen, cuando en el instrumento hace las dos cosas a la vez.
  const diffArcsec = (1.03 * LAMBDA / D) / ARCSEC;

  // Factor de saturación por apertura, referido a la del telescopio del
  // proyecto. Raíz cúbica para que el recorrido completo de aperturas cambie el
  // color por un factor dos y no por uno de ocho. Con la saturación base por
  // debajo de 1, el producto no llega a saturar de más ni con la apertura mayor.
  const satAperture = Math.min(1.5, Math.max(0.55, Math.cbrt(D / D_REFERENCIA)));

  // Compuerta por campo, con desvanecimiento en un factor 1.8 de FOV para que no
  // aparezca de golpe. Vale 1 en el umbral o más cerrado, 0 a 1.8 veces el
  // umbral. En logaritmo, porque el campo se recorre en factores y no en sumas.
  const fovArcmin = fovArcsec / 60;
  const gate = p.fovGateArcmin > 0
    ? Math.max(0, Math.min(1,
        Math.log((p.fovGateArcmin * GATE_FADE) / fovArcmin) / Math.log(GATE_FADE)))
    : 1;

  return {
    r0, D, DR, tiltArcsec, pxPerArcsec, fovArcsec, fovArcmin, gate, blurFrac, diffArcsec,
    rFresnel, altFactor, apFactor, satAperture,
    r0Suelo, vSuelo, driftArcminPerSec,
    hCentelleo, scintAtten,
  };
}

// ── Shaders ────────────────────────────────────────────────────────────────

const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// highp no está garantizado en fragment shaders de WebGL1, y estas páginas se
// abren en teléfonos. Sin el fallback el shader no compila en esos equipos.
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D u_src;
uniform vec2  u_res;
uniform float u_t;
uniform int   u_modelL, u_modelR;
uniform float u_split;
uniform vec2  u_tipTilt;
uniform float u_env;
uniform float u_luckySharp;
uniform float u_warpPx;
uniform float u_cellPx;
uniform vec2  u_driftOff;   // celdas ya acumuladas y acotadas
uniform float u_boilTz;     // eje temporal ya acumulado y acotado
uniform float u_compress;
uniform float u_compressBase;
uniform float u_scint;
uniform float u_scintPx;
uniform vec2  u_jetOff;     // celdas de centelleo, acumuladas y acotadas
uniform float u_scintTz;
uniform float u_blurPx;
uniform float u_blurFloor;
uniform float u_saturation;
uniform float u_legacyAmt;
uniform vec4  u_octW;
varying vec2 v_uv;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// Periodo del retículo. El índice se envuelve antes de entrar al hash, de modo
// que el campo es periódico y la coordenada se puede acotar en CPU sin que el
// patrón salte. Sin esto la coordenada crece con el tiempo sin límite: la deriva
// la hace avanzar decenas de celdas por segundo, la cuarta octava la multiplica
// por ocho, y a los pocos segundos el fract() se queda sin bits y el ruido
// colapsa. En mediump, que es a lo que caen varias GPU móviles, la imagen se
// rompe en bloques a los diez segundos.
//
// 256 celdas de repetición espacial son unas veinticinco pantallas, y 4096 de
// repetición temporal son varios minutos.
const vec3 PERIODO = vec3(256.0, 256.0, 4096.0);

float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec3 a0 = mod(i, PERIODO);
  vec3 a1 = mod(i + 1.0, PERIODO);
  float v = mix(
    mix(mix(hash13(vec3(a0.x, a0.y, a0.z)), hash13(vec3(a1.x, a0.y, a0.z)), f.x),
        mix(hash13(vec3(a0.x, a1.y, a0.z)), hash13(vec3(a1.x, a1.y, a0.z)), f.x), f.y),
    mix(mix(hash13(vec3(a0.x, a0.y, a1.z)), hash13(vec3(a1.x, a0.y, a1.z)), f.x),
        mix(hash13(vec3(a0.x, a1.y, a1.z)), hash13(vec3(a1.x, a1.y, a1.z)), f.x), f.y), f.z);
  return v * 2.0 - 1.0;
}
float fbm2h(vec3 p) { return n3(p) * 0.66 + n3(p * 2.11 + 9.1) * 0.34; }

// Gradiente y laplaciano de una octava, con el paso de las diferencias centrales
// expresado en el espacio de esa octava. Un paso único para todas deja la octava
// más fina por debajo de su propio retículo, y entonces agregarla no cambia
// nada: medido, el rms del gradiente pasa de 0.791 a 0.788 al sumar la cuarta.
// Con el paso por octava pasa de 0.818 a 0.966 y la estructura fina aparece.
// La lacunaridad es entera a propósito: con ella, envolver la coordenada base
// en el período envuelve también cada octava, porque su desplazamiento es un
// múltiplo del período. Con una razón fraccionaria el patrón saltaría al
// envolver.
vec3 octGrad(vec2 q, float tz, float f, float off) {
  const float e = 0.30;
  vec2  p = q * f + off;
  float z = tz * f;
  float c  = n3(vec3(p, z));
  float px = n3(vec3(p + vec2(e, 0.0), z));
  float mx = n3(vec3(p - vec2(e, 0.0), z));
  float py = n3(vec3(p + vec2(0.0, e), z));
  float my = n3(vec3(p - vec2(0.0, e), z));
  return vec3((px - mx) / (2.0 * e) * f,
              (py - my) / (2.0 * e) * f,
              (px + mx + py + my - 4.0 * c) * f * f / (e * e));
}

// Campo de fase de la capa límite. Los pesos siguen a Kolmogorov: la fase decae
// 0.56 por octava y el gradiente la multiplica por la frecuencia, así que la
// deformación crece con la frecuencia. Las octavas finas son las que producen el
// temblor localizado; la primera sola da un vaivén global.
vec3 phaseField(vec2 q, float tz) {
  vec3 a = octGrad(q, tz, 1.0, 0.0) * u_octW.x;
  // Las octavas apagadas pesan cero pero costaban lo mismo: cada una son cinco
  // evaluaciones de ruido, un 23 % del total con tres octavas. La condición mira
  // un uniform, igual para todos los fragmentos, así que no diverge.
  if (u_octW.y > 0.0) a += octGrad(q, tz, 2.0, 17.3) * u_octW.y;
  if (u_octW.z > 0.0) a += octGrad(q, tz, 4.0, 34.6) * u_octW.z;
  if (u_octW.w > 0.0) a += octGrad(q, tz, 8.0, 51.9) * u_octW.w;
  return a;
}

// El centelleo modula brillo con el VALOR del campo, no con su laplaciano. El
// laplaciano está dominado por las frecuencias altas y sobre una superficie
// extendida se lee como granulado; la intensidad de un patrón de centelleo real
// es suave. El laplaciano queda sólo para la compresión geométrica, donde sí
// corresponde por ser la divergencia del desplazamiento.
float scintField(vec2 q, float tz) { return fbm2h(vec3(q, tz)); }

// Modelo 0 — puerto literal del shader original, para comparar contra algo real.
// ox depende sólo de y, oy sólo de x: es la definición de una onda plana viajera.
vec2 waveOffset(vec2 uv, float t) {
  float s = u_legacyAmt * 0.0001;
  float tt = t * 0.5;
  float ox = sin(uv.y * 42.1 + tt * 1.1) * s * 0.7 + sin(uv.y * 15.3 - tt * 1.6) * s * 0.6;
  float oy = cos(uv.x * 35.7 + tt * 0.9) * s * 0.7 + cos(uv.x * 21.9 + tt * 1.3) * s * 0.4;
  return vec2(ox, oy);
}

void main() {
  vec2 frag = v_uv * u_res;
  int model = (v_uv.x < u_split) ? u_modelL : u_modelR;

  vec2  offPx = vec2(0.0);
  float gain  = 1.0;
  float blur  = 0.0;

  if (model == 0) {
    offPx = waveOffset(v_uv, u_t) * u_res;
  } else if (model == 1) {
    // Domain warping tal cual se hace en juegos: el ruido va directo como offset.
    // Topología correcta (celdas locales) pero sin divergencia real, así que no
    // puede dar cáusticas.
    vec2 q = frag / u_cellPx + u_driftOff;
    float tz = u_boilTz;
    offPx = vec2(fbm2h(vec3(q, tz)), fbm2h(vec3(q + 53.7, tz + 11.0)))
          * u_warpPx * u_env * 2.0;
  } else {
    vec2 q = frag / u_cellPx + u_driftOff;
    vec3 f = phaseField(q, u_boilTz);
    offPx = f.xy * u_warpPx * u_env;

    // Compresión geométrica: la divergencia del propio warp, conservación de
    // flujo. Su amplitud no es libre — vale warpPx/cellPx, del orden del 1 %, y
    // es independiente del FOV porque ambas escalas crecen juntas al zoomear.
    gain = 1.0 - u_compress * u_compressBase * f.z * u_env;

    if (model == 3) {
      // Centelleo: difracción de Fresnel de las capas altas, escala θc = √(λ/h).
      // A esa escala se discrimina solo, sin detectar qué se está mirando: una
      // estrella entra entera en una celda y titila con amplitud plena, mientras
      // que una superficie extendida abarca cientos de celdas descorrelacionadas
      // que se promedian entre sí. Es por lo que las estrellas titilan y los
      // planetas no, con la misma atmósfera para ambos.
      vec2 qb = frag / u_scintPx + u_jetOff;
      float sc = scintField(qb, u_scintTz);
      gain -= u_scint * sc * u_env * 1.2;
      blur = u_blurPx * u_env * (0.62 + 1.4 * abs(sc)) * u_luckySharp;
      // El piso de difracción se suma en cuadratura y queda fuera de la
      // envolvente: no es atmósfera y no se atenúa con ella.
      blur = sqrt(blur * blur + u_blurFloor * u_blurFloor);
    }
    offPx += u_tipTilt;
  }
  gain = clamp(gain, 0.25, 2.4);

  vec2 uv = (frag + offPx) / u_res;
  vec3 col;
  if (blur < 0.12) {
    col = texture2D(u_src, uv).rgb;
  } else {
    col = texture2D(u_src, uv).rgb * 0.28;
    float wsum = 0.28;
    float rot = hash13(vec3(frag, 1.0)) * 6.2831853;
    for (int i = 0; i < 8; i++) {
      float a = 6.2831853 * float(i) / 8.0 + rot;
      vec2 d = vec2(cos(a), sin(a));
      float w = (i < 4) ? 0.14 : 0.075;
      float r = (i < 4) ? 0.55 : 1.0;
      col += texture2D(u_src, uv + d * blur * r / u_res).rgb * w;
      wsum += w;
    }
    col /= wsum;
  }

  col *= gain;
  // Saturación sobre la luminancia Rec.709.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, u_saturation);
  if (u_split > 0.001 && abs(v_uv.x - u_split) < 0.0009) col = vec3(0.48, 0.59, 0.94);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Pesos por octava y su normalización, medidos sobre el mismo ruido del shader.
// `grad` deja la amplitud de la deformación igual al cambiar de número de
// octavas, así que el deslizador cambia el carácter del temblor y no su tamaño.
// La columna de la izquierda es la escala más fina alcanzada, como fracción del
// tamaño de celda: con 3.4′ de base, cuatro octavas llegan a 0.36′.
const OCTAVAS = {
  1: { w: [1.0000, 0.0000, 0.0000, 0.0000], grad: 0.6981 },  // base
  2: { w: [0.6410, 0.3590, 0.0000, 0.0000], grad: 0.8038 },  // base / 2
  3: { w: [0.5337, 0.2989, 0.1674, 0.0000], grad: 0.6728 },  // base / 4
  4: { w: [0.4880, 0.2733, 0.1530, 0.0857], grad: 0.6171 },  // base / 8
};

// ── Envolventes en CPU ─────────────────────────────────────────────────────
// Tip/tilt global, intermitencia y lucky imaging son señales globales, una por
// frame. No hay razón para pagarlas por píxel.

function h1(i) { const x = Math.sin(i * 127.1) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
function sn1(t) {
  const i = Math.floor(t); let f = t - i;
  f = f * f * (3 - 2 * f);
  return h1(i) * (1 - f) + h1(i + 1) * f;
}
// Normalizada a rms 1 (medido 0.3313 sin el factor). Sin esto el movimiento
// global se entregaba tres veces mas debil de lo que declara tiltArcsec, y el
// deslizador de tip/tilt no llegaba a mover un pixel.
const NORM_FN1 = 3.0182;
function fn1(t) {
  return (sn1(t) * 0.6 + sn1(t * 2.3 + 5.1) * 0.28 + sn1(t * 5.1 + 13.7) * 0.12) * NORM_FN1;
}

/**
 * Crea el overlay. `skyCanvas` es el canvas del motor, del que se lee; `effectCanvas`
 * es donde se dibuja, y tiene que estar ya colocado con exactamente la misma
 * geometría en pantalla — recorte, tamaño y rotación incluidos.
 *
 * Devuelve `null` si no hay WebGL.
 */
export function createSeeingOverlay({
  skyCanvas,
  effectCanvas,
  params = {},
  fov = 1.2,
  // Lo provee la app y devuelve el FOV actual en radianes. Se lee por frame.
  // Hace falta cuando el zoom no pasa por la app — el motor atiende la rueda del
  // ratón y los gestos por su cuenta, y sin esto el overlay conserva el último
  // FOV que le pasaron y calcula todas sus escalas contra un campo que ya no es.
  getFov = null,
  // A qué lado del canvas corresponde el FOV que reporta el motor. Stellarium
  // no usa la misma convención en todos los casos, y equivocarse escala mal
  // todas las amplitudes: el efecto sale débil o exagerado por el factor de
  // aspecto. 'height' es lo que asumía este módulo desde el principio.
  fovAxis = 'height',
  // Se llama con true cuando el overlay empieza a dibujar y con false cuando la
  // compuerta lo apaga. La app lo usa para mostrar u ocultar su canvas: con el
  // efecto apagado el canvas conservaría el último frame dibujado.
  onActiveChange = null,
} = {}) {
  const gl = effectCanvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
  if (!gl) { console.error('[seeing] WebGL no disponible'); return null; }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[seeing] error de shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(program, 0, 'a_pos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[seeing] error de enlace:', gl.getProgramInfoLog(program));
    return null;
  }

  // Se leen por introspección y no por nombre suelto: un uniform que el
  // compilador elimine por no usarse devuelve una location nula, y pasarla a
  // gl.uniform*() rompe el bucle entero.
  const U = {};
  const nU = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nU; i++) {
    const { name } = gl.getActiveUniform(program, i);
    U[name] = gl.getUniformLocation(program, name);
  }
  const set1f = (n, v) => { if (U[n]) gl.uniform1f(U[n], v); };
  const set2f = (n, a, b) => { if (U[n]) gl.uniform2f(U[n], a, b); };
  const set4f = (n, a, b, c, d) => { if (U[n]) gl.uniform4f(U[n], a, b, c, d); };
  const set1i = (n, v) => { if (U[n]) gl.uniform1i(U[n], v); };

  // Un solo triángulo que cubre la pantalla: evita la costura diagonal que dejan
  // dos triángulos y ahorra un vértice.
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  // El navegador aplica su conversión de perfil de color al subir una textura
  // desde un canvas. Con el motor eso llega como una pérdida de saturación
  // respecto de lo que se ve sin overlay.
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

  const P = { ...SEEING_DEFAULTS, ...params };
  let fovRad = fov;
  let compareModel = null;   // null = sin comparación A/B
  let corriendo = true;
  let habilitado = true;
  let activo = null;
  let W = 0, H = 0;

  // El canvas del motor fija su resolución física a client × devicePixelRatio.
  // Copiar sin el mismo factor deja el efecto con menos píxeles que el original
  // y se ve pixelado aunque el CSS lo muestre del mismo tamaño.
  function sincronizarTamaño() {
    // Por encima de 2 el detalle no se distingue y el costo sí: la textura se
    // sube entera cada cuadro, y un dpr de 3 pide nueve veces el área lógica.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const esc = Math.max(0.25, Math.min(1, P.resolutionScale));
    const w = Math.max(1, Math.round(skyCanvas.clientWidth * dpr * esc));
    const h = Math.max(1, Math.round(skyCanvas.clientHeight * dpr * esc));
    if (w === W && h === H) return;
    W = w; H = h;
    effectCanvas.width = W;
    effectCanvas.height = H;
    gl.viewport(0, 0, W, H);
  }
  sincronizarTamaño();
  const observador = new ResizeObserver(sincronizarTamaño);
  observador.observe(skyCanvas);

  let t0 = null;
  let tPrev = null;
  let cuadros = 0;
  let ultimoDibujo = -1e9;

  // Acumuladores acotados. Multiplicar una tasa por el tiempo transcurrido daba
  // una coordenada que crece sin límite; se integran por incrementos y se
  // envuelven en el período del ruido, que es periódico justamente para esto.
  const PERIODO_XY = 256;
  const PERIODO_Z = 4096;
  const envolver = (v, p) => ((v % p) + p) % p;
  let driftX = 0, driftY = 0, boilTz = 0;
  let jetX = 0, jetY = 0, scintTz = 0;

  function animar(ms) {
    if (!corriendo) return;
    requestAnimationFrame(animar);
    if (t0 === null) t0 = ms;
    const t = (ms - t0) / 1000;

    // Leer clientWidth fuerza un reflow. El ResizeObserver ya atiende los
    // cambios de caja y setParams los de resolución, así que acá alcanza con un
    // repaso espaciado para el caso de que cambie el devicePixelRatio.
    if ((cuadros++ & 31) === 0) sincronizarTamaño();
    if (skyCanvas.width === 0 || skyCanvas.height === 0) return;

    if (getFov) {
      const f = getFov();
      if (typeof f === 'number' && f > 0) fovRad = f;
    }
    const ph = computeSeeingPhysics(P, fovRad, fovAxis === 'width' ? W : H);

    // Con la compuerta cerrada no se sube la textura ni se dibuja. Subirla es lo
    // caro del frame, así que apagar acá es lo que ahorra de verdad.
    // Tope de cuadros. Una pantalla de 120 Hz duplica el trabajo sin que el
    // efecto se vea distinto, y sube al doble la presión sobre la lectura del
    // canvas del motor.
    if (P.maxFps > 0 && ms - ultimoDibujo < 1000 / P.maxFps - 0.5) return;
    ultimoDibujo = ms;

    if (!habilitado || ph.gate <= 0) {
      if (activo !== false) { activo = false; onActiveChange?.(false); }
      return;
    }

    // Sube la textura directo desde el canvas del motor, sin canvas 2D
    // intermedio. Depende de que este requestAnimationFrame corra DESPUÉS del
    // del motor dentro del mismo frame: el contexto del motor no pide
    // preserveDrawingBuffer, así que su buffer sólo es legible antes de que el
    // navegador componga. Se cumple porque este overlay registra su rAF más
    // tarde, y los callbacks corren en orden de registro.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skyCanvas);

    // Intermitencia: rachas y calmas en escala de segundos. Una intensidad
    // perfectamente constante delata que hay una máquina detrás.
    const env = Math.max(0.12, 1 + P.intermit * fn1(t * 0.42) * 0.447)
              * ph.gate * Math.max(0, P.intensity);

    // Lucky imaging: instantes de nitidez. La potencia alta los vuelve breves y
    // ocasionales en vez de una oscilación regular, que es como se dan.
    const lk = Math.pow(Math.max(0, fn1(t * 0.85 + 31.4)), 3);
    const luckySharp = 1 - P.lucky * lk * 0.92;

    // Tip/tilt global: la imagen entera bailando. Es el componente más notorio a
    // gran aumento y el más barato de los tres.
    const tiltPx = ph.tiltArcsec * ph.pxPerArcsec * P.tipTilt * env;
    const ttx = fn1(t * 1.9) * tiltPx;
    const tty = fn1(t * 1.9 + 77.3) * tiltPx;

    const dt = tPrev === null ? 0 : Math.min(0.1, t - tPrev);
    tPrev = t;

    const oct = OCTAVAS[Math.max(1, Math.min(4, Math.round(P.octaves)))];
    const cellPx = Math.max(6, P.cellArcmin * 60 * ph.pxPerArcsec);
    const warpPx = P.seeing * 0.55 * ph.pxPerArcsec * 2.2 * oct.grad;
    const driftCells = (ph.driftArcminPerSec * 60 * ph.pxPerArcsec / cellPx) * P.frozen;
    const dirR = (P.windDir * Math.PI) / 180;
    const boil = P.boilHz * (1 - P.frozen * 0.72) * 0.55;
    // Por debajo de un par de píxeles la celda de centelleo deja de resolverse y
    // en el cielo real se promedia hasta desaparecer. El piso de tamaño evita el
    // aliasing, pero por sí solo fabricaría un parpadeo de escala fija que sigue
    // viéndose a campo amplio, donde no debería quedar nada: la amplitud se
    // apaga en la misma proporción.
    const scintPxNat = P.scintArcsec * ph.pxPerArcsec;
    const scintPx = Math.max(2, scintPxNat);
    const subPix = Math.min(1, scintPxNat / 2);
    const jetR = (P.jetDir * Math.PI) / 180;
    const jetPx = P.jetDrift * 60 * ph.pxPerArcsec;
    const blurPx = P.seeing * P.blurMul * ph.blurFrac * ph.pxPerArcsec * 0.85;

    driftX = envolver(driftX + Math.cos(dirR) * driftCells * dt, PERIODO_XY);
    driftY = envolver(driftY + Math.sin(dirR) * driftCells * dt, PERIODO_XY);
    boilTz = envolver(boilTz + boil * dt, PERIODO_Z);
    jetX = envolver(jetX + (Math.cos(jetR) * jetPx * dt) / scintPx, PERIODO_XY);
    jetY = envolver(jetY + (Math.sin(jetR) * jetPx * dt) / scintPx, PERIODO_XY);
    scintTz = envolver(scintTz + 1.6 * dt, PERIODO_Z);

    gl.useProgram(program);
    set1i('u_src', 0);
    set2f('u_res', W, H);
    set1f('u_t', t);
    set1i('u_modelL', compareModel === null ? P.model : compareModel);
    set1i('u_modelR', P.model);
    set1f('u_split', compareModel === null ? 0 : 0.5);
    set2f('u_tipTilt', ttx, tty);
    set1f('u_env', env);
    set1f('u_luckySharp', luckySharp);
    set1f('u_warpPx', warpPx);
    set1f('u_cellPx', cellPx);
    set2f('u_driftOff', driftX, driftY);
    set1f('u_boilTz', boilTz);
    set1f('u_compress', P.compress);
    set1f('u_compressBase', warpPx / cellPx);
    set1f('u_scint', P.scint * ph.scintAtten * subPix);
    set1f('u_scintPx', scintPx);
    set2f('u_jetOff', jetX, jetY);
    set1f('u_scintTz', scintTz);
    set1f('u_blurPx', blurPx);
    set1f('u_blurFloor', ph.diffArcsec * P.diffMul * ph.pxPerArcsec * 0.85);
    set1f('u_saturation', Math.max(0, P.saturation * ph.satAperture));
    set1f('u_legacyAmt', P.legacyAmount);
    set4f('u_octW', oct.w[0], oct.w[1], oct.w[2], oct.w[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (activo !== true) { activo = true; onActiveChange?.(true); }
  }
  requestAnimationFrame(animar);

  return {
    // FOV del ocular en radianes. Es el disparador de toda la escala: convierte
    // los arcosegundos del modelo en píxeles. La app lo llama en cada zoom.
    // Apaga el overlay sin destruirlo. Con esto no se sube la textura ni se
    // dibuja, así que sale del presupuesto de GPU además de dejar de verse.
    // La app decide la visibilidad de su canvas desde onActiveChange.
    setEnabled(on) { habilitado = !!on; },
    isEnabled() { return habilitado; },

    setFov(rad) { if (rad > 0) fovRad = rad; },
    getFov() { return fovRad; },

    // Acepta cualquier subconjunto de SEEING_DEFAULTS. Un handler de mensajes
    // del control remoto reenvía sus `values` aquí sin traducir nada.
    setParams(partial) {
      Object.assign(P, partial);
      if ('resolutionScale' in partial) sincronizarTamaño();
    },
    getParams() { return { ...P }; },
    applyPreset(nombre) {
      const preset = SEEING_PRESETS[nombre];
      if (preset) Object.assign(P, preset);
      return !!preset;
    },

    // Modelo mostrado a la izquierda de la pantalla partida. `null` la apaga.
    // Sólo lo usa el banco de pruebas.
    setCompareModel(m) { compareModel = m; },

    // Magnitudes derivadas, para paneles de diagnóstico.
    physics() { return computeSeeingPhysics(P, fovRad, H); },

    stop() {
      corriendo = false;
      observador.disconnect();
    },
  };
}
