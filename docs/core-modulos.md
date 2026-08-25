# Módulos de core

Todo lo que exporta `@ventanaceleste/core`, salvo el arranque del motor, que está en
[stellarium-web-engine.md](stellarium-web-engine.md).

Ningún módulo toca el DOM ni asume framework: son factorías con callbacks, y el cableado a la UI
vive en cada app. Todo lo público sale de `src/index.js`.

Los términos de astronomía y óptica están en [glosario.md](glosario.md).

---

# Orientación

`packages/core/src/orientation/controller.js`

Convierte los sensores del dispositivo en un par yaw/pitch listo para escribir en el motor. Fusiona
dos fuentes: `RelativeOrientationSensor`, que entrega un quaternion, y `Gyroscope`, que entrega
velocidad angular.

Requiere contexto seguro. `http://localhost` cuenta.

## Uso

```js
import { createOrientationController } from '@ventanaceleste/core';

const controller = createOrientationController({
  pointingMode: 'vector',
  opticalAxis: '+y',
  smoothing: { relative: 0.10, gyro: 0.10 },
  onView: ({ yaw, pitch }) => { /* escribir en el motor */ },
  onError: (e) => { /* superficie visible */ },
});
controller.start();
```

`start()` pide permisos, crea los sensores y arranca la calibración. Sin `start()` la calibración
queda esperando para siempre.

## Ciclo

```
idle → compuerta de arranque → calibrando → corriendo
```

La compuerta decide cuándo empezar a muestrear:

| `readinessGate` | Comportamiento | Dónde se usa |
|---|---|---|
| `'stillness'` | Espera a que el dispositivo deje de moverse durante `stillnessHoldSeconds`. | `kiosk-standalone` (default), `dual-telescope` |
| `'countdown'` | Temporizador fijo de `countdownSeconds`, sin mirar el movimiento. | `web-app` |
| `'immediate'` | Sin compuerta. | Ninguna app |

La calibración promedia `gyroFreq × calibDuration` muestras del giroscopio para obtener el bias.
Con `persistBiasKey`, el resultado se guarda en `localStorage` y en arranques siguientes se salta la
calibración.

El bias es el cero del sensor, así que se mide con el aparato quieto. Muestrear mientras se lo
manipula deja movimiento real dentro del promedio, y la integración del giroscopio pasa a acumular
una velocidad que no existe.

## Opciones

### Sensores y calibración

| Opción | Por defecto | Qué hace |
|---|---|---|
| `gyroFreq` | `100` | Frecuencia del giroscopio, en Hz. |
| `relFreq` | `30` | Frecuencia del sensor de orientación, en Hz. |
| `calibDuration` | `1` | Segundos de muestreo de bias. |
| `persistBiasKey` | `null` | Clave de `localStorage` para el bias. `null` no persiste. |
| `readinessGate` | `'stillness'` | Ver [Ciclo](#ciclo). |
| `stillnessThreshold` | `0.05` | rad/s por debajo de los cuales se considera quieto. |
| `stillnessHoldSeconds` | `2` | Segundos de quietud requeridos. |
| `countdownSeconds` | `3` | Duración de la cuenta regresiva. |

### Apuntado

| Opción | Por defecto | Qué hace |
|---|---|---|
| `pointingMode` | `'euler'` | `'euler'` o `'vector'`. Ver [Modos de apuntado](#modos-de-apuntado). |
| `opticalAxis` | `'+y'` | Clave de `OPTICAL_AXES` o vector `[x, y, z]`. Sólo en modo `'vector'`. |
| `zenithRateGuardDeg` | `85` | Altura a la que se topa la amplificación de la tasa de acimut. Sólo en modo `'vector'`. |
| `mountQuaternion` | `null` | Rotación aplicada al quaternion crudo antes de descomponerlo. Se construye con `quaternionFromAxisAngle()`. |
| `mountingTransform` | identidad | `(yaw, pitch) => ({ yaw, pitch })`, aplicada sólo en la salida. |

### Fusión y suavizado

| Opción | Por defecto | Qué hace |
|---|---|---|
| `fovThreshold` | `0.2` | Umbral de conmutación de modo, en radianes. Ver [Conmutación de modo](#conmutación-de-modo). |
| `dynamicThreshold` | `0.06` | Umbral de la zona dinámica, en radianes. |
| `dynamicSmoothingFactor` | `0.15` | Suavizado dentro de la zona dinámica. |
| `gyroDeadzone` | `0.003` | rad/s por debajo de los cuales la lectura se trata como cero. |
| `smoothing` | `{ relative: 0.5, gyro: 0.1 }` | Fracción del error corregida por lectura. `1` es sin suavizado. |

### Callbacks

| Callback | Cuándo |
|---|---|
| `onView({ yaw, pitch })` | Por frame, limitado con `requestAnimationFrame`. Es la salida principal. |
| `onCoords({ yaw, pitch, yawDeg, pitchDeg })` | Por lectura, con grados incluidos. Para paneles de depuración. |
| `onDebug(partial)` | Estado interno: modo activo, fuente, fase de calibración. |
| `onCalibrationVisibility(bool)` | Mostrar u ocultar el overlay de calibración. |
| `onError(err)` | Fallos de sensor y de permisos. |
| `getLogFov()` | Lo provee la app. Devuelve el logaritmo del FOV actual. |

`onView` emite `{ yaw, pitch }`. Las apps que hablan `{ h, v }` hacia Stellarium traducen en el
propio callback.

## Métodos

| Método | Uso |
|---|---|
| `start(calibrateOnStart = true)` | Pide permisos, crea sensores y arranca. |
| `stop()` | Detiene los sensores y los temporizadores. |
| `startCalibration()` | Recalibra. |
| `cancelCalibration()` | Aborta y pasa a corriendo con el bias que haya. |
| `setSmoothing(partial)` | Ajuste en caliente. Acepta uno solo de los dos ejes. |
| `getSmoothing()` | Copia de los valores actuales. |
| `setDynamicThreshold(v)` | Activa o desactiva la zona dinámica en caliente. `0` la desactiva. |
| `getDynamicThreshold()` | Valor actual. |

## Modos de apuntado

**`'euler'`** descompone el quaternion en dos ángulos bajo una convención fija. La correspondencia
entre ejes del dispositivo y ejes del cielo sólo vale cerca de una elevación: el eje de rotación
necesario para moverse en acimut se desplaza con la elevación, y en el cenit la vista deja de
responder.

**`'vector'`** rota el eje óptico por el quaternion y lee alt/az del vector resultante. El montaje
se reduce a qué vector del dispositivo apunta por el tubo, que es una constante. La única
singularidad que queda es la real del alt-az: acimut indefinido en el cenit.

El modo también determina de dónde salen las **tasas** de acimut y altura que integra el
giroscopio, no sólo la posición:

| Modo | Tasas |
|---|---|
| `'euler'` | Ejes crudos del dispositivo: `gyro.z` es acimut y `gyro.x` es altura. |
| `'vector'` | La velocidad angular se lleva al marco del mundo con el mismo quaternion del apuntado y se proyecta. |

En modo `'vector'`, con ω ya en el marco del mundo:

```
d(altura)/dt = wx·cos(az) − wy·sin(az)
d(acimut)/dt = tan(alt)·(wx·sin(az) + wy·cos(az)) − wz
```

Salen de derivar las mismas expresiones que dan la posición, `yaw = atan2(vx, vy)` y
`pitch = asin(vz)`, así que posición y tasa quedan consistentes y un cambio de modo no salta.

`tan(alt)` se topa en `zenithRateGuardDeg`, porque cerca del cenit la tasa de acimut diverge. Con
el valor por defecto, a 85° el factor es 11.4 y ahí se queda. No es un tope de apuntado: la vista
puede pasar del cenit, lo que se limita es cuánto se amplifica el giro.

`'euler'` es el default, así que `web-app` y `kiosk` no cambian de comportamiento.

## Conmutación de modo

```js
const requiredMode = fov < fovThreshold ? 'gyro' : 'relative';
```

Un `fovThreshold` **alto** fuerza giroscopio. Un `fovThreshold` de `0` nunca se cumple, porque el
FOV siempre es positivo, y deja el controlador en `'relative'`, que es el camino del quaternion.

En modo `'relative'` la orientación sale del quaternion. En modo `'gyro'` se integra la velocidad
angular, lo cual introduce deriva con el aparato quieto.

La zona dinámica es un tercer camino, independiente del modo: con `fov < dynamicThreshold` se
integra el giroscopio escalado por el zoom, para que un movimiento pequeño de la mano recorra menos
cielo cuanto más cerrado esté el campo. `dynamicThreshold` de `0` la desactiva por completo.

`setDynamicThreshold()` y `setSmoothing()` los cambian en caliente, sin reconstruir el controlador.
Ninguna app los usa hoy: existen porque encontrar estos dos valores exige moverlos con el
instrumento apuntando a algo, y una vez encontrados se fijan en código.

El límite por debajo del cual se considera que hubo integración del giroscopio es el mayor entre
`fovThreshold` y `dynamicThreshold`. Mirar sólo `fovThreshold` dejaba la corrección de deriva
muerta en cualquier app que lo pusiera en `0` para quedarse en el camino del quaternion.

Al salir de la zona dinámica hacia campos más amplios, `blendTowardRelativeOnZoomIn()` mezcla
gradualmente hacia la lectura del quaternion en vez de saltar.

## Configuración por app

| Opción | `web-app` | `kiosk-standalone` | `dual-telescope` |
|---|---|---|---|
| `readinessGate` | `'countdown'` | `'stillness'` | `'stillness'` |
| `pointingMode` | `'euler'` | `'euler'` | `'vector'` |
| `fovThreshold` | `0.8` | `0.2` | `0` |
| `dynamicThreshold` | default | default | `0.06` |
| `smoothing` | default | default | `0.10` en ambos ejes |
| `persistBiasKey` | — | `astrovis_gyro_bias` | `dual-telescope:gyro-bias` |

## Utilidades exportadas

| Función | Uso |
|---|---|
| `quaternionFromAxisAngle(eje, grados)` | Construye un `mountQuaternion` legible. Ejes `'x'`, `'y'`, `'z'`. |
| `rotateVectorByQuaternion(q, v)` | Rota un vector. |
| `OPTICAL_AXES` | Mapa de `'+x'`…`'-z'` a vectores unitarios. |

## Trampas conocidas

**Singularidad de la descomposición Euler.** `quaternionToEuler()` extrae dos ángulos bajo una
convención cuyo ángulo intermedio nunca se calcula, y es singular cuando ese ángulo llega a ±90°. Un
teléfono rotado 90° sobre su eje Y cae exactamente ahí: los dos ángulos leen 0 y 0 con el
dispositivo claramente rotado, y cualquier movimiento se amplifica unas 240 veces. Se corrige
prerrotando el quaternion con `mountQuaternion`, o usando modo `'vector'`.

**`mountingTransform` no reemplaza a `mountQuaternion`.** Corre sobre el resultado de la
descomposición, así que puede desplazar o intercambiar ángulos, pero no puede deshacer una
descomposición degenerada.

**Calibración colgada.** `startCalibration()` sin `start()` previo deja la pantalla de calibración
esperando indefinidamente.

**Errores de sensor silenciosos.** Sin listener de `'error'` en los sensores, un permiso denegado se
ve igual que un dispositivo quieto. El controlador los reporta por `onError` con el nombre del
sensor que falló.

---

# Tiempo

`packages/core/src/time/`

El motor lleva el reloj en MJD (Modified Julian Date), un número de días en punto flotante. Todo lo
que entra o sale del motor pasa por estas conversiones.

Se usa `@js-temporal/polyfill` para no depender del soporte nativo de `Temporal`.

## `conversions.js`

| Función | Convierte |
|---|---|
| `instantToMJD(instant)` | `Temporal.Instant` a MJD. |
| `mjdToInstant(mjd)` | MJD a `Temporal.Instant`. |
| `isoToMJD(iso)` | Cadena ISO absoluta, con offset o `Z`, a MJD. |
| `mjdToISO(mjd)` | MJD a cadena ISO absoluta. |
| `wallClockToMJD(date, offsetHours)` | `Date` de JavaScript leído como hora de pared, a MJD. |
| `mjdToWallClockISO(mjd, offsetHours)` | MJD a cadena sin sufijo de offset. |
| `formatMJDForDisplay(mjd, offsetHours)` | MJD a texto legible. |

Las dos funciones de hora de pared existen para los widgets de UI que devuelven un `Date` cuyos
campos representan una lectura de reloj, no un instante. `offsetHours` es el offset fijo con el que
interpretar esa lectura, independiente de la zona del navegador.

## `engineTime.js`

| Función | Uso |
|---|---|
| `computeMidnightMJD(offsetHours)` | Medianoche de hoy en ese offset, como MJD. |
| `computeDefaultObservationTime({ offsetHours, fixedMJD })` | Hora de observación inicial. `fixedMJD` fija una fecha; si no, medianoche de hoy. |
| `setEngineTime(engine, mjd)` | Escribe `core.observer.utc`. |
| `setEngineSpeed(engine, multiplier)` | Escribe `core.time_speed`. |
| `nudgeEngineHours(engine, hours)` | Suma horas al reloj. |
| `getEngineMJD(engine)` | Lee `core.observer.utc`, o `null`. |

`initializeStellariumEngine()` llama a `computeDefaultObservationTime()` con lo que reciba en su
opción `time`.

Los despliegues actuales usan offset `-3`, hora continental de Chile, sin horario de verano.

---

# Comunicación

`packages/core/src/sync/`

## Bus de mensajes

`createMessageBus(transport)` da despacho por nombre de mensaje y limitación de frecuencia de
salida, con forma `{ msg, values }` independiente del transporte.

```js
const bus = createMessageBus(createWebSocketTransport({ url, role: 'ocular' }));
bus.on('pose', ({ yaw, pitch }) => { /* ... */ });
bus.start({ onConnect: () => { /* ... */ } });
bus.sendThrottled('pose', { yaw, pitch }, 'guide', 20);
```

| Método | Uso |
|---|---|
| `on(msg, handler)` | Registra un handler. Uno por nombre de mensaje. |
| `send(msg, values, target)` | Envía. |
| `sendThrottled(msg, values, target, interval)` | Descarta envíos más frecuentes que `interval` ms para el mismo par mensaje y destino. |
| `start({ onConnect })` | Conecta el receptor del transporte y arranca. |

Un mensaje sin handler registrado emite una advertencia por consola.

## Contrato de transporte

Tres métodos:

```js
{
  send(payload, target),   // payload es { msg, values }
  onReceive(handler),      // handler recibe { msg, values }
  onConnect(handler),      // opcional
}
```

| Transporte | Usado por |
|---|---|
| `createProtobjectTransport()` | `web-app`. Ver [protobject.md](protobject.md). |
| `createWebSocketTransport(opciones)` | `dual-telescope`. |
| `createNullTransport()` | Apps de un solo dispositivo. `send()` no hace nada. |

## Transporte WebSocket

```js
createWebSocketTransport({ url, role, reconnectMs = 2000, onStatus })
```

| Opción | Qué hace |
|---|---|
| `url` | URL del relay. Obligatoria. |
| `role` | Identifica al cliente ante el relay. Se envía como query param. |
| `reconnectMs` | Espera entre reintentos. |
| `onStatus` | Recibe `'connecting'`, `'open'`, `'closed'`, `'error'`. |

Un `send()` con el socket cerrado se descarta en vez de encolarse: esto transporta orientación a
unos 50 Hz, y entregar una pose vieja tarde es peor que saltearla.

La reconexión vive en el transporte, no en la app. El guía puede arrancar antes que el ocular y
sigue reintentando hasta que el servidor exista.

Un frame que no parsea como JSON se ignora sin cortar el stream.

Dos diferencias con el transporte de Protobject:

- El WebSocket tiene eventos `close` y `error` reales, así que no hace falta heartbeat.
- `onConnect` se dispara en cada conexión y es un evento genuino de peer, sin primera llamada
  espuria que descartar.

## Relay de dual-telescope

`apps/dual-telescope/server/relay-core.js`

Enruta por **rol**, no por identificador de conexión, así `send(msg, values, target)` del bus llega
sin traducción. Un mensaje sin `target` va a todos los clientes menos el emisor.

| Función | Uso |
|---|---|
| `handleUpgrade(req, socket, head)` | Atiende sólo `/relay` y devuelve `false` para el resto. |
| `handleRequest(req, res)` | Atiende sólo `/link-config` y devuelve `false` para el resto. |

Ambas devuelven `false` cuando la ruta no les corresponde, lo cual permite montar el relay sobre el
dev server de Vite sin romper su WebSocket de HMR.

`/link-config` devuelve `{ sensorSource, addresses }`, y cada página lo consulta al cargar con
`fetchLinkConfig()`.

`sensorSource` es qué rol lleva los sensores, y lo fija el script de arranque con la variable
`SENSOR_SOURCE`. `addresses` son las IPv4 de LAN del equipo, sacadas de `os.networkInterfaces()`,
para que el ocular pueda mostrar la URL del guía como QR.

Van sólo las direcciones y no la URL completa: el protocolo y el puerto los sabe la página, así que
la URL se arma del lado del cliente y queda bien tanto sobre el servidor de Vite en desarrollo como
en producción, sin que el relay tenga que saber en cuál de los dos está.

Corre en dos modos con la misma lógica: como proceso propio en producción (`server/relay.js`, que
además sirve `dist/`) y montado sobre Vite en desarrollo.

---

# Óptica

`packages/core/src/telescope/Telescope.js`

Matemática del instrumento y de la calidad del cielo. Las funciones son puras y no requieren
instancia: cualquier app las usa con los números que ya tenga. `Telescope` es una clase opcional que
envuelve las mismas funciones para las apps que quieran mantener el estado como objeto.

Vocabulario en [glosario.md](glosario.md).

## Aumento y campo

| Función | Devuelve |
|---|---|
| `computeMagnification(focalLength, eyepieceFocalLength)` | Aumento. `null` si la focal del ocular no es positiva. |
| `computeFovFromEyepiece(focalLength, eyepieceFocalLength, projectionConstant = 100)` | FOV en radianes. |

Distancias focales en milímetros. `projectionConstant` es el campo aparente asumido del ocular, en
grados.

## Slider de modo simple

El modo simple de `web-app` expone el zoom como un deslizador lineal, pero el FOV útil abarca varios
órdenes de magnitud. El mapeo es exponencial para que el recorrido del deslizador se sienta parejo.

| Función | Uso |
|---|---|
| `sliderToFov(valor, { minFov, maxFov, maxSlider = 150 })` | Posición del deslizador a FOV. |
| `fovToSlider(fov, { minFov, maxFov, maxSlider = 150 })` | Inversa. |

## Magnitud límite

```js
calculateLimitMag({ aperture, magnification, telescopeType, sqmReading, ... })
```

Devuelve la magnitud del objeto más débil visible, redondeada a un decimal. Es el valor que se
escribe en `core.display_limit_mag`.

| Parámetro | Por defecto | Describe |
|---|---|---|
| `aperture` | — | Apertura en mm. Instrumento. |
| `magnification` | — | Aumento. Instrumento. |
| `telescopeType` | `REFRACTOR` | `TelescopeType.REFLECTOR`, `REFRACTOR` o `CATADIOPTRIC`. Fija la obstrucción central y las pérdidas por reflexión. |
| `coatingReflectivity` | `88` | Reflectividad del tratamiento, en porcentaje. Instrumento. |
| `cleanliness` | `0` | Suciedad de la óptica, de 0 a 1. Instrumento. |
| `sqmReading` | — | Brillo del fondo de cielo. Cielo. |
| `extinction` | `0.3` | Extinción atmosférica. Cielo. |
| `seeingDiskDiameter` | `1` | Seeing en segundos de arco. Cielo. |
| `zenithDistanceDeg` | `30` | Distancia cenital del objeto. Cielo. |
| `starColorIndex` | `0` | Índice de color del objeto. |
| `observerExperience` | `3` | Experiencia del observador, de 1 a 9. Observador. |
| `observerPupil` | `7` | Diámetro de pupila en mm. Observador. |

Sólo los cuatro primeros describen el telescopio. El resto describe el cielo y a quien mira, que es
por qué el mismo instrumento da resultados distintos según la noche.

La fórmula es la de Schaefer para magnitud límite telescópica, trasladada del código original sin
cambios. `computeNELM()` deriva la magnitud límite a ojo desnudo a partir del SQM.

## Contaminación lumínica

| Función | Uso |
|---|---|
| `magToBortle(magArcsec2)` | SQM a escala Bortle, de 1 a 9. |
| `bortleToMag(bortle)` | Bortle a un SQM dentro del rango de esa clase. |

`bortleToMag()` devuelve un valor aleatorio dentro del rango de la clase, así que no es la inversa
exacta de `magToBortle()` y dos llamadas con el mismo argumento no coinciden.

## Clase `Telescope`

Guarda apertura, focal, tipo y estado del ocular montado, más las coordenadas apuntadas
(`ra`, `dec`, `alt`, `az`). `setEyepieceFocalLength()` recalcula el aumento.

---

# Conectores de hardware

`packages/core/src/io/connectors.js`

Contrato de lo que alimenta a una app con entrada externa. Qué hardware hay difiere por app, así que
`core` sólo define la forma y las integraciones concretas viven donde está el hardware.

```js
{ isSupported(): boolean, connect(): Promise<void>|void, disconnect(): Promise<void>|void }
```

`createKeyboardConnector({ bindings, onError })` mapea eventos `keydown` a acciones. `bindings` es un
objeto de tecla en minúscula a función. Es lo que usa `kiosk-standalone`, donde el Arduino actúa
como teclado USB.

`createKeyboardLineSource({ onLine, onKey, preventDefault })` rearma líneas terminadas en Enter a
partir de pulsaciones sueltas. Una placa que actúa como teclado no puede mandar un flujo de bytes:
cada carácter llega como su propio `keydown`. Con esto, el código que interpreta un protocolo no
necesita saber si los bytes vinieron de un teclado, de un puerto serie o de un endpoint bulk.

`preventDefault` evita que las pulsaciones actúen además sobre la página. Importa sobre todo con
Enter: un botón que conserve el foco se volvería a disparar con cada línea que manda la placa, y la
placa manda hasta cincuenta por segundo.

`onKey` entrega cada carácter suelto, para diagnóstico. La librería `Keyboard` de Arduino envía
códigos de tecla, no caracteres, así que con otra distribución en el anfitrión llega un carácter
distinto del que el sketch imprimió; verlo en crudo es la única forma de detectarlo.

`dual-telescope` lo usa en `apps/dual-telescope/src/focuser.js`, que interpreta el protocolo del
enfocador. Esa parte vive ahí y no en `core` porque es específica de ese hardware.

---

# Configuración

`packages/core/src/config/loadConfig.js`

```js
const config = await loadConfig({
  development: () => import('./config.dev.js'),
  production: () => import('./config.prod.js'),
});
```

Elige un módulo de configuración según `import.meta.env.MODE` de Vite. Los loaders son funciones que
devuelven un `import()` dinámico, así que los archivos no usados no entran al bundle.

| Opción | Por defecto | Qué hace |
|---|---|---|
| `mode` | `import.meta.env.MODE` | Modo a resolver. |
| `fallbackMode` | `'production'` | Modo usado si no hay loader para el actual. |
| `verbose` | `true` | Loguea el modo elegido. |

Sin loader para el modo actual ni para el de respaldo, lanza error.

No asume nombres de modo ni rutas: `kiosk-standalone` tiene un modo `dev-device` que no tendría
sentido en otra app.
