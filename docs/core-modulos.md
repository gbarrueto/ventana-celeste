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
| `sensorReference` | `'relative'` | `'relative'` o `'absolute'`. Ver [Referencia del acimut](#referencia-del-acimut). |
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

## Referencia del acimut

`sensorReference` decide qué sensor entrega el quaternion, y con eso contra qué está referido el
acimut.

`'relative'` usa `RelativeOrientationSensor`: giroscopio y acelerómetro, sin brújula. Su acimut
arranca en un origen arbitrario, la lectura del momento en que se crea el sensor, sea cual sea la
dirección real a la que apunta el aparato. Ese origen no lo fija la página que lo usa: lo fija la
fusión de sensores del sistema operativo. Medido en Android: recargar la página no lo reinicia,
sólo bloquear y desbloquear el equipo. Que el aparato arranque apuntando al norte con este modo es
coincidencia del momento en que arrancó el sensor, no una propiedad del sensor.

`'absolute'` usa `AbsoluteOrientationSensor`, que suma el magnetómetro y refiere el acimut al
norte magnético real en vez de a ese origen arbitrario. A cambio se degrada cerca de metal, así
que un montaje metálico puede volver la lectura inestable en vez de mejorarla.

No es lo mismo que `'relative'`/`'gyro'` de la conmutación de modo, más abajo: eso decide de qué
camino sale el apuntado en cada instante, quaternion o integración de giroscopio, y es ortogonal a
esto, que decide contra qué está referido el acimut del propio quaternion.

Por defecto `'relative'`, así que `web-app` y `kiosk` no cambian de comportamiento.

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
| `opticalAxis` | — | — | `'-y'` |
| `fovThreshold` | `0.8` | `0.2` | `0` |
| `dynamicThreshold` | default | default | `0.06` |
| `smoothing` | default | default | `0.10` en ambos ejes |
| `persistBiasKey` | — | `astrovis_gyro_bias` | `dual-telescope:gyro-bias` |
| `sensorReference` | default | default | `'absolute'` |

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

# Seeing atmosférico

`packages/core/src/sky/seeing.js`

Post-proceso WebGL que simula la turbulencia atmosférica sobre el canvas del motor. Recibe dos
canvas ya posicionados y dibuja en el segundo. No crea elementos ni escribe estilos: la geometría
en pantalla y los filtros CSS los fija cada app.

Vocabulario en [glosario.md](glosario.md).

## Uso

```js
import { createSeeingOverlay, SEEING_PRESETS } from '@ventanaceleste/core';

const seeing = createSeeingOverlay({
  skyCanvas: document.getElementById('stel-canvas'),
  effectCanvas: document.getElementById('seeing-canvas'),
  fov: engine.core.fov,
  onActiveChange: (on) => { effectCanvas.style.visibility = on ? 'visible' : 'hidden'; },
});

seeing.setParams({ seeing: 2.4, aperture: 200 });
```

Devuelve `null` si el contexto WebGL no está disponible.

| Opción | Uso |
|---|---|
| `skyCanvas` | Canvas del motor, del que se lee. |
| `effectCanvas` | Canvas donde se dibuja. |
| `params` | Subconjunto inicial de los parámetros. |
| `fov` | FOV inicial en radianes. |
| `getFov` | La provee la app y devuelve el FOV actual en radianes. Se lee por frame. |
| `fovAxis` | `'height'` o `'width'`: a qué lado del canvas corresponde ese FOV. Por defecto `'height'`. |
| `onActiveChange` | Recibe `true` cuando el overlay empieza a dibujar y `false` cuando la compuerta lo apaga. |

El motor atiende la rueda del ratón y los gestos de zoom por su cuenta. Sin `getFov`, el overlay
conserva el último FOV recibido por `setFov()` y calcula sus escalas contra un campo que ya cambió.

Los dos canvas comparten resolución y geometría en pantalla, rotación y recorte incluidos. Una
diferencia entre ambos se ve como un desplazamiento del cielo entero.

## Modelo

Tres términos, uno por grupo de capas. El ángulo isoplanático vale θ₀ = 0.314·r₀ℓ/h y la frecuencia
f = v/(0.314·r₀ℓ), así que el tamaño angular de celda depende de la altura de la capa y la frecuencia
de hervor no.

| Capa | Altura | Celda | Frecuencia | Aporte |
|---|---|---|---|---|
| Límite | 50–200 m | 2–6′ | 10–30 Hz | Deformación |
| Media | 5 km | 4″ | 160 Hz | Desenfoque |
| Jet | 10 km | 1″ | 480 Hz | Desenfoque y cáusticas |

Sólo la capa límite produce deformación visible. Por encima de un kilómetro las celdas quedan bajo
el límite de resolución y sobre la fusión de parpadeo.

El desplazamiento es el gradiente de un campo de fase, que es la relación entre ángulo de llegada y
frente de onda. La divergencia de ese mismo campo da la compresión del haz, con dos muestreos ya
disponibles.

El orden es deformar y después difuminar. Invertido, las PSF se destruyen en vez de trasladarse.

Las amplitudes están en arcosegundos y se convierten a píxeles con el FOV, así que el efecto escala
con el zoom sin rampa explícita.

## Parámetros

Todos opcionales. `setParams()` acepta cualquier subconjunto y `SEEING_DEFAULTS` tiene los valores
iniciales.

| Parámetro | Unidad | Por defecto | Controla |
|---|---|---|---|
| `seeing` | arcosegundos | `2.0` | FWHM del disco de seeing. Rango operativo 0.3 a 3. |
| `intermit` | 0–1 | `0.35` | Rachas y calmas en escala de segundos. |
| `intensity` | multiplicador | `0.3` | Escala maestra de todo el efecto. Ver [Intensidad y seeing](#intensidad-y-seeing). |
| `cellArcmin` | arcominutos | `0.57` | Tamaño angular de celda de la capa límite. |
| `boilHz` | Hz | `40` | Frecuencia de decorrelación de la capa límite. |
| `octaves` | 1–4 | `3` | Escalas superpuestas del campo de fase. La amplitud está normalizada, así que cambia el carácter del temblor y no su tamaño. |
| `frozen` | 0–1 | `0.4` | Reparto entre arrastre por viento y hervor en el lugar. |
| `windDir` | grados | `227` | Dirección del arrastre. |
| `compress` | multiplicador | `1.5` | Escala la divergencia del warp. La base ya es física, del orden del 1 %. |
| `scint` | 0–1 | `0.34` | Amplitud del centelleo antes de la supresión física. Ver [Centelleo](#centelleo). |
| `scintArcsec` | arcosegundos | `7` | θc = √(λ/h). Rango físico 1.5–5″. |
| `jetDrift` | arcmin/s | `7` | Deriva de las bandas de brillo. |
| `jetDir` | grados | `186` | Dirección de esa deriva. |
| `aperture` | mm | desde `Telescope.js` | Vía D/r₀, reparte entre movimiento global y desenfoque. Ver [Apertura y desenfoque](#apertura-y-desenfoque). |
| `tipTilt` | multiplicador | `0.97` | Escala el movimiento global calculado. |
| `blurMul` | multiplicador | `0.72` | Desenfoque residual, sobre la fracción que deja D/r₀. |
| `diffMul` | multiplicador | `1` | Límite de difracción del instrumento. `0` lo desactiva. |
| `lucky` | 0–1 | `0.5` | Profundidad de los instantes de nitidez. |
| `model` | 0–3 | `3` | `3` es el modelo completo. `0` es el shader de ondas original, `1` warp fBm, `2` gradiente de una capa. |
| `fovGateArcmin` | arcominutos | `0` | Campo por encima del cual el efecto se desvanece. `0` lo desactiva. |
| `legacyAmount` | — | `80` | Amplitud del modelo `0`. |
| `resolutionScale` | 0.25–1 | `1` | Fracción de la resolución nativa a la que se renderiza. |

`scintArcsec` fuera del rango 1.5–5″ rompe la discriminación entre fuentes puntuales y extendidas.
A su escala física, una estrella no resuelta entra en una sola celda y titila con amplitud plena,
mientras que una superficie extendida abarca cientos de celdas descorrelacionadas que se promedian.

## Métodos

| Método | Uso |
|---|---|
| `setFov(rad)` | FOV del ocular en radianes. Convierte los arcosegundos del modelo en píxeles. Innecesario con `getFov`. |
| `getFov()` | FOV actual. |
| `setParams(partial)` | Aplica cualquier subconjunto de los parámetros. |
| `getParams()` | Copia del estado actual. |
| `applyPreset(nombre)` | Aplica una clave de `SEEING_PRESETS`. Devuelve `false` si no existe. |
| `setCompareModel(m)` | Modelo mostrado en la mitad izquierda, para comparación A/B. `null` la apaga. |
| `physics()` | Magnitudes derivadas para paneles de diagnóstico. |
| `stop()` | Detiene el bucle y libera el observador de tamaño. |

## Exposición de parámetros

`SEEING_PARAMS` describe cada parámetro con su rango, unidad, grupo y `scope`. Los paneles se
construyen desde ahí para que no existan dos listas que se desincronicen.

| `scope` | Quién lo ve | Parámetros |
|---|---|---|
| `user` | La aplicación pública | `seeing` |
| `debug` | Panel de desarrollo | Los otros 21 |

La aplicación pública expone únicamente el seeing, entre 0.3 y 3 arcosegundos. Todo lo demás
describe el modelo o el instrumento y se ajusta durante el desarrollo.

`aperture` figura entre los parámetros para poder compararla en el banco. Su valor sale de
`createDefaultTelescope()` en `packages/core/src/telescope/Telescope.js`, que es donde viven las
características del instrumento.

## Intensidad y seeing

`seeing` es una magnitud física. De ella dependen r₀, D/r₀, la amplitud del movimiento global y la
atenuación automática del centelleo sobre objetos extendidos. Además no escala el efecto de forma
pareja: la deformación va con seeing¹ y el movimiento global con seeing^(5/6), de modo que cambiarlo
altera el carácter además del tamaño. Con `seeing` por debajo de 0.5″ la atenuación del centelleo
satura en 1 y deja de suprimir el granulado de las superficies extendidas.

`intensity` escala el efecto completo por igual y deja esas magnitudes intactas. Es el control para
mostrar menos turbulencia sin cambiar la noche que se está describiendo. El valor por defecto de 0.3
es una decisión de puesta en escena: el seeing real a gran aumento resulta excesivo en una pieza que
se mira de pie y durante poco tiempo.

Los defaults corresponden a una noche corriente vista con 200 mm, ajustados contra el motor en el
rango de campo que alcanza `dual-telescope`, de 1.72′ a 10′.

## Apertura y desenfoque

La varianza de frente de onda que queda tras retirar el tilt vale 0.134 (D/r₀)^(5/3). De ahí sale
`blurFrac`, la fracción del seeing que sobrevive como desenfoque:

| D/r₀ | `blurFrac` |
|---|---|
| 0.45 | 0.035 |
| 0.90 | 0.106 |
| 1.80 | 0.300 |
| 3.60 | 0.678 |
| 7.20 | 0.973 |

Con la apertura por debajo de r₀ el instrumento queda limitado por difracción y el desenfoque
atmosférico es despreciable, aunque la imagen siga moviéndose entera. Por encima de r₀ el
movimiento se promedia y domina el desenfoque. `blurMul` multiplica esa fracción, así que sus
valores útiles rondan 1.

El movimiento global depende de la apertura como D^(-1/6), una relación débil: entre 50 mm y 400 mm
cambia menos de un factor 1.5.

El desenfoque total suma en cuadratura ese término atmosférico y el límite de difracción del
instrumento, 1.03 λ/D:

| Apertura | Difracción | Atmósfera | Total |
|---|---|---|---|
| 50 mm | 2.34″ | 0.03″ | 2.34″ |
| 110 mm | 1.06″ | 0.12″ | 1.07″ |
| 200 mm | 0.58″ | 0.30″ | 0.66″ |
| 300 mm | 0.39″ | 0.50″ | 0.64″ |
| 400 mm | 0.29″ | 0.68″ | 0.74″ |

Los valores de atmósfera corresponden a seeing 1″ con `intensity` en 1. Los dos términos van en
sentidos opuestos y el mínimo cae cerca de D ≈ 2 r₀. Más apertura ya no afina la imagen: reúne más
luz y permite exposiciones más cortas.

El término de difracción queda fuera de la envolvente, porque describe el instrumento y no la
noche. Ni `intensity` ni `intermit` lo tocan, y `lucky` no puede bajar de él: alcanzar el límite de
difracción en los momentos buenos es la definición de esa técnica.

## Centelleo

El brillo se modula con el valor del campo de ruido y no con su laplaciano. El laplaciano está
dominado por las frecuencias altas y sobre una superficie extendida se lee como granulado. El
laplaciano queda para la compresión geométrica, donde corresponde por ser la divergencia del
desplazamiento.

`scintArcsec` fija θc y con ello la altura de la capa, h = λ/θc². De ahí salen dos supresiones que
se aplican sobre `scint`:

| | Factor | Origen |
|---|---|---|
| Altura | (h/10 km)^(5/12) | La intensidad de centelleo crece con la distancia de propagación. |
| Apertura | (r_F/D)^(7/6) con r_F = √(λh) | La apertura promedia sobre los parches de Fresnel que abarca. |

| θc | Capa | Supresión total con D = 150 mm |
|---|---|---|
| 1.5″ | 10.4 km | 0.343 |
| 2.5″ | 3.7 km | 0.165 |
| 4.0″ | 1.5 km | 0.064 |
| 7.0″ | 478 m | 0.021 |

Una capa alta y una apertura pequeña centellean; una capa baja vista con una apertura grande
prácticamente no. Es la razón por la que las estrellas titilan a ojo desnudo y casi no lo hacen a
través de un telescopio.

El modelo no distingue una fuente puntual de una superficie resuelta: aplica la misma ganancia a
cada píxel. La discriminación queda sólo en la escala angular y en estas supresiones.

## Uso por app

| App | Canvas de efecto | Panel | Qué expone |
|---|---|---|---|
| `dual-telescope` | Sólo el rol `ocular`. `acomodarVista()` coloca los dos canvas con la misma geometría. | `panel.js`, construido desde `SEEING_PARAMS` | Todo, con el FWHM separado arriba |
| `web-app` | `apps/web-app/src/lib/seeing-overlay.js` | La página de control, otro dispositivo | Sólo el FWHM, por `seeingOption` |

El guía de `dual-telescope` no monta overlay: trabaja a campo amplio, donde el efecto es sub-píxel.

Los ajustes del seeing viven anidados en `ajustes.seeing`. `cargarAjustes()` fusiona ese nivel
aparte, porque un objeto anidado no se combina con el spread de un nivel y un parámetro nuevo no
llegaría a quien ya tenga ajustes guardados.

`focus` y `saturation` no son parámetros del modelo: describen el ocular y la pantalla. Se aplican
como filtro CSS sobre el canvas de efecto. Un filtro no altera el buffer, así que aplicarlo al canvas
del motor sería invisible para el overlay, que lee de ahí.

## Compuerta por campo

`fovGateArcmin` no describe la atmósfera. El seeing existe a todo campo y por debajo de un píxel
de desplazamiento no queda nada visible, así que la compuerta elige a partir de qué aumento
aparece el efecto y evita el gasto de GPU por encima de ese punto.

El desvanecimiento ocupa un factor 1.8 de campo: vale 1 en el umbral o más cerrado y llega a 0 a
1.8 veces el umbral. Con la compuerta en cero no se sube la textura ni se dibuja, y
`onActiveChange` recibe `false`. La app oculta su canvas ahí, que de otro modo conservaría el
último frame dibujado.

## Presets

Claves de `SEEING_PRESETS`: `antoniadi1`, `antoniadi3`, `antoniadi5`, `jetStream`, `calorSuelo`.
La escala Antoniadi de I a V es la que se anota en la bitácora de observación.

## `computeSeeingPhysics(params, fov, viewHeightPx)`

Función pura, sin instancia. `fov` en radianes, `viewHeightPx` en píxeles físicos.

| Campo | Unidad | Significado |
|---|---|---|
| `r0` | metros | Parámetro de Fried, desde FWHM = 0.98 λ/r₀. |
| `D` | metros | Apertura. |
| `DR` | — | D/r₀. |
| `tiltArcsec` | arcosegundos | Movimiento de imagen rms. |
| `pxPerArcsec` | px | Escala de la vista. |
| `r0Suelo` | metros | r₀ implícito de la capa límite. |
| `vSuelo` | m/s | Viento implícito de la capa límite. |
| `driftArcminPerSec` | arcmin/s | Deriva angular de la capa límite. |
| `hCentelleo` | metros | Altura implícita de la capa de centelleo. |
| `scintAtten` | 0–1 | Atenuación del centelleo por el disco de seeing. |

Los campos implícitos existen para detectar combinaciones de parámetros sin correlato físico. Un
`vSuelo` sobre 12 m/s no corresponde a una capa límite nocturna.

## Trampas conocidas

**Orden de los `requestAnimationFrame`.** La textura se sube directo desde `skyCanvas`. El contexto
del motor no pide `preserveDrawingBuffer`, así que su buffer sólo es legible antes de que el
navegador componga. El overlay registra su callback después del motor y por eso lee contenido
válido. Un cambio en el orden de registro deja la vista en negro sin emitir error.

**Uniforms eliminados por el compilador.** Las locations se leen por introspección del programa
enlazado. Un uniform declarado y no usado devuelve una location nula, y pasarla a `gl.uniform*()`
lanza y corta el bucle de render.

**Paso de las diferencias centrales.** El gradiente del campo de fase se calcula por octava, con
el paso expresado en el espacio de cada una. Un paso único deja la octava más fina por debajo de su
propio retículo y agregarla no cambia el resultado: el rms del gradiente pasa de 0.791 a 0.788 al
sumar la cuarta octava, contra 0.818 a 0.966 con el paso por octava.

**Escala de la deformación.** El tamaño de celda base corresponde a D/h, la separación angular a la
que dos haces dejan de compartir camino en la capa. Con 150 mm a 100 m son unos 5 arcominutos. La
estructura fina no sale de reducir ese número sino de `octaves`: los pesos siguen a Kolmogorov, la
fase decae 0.56 por octava y el gradiente la multiplica por la frecuencia, así que la deformación
crece con la frecuencia y las octavas finas dominan el temblor localizado.

**Eje del FOV.** `fovAxis` declara si el FOV que reporta el motor abarca el alto o el ancho del
canvas. Equivocarse escala todas las amplitudes por el factor de aspecto y el efecto sale débil o
exagerado sin ningún otro síntoma.

**Efecto invisible a campo amplio.** Las amplitudes están en arcosegundos. A 69° de campo, 2
arcosegundos de seeing son 0.01 px de deformación y no hay nada que ver. El efecto empieza a leerse
por debajo de unos 20 arcominutos. La celda de centelleo se apaga junto con su tamaño en píxeles
por el mismo motivo.

**`highp` en fragment shaders.** No está garantizado en WebGL1. El shader se declara bajo
`GL_FRAGMENT_PRECISION_HIGH` con respaldo en `mediump`. Sin eso no compila en varios teléfonos.

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
