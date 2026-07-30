# @ventanaceleste/core — Diseño de módulos

Complementa a `Architecture.md` (visión de producto y de `dual-telescope`). Este documento
cubre la etapa previa: consolidar `web-app` y `kiosk-standalone` en una base común antes de
diseñar `dual-telescope`. Es una propuesta — todavía no hay código escrito a partir de esto.

## Modelo de compartición (3 niveles)

1. **`packages/core`** — usado por las 3 versiones (presentes y futuras). Lo único que entra
   aquí es lo que no depende de: un framework de UI específico, un transporte de red específico,
   o una forma de renderizar la UI específica.
2. **Compartido parcial** (p. ej. futuro `packages/shared-viewer`) — usado por `web-app` y
   `dual-telescope`, no por `kiosk`. No se diseña en esta etapa (depende de resolver primero
   la dirección del dato de orientación en el modelo dual, ver más abajo).
3. **Específico de app** — todo lo que depende del transporte real (Protobject/WebRTC,
   WebSocket, ninguno), del hardware real conectado, o de la UI de cada app.

## Estructura propuesta

```
packages/core/src/
├── engine/
│   ├── stellarium.js   # init de StelWebEngine + carga de data sources
│   └── view.js          # control de vista: yaw/pitch, FOV, blur, ubicación, contaminación lumínica
├── telescope/
│   └── Telescope.js     # óptica: apertura/focal/ocular/magnificación, FOV desde ocular, NELM, Bortle
├── orientation/
│   └── controller.js    # sensores (gyro + orientation), calibración, factory + callbacks
├── time/
│   ├── conversions.js   # ISO ⇄ MJD ⇄ Date, conversión con timezone
│   └── engineTime.js    # mutar core.observer.utc, velocidad, avance/retroceso, hora por defecto
├── sync/
│   └── messageBus.js    # contrato {msg, values} agnóstico de transporte
├── io/
│   └── connectors.js    # interfaces de conectores (Serial / WebSocket / Keyboard) — sin implementación concreta
└── config/
    └── loadConfig.js    # loader de config por entorno (dev / dev-device / prod)
```

Cada módulo se detalla abajo: qué resuelve, qué código reemplaza, y qué decisión de diseño hay detrás.

---

## `engine/` — motor Stellarium

Reemplaza: `web-app/lib/stellarium.js` (parte de init) + `kiosk/services/stellariumEngine.js`.

Ambas apps cargan exactamente los mismos data sources (mismas URLs, mismas keys) y aplican
casi los mismos flags visuales por defecto — es la duplicación más directa de las tres.
`view.js` se separa de la inicialización porque hoy en `web-app` están mezclados init +
control de vista + `Protobject.Core.send(...)` en el mismo archivo; `view.js` queda puro
(sin saber que existe Protobject ni WebSocket), y cada app decide cómo transmitir esos cambios
usando `sync/messageBus.js`.

## `telescope/` — óptica

Reemplaza: `kiosk/Telescope.js` + el cálculo inline de FOV en `web-app/telescope/AdvancedMode.svelte`
(línea 44-50) + `calculateLimitMag`/Bortle de `web-app/lib/fov.js`. Hoy la fórmula
`FOV = (100 / magnificación) * π/180` está reimplementada en tres lugares con la misma lógica.
El cálculo de magnitud límite (NELM) y escala Bortle, que hoy solo tiene `web-app`, pasa a
`core` porque es matemática pura, no depende de nada específico de esa app.

## `orientation/` — sensores de orientación

Reemplaza: `web-app/lib/orientation.js` (objeto singleton acoplado a DOM/Protobject) y
`kiosk/services/orientationController.js` (factory + callbacks). **Gana el patrón de kiosk**:
factory function con callbacks inyectados (`onDebug`, `onCoords`, `onView`,
`onCalibrationVisibility`, `onError`), sin dependencia de Svelte ni de DOM. Motivo: las Svelte
stores en `core` fueron sugerencia externa de una IA en una pre-fase de planificación, sin
contexto completo del proyecto; el patrón callback es más portable (sirve aunque una futura
versión no sea 100% Svelte) y ya está probado en producción en el kiosk. Si una app quiere
reactividad Svelte, envuelve el callback en un `writable()` en su propio código — no en `core`.

**Transformación de montaje configurable:** distintas versiones montan el teléfono con
orientación física distinta respecto al tubo del telescopio (p. ej. en el modelo dual, el
teléfono ocular apunta de costado por diseño newtoniano, mientras que el guía apunta en la
misma dirección que el tubo). En vez de tener una función de orientación por versión, el
factory acepta un parámetro de transformación de montaje (offset/rotación aplicado a la
lectura cruda antes de convertirla en pitch/yaw canónico). Esto deja abierta la decisión de
**qué dispositivo es la fuente de la lectura** como una decisión de wiring de cada app, no
una asunción de `core`.

> **Pendiente sin resolver (no bloqueante para esta etapa):** `Architecture.md` §2 dice que la
> orientación se transmite "desde el Principal al Secundario". En la conversación de diseño
> surgió que podría ser al revés — el Secundario es el que puede leer el cielo correctamente
> (la cámara apunta donde apunta el tubo), mientras que el Principal apunta con la parte
> posterior del teléfono y requeriría una transformación. Con el diseño de arriba, `core` no
> necesita tomar partido: cualquiera de los dos puede ser la fuente, según cómo cada versión
> configure la transformación de montaje. Falta decidir esto — y corregir `Architecture.md` en
> consecuencia — antes de diseñar `dual-telescope` en sí.

## `time/` — gestión de tiempo (módulo nuevo, no identificado en la ronda anterior)

Reemplaza, como mínimo, estas implementaciones independientes del mismo problema:

| Archivo | Función | Qué hace |
|---|---|---|
| `web-app/lib/stellarium.js:252` | `toJulianDateIso(iso)` | ISO → MJD |
| `web-app/lib/stellarium.js:241` | `getParanalMidnightISO()` | Medianoche fija en Paranal (privada) |
| `web-app/telescope/DateTimePicker.svelte:19` | `isoToMJD(isoString)` | ISO → MJD — **misma fórmula que `toJulianDateIso`, reimplementada aparte, no importada** |
| `web-app/telescope/DateTimePicker.svelte:25` | `fromMJDToLuxon(mjd, offsetHours)` | MJD → Luxon DateTime con timezone |
| `web-app/telescope/DateTimePicker.svelte:32` | `getISOWithTZ(date)` | Date → ISO ajustado a `currentTZ` |
| `kiosk/App.svelte:45` | `jdnToDate(jdn)` | JDN → Date, implementación propia sin Luxon |
| `kiosk/services/stellariumEngine.js:152` | — | `core.observer.utc = 66295.97917` hardcodeado (MJD ≈ 21 mayo 2040) |
| `kiosk/App.svelte:19` | `JULIAN_HOUR = 1/24` | Avanzar/retroceder hora a mano en el panel de debug |

Cuatro implementaciones distintas de la misma conversión ISO/Date ⇄ MJD/JDN, una de ellas
duplicada dentro del mismo archivo de `web-app` sin siquiera reusar la función hermana. La
raíz del problema no es la aritmética de MJD en sí (es la misma con cualquier librería), sino
que `Date` no distingue "un instante exacto" de "una hora de reloj en una zona horaria" — de
ahí salen hacks como el string `UTC±N` armado a mano en `getISOWithTZ`.

**Decisión: `time/` se construye sobre [Temporal](https://tc39.es/proposal-temporal/docs/)**
(`@js-temporal/polyfill`, usado desde ya independientemente del soporte nativo del navegador —
el polyfill respeta el spec al 100%, así que se puede retirar sin cambiar código el día que el
soporte nativo sea universal en los dispositivos móviles donde corren estas apps). Temporal
separa `Instant` (el UTC que vive en `engine.core.observer.utc`) de `ZonedDateTime`
(lo que ve el usuario en el date picker) — esa separación explícita es la que elimina la
ambigüedad que causó la duplicación. Pasa a ser dependencia de `core`; las apps que lo
consuman lo reciben transitivamente vía el workspace, no hace falta agregarlo a mano en
`kiosk`. **`web-app` puede eliminar su dependencia directa de `luxon`** una vez que
`DateTimePicker.svelte` consuma `time/` en vez de manejar Luxon a mano (Luxon solo se usaba
ahí; no queda ningún otro uso en el resto de la app).

`time/engineTime.js` centraliza la mutación de `engine.core.observer.utc`
(set, velocidad, avanzar/retroceder N horas) y expone `computeDefaultObservationTime(config)`
para que la hora por defecto salga de configuración (ver `config/`) en vez de estar
hardcodeada — con esto la fecha "2040" de kiosk deja de ser un número mágico y pasa a ser un
valor de configuración explícito, editable por el desarrollador tal como pediste que fuera
posible.

Lo que **no** entra a `time/` (queda en cada app): el debounce de "pausar sync 3s tras
interacción del usuario" y el polling de broadcast cada 300ms de `DateTimePicker.svelte` — es
comportamiento de UI/transporte de esa app puntual, no gestión de tiempo en sí.

## `sync/` — contrato de mensajes agnóstico de transporte

Define el shape `{msg, values}` (el que ya usan ambas apps hoy, cada una con su propio
transporte) como un pub/sub interno de `core`. Cada app conecta su transporte real como un
adaptador: Protobject/WebRTC en `web-app`, WebSocket nativo en `dual-telescope`, nada en
`kiosk` (todo local). El objetivo es que cambiar de transporte sea cambiar un adaptador, no
reescribir la lógica que genera o consume los mensajes.

## `io/` — interfaces de conectores de hardware

Solo define contratos ("esto alimenta tal función/callback de `core`"), no implementaciones.
Confirmado que las 3 versiones tendrán hardware de control físico, así que el concepto vive en
`core`, pero cada app decide su implementación real: hoy el "Arduino" del kiosk en realidad es
emulación de teclado/HID leída directo en `App.svelte:358-379` (no Serial); el módulo
`arduinoBridge.js` es un stub que nunca se conectó a nada real. `dual-telescope` necesitará
Serial real (RFID + potenciómetro). Cada implementación concreta queda en su app; si en el
futuro se retoma Serial real para el kiosk, se puede compartir esa implementación entre kiosk
y dual-telescope como conector concreto, sin que eso obligue a tocar `core`.

## `config/` — configuración por entorno

Generaliza `kiosk/config/index.js` (`config.dev.js` / `config.dev-device.js` / `config.prod.js`,
elegido por `import.meta.env.MODE`). Confirmado: en desarrollo se usa el servidor remoto de
datos por comodidad, en producción los datos viven localmente en el dispositivo (el fallback
local en `kiosk` está comentado a propósito, no roto, a la espera de terminar el empaquetado
de datos locales). `web-app` no tiene este patrón hoy — lo gana al adoptar `core`.

---

## Próximos pasos

Orden propuesto para la extracción real (cada paso deja el repo en estado buildeable y
verificado antes de pasar al siguiente):

1. **Scaffold vacío de `packages/core`** — `package.json`, carpetas, sin lógica todavía.
2. **`time/`** primero — es el más autocontenido, el de mayor caos concreto hoy, y no depende
   de los demás módulos. Extraer, deduplicar las 4 implementaciones, resolver el hardcode de
   2040 vía config.
3. **`telescope/`** — fusiona 3 implementaciones de la misma fórmula de FOV.
4. **`orientation/`** — adoptar la forma de kiosk como base, agregar transformación de montaje
   configurable, migrar `web-app` a consumirla (hoy usa el singleton acoplado a DOM).
5. **`engine/`** — separar init de control de vista; quitar las llamadas a Protobject de
   `stellarium.js`, reemplazarlas por `sync/messageBus.js`.
6. **`sync/` + `io/`** — contratos, delgados por diseño.
7. **`config/`** — generalizar el loader, darle el patrón a `web-app`.
8. **Rewire de ambas apps** para consumir `@ventanaceleste/core`, borrar el código duplicado
   original.
9. **Verificación** — `pnpm --filter <app> dev` y `build` de ambas apps, smoke test manual de
   orientación/zoom/tiempo en cada una.

Esta etapa (documento + plan) queda como propuesta. Antes de empezar el paso 1 necesito tu
confirmación de que la estructura y las decisiones de arriba están bien.
