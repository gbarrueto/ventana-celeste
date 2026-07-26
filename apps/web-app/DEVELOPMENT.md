# Desarrollo — `web-app`

Recomendaciones para levantar y probar esta app, en particular el emparejamiento
visor↔teléfono, que es la parte que históricamente más problemas dio.

> Guía específica de `web-app`. Las otras apps del monorepo tendrán la suya cuando se trabaje
> en ellas; nada de acá se puede asumir válido para `kiosk-standalone`, que no usa Protobject.

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

Si igual hay que exponer un puerto de WSL a la red, tener en cuenta que requiere una regla del
firewall de **Hyper-V** (`New-NetFirewallHyperVRule`), no solo del Windows Firewall normal.

## Si trabajás en WSL/VM y no querés migrar

- **GitHub Codespaces o equivalente (recomendado).** Las dos páginas se sirven desde la misma URL
  reenviada, así que comparten origen *por construcción* y el problema no existe. Es la razón por
  la que el emparejamiento siempre funcionó ahí mientras fallaba en local.
- **Un túnel público** (tipo cloudflared/ngrok) apuntando al dev server: mismo efecto, ambos
  dispositivos entran por el mismo origen. Ojo que publica el dev server en Internet.
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

## Qué esperar al conectar

- El teléfono muestra **"Conectando…"** hasta que la conexión se confirma. A los 15 s sin
  conexión pasa a un error visible en pantalla.
- **La calibración arranca recién después** de conectar — a propósito. Si arranca antes, está
  calibrando contra un peer que puede no existir.
- El visor oculta el QR cuando recibe el mensaje `telescopeConnected`. No lo deduce de recibir
  datos de orientación: eso ataba la detección de conexión a que la calibración terminara, que es
  justo al revés.

## Depurar en el teléfono

Protobject reenvía la consola del teléfono al visor, pero **solo después** de que exista
conexión. Todo lo que pase antes —incluido el motivo por el que no conecta— es invisible ahí.

Para eso está la consola en pantalla (`src/lib/debug-log.js`): activa en builds de dev, o en
cualquier build agregando `?debug=1`. Captura `console.*`, errores no atrapados y promesas
rechazadas, y al arrancar loguea el **origen** y el **`ptjuid`** de la página — precisamente los
dos datos que hay que comparar entre visor y teléfono cuando algo no empareja.

Útil cuando no hay depuración remota por USB disponible.

## `VITE_LAN_HOST` (obsoleto)

Variable de entorno que overridea el host del QR (`buildTelescopeUrl()` en
`src/viewer/Viewer.svelte`). Fue una mitigación para que el teléfono pudiera *cargar* la página
cuando el host estaba forzado a `localhost`; **nunca resolvió el emparejamiento**. Con el dev
server nativo no hace falta. Si se sigue usando, un valor desactualizado apunta el QR a un host
equivocado sin avisar.
