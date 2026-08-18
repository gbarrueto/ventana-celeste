# Changelog

Cambios relevantes desde la migración a monorepo. Lo anterior está en el historial de git.

Orden inverso: lo más reciente arriba.

## 2026-08-18 — Orientación del ocular y zona dinámica

Sesión sobre el montaje real del teléfono en el tubo. Verificado en el aparato: la calibración
funciona y la zona dinámica se comporta como corresponde.

### Tasas del giroscopio derivadas del quaternion

El camino del giroscopio integraba los ejes crudos del dispositivo, asumiendo que `gyro.z` es
acimut y `gyro.x` es altura. Eso sólo vale con el aparato derecho, y la correspondencia además
depende de la elevación, así que ninguna permutación fija de ejes la arregla. Es el mismo error que
la descomposición Euler tenía para la posición, y la razón de que `mountingTransform` no pudiera
corregirlo: se aplica a la salida de los dos caminos por igual.

En modo `'vector'`, la velocidad angular se lleva al marco del mundo con el mismo quaternion del
apuntado y las tasas salen por proyección:

```
d(altura)/dt = wx·cos(az) − wy·sin(az)
d(acimut)/dt = tan(alt)·(wx·sin(az) + wy·cos(az)) − wz
```

Derivadas de las mismas expresiones que dan la posición, así que posición y tasa quedan consistentes
y un cambio de modo no salta. Reutiliza `rotateVectorByQuaternion` y `opticalAxis`; el escalado por
zoom, la deadzone, el suavizado y la mezcla al salir de la zona no se tocaron.

`zenithRateGuardDeg`, 85° por defecto, topa la amplificación de la tasa de acimut cerca del cenit.
No es un tope de apuntado.

En modo `'euler'` se mantiene la integración por ejes crudos, así que `web-app` y `kiosk` no cambian.

Verificado con un script Node contra rotaciones conocidas y contra la derivada numérica del apuntado
con un montaje rotado 40° en z y 25° en x, que es el caso donde la versión anterior fallaba.

### Calibración con el aparato quieto

La calibración de `dual-telescope` corría con `readinessGate: 'immediate'`, o sea que promediaba el
bias mientras se manipulaba el teléfono. El bias es el cero del sensor y se mide quieto; con
movimiento adentro, la integración del giroscopio acumula una velocidad que no existe.

Pasa a `'stillness'`, que es la situación del teléfono ya montado, con 2 segundos de muestreo. El
bias se persiste, porque recalibrar en cada arranque con el teléfono dentro del telescopio no es
viable, y el panel gana un botón para rehacerla. El aviso de calibración va en pantalla y fuera del
panel: una calibración que no arranca porque el aparato se mueve se ve igual que un cuelgue.

### Corrección de deriva revivida

`blendTowardRelativeOnZoomIn()` devuelve la vista a la lectura absoluta al salir de la zona
dinámica, y se activaba con `lastV < fovThreshold`. `dual-telescope` usa `fovThreshold: 0` para
quedarse en el camino del quaternion, así que nunca se cumplía y lo acumulado en la zona dinámica no
volvía jamás a una referencia absoluta.

El límite pasa a ser el mayor entre `fovThreshold` y `dynamicThreshold`: por debajo de cualquiera de
los dos hubo integración, y por lo tanto deriva que corregir. `kiosk` (0.2) y `web-app` (0.8)
conservan su límite anterior, que en ambas es el mayor.

### Montaje y panel del ocular

- Rotación del canvas a 270°, la posición física real del teléfono.
- El alto de la vista queda fijo en 50 %, medido contra el ocular. Deja de ser un ajuste.
- Altura invertida y acimut sin tocar, medido en el montaje. Va en `mountingTransform`.
- La vista se puede desplazar a lo largo de la pantalla, para iterar el calce sin volver a montar.
- El panel de ajustes pasa a un popover anclado arriba o abajo de la vista, con el alto limitado al
  hueco libre, así no puede taparla. Un botón lo manda al otro lado.
- Deslizador de zoom. El controlador ahora recibe `getLogFov` real; antes quedaba en el valor por
  defecto y el zoom no influía en nada.
- `setDynamicThreshold()` en `core` permite entrar y salir de la zona dinámica sin reconstruir el
  controlador.

El panel del ocular es de depuración, no interfaz de producto, igual que el de `kiosk`.

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
