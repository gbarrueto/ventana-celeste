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

0. **Experimento de sensores con roll de 90°** (§5.1). Es lo único que bloquea el diseño.
1. **Scaffold** `apps/dual-telescope`: Vite + Svelte, dos entradas, `@ventanaceleste/core` como
   dependencia de workspace. Sin lógica.
2. **Transporte**: `createWebSocketTransport` + servidor mínimo. Criterio de éxito: un `{msg,
   values}` de ida y vuelta entre dos navegadores, usando el `messageBus` sin tocarlo.
3. **Rol con sensores**: engine + óptica + orientación + emisión.
4. **Rol receptor**: engine + recepción + FOV fijo amplio + interpolación en el receptor.
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

### 5.1 · Dónde viven los sensores — y la condición de contexto seguro

**Bloqueante, y ahora es un experimento concreto, no un debate.** El Ocular va montado con un
**roll de 90°** respecto del tubo (diseño newtoniano). Hay que **investigar cómo se comportan los
sensores en esa orientación**: si la fusión gyro + `RelativeOrientationSensor` se degrada ahí, la
salida es poner los sensores en el **buscador** y que ese sea la fuente de orientación.

De eso dependen: los valores de `mountingTransform` de cada rol, la dirección del flujo, y si hace
falta extender `orientation/` para exponer **roll** (hoy `core` emite solo `yaw`/`pitch`; el dato
está en el quaternion, es superficie de API, no un problema de sensores).

**Condición que hay que respetar en cualquiera de las dos ramas:**

> El dispositivo que lleva los sensores tiene que ser **el que corre el servidor**, para servirse a
> sí mismo por `http://localhost` — que el navegador ya trata como contexto seguro. El otro
> dispositivo, sin sensores, puede recibir la página por HTTP plano sin problema.
>
> Si en cambio el dispositivo con sensores recibiera su página del otro por IP de LAN, esa página
> **no** sería contexto seguro y los sensores no devolverían nada — el mismo fallo silencioso que
> ya costó tiempo en `web-app` y en `kiosk`. Ahí volverían HTTPS y `wss://`, con certificado en
> una IP de LAN.

Hoy las respuestas encajan (sensores en el Ocular, servidor en el Ocular). Si el experimento mueve
los sensores al buscador, **hay que mover el servidor con ellos**, no agregar HTTPS.

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

### 5.3 · Rendimiento en la topología real

Dos motores WASM y un teléfono haciendo de AP. Hay un riesgo ya documentado en `Architecture.md`
sobre exactamente esta configuración. **Se decide midiendo**, en el paso 5, antes de sumar
hardware.

## 6. Criterio de "listo" por paso

Ningún paso se cierra sin algo observable: el transporte con un mensaje de ida y vuelta, el
receptor con el cielo moviéndose al mover el otro teléfono, el hardware con una tarjeta RFID
cambiando el FOV. Los dos bugs de `onView` (`{yaw,pitch}` vs `{h,v}`) pasaron desapercibidos
justamente porque "compila" no es evidencia de que el dato llegue.
