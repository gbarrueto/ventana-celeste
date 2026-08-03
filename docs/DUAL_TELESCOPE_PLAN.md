# Plan — `dual-telescope` (prototipo mediado)

Plan de construcción de la tercera app: el prototipo avanzado de dos pantallas sincronizadas,
100% offline, que requiere alguien que lo explique mientras se usa (de ahí "mediado").

Visión de producto y tabla de sincronización: [`Architecture.md`](Architecture.md) §2.
Piezas disponibles: [`../packages/core/README.md`](../packages/core/README.md).

> **Filosofía: re-cablear, no re-escribir.** El objetivo de haber partido el repo original en
> piezas fue exactamente este momento. Si algo hay que escribir de cero, primero hay que
> preguntarse por qué la pieza existente no encaja — y si la respuesta es "casi encaja", la
> salida suele ser un parámetro, no una copia.

---

## 1. Qué se re-cablea

| Pieza de `core` | Rol en `dual-telescope` | Estado |
|---|---|---|
| `time/` | Reloj de simulación, sincronizado desde el Principal | **Tal cual** |
| `telescope/` | Óptica: focal, magnificación, FOV desde ocular, NELM/Bortle | **Tal cual** |
| `engine/` | Bootstrap de Stellarium en **ambos** teléfonos | **Tal cual** — el Guía usa `extended: false` |
| `config/` | Modos por entorno | **Tal cual** (ojo el trap de MODE, §5.2) |
| `orientation/` | Lectura de sensores en el dispositivo que resulte fuente | **Tal cual** salvo roll (§5.1) |
| `sync/messageBus` | Mismo contrato `{msg, values}`, payload JSON | **Tal cual** |
| `io/createKeyboardConnector` | RFID → pulsación de tecla, igual que `kiosk` | **Tal cual** |
| `sync/` transport | Transporte WebSocket | **Falta** — la pieza nueva principal |
| `io/createSerialConnector` | — | **Archivar** (§4.3) |

## 2. Qué es genuinamente nuevo

1. **`createWebSocketTransport()`** en `core/sync/` — implementa el mismo contrato de tres
   métodos que `createProtobjectTransport`. Es lo único que el `messageBus` necesita para cambiar
   de transporte.
2. **Un servidor** en el Principal que sirva los estáticos y hable WS (§5.2).
3. **Dos entradas** en la app: Ocular y Guía (§4.5).
4. **Empaquetado offline** de los catálogos — pendiente también para `kiosk`.

Nótese lo que **no** está en esta lista: no hay que implementar Web Serial (§4.3), ni un
heartbeat (§4.9), ni catálogos completos en el Guía (§4.10). Tres cosas que el plan original daba
por nuevas y resultaron ser re-cableado.

## 3. Pasos propuestos

Cada paso deja el repo buildeable y algo verificable a mano.

0. ~~Experimento de sensores con roll de 90°~~ — **HECHO** (§5.1). El Ocular queda como fuente.
1. **Scaffold** `apps/dual-telescope`: Vite + Svelte, dos entradas, `@ventanaceleste/core` como
   dependencia de workspace. Sin lógica.
2. **Transporte**: `createWebSocketTransport` + servidor mínimo. Criterio de éxito: un `{msg,
   values}` de ida y vuelta entre dos navegadores, usando el `messageBus` sin tocarlo.
3. ~~**Rol con sensores**: engine + orientación + emisión~~ — **HECHO**. Modo vector, eje `+y`.
4. ~~**Rol receptor**: engine + recepción + FOV amplio + interpolación~~ — **HECHO**.
5. **Medir latencia y fluidez en la topología real** (teléfono como AP), *antes* de sumar
   hardware (§5.3). Es el riesgo ya documentado en `Architecture.md`.
6. **Hardware**: cablear `createKeyboardConnector` a las teclas del lector RFID.
7. **Offline**: catálogos locales + arranque en el dispositivo (§5.2).
8. **Recién ahí**, evaluar si `shared-viewer` tiene sentido.

## 4. Decisiones tomadas

**4.2 · El Secundario no lleva sensores.** Recibe el movimiento del otro dispositivo. Esto
**elimina el requisito de HTTPS** que el plan original anticipaba — con una condición importante,
en §5.1.

**4.3 · No se usa Web Serial.** Era una suposición heredada, no un requisito. El lector RFID es
una placa que **manda una pulsación de tecla**, exactamente como ya funciona en `kiosk`: tarjetas
distintas en una ranura que las lee. Se re-cablea `createKeyboardConnector` y se **archiva**
`createSerialConnector`. Hay que corregir `Architecture.md`, que habla de Serial.

**4.5 · Una app, dos páginas.** Como `web-app` con su build multipágina. Comparten stores, engine
y óptica; difieren en qué conectan.

**4.7 · El Principal es la autoridad** de tiempo y ubicación. Si el Guía arranca primero,
**reintenta cada X segundos** hasta conectar y sincronizar.

**4.8 · Payload JSON.** Sin fast-path binario por ahora; se revisa si una medición lo justifica.

**4.9 · Sin heartbeats.** WebSocket tiene `close`/`error` nativos, a diferencia de Protobject.
Eventos nativos + reconexión con backoff.

**4.10 · El Guía solo necesita datos mínimos**, no los catálogos completos — coherente con su FOV
amplio y fijo. Esto ya es un parámetro existente: `initializeStellariumEngine({ extended: false })`,
la misma distinción que hoy separa al visor del telescopio en `web-app`. Reduce mucho lo que haya
que transferir o empaquetar para el Guía.

**4.11 · `shared-viewer` más adelante**, cuando haya un segundo consumidor real con el que
comparar.

**4.12 · Mapeo RFID → ocular: por pulsación de tecla.** En `kiosk` el mapa vigente es
`1 → ojo humano`, `2 → 40 mm`, `3 → 6 mm`, `4 → 0,5 mm` (y `5–8` repiten los mismos cuatro
valores). Se reutiliza tal cual.

**4.13 · Enfoque/potenciómetro: igual que `web-app`.**

**4.14 · FOV del Guía: cerrado, con los mismos valores que `web-app`** (`MIN_FOV`/`MAX_FOV` y
`FOCAL_LENGTH = 1200` viven en sus stores).

**4.16 · Si el Principal desaparece**, el Guía muestra "Reintentando conexión…" y sigue
reintentando (mismo mecanismo que §4.7).

## 5. Lo que sigue abierto

### 5.1 · Dónde viven los sensores — RESUELTO

**Medido en dispositivo (2026-08-02), resuelto: los sensores están bien, lo que fallaba era la
descomposición.** En el montaje del ocular el ángulo medio da **−89,8°**, o sea prácticamente
sobre la singularidad de la descomposición Euler. Ahí las mismas muestras dan un jitter ~240×
mayor que descompuestas fuera de la singularidad (3,877 vs 0,016 °RMS), contra una línea base de
0,001 apoyado en la mesa. El sensor en sí es excelente.

**Consecuencias:**
- **El Ocular sigue siendo la fuente de orientación.** No hace falta mover los sensores al
  buscador, y por lo tanto tampoco mover el servidor ni agregar HTTPS.
- `core` ganó la opción **`mountQuaternion`**: rota el quaternion *antes* de descomponerlo.
  `mountingTransform` no podía hacer este trabajo porque corre *después* — sobre valores ya
  degenerados.
- **Roll:** sigue sin necesitarse en `core` para esto. Queda pendiente decidir si el modelo dual
  lo requiere por otro motivo (§4.4 de `Architecture.md`).
- Pendiente menor, de ajuste y no de diseño: el pre-giro permuta qué eje sale por cada ángulo
  (paneo E–O aparece como N–S). Eso sí es trabajo de `mountingTransform`, y el banco de pruebas
  (`apps/orientation-lab/sky.html`) tiene toggles en vivo para encontrar la combinación.

**Condición que hay que respetar en cualquiera de las dos ramas:**

> El dispositivo que lleva los sensores tiene que ser **el que corre el servidor**, para servirse a
> sí mismo por `http://localhost` — que el navegador ya trata como contexto seguro. El otro
> dispositivo, sin sensores, puede recibir la página por HTTP plano sin problema.
>
> Si en cambio el dispositivo con sensores recibiera su página del otro por IP de LAN, esa página
> **no** sería contexto seguro y los sensores no devolverían nada — el mismo fallo silencioso que
> ya costó tiempo en `web-app` y en `kiosk`. Ahí volverían HTTPS y `wss://`, con certificado en
> una IP de LAN.

Las respuestas encajan: sensores en el Ocular, servidor en el Ocular. La condición queda
documentada por si alguna vez se mueven los sensores — habría que mover el servidor con ellos, no
agregar HTTPS.

### 5.1a · Apuntado por vector — hallazgos en dispositivo (2026-08-03)

- **Eje óptico: `+y`.** Es el vector del dispositivo que apunta por el tubo, y con él el apuntado
  se comporta correctamente. Sustituye a todo el problema de mapeo elevación-dependiente: el
  montaje pasa a ser **una constante**, no una reasignación de ángulos.
- **Límite operativo ~85° de altitud.** Pasado eso se vuelve casi incontrolable. No es un defecto
  del mapeo: es la degeneración real del alt-az, el azimut deja de estar definido en el cenit.
  Vale evaluar **limitarlo por software** a 85° para que el instrumento se siente firme en vez de
  errático — hay un toggle en el banco de pruebas para probarlo antes de decidir.
- **El azimut no tiene norte.** `RelativeOrientationSensor` es giroscopio + acelerómetro, **sin
  magnetómetro**: la gravedad ancla altitud, pero el origen del azimut es arbitrario. Por eso
  apuntando al este puede mostrar norte. Ver §5.1d.

### 5.1d · Referencia de norte (azimut absoluto)

Dos caminos, y conviene medir antes de elegir:

1. **`AbsoluteOrientationSensor`** — suma el magnetómetro y da norte magnético real. Costos:
   requiere calibración de brújula, y se degrada cerca de metal. El tubo del telescopio *es*
   metálico, así que hay que comprobar si sirve en el montaje real y no sólo sobre una mesa. Hay
   un selector en el banco de pruebas para compararlo contra el sensor actual.
2. **Alineación manual, una vez.** Es lo que hacen los telescopios de verdad: se apunta a algo
   conocido y se guarda el offset. Encaja con que el prototipo sea *mediado* — hay alguien
   operándolo que puede hacer la alineación inicial — y es inmune al metal y al interior.

**Resuelto (2026-08-03): las dos.** El magnetómetro funciona bien, así que
`AbsoluteOrientationSensor` da la referencia de norte de arranque. Y la **calibración de norte
queda como funcionalidad** del producto, no como plan B: es lo que hacen los telescopios reales,
cubre el caso de que el magnetómetro se degrade cerca del metal del tubo, y encaja con que el
prototipo sea mediado — hay alguien que puede alinear al empezar.

Falta definir la interacción de esa calibración (apuntar a algo conocido y confirmar) y dónde se
guarda el offset.

### 5.1b · Transformación del canvas para vista newtoniana

Pendiente, anotado para no perderlo: la vista por un newtoniano llega **rotada y con una
reflexión** respecto de lo que se ve a ojo desnudo. Eso es una transformación del *canvas*
(render), no de la orientación — es independiente de `mountQuaternion` y de `mountingTransform`,
y hay que resolverla aparte para que la imagen coincida con lo que la persona ve por el ocular.

### 5.1c · Camino del giroscopio con montaje rotado

`mountQuaternion` corrige el camino del quaternion (modo `relative`). El camino de **integración
del giroscopio**, que se usa con FOV angosto, lee los ejes crudos del dispositivo, que también
están rotados por el montaje — necesita su propia corrección del vector de velocidad angular. El
banco de pruebas se fija a modo `relative` a propósito para no mezclar las dos cosas.

### 5.2 · Cómo se arranca en el dispositivo

El servidor corre en el Principal y sirve también los estáticos. El precedente es `kiosk`: Termux
+ un script `.sh` que levanta las dos cosas, y el flujo de trabajo es *push* desde la PC y *pull*
desde el teléfono — cómodo y ya probado.

Vale evaluar alternativas más sólidas **siempre que no pierdan esa comodidad**: por ejemplo
instalar la app como PWA, empaquetarla en un contenedor nativo, o `Termux:Boot` para que levante
sola. Criterio: que actualizar siga siendo tan simple como hoy.

Recordar el trap de modo: en Termux `pnpm run dev` implica modo `development`, así que la config
que se carga es la de desarrollo (ver pendientes en [`CHANGELOG.md`](CHANGELOG.md)).

### 5.2b · Qué dispositivo es la fuente de sensores (configurable)

Si las pruebas de montaje no terminan de convencer, hay que poder mover la fuente de orientación
al Secundario **sin tocar código**. Diseño propuesto, coherente con "el que corre el script es el
principal":

- El relay lee una variable de entorno (`SENSOR_SOURCE`, por defecto `ocular`) que el script de
  arranque fija.
- El relay la expone en un endpoint chico (`GET /link-config` → `{ "sensorSource": "ocular" }`).
- Cada página la consulta al cargar y decide su papel: la que coincide enciende los sensores y
  emite; la otra sólo recibe.

Así el topology switch es **un flag en el script**, no una edición en dos páginas. Y respeta la
condición de §5.1: el dispositivo con sensores es el que corre el servidor, así que se sirve a sí
mismo por `localhost` y no hace falta HTTPS.

### 5.2c · Cómo se despliega y se actualiza

Hoy: Termux + `git pull` + un `.sh` que levanta todo. Es cómodo y ya está probado; el objetivo es
mantener esa comodidad y ganar solidez, no reemplazarla por ceremonia.

**Problema principal a evitar: compilar en el teléfono.** El build es lento en Android y es la
razón de que `kiosk` necesite `NODE_OPTIONS=--max-old-space-size=1536`. Conviene que el teléfono
**no** compile.

Comparación detallada de stack y rutina para decidir: [`DEPLOYMENT.md`](DEPLOYMENT.md).
Descartados el APK y los add-ons de Termux (Boot/Widget).

Ruta recomendada, de menor a mayor esfuerzo:

1. **Compilar en la PC, el dispositivo sólo baja artefactos.** El teléfono no necesita toolchain:
   alcanza con Node + el relay, que ya sabe servir `dist/`. El `dist` se publica en una rama de
   deploy o como artefacto, y el dispositivo hace `git pull` de eso. Rutina de trabajo:
   *editar en PC → probar en PC → build → publicar → `pull` + reiniciar en el teléfono.*
2. **`Termux:Boot`** para que el servicio levante solo al encender el dispositivo, y
   **`Termux:Widget`** para tener un acceso de un toque en la pantalla de inicio. Elimina el paso
   de abrir Termux y tipear.
3. **Instalar la app como PWA** desde el propio servidor: pantalla completa, ícono propio, y sin
   barra del navegador. Sigue necesitando el relay corriendo, así que complementa a (1) y (2), no
   los reemplaza.
4. **Envoltorio nativo (APK)** sólo si hace falta distribuirlo a terceros. Da la instalación más
   sólida, pero suma build, firma y distribución — y el servidor WebSocket sigue teniendo que
   correr en algún lado, así que no ahorra el punto (1).

Criterio para elegir: cualquier alternativa tiene que dejar el ciclo de actualización tan simple
como el actual (*push* desde la PC, *pull* en el dispositivo). Si lo complica, no vale la pena.

### 5.2d · Catálogos: por ahora, desde los servidores remotos

Todavía no hay copia local de los catálogos ni del resto de los datos, así que **para la primera
prueba integral se usan las fuentes online**, igual que hace `kiosk` hoy (sus paths locales siguen
comentados en la config).

Esto no contradice el objetivo offline: la red se usa para *preparar*, no para *operar*. Pero
implica dos cosas concretas para la prueba: hace falta conexión mientras se cargan los catálogos,
y el Guía conviene que arranque con `extended: false` (§4.10), que ya pide bastante menos datos.

El empaquetado local sigue pendiente, y es compartido con `kiosk` (ver Pendientes en
[`CHANGELOG.md`](CHANGELOG.md)).

### 5.3 · Rendimiento en la topología real

Dos motores WASM y un teléfono haciendo de AP. Hay un riesgo ya documentado en `Architecture.md`
sobre exactamente esta configuración. **Se decide midiendo**, en el paso 5, antes de sumar
hardware.

## 6. Criterio de "listo" por paso

Ningún paso se cierra sin algo observable: el transporte con un mensaje de ida y vuelta, el
receptor con el cielo moviéndose al mover el otro teléfono, el hardware con una tarjeta RFID
cambiando el FOV. Los dos bugs de `onView` (`{yaw,pitch}` vs `{h,v}`) pasaron desapercibidos
justamente porque "compila" no es evidencia de que el dato llegue.
