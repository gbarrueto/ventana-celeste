# Changelog

Cambios relevantes desde la migración a monorepo. Lo anterior está en el historial de git.

Orden inverso: lo más reciente arriba.

## 2026-09-07 — Los cuatro signos de yaw eran dos convenciones

La referencia del motor listaba la escritura de `observer.yaw` como una elección por app, con cuatro
filas y ninguna regla. De ahí salía la idea de que había cuatro lugares donde equivocarse y un cielo
invertido esperando.

Son dos signos, uno por modo de apuntado, y dan el mismo acimut. Verificado numéricamente contra
`packages/core/src/orientation/controller.js`: sin alabeo, `−atan2(2(wz+xy), 1−2(y²+z²))` coincide
con `atan2(vx, vy)` de eje óptico `+y` con error nulo en todo el rango de rumbo y elevación. Con
alabeo divergen hasta 90°, que es la degeneración conocida del modo euler y no del signo.

Una de las cuatro filas además estaba mal desde `af7458d`, que eliminó el archivo de cielo viejo de
`device-lab`. La app escribe el acimut sin negar desde entonces.

Se descartó unificar el signo en `core`. Negar la rama euler de `quaternionToPointing` obliga a
negar también `omega[2]` en `angularRates`, porque `state.orient.yaw` se alimenta del quaternion y
de la integración del giroscopio, y `blendTowardRelativeOnZoomIn` mezcla las dos. Hacerlo a medias
rompe `web-app` y `kiosk` sólo en zona dinámica, con campo cerrado y en movimiento. El único caso
que el cambio prevendría es una app nueva que combine la configuración del controlador de
`dual-telescope` con la línea de escritura de `web-app`.

## 2026-09-07 — La coordenada del ruido del seeing crecía sin límite

En un teléfono la imagen se rompía en bloques a los diez o doce segundos, siempre a la misma altura
desde que se reiniciaba el render, y sin aparecer en un monitor. El síntoma se parecía a un cuadro
sin sincronía vertical.

Se descartaron tres explicaciones antes de dar con la buena, y ninguna dejaba rastro en consola:
falta de sincronía entre los dos contextos WebGL, para la que se probó una copia intermedia a un
canvas 2D; la frecuencia de la pantalla, de 120 Hz; y el factor de píxeles del dispositivo. Ninguna
cambió el comportamiento.

La causa es precisión. El desplazamiento del campo salía de multiplicar una tasa por el tiempo
transcurrido, así que la coordenada crecía sin límite: con el arrastre en 0.4 avanzaba dieciséis
celdas por segundo y la cuarta octava la multiplica por ocho, de modo que a los doce segundos iba en
1800. Ahí el `fract()` de las GPU móviles se queda sin bits y el campo colapsa.

Lo que fijó el diagnóstico fue el conjunto de condiciones que lo agravaban: frecuencia de hervor y
número de octavas aceleran el crecimiento, el seeing y la intensidad sólo lo hacen más visible, y
poner el arrastre en cero lo elimina. Ese último dato también explicó por qué el eje temporal, que
crece igual, no se nota: degrada la animación, no la geometría.

El retículo pasa a ser periódico, 256 celdas en el espacio y 4096 en el tiempo, y los
desplazamientos se integran por incrementos y se envuelven en ese período. La lacunaridad baja de
2.11 a 2 para que envolver la coordenada base envuelva también cada octava.

## 2026-09-07 — Costo del seeing medido en el aparato

Medido en `device-lab` contra Saturno, con el medidor de costo que compara los cuadros con el efecto
apagado y encendido.

| Escenario | Sin seeing | Con seeing | Pérdida |
|---|---|---|---|
| En movimiento, pantalla de 120 Hz | 120 fps | 65 fps | 45–50 % |
| En reposo, límite del motor | 60 fps | 52 fps | 13 % |

El motor limita el render a 60 fps mientras la vista no se mueve y sube a la frecuencia de la
pantalla mientras hay movimiento. La Luna resulta algo más costosa que Saturno.

`maxFps` topa el overlay en 60, así que en una pantalla de 120 Hz omite la mitad de los cuadros. El
motor sigue dibujando a la frecuencia de la pantalla, y eso no se controla desde fuera: su bucle
vive dentro del WebAssembly.

La subida de la textura es 10 MB por cuadro a 1080p, unos 0.6 GB/s a 60 fps. Es el precio de leer el
resultado del motor desde otro contexto WebGL.

## 2026-09-07 — Simulación de seeing atmosférico en core

`packages/core/src/sky/seeing.js` reemplaza al overlay de `apps/web-app/src/lib/seeing-overlay.js`,
cuyo shader desplazaba cada punto con `sin(y)` en el eje horizontal y `cos(x)` en el vertical. Esas
dos funciones separables describen una onda plana viajera: todos los puntos de una misma fila se
desplazan en fase a lo ancho del cuadro. Con dos armónicos de frecuencias 42 y 15 el patrón es
periódico y se lee como un frente de olas.

### El modelo

El ángulo isoplanático de una capa vale θ₀ = 0.314·r₀ℓ/h y su frecuencia f = v/(0.314·r₀ℓ), así que
el tamaño angular de celda depende de la altura y la frecuencia de hervor no. Con alturas reales las
capas se separan en dos grupos:

| Capa | Altura | Celda | Frecuencia | Aporte |
|---|---|---|---|---|
| Límite | 50–200 m | 2–6′ | 10–30 Hz | Deformación |
| Media | 5 km | 4″ | 160 Hz | Desenfoque |
| Jet | 10 km | 1″ | 480 Hz | Desenfoque y cáusticas |

Sólo la capa límite produce deformación visible. Por encima de un kilómetro las celdas caen bajo el
límite de resolución y sobre la fusión de parpadeo. El shader anterior usaba la escala de las capas
altas con la amplitud de la baja.

El desplazamiento es el gradiente de un campo de fase, que es la relación entre ángulo de llegada y
frente de onda. La divergencia de ese campo da la compresión del haz sin muestreos adicionales. El
orden es deformar y después difuminar: invertido, las PSF se destruyen en vez de trasladarse.

Las amplitudes están en arcosegundos y se convierten a píxeles con el FOV, así que el efecto escala
con el zoom sin rampa explícita.

### Mediciones que fijaron la implementación

El gradiente del campo de fase se calcula por octava, con el paso de las diferencias centrales
expresado en el espacio de cada una. Con un paso único la octava más fina queda bajo su propio
retículo: el rms del gradiente pasa de 0.791 a 0.788 al sumar la cuarta octava, contra 0.818 a 0.966
con el paso por octava.

La envolvente que modula el movimiento global tiene rms 0.3313. Sin normalizarla, el tip/tilt se
entregaba tres veces más débil de lo que declara `tiltArcsec` y no alcanzaba a mover un píxel.

El desenfoque suma en cuadratura el residuo atmosférico, proporcional a 1 − exp(−0.134·(D/r₀)^(5/3)),
y el límite de difracción 1.03·λ/D. Los dos términos van en sentidos opuestos y el mínimo cae cerca
de D ≈ 2 r₀.

El centelleo modula brillo con el valor del campo y no con su laplaciano, que está dominado por las
frecuencias altas y sobre una superficie extendida se lee como granulado. Su amplitud se suprime por
altura de capa, (h/10 km)^(5/12), y por promediado de apertura, (r_F/D)^(7/6) con r_F = √(λh). Una
capa a 478 m vista con 150 mm queda en 0.021 de la referencia.

### Superficie pública

`SEEING_PARAMS` describe cada parámetro con rango, unidad, grupo y `scope`. La aplicación pública
expone únicamente `seeing`, entre 0.3 y 3 arcosegundos; los otros 21 quedan detrás del panel de
desarrollo. La apertura sale de `createDefaultTelescope()`, que pasa de 100 a 150 mm.

`apps/device-lab/sky.html` gana pestañas, disposición para pantallas grandes y el banco de ajuste
completo, con los cuatro modelos, comparación A/B, presets y persistencia. Los defaults del módulo
salen de ajustar contra el motor en el rango de campo que alcanza `dual-telescope`, de 1.72′ a 10′.

### Límite conocido

El post-proceso aplica la misma ganancia de centelleo a cada píxel y no distingue una fuente puntual
de una superficie resuelta. La discriminación queda en la escala angular y en las dos supresiones.
El promediado por tamaño de fuente no es modelable desde el buffer final.

## 2026-09-01 — device-lab reproduce el apuntado de dual-telescope

`device-lab/sky.html` no podía imitar exactamente el apuntado de `dual-telescope`, así que el mismo
teléfono apuntaba a lugares distintos en las dos apps. Verificado con las doce combinaciones posibles
de eje óptico e inversión de acimut: ninguna reproducía a la vez el acimut y la altura de
`dual-telescope`. La razón es estructural, no de configuración: elegir el eje opuesto mueve el signo
de la altura y desplaza el acimut 180° **a la vez, acoplados**, y `dual-telescope` necesita mover uno
sin el otro — invierte sólo la altura, vía `mountingTransform`, dejando el acimut intacto.

`device-lab` gana el checkbox `−alt`, que reproduce ese `mountingTransform`. Los tres controles
pasan a arrancar en la configuración real de `dual-telescope` (`sensor absolute`, `eje +y`,
`−alt` activado, `−az` apagado), así que abrir la página ya reproduce producción en vez de la
configuración del experimento del giro de 90° que traía por defecto. Verificado sobre 5000
quaternions al azar: acimut y altura coinciden exactos con la fórmula de `apps/dual-telescope/src/sky.js`.

## 2026-09-01 — Acimut corregido 180° y arranque fuera de la zona dinámica

Dos hallazgos verificados en el aparato tras cablear el magnetómetro.

### El acimut estaba 180° invertido: Este por Oeste

Medido: `dual-telescope` mostraba el Este cuando debía mostrar el Oeste. Antes, con
`RelativeOrientationSensor`, esto era invisible — sin referencia absoluta, un desplazamiento
constante en acimut no tenía cómo notarse. La verificación de montaje de esa época («medido en el
montaje: el acimut queda bien, sólo se invierte arriba-abajo») comprobaba el **sentido de giro**
—girar a la derecha panea a la derecha— y ese chequeo no distingue `'+y'` de `'-y'`: los dos ejes dan
el mismo sentido de giro y sólo difieren en un desplazamiento constante de 180° en el acimut, que es
exactamente lo invisible sin norte real.

`opticalAxis` pasa de `'+y'` a `'-y'`, y se retira `mountingTransform`. Verificado: `'-y'` sin
transformar da la misma altura que la configuración anterior y corrige el acimut exactamente 180°,
sin necesidad de ningún ajuste adicional — negar sólo la altura arreglaba la altura pero no el
acimut; negar las dos cambia el acimut por un espejo, no por el desplazamiento que hacía falta.

`device-lab/sky.html` se actualiza con el mismo eje.

### El ocular arrancaba dentro de la zona dinámica

El FOV inicial del ocular (`0.05` rad) estaba por debajo del umbral de la zona dinámica (`0.06`),
así que la app arrancaba ya dentro de ella: la posición se rige por integración de giroscopio en vez
de leerse directo del quaternion. Confirmado en el aparato: recargar estando en la zona dinámica
produce comportamiento errático que se corrige al alejar el zoom.

Encontrados dos bugs de fondo, no sólo el orden de arranque. El camino rápido con bias guardado
—el que corre en casi todos los arranques, salvo el primero— se salta la inicialización que hace
`finishCalibration()`:

- `state.lastTime` queda en `null`. La primera lectura calcula `dt` contra `null`, que en aritmética
  de JavaScript se trata como `0`: en vez de los ~30 ms esperados entre lecturas, `dt` sale del
  orden de segundos. Multiplicado dentro de la zona dinámica, produce un salto de golpe.
- `state.oldX`/`state.oldY` quedan en `null`. La zona dinámica ancla su acumulador ahí en vez de en
  el apuntado real, así que arranca cerca de `(0,0)` y sólo se corrige cuando se sale de la zona.

Los dos se corrigen en `packages/core/src/orientation/controller.js`: el camino rápido ahora fija
`lastTime` igual que `finishCalibration()`, y la zona dinámica espera una lectura real del sensor
absoluto antes de sembrar su acumulador, en vez de arrancar a ciegas.

Además, el FOV inicial del ocular sube por encima del umbral (`UMBRAL_DINAMICO * 1.3`), y las dos
constantes pasan a vivir en el mismo archivo (`panel.js`) para que no puedan desincronizarse otra
vez. Con eso la app no vuelve a arrancar dentro de la zona dinámica aunque cambie el umbral.

## 2026-08-25 — El norte queda referido al magnetómetro

La entrada del 19 de agosto decía la referencia de norte «resuelta a favor del magnetómetro», pero
esa decisión nunca se implementó: `createOrientationController()` sólo instanciaba
`RelativeOrientationSensor`, y `dual-telescope` no tenía ninguna opción para cambiarlo. Lo que
describía esa entrada era un plan, no código en producción.

Apareció al investigar un síntoma intermitente: a veces `dual-telescope` arranca apuntando al norte
real, y otras veces queda fijo en una dirección arbitraria. Medido en el aparato: recargar la página
no reinicia esa referencia, sólo bloquear y desbloquear el equipo. Encaja exactamente con
`RelativeOrientationSensor`, que no tiene norte absoluto — su acimut arranca en la lectura del
momento en que se crea el sensor, y ese origen lo fija la fusión de sensores del sistema operativo,
no la página. Que a veces coincida con el norte real es casualidad del instante en que arrancó.

`createOrientationController()` gana la opción `sensorReference`, `'relative'` o `'absolute'`, que
decide qué clase de sensor se instancia. Por defecto `'relative'`, así que `web-app` y `kiosk` no
cambian. `dual-telescope` pasa a `'absolute'`, que suma el magnetómetro y refiere el acimut al norte
real en vez de a ese origen arbitrario.

Sin verificar todavía: `AbsoluteOrientationSensor` se degrada cerca de metal, y el tubo del
telescopio lo es. Si la lectura resulta inestable en el aparato real, revertir es cambiar ese único
valor a `'relative'`.

`apps/device-lab/sky.html` ya tenía un selector para probar los dos sensores; con este cambio deja
de ser sólo una prueba de banco y pasa a reflejar una opción real del controlador.

## 2026-08-25 — Limpieza de la iteración 1 de kiosk

Las pruebas en museo fijaron el zoom como rueda continua, así que se retira el mecanismo de la
primera iteración: niveles discretos de ocular seleccionados por tarjeta.

Se van `LENS_FOCAL_LENGTHS`, `currentLensLevel`, `applyLensLevel()`, `triggerLens()`,
`triggerCardChange()`, las teclas `1`–`8`, los enganches `onDebugSelectLens` y
`onDebugSimulateCardChange`, y `HUMAN_EYE_FOV` junto con `NO_LENS_BLUR`, que ya no tenía uso. En el
panel de depuración se van sus props, `lensLevels` y `simulatedCardLevels` —declarados y sin usar— y
la línea «ID lente».

Queda intacto el camino de zoom continuo, y también la instancia de `Telescope`: la usa
`updateStellariumFov()` para derivar la focal del ocular a partir del FOV, que es la dirección
inversa a la que usaban los niveles.

### El FOV inicial

Salía de `applyLensLevel()` en el arranque, así que quitarlo dejaba la vista con el valor por
defecto del motor. Ahora se declara junto a las demás constantes de FOV, con los mismos dos valores
que daba la tabla en cada rama.

Al hacerlo apareció que el motor **nunca recibía ese valor**: `applyLensLevel(0)` tenía las líneas
de FOV comentadas y `onReady` no lo fijaba, así que la aplicación creía un FOV y el motor tenía
otro. La asignación va ahora dentro de `onReady`, y no en el arranque, porque `initEngine()` no se
espera: allí el motor todavía no existe y la asignación se perdía por la guarda de
`updateStellariumFov()`.

## 2026-08-24 — El enfocador pasa a teclado

El teléfono del ocular va dentro del tubo y su pantalla no queda accesible cuando se conecta el USB.
WebUSB exige un gesto del usuario para autorizar el dispositivo, así que ese camino no encaja con el
montaje. Un Arduino que actúa como teclado no pide permiso ni gesto: funciona desde el instante en
que se conecta el cable.

### La versión de USB que declara el firmware

Encontrar esto llevó la mayor parte de la sesión, y conviene que quede escrito porque el síntoma
apunta a cualquier lado menos a la causa.

Windows dejaba de reconocer las placas: dispositivo compuesto con Código 10, «se ha especificado un
dispositivo inexistente». Ocurría en tres máquinas y con dos placas, con cualquier sketch salvo el de
WebUSB, y Android nunca tuvo problema.

La causa es una edición del core que piden las instrucciones de instalación de la librería WebUSB:
poner `USB_VERSION` en `0x210` en `cores/arduino/USBCore.h`. Declarar USB 2.1 significa, según la
especificación, «tengo descriptor BOS». El core no lo implementa; la librería WebUSB sí. Así que a
partir de esa edición **todos** los sketches de esa instalación prometen un descriptor que no tienen,
y el único que cumple es el de WebUSB. Windows pide el descriptor, no lo recibe y `usbccgp` no
arranca. Android no lo pide, y por eso ahí el síntoma no aparece.

Lo señaló que una placa programada desde otra máquina funcionara y la misma placa programada desde
esta, no. El sketch no era la variable: lo era el firmware que genera cada instalación.

La versión declarada tiene que coincidir con lo que el sketch entrega, así que se decide por sketch y
no por instalación. `subir.ps1` busca `WebUSB.h` y elige `0x210` o `0x200`. Hace falta `--clean`:
`USBCore.cpp` es parte del core, el core compilado se cachea, y sin eso se reutiliza uno armado con
el valor anterior.

Detalle relacionado: la librería `Keyboard` envía códigos de tecla, no caracteres, así que el
teclado del dispositivo tiene que estar en distribución inglesa. Con distribución española el
separador `:` del protocolo llega como `ñ`.

### El enfocador

`createKeyboardLineSource()` en `core` rearma líneas terminadas en Enter a partir de pulsaciones
sueltas, con el mismo contrato que el resto de los conectores. Deja la fuente intercambiable: el
código que interpreta el protocolo no sabe de dónde vinieron los bytes.

`focuser.js` pasó de 258 a 166 líneas. Desapareció el ciclo de conexión completo —permisos,
emparejamiento, reintentos, eventos de conexión, bucle de lectura, selección de interfaz— porque con
teclado no hay conexión que gestionar. Quedó la lógica del instrumento.

Los tres canales del sketch quedan cableados:

| Canal | Destino |
|---|---|
| `P:<0..1023>` | Posición del enfocador, normalizada a 0..1 en el borde |
| `R:<0..1023>` | Ocular, resuelto a una clave por tramos del ADC |
| `C:TRUE` / `C:FALSE` | Presencia de la cámara, reflejada al guía |

La cámara se reporta y no se interpreta: qué debe hacer la aplicación cuando está presente todavía no
está decidido.

`TRAMOS_OCULAR` queda vacío. Sin medir las resistencias reales no se puede clasificar, así que el
canal avisa «ocular sin clasificar» con el valor crudo en lugar de inventar una clave. Con eso el
propio instrumento sirve para tomar la medida.

Se eliminó el botón de emparejar del panel.

### Herramientas de placa

- `subir.ps1` compila y carga cualquier sketch por la ventana del gestor de arranque, sin depender
  del puerto COM ni del IDE.
- `rescate/` deja una placa muda para poder programarla cuando un sketch de teclado la vuelve
  inoperable.
- `device-lab` gana una sonda de teclado, que mide caudal y distribución, y un volcado de
  descriptores USB.

## 2026-08-19 — Repaso de pendientes

El backlog sale del repo. Los problemas abiertos se siguen en el gestor de issues, y los documentos
de referencia describen sólo lo que existe.

Cerrados por verificación en el aparato: el clamp de altitud a 85° (el dispositivo se comporta bien
en elevaciones altas y el prototipo físico no llega tan arriba), la entrada del Arduino en `kiosk`
(las teclas `+` y `-` responden), la IP estática del principal, y mover el enfocador al dispositivo
de control, que no aplica porque ese dispositivo es externo y remoto.

Cerrada también la reconexión sin gesto del enfocador. Perder la conexión exige desenchufar el cable
o reiniciar la placa, o sea pasos de montaje, no fallos espontáneos. El plan B por teclado queda
abierto sólo por si resulta molesto en uso real.

La referencia de norte quedó resuelta a favor del magnetómetro, que entrega norte real, y en el
camino apareció un error de 180° en acimut: el eje óptico está declarado como `'+y'` cuando el
teléfono apunta por su parte baja, o sea `'-y'`.

El desfase del guía en desarrollo quedó anotado en el README: es una rareza del entorno, no una
tarea.

Los cuatro problemas del arranque de `kiosk` —rama de deploy, comandos de build, empaquetado de
catálogos y modo `development`— se condensaron en uno solo, porque los cuatro se resuelven
replicando la arquitectura de arranque de `dual-telescope`.

## 2026-08-19 — Verificaciones en producción y decisiones de hardware

Verificado en el prototipo desplegado: el emparejamiento por QR funciona, y la latencia con dos
motores WASM y un teléfono haciendo de punto de acceso es buena. En desarrollo el guía va con algo
de desfase, atribuible a que ahí la topología es otra.

**La transformación newtoniana ya está cubierta.** Un newtoniano refleja dos veces, en el primario y
en el secundario, así que la imagen sale rotada 180° y no reflejada. Por ser una rotación pura se
compone con la rotación del montaje en un solo valor, que es el control que el panel ya tiene. El
glosario lo decía mal.

**El cambio de ocular no usará RFID.** Se resolverá con señales eléctricas leídas por el Arduino. Se
eliminaron las referencias, incluido el stub de `createSerialConnector` en `core`, cuya premisa
estaba doblemente muerta: Web Serial no existe en Android y el RFID quedó descartado. No lo usaba
ninguna app.

## 2026-08-18 — Montaje, orientación y emparejamiento

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

### Montaje del ocular

- Rotación del canvas a 270°, la posición física real del teléfono.
- El alto de la vista queda fijo en 50 %, medido contra el ocular. Deja de ser un ajuste.
- Altura invertida y acimut sin tocar, medido en el montaje. Va en `mountingTransform`, que es el
  ajuste que cambia con cada prototipo.
- La vista se puede desplazar a lo largo de la pantalla, para iterar el calce sin volver a montar.
- Deslizador de zoom. El controlador ahora recibe `getLogFov` real; antes quedaba en el valor por
  defecto y el zoom no influía en nada.

### Montaje del guía

La UI del guía reutiliza la del ocular parametrizada por rol, en vez de existir dos veces. La vista
se recorta y queda arriba, con el tamaño ajustable, que es el reparto inverso al del ocular: allá el
tamaño es fijo y la posición móvil.

En pantalla de escritorio el guía va a pantalla completa. El recorte existe por la ubicación física
del teléfono y no tiene sentido cuando se deja el guía abierto en el monitor durante el desarrollo.

Qué controles aparecen depende del rol y de si lleva los sensores, así que el panel se arma después
de `fetchLinkConfig()`. Una clave de `localStorage` por rol: en desarrollo las dos páginas se abren
en el mismo navegador, o sea el mismo origen.

El CSS de la UI estaba duplicado en los dos HTML y pasó a `src/ui.css`.

### Emparejamiento

- El dev server imprime las dos URLs con el rol al lado, ya resueltas al puerto real, así que
  `/guide.html` deja de escribirse a mano.
- La IPv4 de LAN del principal se detecta con `os.networkInterfaces()` y se publica en
  `/link-config`. El panel del ocular la muestra como QR, oculto detrás de un interruptor porque un
  código legible ocupa casi todo el panel.
- Se publican todas las interfaces: el teléfono puede tener a la vez la del punto de acceso y una de
  wifi, y tocar el QR las recorre.
- `start.sh` dejó de adivinar la IP. `ip route get` y `hostname -i` devuelven loopback en Termux, o
  sea una dirección que el guía no puede alcanzar aunque este equipo sea el punto de acceso.

El QR se genera con `qrcode-generator`, sin dependencias y empaquetada local. `web-app` la carga de
un CDN, lo cual acá no sirve.

### El panel es de depuración

No es interfaz de producto, igual que el de `kiosk`. Los controles que existían para encontrar un
valor desaparecieron al encontrarlo: el suavizado quedó en `0.10` y la zona dinámica activa con
umbral `0.06`, ambos como constantes en el código.

Sacarlos de los ajustes era la parte que importaba: mientras vivieran ahí se guardaban en
`localStorage`, y un valor viejo guardado le habría ganado al del código sin que se notara.

`setSmoothing()` y `setDynamicThreshold()` en `core` permiten cambiarlos en caliente. Hoy no los usa
ninguna app; existen porque encontrar estos valores exige moverlos con el instrumento apuntando a
algo, y eso hará falta otra vez con el próximo montaje.

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
