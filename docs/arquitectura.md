# Arquitectura

Monorepo pnpm con cuatro aplicaciones y un paquete compartido. Todas renderizan el mismo cielo con
Stellarium Web Engine; se diferencian en de dónde sale la orientación y en cuántos dispositivos
participan.

```
apps/
├── web-app             visor + teléfono como control, por WebRTC
├── kiosk-standalone    un dispositivo, sensores y pantalla en el mismo lugar
├── dual-telescope      dos teléfonos, ocular y guía, por WebSocket
└── device-lab          banco de pruebas de sensores y hardware
packages/
└── core                @ventanaceleste/core
```

## Concepto

El proyecto simula un telescopio. Un dispositivo con sensores hace de tubo: al moverlo, la vista del
cielo se mueve con él. El resto de las piezas (zoom, enfoque, cambio de ocular) llegan como entrada
externa.

Las cuatro apps son configuraciones distintas de la misma idea.

| App | Dispositivos | Transporte | Fuente de orientación |
|---|---|---|---|
| `web-app` | 2 (navegador + teléfono) | Protobject, WebRTC | El teléfono |
| `kiosk-standalone` | 1 | Ninguno | El propio dispositivo |
| `dual-telescope` | 2 teléfonos | WebSocket sobre un relay propio | Configurable por servidor |
| `device-lab` | 1 | Ninguno | El propio dispositivo |

## `@ventanaceleste/core`

Dependencia de workspace (`workspace:*`). Sin build: las apps importan el fuente y Vite lo procesa.
Todo lo público sale de `src/index.js`.

| Módulo | Contenido |
|---|---|
| `engine/` | Arranque de Stellarium Web Engine y manifiesto de catálogos. Ver [stellarium-web-engine.md](stellarium-web-engine.md). |
| `orientation/` | Fusión de giroscopio y `RelativeOrientationSensor`. Ver [core-modulos.md](core-modulos.md). |
| `sync/` | Bus de mensajes agnóstico de transporte, más los adaptadores de Protobject, WebSocket y nulo. |
| `time/` | Conversiones MJD y mutación del reloj del motor. |
| `telescope/` | Óptica: aumento, FOV desde ocular, magnitud límite, escala Bortle. |
| `io/` | Contrato de conectores de hardware. Implementación de teclado. |
| `config/` | Carga de config por modo de Vite. |
| `assets/` | Copia única de los binarios del motor. |

`core` no contiene DOM, ni Svelte, ni transporte concreto. Cada módulo es una factoría con
callbacks; el cableado a la UI vive en cada app.

### Qué no está en core

Los defaults visuales del motor, la política de UI y las llamadas a Stellarium específicas de cada
app. `web-app` tiene además su propia capa en `src/lib/stellarium.js`.

## Topologías

### web-app

```
navegador (index.html)  ←── WebRTC ──→  teléfono (telescope.html)
      visor                                  control + sensores
```

El visor muestra un QR con la URL de `telescope.html`. El emparejamiento lo hace Protobject.

Restricción dura: los dos peers deben cargarse desde el mismo scheme, host y puerto. Ver
[protobject.md](protobject.md) y [ADR 0001](adr/0001-protobject-peers-must-share-an-origin.md).

### kiosk-standalone

Un solo dispositivo. Sin transporte: el bus usa `createNullTransport()`. La entrada externa llega
por teclado, con un Arduino actuando como teclado USB.

### dual-telescope

```
        ocular (dentro del tubo)          guía (tubo buscador)
                 │                              │
                 └───── WebSocket ──────────────┘
                            │
                    relay + estáticos
              (proceso Node en el dispositivo principal)
```

Dos entradas de una misma app: `index.html` es el ocular, `guide.html` es el guía. El ocular arranca
con catálogos extendidos y un FOV de 0.05 rad; el guía sin ellos y 0.14 rad. Los dos FOV son
ajustables desde el panel de depuración.

Cada rol recorta la vista según dónde queda físicamente el teléfono: el ocular abajo y rotado dentro
del tubo, el guía arriba. En pantalla de escritorio el guía va completo, porque el recorte existe
por la ubicación en el tubo y no tiene sentido en un monitor.

El dispositivo principal corre el relay, sirve los estáticos y hace de punto de acceso. El otro
teléfono se conecta a esa red.

Qué rol lleva los sensores lo decide el servidor y lo consulta cada página en `/link-config`, junto
con las IPv4 de LAN del equipo. Se cambia con la variable `SENSOR_SOURCE` del script de arranque,
sin tocar código. El ocular muestra la URL del guía como QR.

El enfocador es un potenciómetro sobre un Arduino Leonardo, leído por WebUSB desde el ocular.

## Comunicación

Todas las apps usan el mismo bus, `createMessageBus(transport)`, con mensajes de forma
`{ msg, values }`. Cambiar de transporte es cambiar el argumento del constructor.

| Transporte | Usado por | Detección de caída |
|---|---|---|
| `createProtobjectTransport()` | `web-app` | Heartbeat a 1 Hz, timeout de 2.5 s |
| `createWebSocketTransport()` | `dual-telescope` | Eventos `close` y `error` del socket |
| `createNullTransport()` | `kiosk-standalone` | No aplica |

Protobject no expone ningún evento de desconexión, de ahí el heartbeat. El transporte WebSocket no
lo necesita y además reconecta solo.

## Contexto seguro

La Generic Sensor API (`Gyroscope`, `RelativeOrientationSensor`) exige contexto seguro. También lo
exigen WebUSB y los service workers.

`http://localhost` cuenta como contexto seguro. Una IP de LAN por HTTP plano, no.

De ahí se derivan dos cosas:

- El dispositivo con sensores se sirve a sí mismo por `localhost` y no necesita certificado.
- En desarrollo, con la página abierta desde otro dispositivo por la LAN, hace falta HTTPS. Las
  apps usan `@vitejs/plugin-basic-ssl`, que genera un certificado autofirmado.

Una página HTTPS no puede abrir un WebSocket en claro. En `dual-telescope` el relay va montado
sobre el dev server de Vite, así que la página y el socket comparten origen y el socket queda en
`wss://` sin configuración.

## Datos

Los catálogos se sirven desde dos orígenes remotos: `smalldata` (estrellas, DSOs, planetas, terreno,
MPC) y `bigdata` (surveys DSS y Gaia).

No están en el repo ni se espera que estén en las máquinas de desarrollo. Sólo los equipos de
deploy de los prototipos los tienen en local.

Los dominios `smalldata.ventanaceleste.com` y `bigdata.ventanaceleste.com` son de Alessio Bellino,
gestor del proyecto, y están hosteados en Cloudflare.

### Ubicación por defecto

Las apps arrancan en Paranal (`lat -24.6272`, `lon -70.4042`, `elev 2635`), con offset horario `-3`,
hora continental de Chile sin horario de verano.

Es un observatorio de referencia en el país y el sitio con la mejor calidad de cielo, así que
funciona como punto de partida conocido donde el cielo se ve en todo su esplendor.

## Herramientas

- pnpm 11 con workspaces. `shellEmulator: true` en `pnpm-workspace.yaml` hace que los prefijos
  `VAR=x comando` de los scripts funcionen también en Windows.
- Vite 6 en `web-app`, Vite 5 en las otras tres.
- Svelte en `web-app` y `kiosk-standalone`. `dual-telescope` y `device-lab` son JavaScript y HTML
  sin framework.
- esbuild para empaquetar el relay de `dual-telescope` en un archivo sin dependencias.
- `qrcode-generator` en `dual-telescope`, para el QR de emparejamiento. Sin dependencias y
  empaquetada local, porque el prototipo tiene que funcionar sin internet.
