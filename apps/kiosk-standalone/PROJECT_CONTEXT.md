# Contexto del Proyecto — kiosk-standalone

Ultima actualizacion: 2026-07-26

> **Esta app ahora vive en un monorepo.** La lógica de dominio compartida (motor de
> Stellarium, óptica, sensores, tiempo, config) está en `@ventanaceleste/core`, no aquí.
> Ver [`../../CONTEXT.md`](../../CONTEXT.md) y
> [`../../packages/core/README.md`](../../packages/core/README.md).
>
> La sección "Recomendacion de arquitectura" de la versión anterior de este documento
> **ya se ejecutó** — es lo que hoy es `packages/core`. Se conserva abajo como registro
> histórico, marcada como completada.

## Alcance de este contexto
Resume el estado actual de la app para consulta rapida durante desarrollo.

## Stack y tooling
- Framework UI: Svelte 4
- Bundler/dev server: Vite 5
- Lenguaje: JavaScript (ESM)
- Dependencia de workspace: `@ventanaceleste/core`
- Scripts npm:
  - dev: `NODE_OPTIONS=--max-old-space-size=1536 vite` (el flag de memoria es
    necesario para el build/dev con los catálogos grandes)
  - build: vite build
  - preview: vite preview

## Estructura principal
- index.html: punto de montaje del app en #app y carga de src/main.js
- src/main.js: bootstrap de Svelte, monta App.svelte
- src/App.svelte: nucleo funcional actual de la app (ahora consume `core`)
- src/config/: config por entorno (`dev` / `dev-device` / `prod`) via `loadConfig` de core
- public/stellarium-web-engine.js + .wasm: runtime del motor astronomico en cliente

Movidos a `packages/core` durante la extracción (ya no existen aquí):
`Telescope.js`, `services/orientationController.js`, `services/stellariumEngine.js`,
`services/arduinoBridge.js` (este último era un stub que nunca se conectó a nada).

## Flujo de arranque (actual)
1. Carga index.html y monta Svelte en #app.
2. App.svelte ejecuta onMount.
3. Se asegura carga dinamica del script de Stellarium (window.StelWebEngine).
4. Inicializa el engine con canvas y archivo wasm.
5. Configura observador: ubicacion por defecto Santiago (lat -33.45, lon -70.67, elev 520)
   y hora = medianoche calculada para `offsetHours: -4` via `computeDefaultObservationTime`
   de core. (Antes era un MJD hardcodeado de mayo 2040, que resulto ser un valor de
   prueba olvidado. Se puede volver a fijar con `time: { fixedMJD }` si se quiere una
   fecha fija para demos.)
6. Carga multiples data sources remotos (estrellas, planetas, DSO, via lactea, skyculture, MPC, etc.).
7. Activa/ajusta visibilidad de pistas y parametros de render.
8. Inicia sistema de orientacion por sensores y setup de zoom/lentes.

## Logica funcional en App.svelte
- Render principal:
  - canvas full-screen para Stellarium
  - crosshair centrado
  - overlay de calibracion
- Control de vista:
  - updateStellariumView: yaw/pitch
  - updateStellariumFov: fov y conversion a variable de ocular
  - updateStellariumBlur: blur CSS sobre canvas
- Gestion de lentes/FOV:
  - Niveles de lentes predefinidos
  - Modo ojo humano
  - Zoom suave via interpolacion logaritmica
- Sensores y orientacion (hoy en `core/orientation/controller.js`):
  - Usa Gyroscope + **RelativeOrientationSensor**. La versión anterior de este documento
    decía `AbsoluteOrientationSensor`: era incorrecto. El código nombraba todo `abs*` /
    `"absolute"` como resabio de una versión previa, pero el sensor instanciado siempre
    fue el relativo (no necesita magnetómetro, funciona en interiores, sin brújula).
  - Calibracion inicial con muestreo de bias, persistida en `localStorage`
    (`persistBiasKey: "astrovis_gyro_bias"`) — en runs siguientes se salta la calibración.
    Esto es específico de kiosk; `web-app` calibra siempre de cero.
  - `readinessGate: 'stillness'` — espera a que el dispositivo esté quieto, en vez de
    pedir un tap (es un dispositivo instalado, sin interacción).
  - Conmutacion dinamica de modo relative/gyro segun FOV
  - Suavizado y deadzone para estabilidad

## HTTPS por modo (sensores y contexto seguro)

Los sensores de orientación solo funcionan en un **contexto seguro**. Si la página se sirve por
HTTP plano en una dirección de LAN, carga bien pero los sensores no devuelven nada — parece un bug
de código y en realidad es un permiso que el navegador nunca da.

Por eso `vite.config.js` activa `@vitejs/plugin-basic-ssl` en **todos los modos menos
`production`**:

| Modo | Sirve | Motivo |
|---|---|---|
| `development` (por defecto) | `https` | se sirve desde la PC y se abre en el teléfono por la LAN |
| `dev-device` | `https` | mismo caso: ese modo existe justamente para probar en el teléfono |
| `production` | `http` | el dispositivo se sirve a sí mismo en `http://localhost`, que el navegador **ya** trata como contexto seguro |

O sea: en el dispositivo no hace falta certificado y no aparece ninguna advertencia de conexión
insegura. En desarrollo sí aparece, porque el certificado es autofirmado — se acepta una vez por
navegador. Si molesta, la alternativa sin advertencia es generar un certificado de desarrollo con
`mkcert` e instalar su CA en el teléfono una sola vez.

## ⚠️ El despliegue real corre en modo `development`

En el dispositivo, la app se levanta con `pnpm run dev` desde Termux — o sea `vite`, el dev
server, no un build. Consecuencia directa: `import.meta.env.MODE` vale `'development'`, así que
`loadConfig` selecciona **`config.dev.js`** y `config.prod.js` no se usa nunca en campo.

Hoy no rompe nada porque los dos archivos son idénticos salvo el campo `env`. Pasa a importar en
cuanto diverjan — sobre todo al terminar el empaquetado de datos locales, donde `config.prod.js`
apuntaría a `/data/...` y el dispositivo seguiría yendo a los servidores remotos igual.

Cuando se toque: `vite --mode production` conserva el flujo de dev server que Termux necesita
pero selecciona la config correcta. Verificar en ese momento si además cambia
`import.meta.env.DEV`/`PROD`, que no está comprobado.

Relacionado: en ese despliegue `import.meta.env.DEV` es `true`, así que cualquier herramienta de
debug gateada por `DEV` quedaría encendida en campo. Hoy solo la usa `debug-log.js` de `web-app`,
así que a `kiosk` no le afecta — pero conviene saberlo antes de agregar uno aquí.

## Dependencias externas en runtime
- Endpoint base de datos astronomicos:
  - https://smalldata.ventanaceleste.com/
- Comentado en codigo como alternativa local (empaquetado sin terminar):
  - `/data/smalldata/` y `/data/bigdata/` en `config.dev.js` / `config.prod.js`

## Controles de usuario (teclado)
Via `createKeyboardConnector` de core (el Arduino emula un teclado USB-HID).

**No hay una ruta separada para el hardware**: el conector escucha `keydown` en `window` y mapea
`e.key`, así que la app no distingue un Arduino de un teclado. Se puede probar sin las placas,
con el teclado o despachando `KeyboardEvent`s desde la consola.

- c: recalibrar sensores
- 1..8: seleccionar nivel de lente (cambio discreto de ocular; fuera del alcance del prototipo)
- + / =: zoom in
- -: zoom out

El zoom es **continuo**: cada pulsación mueve `targetLogFov` ±0,1 en espacio logarítmico y un loop
de `requestAnimationFrame` interpola hacia él con suavizado 0,12. El conector no filtra
`e.repeat`, así que mantener la tecla apretada deja que el auto-repeat del sistema lo mueva de
forma continua. `=` está mapeado además de `+` para no depender de Shift.

## Riesgos y observaciones tecnicas
- El inicio depende de APIs de sensores no disponibles en todos los navegadores/dispositivos.
- La carga de catalogos depende de red y del host externo; latencia o caidas impactan
  funcionalidad. Kiosk usa `strict: true` al inicializar el engine: si un catálogo falla,
  el init aborta (a diferencia de `web-app`, que usa `strict: false` y sigue).
- La UI principal funciona como experiencia full-screen; no hay fallback visual avanzado ante
  fallas de motor/sensores.
- **Empaquetado de datos locales sin terminar:** los paths locales (`/data/smalldata/`, etc.)
  siguen comentados en el config, así que producción sigue apuntando a los servidores remotos.
- **Sin verificar contra hardware.** El refactor a `core` no se probó todavía con el Arduino
  real ni en el dispositivo instalado.

## Modularizacion — COMPLETADA (registro historico)

La versión anterior de este documento proponía separar `App.svelte` en módulos y definía
cuatro "ejes de modularizacion obligatorios". Eso **ya se hizo**, extrayéndolo a
`packages/core` en vez de a carpetas locales, para poder compartirlo con `web-app` y con el
futuro `dual-telescope`:

| Eje propuesto | Dónde vive hoy |
|---|---|
| Motor de Stellarium (init + carga de datos del cielo) | `core/engine/` |
| Telescope (focal, apertura, magnificacion) | `core/telescope/` |
| Lectura de sensores (orientacion, calibracion, fusion) | `core/orientation/` |
| Comunicacion con Arduino | `core/io/` — `createKeyboardConnector` (ver abajo) |
| Capa de configuracion central | `core/config/` + `src/config/` |

**Corrección importante sobre el eje de Arduino:** el "Arduino" de esta app no habla Serial.
Es un Arduino emulando un **teclado USB-HID**, y lo que la app lee son eventos `keydown`
normales. `arduinoBridge.js` era un stub que lanzaba `"Arduino bridge not implemented yet"`
y nunca se conectó a nada. Hoy el control real pasa por `createKeyboardConnector` de `core`.
`createSerialConnector` existe en `core` pero es un stub — lo necesitará `dual-telescope`.

Pendiente de ese plan: "manejo de errores visible para usuario" sigue sin implementarse en
kiosk (en `web-app` sí se agregó, ver su changelog).
