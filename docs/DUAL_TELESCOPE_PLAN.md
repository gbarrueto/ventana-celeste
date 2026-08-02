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

## 1. Qué se re-cablea (inventario honesto)

| Pieza de `core` | Rol en `dual-telescope` | Estado |
|---|---|---|
| `time/` | Reloj de simulación, sincronizado desde el Principal | **Tal cual** |
| `telescope/` | Óptica: focal, magnificación, FOV desde ocular, NELM/Bortle | **Tal cual** |
| `engine/` | Bootstrap de Stellarium en **ambos** teléfonos | **Tal cual** (con `strict` y paths locales) |
| `config/` | Modos por entorno | **Tal cual** (ojo el trap de MODE, §4.6) |
| `orientation/` | Lectura de sensores en el dispositivo que sea la fuente | **Tal cual salvo roll** (§4.4) |
| `sync/messageBus` | Mismo contrato `{msg, values}` | **Tal cual**; falta el adapter |
| `sync/` transport | Transporte WebSocket | **Falta** — es la pieza nueva principal |
| `io/createKeyboardConnector` | Entrada por HID si se sigue esa vía | **Tal cual** |
| `io/createSerialConnector` | RFID + potenciómetro | **Stub** — y quizá inviable (§4.3) |

Lo que **no** existe todavía y hay que decidir si se crea: `packages/shared-viewer` (§4.11).

## 2. Qué es genuinamente nuevo

1. **`createWebSocketTransport()`** en `core/sync/` — implementa el mismo contrato de tres
   métodos que `createProtobjectTransport`. Es literalmente lo único que el `messageBus`
   necesita para cambiar de transporte.
2. **Un servidor** en el Principal que sirva los estáticos y hable WS (§4.6).
3. **Dos roles/entradas** en la app: Ocular (Principal) y Guía (Secundario) (§4.5).
4. **Integración de hardware real** (RFID + potenciómetro), condicionada a §4.3.
5. **Empaquetado offline** de los catálogos, hoy pendiente para `kiosk` también.

## 3. Pasos propuestos

Cada paso deja el repo buildeable y algo verificable a mano, igual que la extracción de `core`.

0. **Resolver los bloqueantes de §4.1–4.4.** No es papeleo: cambian qué se cablea.
1. **Scaffold** `apps/dual-telescope`: Vite + Svelte, dos entradas, `@ventanaceleste/core` como
   dependencia de workspace. Sin lógica. Verifica que el andamiaje compila.
2. **Transporte**: `createWebSocketTransport` + servidor mínimo. Criterio de éxito: un `{msg,
   values}` de ida y vuelta entre dos navegadores, usando el `messageBus` sin tocarlo.
3. **Rol Ocular**: engine + óptica + (según §4.1) sensores, y emisión de orientación.
4. **Rol Guía**: engine + recepción + FOV fijo amplio + interpolación en el receptor.
5. **Medir latencia y fluidez en la topología real** (teléfono como AP), *antes* de sumar
   hardware. Es el riesgo #1 ya documentado en `Architecture.md`, y es el que puede obligar a
   rediseñar el canal.
6. **Hardware** según lo que resuelva §4.3.
7. **Offline**: catálogos locales + modo producción real.
8. **Recién ahí**, evaluar si `shared-viewer` tiene sentido (§4.11).

## 4. Lo que hay que clarificar antes de cablear

### Bloqueantes

**4.1 · ¿Qué dispositivo lee el cielo?**
`Architecture.md` §2 dice que la orientación va del Principal al Secundario. En la conversación
de diseño surgió lo contrario: el Guía apunta a donde apunta el tubo, mientras que el Ocular
apunta con la parte trasera del teléfono y necesita transformación. **Esta decisión determina
4.2, los valores de `mountingTransform` de cada rol y la dirección del flujo.** `core` no toma
partido a propósito — pero la app sí tiene que hacerlo. Hay que corregir `Architecture.md` §2 en
consecuencia.

**4.2 · ¿El Secundario necesita sensores? → ¿la app necesita HTTPS?**
Si el dispositivo que lee el cielo es el que **recibe la página desde el otro teléfono**, entonces
esa página necesita ser **contexto seguro** o los sensores no entregan nada (mismo fallo silencioso
que ya nos costó tiempo en `web-app` y en `kiosk`). Y `http://localhost` no salva aquí: solo aplica
al teléfono que se sirve a sí mismo, no al remoto, que entra por IP de LAN.

Consecuencias si la respuesta es "sí":
- El servidor del Principal tiene que servir **HTTPS**, no HTTP.
- Y por lo tanto **`wss://`**, no `ws://`: una página `https://` no puede abrir un WebSocket en
  claro (mixed content).
- Certificado en una IP de LAN: o se acepta la advertencia en cada arranque, o se usa `mkcert`
  con su CA instalada una vez en ambos teléfonos (funciona offline y sin advertencia).

**4.3 · ¿Web Serial existe en el navegador de estos teléfonos?**
El plan asume RFID + potenciómetro por Web Serial. **Hay que verificarlo antes de diseñar nada
alrededor**: Web Serial es, hasta donde sabemos, una API de escritorio y no está disponible en
Chrome para Android. Si se confirma que no está:
- seguir con el Arduino como **teclado HID**, que ya funciona y ya tiene conector en `core`; o
- **WebUSB**, si aplica al dispositivo; o
- un **puente en Termux**: un proceso lee el serial y lo reenvía al navegador por el mismo
  WS/HTTP local que ya vamos a tener.
La opción que se elija cambia si `createSerialConnector` se implementa o se archiva, y hay que
corregir `Architecture.md` §5 si el supuesto no se sostiene.

**4.4 · ¿Se necesita roll?**
`Architecture.md` §2 sincroniza "Alt / Az / **Roll**", pero `core` **no produce roll**: `onCoords`
y `onView` emiten solo `yaw`/`pitch`. Si el roll hace falta de verdad (rotación de campo), hay que
extender `orientation/` — el dato está disponible en el quaternion del `RelativeOrientationSensor`,
no es un problema de sensores sino de superficie de API. Si no hace falta, hay que sacarlo del
documento para que nadie lo implemente por inercia.

### Estructurales

**4.5 · ¿Una app con dos entradas, o dos apps?**
Recomendación: **una app, dos páginas** (`index.html` + `guide.html`), como ya hace `web-app` con
su build multipágina. Comparten stores, engine y óptica; se diferencian en qué conectan. Dos apps
duplicarían wiring por una diferencia de rol.

**4.6 · ¿Qué proceso corre el servidor?**
El dev server de Vite no sirve WS propio sin un plugin. Opciones: un proceso Node aparte, un
plugin de Vite para desarrollo, o un servidor propio que en producción sirva también los
estáticos. Decidir temprano porque condiciona cómo se arranca en el dispositivo — y recordar que
en Termux `pnpm run dev` implica modo `development` (ver pendiente en
[`CHANGELOG.md`](CHANGELOG.md)).

**4.7 · ¿Quién es la autoridad de tiempo y ubicación?**
Presumiblemente el Principal, con handshake JSON al conectar y re-sync periódico. Falta definir
qué pasa si el Guía arranca primero.

**4.8 · ¿Formato del payload?**
§5 pide binario/TypedArray para la orientación. El `messageBus` hoy mueve `{msg, values}`.
Recomendación: **empezar en JSON y medir**; agregar un fast-path binario solo si el número lo
justifica. Optimizar el canal antes de tener una medición es exactamente lo que nos hizo perder
tiempo persiguiendo lag que era de red.

**4.9 · ¿Liveness y reconexión?**
A diferencia de Protobject, WebSocket **sí** tiene `close`/`error` nativos, así que no hace falta
el heartbeat que tuvimos que inventar en `web-app`. Recomendación: eventos nativos + reconexión
con backoff, y sumar un monitor tipo `createPeerMonitor` solo si aparece el caso "conectado pero
mudo". Si se necesita, esa pieza se promueve de `web-app` a `core`.

**4.10 · ¿Cómo llegan los catálogos a cada teléfono?**
Los packs locales siguen sin empaquetar. ¿Cada teléfono tiene su copia, o el Guía los descarga del
Principal? Descargarlos por el hotspot compite con la orientación por el mismo medio.

**4.11 · ¿`shared-viewer` ahora o después?**
Recomendación: **después**. Hoy hay un solo "visor pasivo" real (el de `web-app`); extraer un
paquete a partir de un caso y medio es adivinar. Cuando el Guía funcione, comparar los dos y
extraer lo que de verdad coincida.

### De producto y hardware

- **4.12** Mapeo RFID → focal/FOV: qué tag corresponde a qué ocular.
- **4.13** Curva potenciómetro → blur de enfoque.
- **4.14** FOV fijo del Guía (~5°–8°): ¿configurable o cerrado?
- **4.15** Montaje físico de cada teléfono respecto al tubo → valores concretos de
  `mountingTransform` (para esto existe el parámetro).
- **4.16** Qué muestra el Guía si el Principal desaparece.
- **4.17** Rendimiento: dos motores WASM + teléfono haciendo de AP. Ya hay un riesgo documentado
  en `Architecture.md` sobre esta topología exacta.

## 5. Criterio de "listo" por paso

Ningún paso se da por cerrado sin algo observable: el transporte con un mensaje de ida y vuelta,
el Guía con el cielo moviéndose al mover el otro teléfono, el hardware con una lectura real
cambiando el FOV. Los dos bugs de `onView` (`{yaw,pitch}` vs `{h,v}`) pasaron desapercibidos
justamente porque "compila" no es evidencia de que el dato llegue.
