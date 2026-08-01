# Changelog de la sesión — migración a monorepo + extracción de `@ventanaceleste/core`

Registro de lo hecho en estas sesiones de trabajo, qué falta, y qué limitaciones tiene lo entregado.
Ver también [`../CONTEXT.md`](../CONTEXT.md) (punto de entrada del repo),
[`MIGRATION.md`](MIGRATION.md) (proceso de migración a monorepo),
[`Architecture.md`](Architecture.md) (visión de producto) y [`CORE_DESIGN.md`](CORE_DESIGN.md)
(propuesta original de diseño de `core`, previa a la implementación) y
[`packages/core/README.md`](../packages/core/README.md) (referencia de arquitectura actual).

## Estado de git

Todo lo descrito en este documento está **commiteado y pusheado** a `origin/main`
(`gbarrueto/ventana-celeste`). La extracción de `core` se agrupó en un commit por módulo, más
commits separados para el rewire de cada app, los fixes de `web-app`, el lockfile y la
documentación. Las ramas `legacy/*` siguen siendo solo locales, a propósito.

La verificación en dispositivo real está parcialmente hecha para `web-app` (sección 3); `kiosk`
sigue sin probarse contra hardware.

## Entorno de desarrollo

Para probar el emparejamiento visor↔teléfono en la red local, **el dev server tiene que correr
nativo en el sistema del host**, no dentro de WSL ni de una VM: si no, el host no puede usar la
misma dirección que el teléfono y Protobject nunca empareja los dos peers. Ver la Resolución del
[ADR 0001](adr/0001-protobject-peers-must-share-an-origin.md).

## 🎯 Próximos pasos (en orden)

- ~~**Commitear y pushear**~~ — HECHO. 14 commits (uno por módulo de `core`, más los rewires
  de cada app, los fixes de `web-app`, el lockfile y la documentación), pusheados a
  `origin/main`. Las ramas `legacy/*` siguen siendo solo locales.
- ~~**Desbloquear las pruebas con teléfono en la LAN**~~ — HECHO. Dev server nativo en el host;
  el host ya alcanza su propia IP LAN. Ver la Resolución del
  [ADR 0001](adr/0001-protobject-peers-must-share-an-origin.md).
- ~~**Emparejamiento verificado en dispositivo real**~~ — HECHO. Escaneando el QR desde un
  teléfono, visor y teléfono emparejan y el overlay del QR se oculta con `telescopeConnected`.
- ~~**Eliminar `VITE_LAN_HOST`**~~ — HECHO. `buildTelescopeUrl()` deriva el host del QR de
  `window.location.host`, sin override.

- ~~**Verificar la interacción en dispositivo real**~~ — HECHO. Zoom, lentes, tiempo y ubicación
  funcionan como se espera.
- ~~**Feedback de desconexión en ambos lados**~~ — HECHO. Ver sección 5.

1. **Atender la lista de detalles/bugs de `web-app`** que está en recolección durante el uso.
   Sigue siendo la prioridad antes de pasar a las otras apps.
2. **Verificar `kiosk` contra hardware** (Arduino-como-teclado, dispositivo instalado). El
   refactor a `core` no se probó nunca ahí. Le corresponde también su propio `DEVELOPMENT.md`.
3. **Arrancar `dual-telescope`** — plan de construcción, inventario de qué se re-cablea y lista
   de decisiones abiertas en [`DUAL_TELESCOPE_PLAN.md`](DUAL_TELESCOPE_PLAN.md). Los cuatro
   bloqueantes (dirección de la orientación, contexto seguro/HTTPS, viabilidad de Web Serial en
   Android, y si hace falta roll) hay que resolverlos antes de escribir código.

Detalle del resto de pendientes más abajo.

## 1. Migración a monorepo (sesión anterior, ya commiteada y pusheada)

- `abellinouc.github.io` (5 ramas, 2 líneas de desarrollo reales) → monorepo pnpm, rama `main`.
- Historial real preservado vía `git subtree add` (no squash) para `apps/web-app` (←
  `svelte-app-ventanaceleste-com`) y `apps/kiosk-standalone` (← `localversion`).
- **Purgados con `git filter-repo`** dos archivos `.pem` (cert + clave privada autofirmados) que
  estaban versionados en el historial de `web-app` — no llegaron al monorepo.
- Fix de seguridad relacionado: `apps/web-app/vite.config.js` ya no lee esos `.pem` a mano;
  usa `@vitejs/plugin-basic-ssl`.
- Las 5 ramas originales quedaron renombradas `legacy/*`, solo locales — el remoto de
  `abellinouc/abellinouc.github.io` nunca se tocó.
- `origin` del monorepo apunta a `gbarrueto/ventana-celeste.git` — **pusheado** (rama `main` únicamente,
  las `legacy/*` quedaron solo locales a pedido tuyo).

## 2. Extracción de `packages/core`

Siete módulos extraídos desde `apps/web-app` y `apps/kiosk-standalone`, en el orden del plan de
`CORE_DESIGN.md`. Detalle completo de API y decisiones de diseño en
[`packages/core/README.md`](../packages/core/README.md); aquí solo el resumen de cambios y hallazgos.

| Módulo | Reemplaza | Hallazgo notable |
|---|---|---|
| `time/` | 4 implementaciones independientes de conversión ISO/Date ⇄ MJD | Fecha hardcodeada a **mayo 2040** en kiosk resultó ser un valor de prueba olvidado |
| `telescope/` | 3 implementaciones de la fórmula de FOV desde ocular | — |
| `orientation/` | 2 controladores de sensores (~1100 líneas combinadas) | kiosk usaba `RelativeOrientationSensor` pero nombraba todo `abs*`/`"absolute"` — resabio de una versión anterior con `AbsoluteOrientationSensor` |
| `engine/` | 2 inicializaciones de Stellarium Web Engine casi idénticas | web-app toleraba fallos de carga de catálogo y seguía funcionando; kiosk no — preservado como flag `strict` |
| `sync/` | Dispatcher `msg→handler` duplicado 2 veces en el mismo archivo (`protobject.js`) | — |
| `io/` | Stub muerto de Arduino (`arduinoBridge.js`, nunca conectado a nada) | El control real de kiosk es un Arduino emulando teclado (USB-HID), no Serial |
| `config/` | Loader de config por entorno que solo tenía kiosk | web-app no lo adoptó (ver Limitaciones) |

**Otros hallazgos/fixes de paso:**
- Bug real en el panel de debug de kiosk: `jdnToDate` mezclaba las épocas de JD y MJD, mostrando
  fechas alrededor del año **-4531**. Corregido al migrar a `time/`.
- `luxon` eliminado de las dependencias de `web-app` (reemplazado por Temporal vía
  `@js-temporal/polyfill`, ya usado en `core`).
- Clase `EventManager` en `protobject.js` tenía 3 métodos (`on`/`off`/`cleanup`) sin ningún uso en
  toda la app — confirmado y eliminado.

**Cambios de comportamiento reales** (no solo refactor, avisados en su momento):
- La hora por defecto de kiosk pasó de una fecha fija de 2040 a medianoche real calculada
  (configurable vía `time: { fixedMJD }` si en realidad se quería una fecha fija para demos).
- `web-app` heredó el algoritmo de suavizado más evolucionado de `orientation/` (el de kiosk, con
  "progress blending" al volver de la zona dinámica de zoom) — no es una regresión, pero es distinto
  al que tenía antes.
- Panel de debug de kiosk: magnificación en "sin lente" muestra `null` en vez de `Infinity`.

**Verificación realizada:** `pnpm install` limpio desde cero, `build` y `dev` de ambas apps en cada
módulo individualmente y al final todos juntos. Módulos de matemática pura (`time/`, `telescope/`)
verificados con scripts Node standalone contra valores de referencia conocidos y contra la fórmula
original ejecutada en paralelo. **Ningún dispositivo físico ni sensor real fue probado** (ver
Limitaciones).

## 3. Fixes de conexión y sensores en `web-app` (2026-07-26)

Primera sesión con verificación en un teléfono real. Salieron tres bugs distintos, todos
introducidos o destapados por el refactor a `core`:

- **La calibración quedaba colgada para siempre.** `apps/web-app/src/lib/orientation.js` llamaba
  a `controller.startCalibration()` sin haber llamado antes a `controller.start()`. Como
  `startCalibration()` arranca con `if (!state.gyroSensor || !state.relSensor) return;` y los
  sensores solo se construyen dentro de `start()`, el tap en "Calibrar" era un no-op silencioso:
  el overlay pasaba a "countdown" y se quedaba ahí. `kiosk` sí llamaba a `start()` — el refactor
  perdió esa llamada solo en `web-app`.
- **Los errores de sensor eran invisibles.** `core/orientation/controller.js` no registraba
  listener de `'error'` en ninguno de los dos sensores, así que un permiso denegado no llegaba
  nunca a `onError`. Agregados en ambos, más checkpoints de debug
  (`requesting-permission`, `sensors-created`). En `web-app`, `onError` solo escribía en el panel
  de debug oculto; ahora además pinta una fase `'error'` visible con botón de reintento.
- **El overlay del QR no se ocultaba.** El visor infería "conectado" del primer mensaje
  `updateView`, que solo llega *después* de que el teléfono termine de calibrar — o sea, la
  detección de conexión dependía de la calibración, al revés de lo que corresponde. Se intentó
  usar `Protobject.Core.onConnected`, pero se comprobó que del lado del visor **no dispara nunca
  al llegar el peer** (solo una vez, al unirse el socket propio al relay). Solución: el teléfono
  manda un mensaje explícito `telescopeConnected` en cuanto su propia conexión se confirma, y el
  visor oculta el QR con eso.

**Cambios de comportamiento:**
- `Telescope.svelte` ya no arranca la calibración en `onMount`: espera la conexión confirmada, y
  muestra "Conectando…" con timeout de 15s y mensaje de error visible si no llega. Antes
  calibraba contra un peer que podía no existir.
- Ambos lados filtran el primer `onConnect` (el auto-connect al relay) con un helper
  `skipFirstCall`, porque dispara sin que haya ningún peer.

**Nuevo:** `apps/web-app/src/lib/debug-log.js` — consola en pantalla para el teléfono (captura
`console.*`, errores no atrapados y promesas rechazadas). Necesaria porque Protobject reenvía la
consola del teléfono al visor solo *después* de conectar, y en este teléfono no se pudo levantar
depuración remota por USB. Activa en dev, o con `?debug=1`.

**Hallazgo de entorno documentado como ADR:** Protobject empareja por **origen**, no solo por
`ptjuid`, y un dev server dentro de WSL en modo `mirrored` no es alcanzable por el host vía su
propia IP LAN — combinación que hacía imposible emparejar teléfono y PC en local. Ver
[`adr/0001-protobject-peers-must-share-an-origin.md`](adr/0001-protobject-peers-must-share-an-origin.md),
ya resuelto corriendo el dev server nativo en el host. Cómo montar el entorno para probar con
teléfono: [`../apps/web-app/DEVELOPMENT.md`](../apps/web-app/DEVELOPMENT.md).

## 4. Orientación: bug de shape y fluidez (2026-07-27)

Verificado en teléfono real, ya con el emparejamiento funcionando.

**Bug: la orientación no llegaba al cielo.** `onView` de `core` emite `{ yaw, pitch }` (su propio
vocabulario, igual que `onCoords`), pero `sendView` en `web-app` desestructuraba `{ h, v }` — o sea
`undefined` en ambos. El mensaje `updateView` igual se enviaba y se recibía, así que los logs se
veían sanos, y al llegar `updateStellariumView` hacía `observer.yaw = -undefined`, escribiendo NaN
en el engine. El resto de los mensajes funcionaba porque ninguno pasa por `onView`.

Esto también explica por qué el overlay del QR nunca se ocultaba antes del handshake: ese chequeo
exigía `typeof v.h === 'number'`, imposible con `undefined`. El bug venía de la extracción de
`core`, no de los cambios de conexión.

`updateStellariumView` ahora además ignora valores no finitos y avisa una vez, en vez de meter NaN
en silencio — que era indistinguible de "no llegan mensajes".

**Perf: flood de logs por el canal de WebRTC.** `onSensorReading` emite `activeSource` en *cada*
lectura del giroscopio (100 Hz) y `handleDebug` lo logueaba sin filtro. Protobject reenvía la
consola del teléfono al visor **por el mismo data channel** que `updateView`, así que ~100
mensajes/s competían con un stream limitado a 50 Hz. No estaba gateado por entorno, así que
afectaba también a producción. Ahora se loguea solo en transiciones de `activeSource`. Además
`updateDisplay` reconstruía un string con tres `toFixed(5)` ~200 veces/s incluso con el overlay
en `display:none`; ahora sale temprano si está oculto.

**Fluidez: la causa dominante era la red.** Ver la tabla en
[`../apps/web-app/DEVELOPMENT.md`](../apps/web-app/DEVELOPMENT.md): con el teléfono actuando de
hotspot 2.4 GHz el movimiento era claramente laggy (en dos teléfonos), y sobre una Wi-Fi normal
quedó fluido. **Descartado** que sea la app renderizando en el teléfono: el modo avanzado corre
fluido y no hay diferencia con el modo simple. **No aislado**: qué parte del hotspot es la culpable.
Esto es un riesgo directo para `dual-telescope`, que planea usar el móvil principal como AP — ver
el recuadro de riesgo en [`Architecture.md`](Architecture.md).

## 5. Robustez de conexión en `web-app` (2026-07-27)

Interacción verificada en dispositivo real: zoom, lentes, tiempo y ubicación funcionan como se
espera. Sobre eso se agregó feedback de estado de la conexión, que antes no existía en ninguno de
los dos lados: si el enlace se caía, el visor se quedaba mostrando un cielo congelado y el
teléfono no daba ninguna señal.

**No hay evento de desconexión en Protobject.** `Protobject.Core` expone solo `onConnected` y
`onReceived` — verificado contra el `p.js` que se sirve hoy (`'onClosed'` y `'onDisconnected'` no
existen como métodos). Así que la liveness se infiere con un **heartbeat** de 1 Hz por lado
(`src/lib/connection.js`), declarando al peer perdido tras 3 s de silencio. Un timeout además
cubre casos que un evento de cierre no cubriría: red caída, página congelada, pestaña en segundo
plano. Se mantiene a 1 Hz con payload vacío porque comparte data channel con la orientación a
~50 Hz, y ya se vio que saturar ese canal se siente como lag.

- **Visor:** el overlay del QR vuelve cuando el teléfono deja de responder, con el texto cambiado
  a "Se perdió la conexión"; punto de estado verde/rojo arriba a la derecha.
  `setConnectionHandler` (disparo único) pasó a `setConnectionStatusHandler`, que reporta
  `{ alive, everAlive }` de forma continua — `everAlive` es lo que permite distinguir "todavía no
  se conectó ningún teléfono" de "el teléfono se cayó".
- **Teléfono:** estado `'lost'` con mensaje y botón **Recargar**. Los sensores siguen corriendo
  durante el corte, así que un blip breve se recupera sin recalibrar. El texto distingue los dos
  caminos de recuperación: recargar el teléfono alcanza si la página principal solo se recargó,
  pero si se cerró y se volvió a abrir probablemente tenga un `ptjuid` nuevo y hay que volver a
  escanear el QR.

**Detalle de implementación que costó dos intentos:** el overlay del QR tiene que estar siempre
montado y ocultarse por CSS. Dentro de un `{#if}`, el contenedor bindeado con `bind:this` se
destruye al conectar, y al reaparecer Svelte crea un div nuevo y vacío mientras `renderQr()` solo
corrió una vez en `onMount` — se ve como un cuadrado blanco. Y la regla que lo oculta necesita
selector compuesto (`.qr-overlay.qr-overlay--hidden`): tras el scoping de Svelte, una sola clase
empata en especificidad con `.qr-overlay` y pierde por orden de declaración.

**Idioma:** los textos de UI agregados estaban en español rioplatense, inconsistente con la copia
que ya existía en la app (que usa formas de *tú*). Normalizados a español neutro, junto con la
documentación escrita en estas sesiones.

## Pendientes

1. **Verificación manual en dispositivo real** — parcialmente hecha (ver sección 3). En un
   teléfono real ya se validaron sensores de orientación y calibración de `web-app`, y el pairing
   de Protobject **con ambos peers en el mismo origen**. Sigue pendiente: zoom en dispositivo,
   Arduino-como-teclado en `kiosk` (sin hardware disponible en este entorno), y pairing
   teléfono↔PC en la LAN, que está bloqueado por la restricción de origen del ADR 0001.
2. **Commitear y pushear** todo lo posterior a `b123960` (ver sección de git arriba).
3. **Contradicción sin resolver en `Architecture.md`**: el documento dice que la orientación se
   transmite "desde el Principal al Secundario" en el modelo dual; en la conversación de diseño
   surgió que probablemente sea al revés (el Secundario es el que puede leer el cielo
   correctamente). No bloquea esta etapa, pero hay que resolverlo — y corregir el documento — antes
   de diseñar `dual-telescope`.
4. **Diseño de `apps/dual-telescope`** — explícitamente pospuesto hasta ahora.
5. **`packages/shared-viewer`** (nivel intermedio de compartición entre `web-app` y
   `dual-telescope`, mencionado en `CORE_DESIGN.md`) — no diseñado, depende del punto 3.
6. **Implementación real de `createSerialConnector`** — hoy es un stub que lanza error; `dual-telescope`
   la va a necesitar (RFID + potenciómetro vía Web Serial).
7. **`kiosk` en Termux corre en modo `development`** — el despliegue real lo arranca con
   `pnpm run dev`, o sea `vite`, así que `import.meta.env.MODE` vale `'development'` y
   `loadConfig` elige **`config.dev.js`**, no `config.prod.js`. Hoy es inofensivo porque los dos
   archivos son idénticos salvo el campo `env`, pero deja de serlo en cuanto diverjan — en
   particular al hacer el punto 8, donde `config.prod.js` pasaría a apuntar a los datos locales
   y el dispositivo en campo seguiría yendo a los servidores remotos. Cuando se toque:
   `vite --mode production` mantiene el flujo de dev server que Termux necesita pero selecciona
   la config correcta (verificar en ese momento si además cambia `import.meta.env.DEV`/`PROD`,
   que no está comprobado). Nota relacionada: en ese despliegue `import.meta.env.DEV` es `true`,
   así que cualquier herramienta de debug que se gatee por `DEV` quedaría **encendida** en campo.
   Hoy solo la usa `debug-log.js` de `web-app`, así que no afecta a `kiosk`.
8. **Empaquetado de datos locales para producción de kiosk** — los paths locales (`/data/smalldata/`,
   etc.) siguen comentados en el config; kiosk en producción sigue apuntando a los servidores remotos.
   Preexistente, no tocado esta sesión.
9. **Manejo de errores visible en `kiosk`** — `web-app` ya lo tiene (fase `'error'` del overlay de
   calibración); kiosk sigue sin superficie visible para fallos de sensores o de carga de catálogos.

## Limitaciones conocidas

- **Sin suite de tests automatizada** en ninguna de las dos apps. Toda la verificación de esta
  sesión fue manual: build, boot de dev server, y para los módulos de matemática pura, scripts Node
  ad-hoc comparando contra la fórmula original. No hay tests de regresión que corran en CI.
- **~15 llamadas directas a `Protobject.Core.send(...)`** siguen desparramadas en componentes de
  `web-app` (`DateTimePicker`, `GlobePicker`, `Menu`, etc.), sin pasar por `sync/messageBus.js`.
  Decisión deliberada de alcance (ver `CORE_DESIGN.md`/conversación) — no es un olvido, pero sí una
  limitación real de qué tan "swappable" es el transporte hoy: si `dual-telescope` necesita
  WebSocket, esas ~15 líneas también van a necesitar tocarse.
- **`web-app` no adoptó el patrón de `config/`** — no tiene distinción real entre dev/prod para sus
  URLs de datos (siempre apunta al servidor remoto), así que no se le creó un `config.dev.js`/`config.prod.js`
  especulativo sin contenido real que justifique el split.
- **Soporte nativo de Temporal no verificado** en los navegadores móviles donde corren estas apps —
  se usa el polyfill (`@js-temporal/polyfill`) precisamente para no depender de eso, pero agrega
  peso al bundle.
- **Transformación de montaje de `orientation/`** (la que permite compartir la misma función entre
  dispositivos montados distinto) es nueva y no está validada contra hardware real — no existe
  todavía un dispositivo `dual-telescope` contra el cual probarla.
- **Bundle de kiosk** ahora incluye 3 chunks de config (`config.dev`/`config.dev-device`/`config.prod`,
  ~0.2kB cada uno) en vez de 1 — el loader genérico resuelve el modo en runtime, no en build time
  como el `if/else` original, así que el bundler ya no puede eliminar por dead-code-elimination las
  ramas no alcanzadas. Costo real: ~0.44kB extra en disco, cero impacto en red (solo se descarga el
  chunk que efectivamente se usa). No se corrigió por ser insignificante.
