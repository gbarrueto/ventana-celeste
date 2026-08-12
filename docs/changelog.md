# Changelog

Cambios relevantes desde la migración a monorepo. Lo anterior está en el historial de git.

Orden inverso: lo más reciente arriba.

## 2026-08-12 — Documentación

Reescritura completa del set de documentación. La anterior quedó en `old-docs/`, fuera de git.

Documentos vigentes: arquitectura, deployment, changelog, Stellarium Web Engine, Protobject, y
orientación/tiempo/comunicación. Los pendientes salieron de los documentos de referencia a
`pendientes.md`, temporal hasta pasarlos a GitHub Projects.

`.claude/skills/docs-style/` fija el estilo de redacción.

## 2026-08-11 — Enfocador y ergonomía del ocular

- **Potenciómetro por WebUSB.** Un Arduino Leonardo envía la posición del potenciómetro y el ocular
  la traduce a desenfoque. El punto de foco depende del ocular montado, así que cambiar de ocular
  obliga a reenfocar.
- **Reconexión sin gesto.** `requestDevice()` exige un gesto del usuario; `getDevices()` no. El
  emparejamiento se hace una vez, con el teléfono en la mano, y después cada arranque reconecta
  solo. El permiso queda atado al origen, así que hay que emparejar en la misma URL que se use
  después.
- **Web Serial descartado.** Medido en el dispositivo: no está disponible en Android.
- **Suavizado ajustable.** El factor de suavizado dejó de estar hardcodeado en `core` y pasó a ser
  la opción `smoothing`, con los valores viejos como default. `setSmoothing()` permite ajustarlo en
  caliente.
- **Disposición del canvas del ocular.** La vista ocupa la mitad inferior de la pantalla, rotada 90°.
  El cálculo va en JS porque una rotación de 90° intercambia ancho y alto.
- **Panel de ajustes.** Suavizado, tamaño de vista y rotación, en la franja superior que el tubo
  tapa una vez montado el teléfono. Los valores persisten en `localStorage`. Reemplaza a una versión
  por parámetros de URL, impracticable en teléfonos de prueba sin conexión.
- `orientation-lab` pasó a llamarse `device-lab` y quedó sólo con el camino de WebUSB.

### Corrección de la interfaz USB

La primera versión de la sonda reclamaba la primera interfaz con bulk de entrada, que en un Leonardo
es la de datos CDC. La interfaz de WebUSB es la de clase 255. Reclamar la equivocada deja todo
aparentemente conectado y sin datos.

## 2026-08-03 — dual-telescope, primer prototipo funcionando

- Las dos entradas renderizan cielo. El ocular usa FOV 0.05 rad con catálogos extendidos, el guía
  0.14 rad sin ellos.
- **Apuntado vectorial promovido a `core`.** Sustituye el mapeo dependiente de la elevación por una
  constante: qué vector del dispositivo apunta por el tubo.
- **Relay en modo desarrollo montado sobre Vite.** La página y el socket comparten origen, así que
  con HTTPS el socket es `wss://` sin configuración.
- **Paquete de despliegue sin dependencias.** `dist/`, un `relay.mjs` con `ws` embebido y
  `start.sh`. El dispositivo no necesita el repo, ni pnpm, ni `node_modules`, ni compilar.
- **Rama de deploy huérfana**, creada y actualizada por script desde un worktree aparte.
- Terreno activado.

### Correcciones

- `fovThreshold` estaba invertido respecto de su semántica: la comparación es
  `fov < fovThreshold ? 'gyro' : 'relative'`, así que un umbral alto fuerza giroscopio. El valor
  puesto forzaba integración de giroscopio, con deriva en reposo y ejes vertical y horizontal
  intercambiados. Corregido a `0`, que mantiene el camino del quaternion.
- El FOV del guía no quedaba fijado dentro de `onReady`. Se vuelve a escribir tras resolver la
  promesa.
- `start.sh` llegaba sin bit de ejecución por `core.filemode=false` en Windows, y con un shebang
  absoluto de Termux que impedía correrlo en cualquier otro lado.

## 2026-08-02 — Base de dual-telescope y banco de pruebas

- Andamiaje de `dual-telescope` y transporte WebSocket probado de punta a punta.
- **Copia única del motor de Stellarium** en `packages/core/assets/`. Antes había una por app.
- **`mountQuaternion` en `core`**: prerrotación del quaternion crudo antes de descomponerlo.
- `orientation-lab` como app de diagnóstico para la pregunta del giro de 90°.
- Modo de apuntado vectorial para comparar contra Euler, malla alt-az y marcador de proximidad al
  cenit.

### Singularidad a 90°

Medido en dispositivo: un teléfono rotado 90° sobre su eje Y cae en la singularidad de la
descomposición Euler. Los dos ángulos leen 0 y 0 con el dispositivo claramente rotado, y cualquier
movimiento se amplifica unas 240 veces.

## 2026-08-01 — kiosk-standalone

- **`shellEmulator: true`** en `pnpm-workspace.yaml`. pnpm 10 movió los ajustes ahí y el `.npmrc`
  se ignora en silencio. Sin esto el script `dev` de kiosk falla en Windows por el prefijo
  `NODE_OPTIONS=…`.
- **HTTPS en modos de desarrollo, HTTP plano en producción.** Los sensores exigen contexto seguro
  cuando la página se abre desde otro dispositivo; en producción el dispositivo se sirve a sí mismo
  por `localhost`, que ya lo es, y el certificado autofirmado sólo molestaría.
- `onView` de `core` emite `{ yaw, pitch }` y kiosk habla `{ h, v }` hacia Stellarium. Sin la
  traducción, la vista no se movía.

### Orden de Gaia y DSS

Gaia y el survey DSS se registran sobre el mismo módulo `core.dss` y el módulo conserva la última
fuente agregada. La extracción a `core` los había reordenado, y Gaia reemplazaba a DSS sin error ni
aviso. El botón "Nebulosa" del teléfono además arrancaba apagado con DSS encendido en el visor.

## 2026-07-30 — Robustez de conexión

- Detección de caída en ambos lados por heartbeat a 1 Hz con timeout de 2.5 s. Protobject no expone
  ningún evento de desconexión.
- `updateView` marca al peer como visto, así que una caída se nota por tráfico real a unos 50 Hz
  antes que por el siguiente latido perdido.
- Español neutro en textos de UI y documentación.

## 2026-07-27 — Orientación y fluidez

- `onView` entregaba `{ yaw, pitch }` y `web-app` desestructuraba `{ h, v }`, con lo cual escribía
  `undefined` en el motor.
- Los logs por lectura saturaban el canal WebRTC y degradaban el seguimiento.

## 2026-07-26 — Monorepo y extracción de `@ventanaceleste/core`

Migración a workspaces de pnpm con `apps/*` y `packages/*`, y extracción de los módulos compartidos
por dominio: `telescope/`, `orientation/`, `engine/`, `sync/`, `io/`, `config/`, `time/`.

`web-app` y `kiosk-standalone` pasaron a consumir `core` y se eliminaron las copias locales.

### Correcciones en web-app

- La calibración quedaba colgada porque `startCalibration()` se llamaba sin `start()` previo.
- Los sensores no tenían listener de `'error'`, así que un permiso denegado se veía igual que un
  dispositivo quieto.
- El QR no se ocultaba. `Protobject.Core.onConnected` no dispara del lado del visor al llegar el
  peer, así que se agregó un mensaje explícito `telescopeConnected`.
- El contenedor del QR se destruía al conectar por estar dentro de un bloque `{#if}` con
  `bind:this`. Pasó a estar siempre montado y alternarse por CSS.
- El overlay del QR no se ocultaba porque su regla de ocultamiento estaba declarada antes que la
  regla base y, tras el ámbito de Svelte, ambas empataban en especificidad.

### ADR 0001

Protobject empareja por origen, no sólo por `ptjuid`. Dos páginas con el mismo `ptjuid` en
`127.0.0.1` y en `localhost` no se emparejan.

`VITE_LAN_HOST` se eliminó: nunca resolvió el emparejamiento y un valor desactualizado apuntaba el
QR a un host equivocado sin avisar. El destino del QR pasó a derivarse de `window.location.host`.

Resolución: el dev server corre nativo en el sistema operativo del host, no dentro de WSL ni de una
VM, para que el host alcance su propia IP LAN igual que el teléfono.
