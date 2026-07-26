# `@ventanaceleste/core`

Lógica de dominio compartida entre las apps de VentanaCeleste (`apps/web-app`,
`apps/kiosk-standalone`, y futuras versiones como `dual-telescope`). Este documento describe la
arquitectura **tal como quedó implementada** — para el razonamiento y las alternativas consideradas
durante el diseño, ver [`../../docs/CORE_DESIGN.md`](../../docs/CORE_DESIGN.md).

## Principios de diseño

1. **Sin framework, sin DOM, sin transporte.** Todo módulo es JavaScript plano. Ninguno importa
   Svelte, toca el DOM, ni sabe si existe Protobject/WebRTC/WebSocket. Cada app decide su propia UI
   y su propio transporte; `core` solo expone funciones y factories que cualquier capa puede envolver.
2. **Funciones puras primero, wrappers con estado son opcionales.** Donde tiene sentido (`telescope/`),
   la matemática vive como funciones puras que reciben números explícitos; una clase (`Telescope`)
   envuelve esas funciones para las apps que prefieren trackear estado como objeto. Ninguna app está
   obligada a adoptar el objeto si no lo necesita.
3. **Contrato antes que implementación, cuando la implementación todavía no existe de verdad**
   (`io/connectors.js`). Definir la forma de un conector no es lo mismo que inventar cómo hablarle a
   un Arduino que nadie construyó todavía — eso se implementa cuando hay hardware real contra el cual
   probarlo.
4. **La forma del mensaje es estable; el transporte es intercambiable** (`sync/messageBus.js`). El
   shape `{msg, values}` no cambia entre apps; lo que cambia es el adapter que lo mueve de un lado a
   otro.
5. **Nada se fuerza a ser igual entre apps si no lo es de verdad.** Donde dos apps tenían
   comportamientos genuinamente distintos (ubicación/hora fija vs. seleccionable, tolerancia a fallos
   de red, disparador de calibración), el módulo expone esa diferencia como parámetro de
   configuración en vez de imponer un único comportamiento.

## Cómo se consume

Cada app lo declara como dependencia del workspace:

```json
"dependencies": { "@ventanaceleste/core": "workspace:*" }
```

y hace `import { ... } from '@ventanaceleste/core'` — todo se re-exporta desde `src/index.js`.

## Referencia de módulos

### `time/` — conversiones y reloj del motor

Construido sobre [Temporal](https://tc39.es/proposal-temporal/) (`@js-temporal/polyfill`), no
`Date`/Luxon — ver [`CORE_DESIGN.md`](../../docs/CORE_DESIGN.md) para el porqué.

- **`conversions.js`**: `isoToMJD`, `mjdToISO`, `instantToMJD`/`mjdToInstant`,
  `wallClockToMJD(date, offsetHours)` / `mjdToWallClockISO(mjd, offsetHours)` (puente entre un
  `Date` nativo de un widget de UI —flatpickr— y MJD interpretado a un offset UTC fijo), y
  `formatMJDForDisplay(mjd, offsetHours)`.
- **`engineTime.js`**: `computeMidnightMJD(offsetHours)`, `computeDefaultObservationTime({offsetHours, fixedMJD})`
  (usa `fixedMJD` si se pasa, si no calcula medianoche real — así ninguna app necesita hardcodear una
  fecha), `setEngineTime(engine, mjd)`, `setEngineSpeed(engine, multiplier)`,
  `nudgeEngineHours(engine, hours)`, `getEngineMJD(engine)`.

### `telescope/` — óptica

- **Funciones puras**: `computeMagnification(focalLength, eyepieceFocalLength)`,
  `computeFovFromEyepiece(focalLength, eyepieceFocalLength, projectionConstant=100)`,
  `sliderToFov`/`fovToSlider` (mapeo exponencial slider↔FOV, requiere `{minFov, maxFov, maxSlider}`),
  `calculateLimitMag({aperture, magnification, telescopeType, ...condiciones de cielo/observador})`
  (NELM), `magToBortle`/`bortleToMag`.
- **`TelescopeType`**: `{ REFLECTOR: 1, REFRACTOR: 2, CATADIOPTRIC: 3 }` — reemplaza strings sueltas
  (`"refractor"`) que antes no se usaban en ningún cálculo.
- **`Telescope`** (clase, opcional): envuelve las funciones puras para apps que trackean estado de
  telescopio como objeto (`aperture`, `focalLength`, `eyepieceFocalLength`, `magnification`, más
  `ra`/`dec`/`alt`/`az`). Métodos: `setEyepieceFocalLength`, `fovFromEyepiece`, `limitMag(condiciones)`,
  `setPosition`/`setAltAz`/`getRaDec`/`getAltAz`.

### `orientation/` — fusión de sensores (gyro + `RelativeOrientationSensor`)

`createOrientationController(options)` — factory, sin DOM, callbacks inyectados
(`onDebug`, `onCoords`, `onView`, `onCalibrationVisibility`, `onError`, `getLogFov`). Devuelve
`{ start, stop, startCalibration, cancelCalibration }`.

Parámetros clave:
- Tuning físico: `gyroFreq`, `relFreq`, `calibDuration`, `fovThreshold`, `gyroDeadzone`,
  `dynamicThreshold`, `dynamicSmoothingFactor` — cada app pasa los suyos, no hay un default "correcto"
  universal.
- **`readinessGate`**: `'stillness'` (espera a que el dispositivo esté quieto — flujo de kiosk,
  bueno para un dispositivo instalado sin interacción) | `'countdown'` (cuenta regresiva fija tras un
  tap — flujo de web-app) | `'immediate'` (sin espera).
- **`mountingTransform(yaw, pitch) => {yaw, pitch}`**: aplicado *solo* en los puntos de salida
  (`onView`/`onCoords`), nunca al estado interno de continuidad. Permite que la misma función sirva
  para un teléfono montado de cualquier forma respecto al eje óptico del telescopio — la decisión de
  *qué* transformación usar es de cada app/deployment, no de `core`.
- **`persistBiasKey`**: si se pasa un string, persiste el bias del gyro en `localStorage` bajo esa
  key y se salta la calibración en runs subsiguientes (comportamiento de kiosk). `null` (default) =
  siempre calibra fresco (comportamiento de web-app).

### `engine/` — bootstrap de Stellarium Web Engine

- `ensureStellariumScript(scriptUrl)`: inyecta `<script>` si `window.StelWebEngine` no existe
  todavía (no-op si la app ya lo carga desde su `index.html`).
- `loadStellariumDataSources(core, {smalldataBaseUrl, bigdataBaseUrl, extended, includeGaia})`: el
  manifiesto de catálogos (estrellas, planetas, DSOs, vía láctea, cometas, asteroides) — idéntico
  entre apps, parametrizado por `extended` (catálogos completos vs. mínimos) e `includeGaia`
  (independiente de `extended`, porque kiosk excluye Gaia específicamente por tamaño de datos).
- `initializeStellariumEngine({canvas, wasmFile, smalldataBaseUrl, bigdataBaseUrl, extended,
  includeGaia, location, time, strict, onReady, onError})`: hace todo lo anterior + inicializa
  `StelWebEngine`. `strict` (default `true`) decide si un catálogo que falla en cargar aborta el init
  (kiosk) o solo se loggea y se sigue (web-app, `strict:false`). Los **flags visuales post-carga**
  (qué hints se muestran, exposure, etc.) **no** viven acá — cada app los aplica en su propio
  `onReady`, porque son política de UI, no del motor.
- `removeStellariumEngine(engine, canvasId)`: teardown de contexto WebGL + reemplazo de canvas.

### `sync/` — mensajería agnóstica de transporte

`createMessageBus(transport)` → `{ on(msg, handler), send(msg, values, target),
sendThrottled(msg, values, target, interval), start({onConnect}) }`.

Un transport adapter implementa `{ send(payload, target), onReceive(handler), onConnect(handler) }`.
Vienen dos built-in:
- `createProtobjectTransport()`: envuelve el global `Protobject` (WebRTC), usado hoy por `web-app`.
- `createNullTransport()`: no-op, para apps de una sola pantalla sin sync entre dispositivos (kiosk
  no usa `sync/` en absoluto porque no lo necesita).

Cuando exista `dual-telescope`, un `createWebSocketTransport()` implementando el mismo contrato es
lo único que hace falta — el shape del mensaje y el dispatch no cambian.

> **Nota de alcance**: `web-app` migró su punto central de dispatch (`protobject.js`) a este bus,
> pero todavía tiene ~15 llamadas directas a `Protobject.Core.send(...)` sueltas en componentes de
> UI que no pasan por acá. Ver [`../../docs/CHANGELOG.md`](../../docs/CHANGELOG.md).

### `io/` — contratos de conectores de hardware

Un connector implementa `{ isSupported(), connect(), disconnect() }`.

- `createKeyboardConnector({bindings, onError})`: mapea `keydown` → acciones. Es lo que el Arduino
  de kiosk usa hoy en la práctica (emula teclado USB-HID).
- `createSerialConnector({onError})`: **stub** — `isSupported()` chequea `navigator.serial`,
  `connect()` rechaza con "not implemented yet". Existe como punto de partida documentado para
  cuando `dual-telescope` necesite Serial real (RFID + potenciómetro), no como implementación
  funcional.

### `config/` — configuración por entorno

`loadConfig(loaders, {mode, fallbackMode, verbose})`: elige un config module según
`import.meta.env.MODE` de Vite. `loaders` mapea nombre de modo → thunk de import dinámico
(`{ development: () => import('./config.dev.js') }`), así los config files no usados no se
bundlean. No asume nombres de modo específicos — cada app define los suyos.

Hoy solo `kiosk` lo usa (tenía 3 modos: `development`/`dev-device`/`production`); `web-app` no
adoptó este patrón porque no tiene todavía una distinción real entre sus entornos para justificarlo
(ver [`CHANGELOG.md`](../../docs/CHANGELOG.md)).

## Lo que deliberadamente no está acá

- **UI / DOM**: overlays de calibración, paneles de debug, componentes Svelte — viven en cada app.
- **Transporte concreto**: qué WebRTC/WebSocket real se usa, cómo se negocia la conexión.
- **Hardware concreto**: cómo se lee un Arduino de verdad por Serial.
- **`packages/shared-viewer`**: el rol de "visor pasivo" que van a compartir `web-app` y
  `dual-telescope` (recibe orientación + tiempo, renderiza, sin sensores propios) todavía no existe
  como paquete — depende de resolver primero la dirección del dato de orientación en el modelo dual
  (ver [`CHANGELOG.md`](../../docs/CHANGELOG.md)).
