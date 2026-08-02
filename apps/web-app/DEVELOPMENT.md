# Desarrollo — `web-app`

Recomendaciones para levantar y probar esta app, en particular el emparejamiento
visor↔teléfono, que es la parte que históricamente más problemas dio.

> Guía específica de `web-app`. Las otras apps del monorepo tendrán la suya cuando se trabaje
> en ellas; nada de aquí se puede asumir válido para `kiosk-standalone`, que no usa Protobject.

## Arranque

Desde la raíz del monorepo:

```bash
pnpm install
pnpm --filter @ventanaceleste/web-app dev
```

Dos cosas que ya vienen resueltas en `vite.config.js` y conviene no romper:

- **HTTPS** vía `@vitejs/plugin-basic-ssl`. No es opcional: los sensores de orientación
  requieren *contexto seguro*, así que sobre HTTP plano el teléfono carga la página pero no
  entrega lecturas. El certificado es autofirmado, así que tanto el navegador del host como el
  del teléfono van a mostrar una advertencia que hay que aceptar una vez.
- **`server.host: true`**, o sea escucha en todas las interfaces. No hace falta pasar `--host`.

La app tiene dos páginas: `index.html` (visor) y `telescope.html` (teléfono/control). `p.js`
inyecta un `ptjuid` en la URL del visor, y el visor lo copia al QR que escanea el teléfono.

## La regla que manda: los dos peers necesitan el mismo origen

Protobject empareja por **origen**, no solo por `ptjuid`. Si el visor y el teléfono no cargan
desde el mismo **scheme + host + puerto**, no se conectan nunca — aunque el `ptjuid` coincida y
aunque las dos direcciones sean perfectamente alcanzables. Ver
[ADR 0001](../../docs/adr/0001-protobject-peers-must-share-an-origin.md).

Que una dirección sea alcanzable no alcanza. Tienen que ser *la misma cadena*.

Todo lo de abajo se reduce a cómo cumplir eso.

## Recomendado: dev server nativo en el host + LAN

1. Correr el dev server **nativo en el sistema operativo del host**, no dentro de WSL ni de una VM.
2. Abrir el visor en `https://<IP-LAN-del-host>:<puerto>/index.html` — **no** en `localhost`.
3. Escanear el QR con el teléfono.

Como el visor se cargó desde la IP LAN, `window.location.host` ya es esa dirección y el QR apunta
al mismo origen sin configurar nada. Los dos peers comparten origen y emparejan.

Requisito: que el firewall del host permita ese puerto entrante desde la red local.

## Evitar: dev server dentro de WSL (o de una VM) + teléfono en la LAN

Esta combinación **no puede funcionar**, y falla de la peor manera: en silencio.

Con WSL2 en `networkingMode=mirrored`, el host alcanza un server bindeado dentro de WSL solo por
`localhost`/`127.0.0.1`, nunca por su propia IP LAN. El teléfono es al revés: solo llega por la
IP LAN. Entonces el visor queda forzado a un origen `localhost` y el teléfono a otro, y caen en
sesiones distintas de Protobject. La página carga bien en el teléfono, el QR escanea bien, y no
pasa nada más.

Si aun así hay que exponer un puerto de WSL a la red, tener en cuenta que requiere una regla del
firewall de **Hyper-V** (`New-NetFirewallHyperVRule`), no solo del Windows Firewall normal.

## Si el desarrollo es en WSL/VM y no se quiere migrar

- **GitHub Codespaces o equivalente (recomendado).** Las dos páginas se sirven desde la misma URL
  reenviada, así que comparten origen *por construcción* y el problema no existe. Es la razón por
  la que el emparejamiento siempre funcionó ahí mientras fallaba en local.
- **Un túnel público** (tipo cloudflared/ngrok) apuntando al dev server: mismo efecto, ambos
  dispositivos entran por el mismo origen. Ten en cuenta que publica el dev server en Internet.
- **Opciones más pesadas**, si hace falta quedarse en la LAN: un `netsh portproxy` del lado de
  Windows, o un hostname que resuelva a loopback en el host y a la IP LAN en el teléfono
  (hosts + mDNS). Funcionan, pero agregan infraestructura que hay que mantener.

## Test rápido de la regla, sin teléfono

Para confirmar que un problema de conexión es de origen y no de código, alcanza con dos pestañas
en el mismo equipo, porque `localhost` y `127.0.0.1` son orígenes **distintos**:

1. Visor en `https://localhost:<puerto>/index.html` — anotar el `ptjuid` de la consola.
2. Telescope en `https://127.0.0.1:<puerto>/telescope.html?ptjuid=<el mismo>`.

No emparejan. Poniendo las dos en el mismo host sí. Es un diagnóstico de 30 segundos que separa
"problema de origen" de "problema de la app".

## La red afecta la fluidez de la orientación

La orientación se transmite a ~50 Hz (throttle de 20 ms sobre `updateView`), así que es lo primero
que se degrada cuando la red no da. Medido el 2026-07-27:

| Red | Resultado |
|---|---|
| Teléfono como hotspot (2.4 GHz), visor en un laptop conectado a ese hotspot | **Laggy**, en dos teléfonos distintos |
| Red Wi-Fi normal | **Fluido** |

No está aislado *qué* parte del hotspot es la culpable (el teléfono actuando de AP, la banda de
2.4 GHz, o congestión) — se cambió toda la red de una vez. Sí quedó descartado que sea la app
renderizando en el teléfono: la vista previa de Stellarium del modo avanzado corre fluida y no hay
diferencia perceptible entre modo simple y avanzado.

Dos cosas que conviene tener en cuenta:

- **Al debuggear "se siente laggy", descartar la red antes que el código.** Probar la misma app en
  una Wi-Fi distinta es más rápido que perseguir el pipeline de sensores.
- **No controlamos la red del usuario final.** Vale asumir que en producción va a haber gente con
  enlaces peores que el de desarrollo, así que la fluidez percibida no es solo cuestión de nuestro
  código. Si hace falta robustecerlo, el lugar es interpolar/predecir en el receptor (el visor),
  no subir la tasa de envío.

Para diagnosticar con números en vez de sensaciones: `chrome://webrtc-internals` en el visor
muestra el par de candidatos ICE elegido y las estadísticas del data channel. Un candidato `relay`
significa que el tráfico está pasando por un TURN externo en vez de ir directo por la LAN, lo cual
explicaría latencias altas por sí solo.

## Qué esperar al conectar

- El teléfono muestra **"Conectando…"** hasta que la conexión se confirma. A los 15 s sin
  conexión pasa a un error visible en pantalla.
- **La calibración arranca solo después** de conectar — a propósito. Si arranca antes, está
  calibrando contra un peer que puede no existir.
- El visor oculta el QR cuando recibe el mensaje `telescopeConnected`. No lo deduce de recibir
  datos de orientación: eso ataba la detección de conexión a que la calibración terminara, que es
  justo al revés.
- El visor muestra un **punto de estado** en la esquina superior derecha: verde conectado, rojo
  desconectado.

### Cuando se cae la conexión

`Protobject.Core` expone solo `onConnected` y `onReceived` — **no hay evento de desconexión**
(verificado contra el `p.js` que se sirve hoy). Así que la caída se detecta por **heartbeat**:
cada lado manda uno a 1 Hz y considera al peer perdido tras 2,5 s de silencio
(`src/lib/connection.js`). Un timeout además cubre casos que un evento de cierre no cubriría:
red caída, página congelada, pestaña en segundo plano.

El visor además cuenta cualquier `updateView` como señal de vida: la orientación ya llega a
~50 Hz mientras el teléfono transmite, así que la caída se nota por tráfico real y no por el
siguiente heartbeat perdido (detección ~1,5 s). El heartbeat sigue siendo el piso para los huecos
donde no fluye orientación — sobre todo la calibración, durante la cual `core` no envía ningún
`updateView` por varios segundos. Ese hueco es la razón de que el timeout no pueda bajar a ~1 s.

Se mantiene a 1 Hz con payload mínimo a propósito: comparte el data channel con la orientación a
~50 Hz, y ya se vio que saturar ese canal se siente como lag.

- **Si se cae el teléfono:** el visor vuelve a mostrar el QR, con el texto cambiado a
  "Se perdió la conexión" en vez del de bienvenida, y el punto pasa a rojo.
- **Si se cae el visor** (típicamente porque se recargó la página principal): el teléfono muestra
  "Se perdió la conexión" con un botón **Recargar**. Los sensores siguen corriendo, así que un
  corte breve se recupera solo, sin recalibrar.
- Si la app principal se **cerró y se volvió a abrir**, probablemente tenga un `ptjuid` nuevo: ahí
  recargar el teléfono no alcanza y hay que volver a escanear el QR. Los mensajes de ambos lados
  dicen justamente eso.

## Depurar en el teléfono

Protobject reenvía la consola del teléfono al visor, pero **solo después** de que exista
conexión. Todo lo que pase antes —incluido el motivo por el que no conecta— es invisible ahí.

Para eso está la consola en pantalla (`src/lib/debug-log.js`): activa en builds de dev, o en
cualquier build agregando `?debug=1`. Captura `console.*`, errores no atrapados y promesas
rechazadas, y al arrancar loguea el **origen** y el **`ptjuid`** de la página — precisamente los
dos datos que hay que comparar entre visor y teléfono cuando algo no empareja.

Útil cuando no hay depuración remota por USB disponible.

## Qué queda activo en producción

Auditado sobre un build real (`pnpm --filter @ventanaceleste/web-app build`):

- **La consola en pantalla (`debug-log.js`) queda desactivada.** `import.meta.env.DEV` se resuelve
  a `false` en el bundle de producción; la función de gate compila a un único chequeo de
  `?debug=1`. O sea que sigue existiendo la puerta de entrada manual — a propósito, porque es la
  única forma de diagnosticar un teléfono ya desplegado — pero no se activa sola.
- **El panel de debug de orientación NO está gateado por entorno.** Se abre con una pulsación
  larga de 5 s sobre el marco del buscador en modo avanzado (`AdvancedMode.svelte`), y eso sigue
  disponible en producción. Está oculto por defecto y requiere un gesto deliberado, así que
  funciona como herramienta de diagnóstico en campo — pero es una decisión, no un descuido:
  si no se quiere ahí, hay que gatearlo explícitamente.
- **Los `console.*` siguen en el bundle** (~11 en el de telescope, ~5 en el del visor). Importa
  más de lo habitual aquí: Protobject reenvía la consola del teléfono al visor **por el mismo data
  channel que la orientación**. Hoy son solo transiciones —el flood por lectura ya se corrigió—
  pero cualquier log nuevo que se agregue en un camino caliente se paga en ese canal, en
  producción. Vite no los elimina solo.

## El host del QR no se configura

`buildTelescopeUrl()` (en `src/viewer/Viewer.svelte`) construye el target del QR desde
`window.location.host`, o sea desde la dirección con la que se cargó el visor. Es a propósito y no
tiene override: como Protobject exige el mismo origen, el QR *tiene* que apuntar al mismo host que
el visor. Carga el visor en una dirección alcanzable desde la LAN y el teléfono cae en el mismo
origen solo.

Si el QR apunta a un host que el teléfono no alcanza, el problema es **desde dónde cargaste el
visor** (típicamente `localhost`), no la generación del QR.

> Existió una variable `VITE_LAN_HOST` para overridear ese host. Se eliminó: solo lograba que el
> teléfono pudiera *cargar* la página, nunca que emparejara, y un valor desactualizado apuntaba el
> QR a un host equivocado sin avisar. Si aparece en algún `.env.local` viejo, no hace nada.
