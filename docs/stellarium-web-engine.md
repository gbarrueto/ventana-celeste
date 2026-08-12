# Stellarium Web Engine

Motor de render del cielo: un binario WebAssembly compilado desde C que dibuja estrellas, planetas,
DSOs, imágenes de survey, terreno y atmósfera sobre un `<canvas>` WebGL.

No es un paquete npm. Son dos archivos que van juntos:

| Archivo | Rol |
|---|---|
| `stellarium-web-engine.js` | Loader de Emscripten. Define `window.StelWebEngine`. |
| `stellarium-web-engine.wasm` | El motor. |

Ambos están en `packages/core/assets/`, en una copia única para todo el monorepo. El wrapper que
usan las apps es `packages/core/src/engine/stellarium.js`.

## Importación

Los dos archivos son assets de Vite, no módulos. El sufijo `?url` los emite al build y devuelve la
URL final con hash:

```js
import { initializeStellariumEngine } from '@ventanaceleste/core';
import engineWasmUrl from '@ventanaceleste/core/assets/stellarium-web-engine.wasm?url';
import engineScriptUrl from '@ventanaceleste/core/assets/stellarium-web-engine.js?url';
```

## Inicialización

```js
const engine = await initializeStellariumEngine({
  canvas: document.getElementById('stel-canvas'),
  wasmFile: engineWasmUrl,
  scriptUrl: engineScriptUrl,
  smalldataBaseUrl: 'https://smalldata.ventanaceleste.com/',
  bigdataBaseUrl: 'https://bigdata.ventanaceleste.com/',
  extended: true,
  location: { lat: -24.6272, lon: -70.4042, elev: 2635 },
  time: { offsetHours: -3 },
  strict: false,
  onReady(stel) { stel.core.fov = 0.05; },
});
```

Resuelve con el objeto del motor (`stel`).

### Opciones

| Opción | Por defecto | Qué hace |
|---|---|---|
| `canvas` | — | Elemento `<canvas>` de destino. Obligatorio. |
| `wasmFile` | `/stellarium-web-engine.wasm` | URL del `.wasm`. |
| `scriptUrl` | `/stellarium-web-engine.js` | URL del loader. |
| `smalldataBaseUrl` | — | Base de catálogos livianos: estrellas, DSOs, planetas, terreno, MPC. |
| `bigdataBaseUrl` | — | Base de surveys de imagen: DSS y Gaia. |
| `extended` | `true` | `false` carga sólo el set mínimo. Ver [Fuentes de datos](#fuentes-de-datos). |
| `includeGaia` | igual que `extended` | Gaia sin el resto del set extendido. |
| `location` | — | `{ lat, lon, elev }` en grados y metros. El wrapper convierte a radianes. |
| `time` | — | Pasa a `computeDefaultObservationTime()`. `{ offsetHours }` da medianoche de hoy en ese huso; `{ fixedMJD }` fija una fecha. |
| `strict` | `true` | Comportamiento ante una fuente de datos que falla: `true` rechaza la promesa, `false` loguea y sigue con lo cargado. |
| `onReady(stel)` | no-op | Corre con el motor listo y los catálogos cargados, antes de resolver. Admite `async`. |
| `onError(err)` | no-op | Corre antes de rechazar. |

### Secuencia de arranque

1. `ensureStellariumScript(scriptUrl)` inyecta el `<script>` si `window.StelWebEngine` no existe.
2. Llamada a `window.StelWebEngine({ wasmFile, canvas, onReady })`.
3. Dentro de su `onReady`, en orden: `location` y `time` al observador, carga de fuentes de datos,
   `onReady` del llamador, resolución de la promesa.

El motor queda además en `window.currentStelEngine`, para depuración desde consola.

## Fuentes de datos

`loadStellariumDataSources(core, opciones)` registra cada catálogo con
`core[loader].addDataSource({ url, key })`. Se exporta por separado para agregar fuentes después
del arranque.

Siempre:

| Loader | Contenido |
|---|---|
| `stars` | Packs `minimal` y `base`. |
| `planets` | 14 cuerpos del sistema solar, incluidos los galileanos y `moon-normal`. |
| `landscapes` | Terreno `guereins`. |

Sólo con `extended: true`:

| Loader | Contenido |
|---|---|
| `stars` | Pack `extended`. |
| `skycultures` | `western`. |
| `dsos` | Packs `base` y `extended`. |
| `milkyway` | Survey de la Vía Láctea. |
| `dss` | Survey DSS a color (`bigdata`). |
| `minor_planets` | `mpcorb.dat`. |
| `comets` | `CometEls.txt`. |

Gaia (`bigdata/surveys/gaia/v1`) se carga según `includeGaia`, que por defecto sigue a `extended`.

### Origen de los datos

`web-app` sirve los catálogos por red siempre. `kiosk-standalone` y `dual-telescope` los sirven por
red durante desarrollo, y en deploy los leen del equipo local del prototipo.

Los catálogos no están en el repo ni se espera que estén en las máquinas de desarrollo: el volumen
es alto y sólo lo necesitan los equipos de deploy.

## Cómo se expone en cada app

| App | Acceso al motor | Wrapper propio |
|---|---|---|
| `web-app` | Store `engine` en `src/lib/stores.js` | `src/lib/stellarium.js` |
| `kiosk-standalone` | Variable de módulo en `src/App.svelte` | — |
| `dual-telescope` | Retorno de `startSky()` en `src/sky.js` | — |
| `device-lab` | Variable local en `sky.html` | — |

`src/lib/stellarium.js` en `web-app` agrupa vista, overlays, ubicación, contaminación lumínica,
tiempo y consultas de objetos.

## Atributos de `core`

Ángulos en radianes. Tiempo en MJD (Modified Julian Date).

### Observador

| Atributo | Unidad | Notas |
|---|---|---|
| `core.observer.yaw` | rad | Acimut de la vista. Ver [Signo de yaw](#signo-de-yaw). |
| `core.observer.pitch` | rad | Altura de la vista. |
| `core.observer.latitude` | rad | |
| `core.observer.longitude` | rad | |
| `core.observer.elevation` | m | |
| `core.observer.utc` | MJD | Reloj del motor. Escribirlo mueve el cielo. |

### Vista y render

| Atributo | Unidad | Notas |
|---|---|---|
| `core.fov` | rad | Campo visual. Define el zoom. |
| `core.display_limit_mag` | mag | Magnitud límite visible. `web-app` la calcula desde la óptica. |
| `core.bortle_index` | 1–9 | Contaminación lumínica. |
| `core.star_relative_scale` | — | Tamaño relativo de las estrellas. |
| `core.exposure_scale` | — | Exposición. |
| `core.time_speed` | entero | Multiplicador del reloj. `1` es tiempo real. |
| `core.selection` | objeto | Objeto seleccionado, o `null`. |

### Módulos

Cada módulo tiene `.visible`. Los que dibujan etiquetas tienen además `.hints_visible`.

`stars`, `dsos`, `dss`, `milkyway`, `planets`, `minor_planets`, `comets`, `landscapes`,
`atmosphere`, `cardinals`, `constellations`, `skycultures`.

```js
core.atmosphere.visible = false;
core.landscapes.visible = true;
core.constellations.lines_visible = true;
core.planets.hints_visible = false;
```

Los defaults visuales no están unificados en `core`. Cada app los fija en su propio `onReady`.

## Métodos del objeto `stel`

| Método | Uso |
|---|---|
| `stel.getObj(nombre)` | Busca un objeto por nombre, p. ej. `'NAME Sun'`. |
| `obj.getInfo('pvo', observer)` | Posición y velocidad del objeto en ICRF. |
| `stel.convertFrame(observer, desde, hacia, vec)` | Cambia de marco de referencia, p. ej. `'ICRF'` a `'OBSERVED'`. |
| `stel.c2s(vec)` | Cartesianas a esféricas. |
| `stel.anp(rad)` | Normaliza un ángulo a `[0, 2π)`. |
| `stel.stop()` | Detiene el loop de render. |

Alt/az de un objeto, de `web-app/src/lib/stellarium.js`:

```js
const pvo = obj.getInfo('pvo', engine.observer);
const altaz = engine.convertFrame(engine.observer, 'ICRF', 'OBSERVED', pvo[0]);
const az = radToDeg(engine.anp(engine.c2s(altaz)[0]));
```

## Destrucción

```js
removeStellariumEngine(engine, 'stel-canvas');
```

Detiene el loop, limpia `selection` y `observer`, fuerza la pérdida del contexto WebGL con
`WEBGL_lose_context` y reemplaza el `<canvas>` por uno nuevo con el mismo id. El motor no libera el
contexto por su cuenta y el navegador limita cuántos contextos simultáneos permite.

## Trampas conocidas

**Orden de Gaia y DSS.** Ambos se registran sobre `core.dss` y el módulo conserva la última fuente
agregada. Gaia va primero y `surveys/dss/v1` último. Invertido, no se renderiza ninguna imagen de
cielo profundo y no hay error.

**`assetsInclude`.** Declarar los archivos del motor en `assetsInclude` de `vite.config.js` hace
que el import devuelva un wrapper de módulo con `export` en lugar de una URL.

**`fov` en el arranque.** Escribir `core.fov` dentro de `onReady` no siempre queda. `dual-telescope`
lo vuelve a escribir después de que la promesa resuelve.

**Valores no finitos.** Escribir `NaN` en `observer.yaw` o `observer.pitch` no da error: la vista
deja de moverse, con el mismo síntoma que una caída de conexión. `web-app` y `kiosk-standalone`
validan con `Number.isFinite()` antes de escribir.

### Signo de yaw

| App | Escritura |
|---|---|
| `web-app` | `observer.yaw = -h` |
| `kiosk-standalone` | `observer.yaw = -h` |
| `device-lab` | `observer.yaw = -yaw` |
| `dual-telescope` | `observer.yaw = yaw` |

`dual-telescope` usa el modo de apuntado vectorial del controlador de orientación, que devuelve el
acimut en la convención del motor.
