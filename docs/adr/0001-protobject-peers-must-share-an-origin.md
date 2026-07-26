# 1. Los peers de Protobject deben compartir el mismo origen

Fecha: 2026-07-26

## Estado

Aceptada. La restricción de origen es permanente (es comportamiento de Protobject). El remedio
para desarrollo local está resuelto: correr el dev server nativo en el host — ver Resolución.

## Resolución

Correr el dev server **nativamente en el sistema operativo del host**, no dentro de una VM o de
WSL. Así el socket pertenece al host, que puede alcanzar su propia IP LAN igual que cualquier
otro dispositivo de la red — y entonces el visor se carga en `https://<IP-LAN-del-host>:<puerto>/`
mientras el teléfono usa esa misma dirección. Verificado: la petición del host a su propia IP LAN
pasa de dar timeout (dentro de WSL) a responder en milisegundos (nativo).

Con eso `window.location.host` ya es la dirección correcta, `buildTelescopeUrl()` genera el QR
apuntando al mismo origen sin necesidad de override, y el emparejamiento con el teléfono funciona.

**`VITE_LAN_HOST` queda obsoleto** en ese escenario. Era una mitigación para que el teléfono
pudiera *cargar* la página cuando el host estaba forzado a `localhost`; nunca resolvió el
emparejamiento. Si se elimina el soporte, borrar también la rama en `buildTelescopeUrl()`
(`apps/web-app/src/viewer/Viewer.svelte`).

Nota: nada de esto cambia el requisito de origen en sí, que es permanente. Sigue siendo
obligatorio que ambas páginas se carguen desde el mismo scheme + host + puerto; lo que se
resuelve es *poder cumplirlo* en desarrollo local.

## Contexto

`index.html` (visor) y `telescope.html` (teléfono/control) se emparejan por Protobject
(`app.protobject.com/framework/p.js`, con WebRTC/PeerJS por debajo). El emparejamiento se
correlaciona con un query param `ptjuid` que `p.js` inyecta en la URL del visor y que el visor
copia al QR que escanea el teléfono.

Probar con un teléfono en la red local fallaba sistemáticamente: el teléfono cargaba
`telescope.html`, pero las dos páginas nunca se conectaban. El mismo build funcionaba en una
segunda pestaña del navegador, en producción y en Codespaces.

Lo explican dos hechos independientes, ambos verificados el 2026-07-26:

1. **Protobject empareja por origen, no solo por `ptjuid`.** Con el visor en
   `https://127.0.0.1:5173` y el teléfono en `https://localhost:5173` llevando el *mismo*
   `ptjuid`, los peers no se emparejan. Poniendo ambos en `https://127.0.0.1:5173` se emparejan
   de inmediato. `p.js` es código de terceros ofuscado, así que el mecanismo exacto se
   desconoce, pero el comportamiento es reproducible.

2. **Si el dev server corre dentro de WSL2 con `networkingMode=mirrored`, el host Windows no
   puede alcanzarlo por la propia IP LAN del host** — solo vía `localhost`/`127.0.0.1`. Otros
   dispositivos de la red sí alcanzan esa IP sin problema. Confirmado que no es específico de
   esta app ni del puerto: el mismo síntoma aparece con un proyecto no relacionado en otro
   puerto, y en ambos casos un teléfono conecta bien mientras el host da timeout.

Juntos son insatisfacibles con un `pnpm run dev` dentro de WSL: el host queda forzado a un
origen `localhost`, el teléfono debe usar la IP LAN, y así los dos peers caen en sesiones
distintas de Protobject y nunca pueden emparejarse.

Nota adicional: exponer un puerto de WSL a la red requiere agregarlo al firewall de
**Hyper-V** (`New-NetFirewallHyperVRule`, VMCreatorId
`{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}`), no solo al Windows Firewall normal. Únicamente el
puerto presente en esa regla es alcanzable desde otros dispositivos.

## Decisión

Tratar "ambos navegadores deben cargar el *mismo* scheme + host + puerto" como un requisito
duro de cualquier flujo basado en Protobject, no como un detalle incidental. El código de la
aplicación no debe asumir que con que una dirección sea *alcanzable* es suficiente.

Por lo tanto `window.location.host` no es una fuente segura para el target del QR en desarrollo
local; el host del QR es overrideable vía `VITE_LAN_HOST` (ver `buildTelescopeUrl()` en
`apps/web-app/src/viewer/Viewer.svelte`). Ojo: eso por sí solo **no** arregla el
emparejamiento — solo hace que el teléfono pueda cargar la página.

## Consecuencias

- Producción y Codespaces no se ven afectados: ahí los dos peers ya comparten origen.
- Para probar con teléfono en la LAN, lo más limpio es correr el dev server **nativo en el
  host** (ver Resolución). Si por alguna razón tiene que correr dentro de WSL o de una VM, las
  alternativas son: un `netsh portproxy` del lado de Windows; un hostname que resuelva a
  loopback en el host y a la IP LAN en el teléfono (hosts + mDNS); o un túnel público. Todas
  agregan una pieza de infraestructura que hay que mantener.
- Al correr nativo en Windows con el repo en un filesystem de Windows, tener en cuenta que el
  file watching de Vite sobre rutas de red tipo `\\wsl.localhost\...` no es confiable — conviene
  que la copia de trabajo viva en el filesystem local.
- Diagnosticar el teléfono requiere visibilidad en el propio dispositivo, porque Protobject
  reenvía la consola del teléfono al visor **solo después** de que exista conexión.
  `apps/web-app/src/lib/debug-log.js` dibuja una consola en pantalla (builds de dev, o
  cualquier build con `?debug=1`) y loguea el origen y el `ptjuid` de cada página para poder
  compararlos directamente.
- `Protobject.Core.onConnected` no es confiable del lado del visor (dispara una sola vez, al
  unirse el socket propio al relay, nunca al llegar el peer). Por eso el visor detecta al
  teléfono con un mensaje de aplicación explícito `telescopeConnected`. Ver
  `apps/web-app/src/lib/protobject.js`.
