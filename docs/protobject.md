# Protobject

Framework de terceros que empareja dos páginas web y les da un canal de mensajes. Por debajo usa
WebRTC con PeerJS. Lo usa `web-app` para conectar el visor con el teléfono.

Es código ofuscado de terceros. El comportamiento documentado aquí está verificado en dispositivo,
no leído del fuente.

## Importación

No es un paquete npm. Se carga como script global en cada página que participa:

```html
<script src="https://app.protobject.com/framework/p.js"></script>
```

Está en `apps/web-app/index.html` y `apps/web-app/telescope.html`. Define el global `Protobject`.

El script se descarga de un servidor remoto, así que `web-app` requiere Internet para arrancar.

## Emparejamiento

`p.js` inyecta un query param `ptjuid` en la URL del visor. El visor lo copia al QR que escanea el
teléfono, y ese identificador correlaciona a las dos páginas.

**Los dos peers deben cargarse desde el mismo scheme, host y puerto.** Con el visor en
`https://127.0.0.1:5173` y el teléfono en `https://localhost:5173`, ambos con el mismo `ptjuid`, el
emparejamiento no ocurre. Con los dos en `https://127.0.0.1:5173`, ocurre de inmediato.

Consecuencia para desarrollo: el dev server tiene que correr nativo en el sistema operativo del
host, de modo que el host pueda alcanzar su propia IP LAN igual que el teléfono. Detalle completo en
[ADR 0001](adr/0001-protobject-peers-must-share-an-origin.md).

El destino del QR se deriva de `window.location.host` en `buildTelescopeUrl()`
(`apps/web-app/src/viewer/Viewer.svelte`) y no es configurable.

## API

Tres métodos sobre `Protobject.Core`.

| Método | Uso |
|---|---|
| `send(payload).to(target)` | Envía a una página. `target` es el nombre del archivo: `'index.html'`, `'telescope.html'`. |
| `onReceived(handler)` | Registra el receptor. Recibe el payload tal cual se envió. |
| `onConnected(handler)` | Se dispara al conectar. Ver [Comportamiento de `onConnected`](#comportamiento-de-onconnected). |

## Exposición en la app

Ninguna capa de la app llama a `Protobject.Core` directamente para el flujo principal. El adaptador
está en `packages/core/src/sync/messageBus.js`:

```js
export function createProtobjectTransport() {
  return {
    send(payload, target) { Protobject.Core.send(payload).to(target); },
    onReceive(handler) { Protobject.Core.onReceived((data) => handler(data)); },
    onConnect(handler) { Protobject.Core.onConnected(handler); },
  };
}
```

`apps/web-app/src/lib/protobject.js` lo conecta al bus y registra los handlers de la app:

```js
const bus = createMessageBus(createProtobjectTransport());
bus.on('updateView', updateStellariumView);
bus.start({ onConnect: skipFirstCall(...) });
```

Los mensajes tienen forma `{ msg, values }`. Cambiar de transporte es cambiar el argumento de
`createMessageBus`.

Quedan cerca de 15 llamadas directas a `Protobject.Core.send(...)` en componentes de `web-app`
(`DateTimePicker`, `GlobePicker`, `Menu`) que no pasan por el bus.

## Mensajes

Del teléfono al visor:

| Mensaje | Contenido |
|---|---|
| `updateView` | `{ h, v }`, orientación. Cerca de 50 Hz. |
| `updateFov` | `{ fov }` en radianes. |
| `updateBlur` | `{ blur }` en píxeles. |
| `telescopeConnected` | Vacío. Handshake de conexión. |
| `telescopeHeartbeat` | Vacío. 1 Hz. |
| `stellariumOption` | `{ path, attr }`, alterna un atributo del motor. |
| `applyLocation` | `{ cityName, lat, lon, elev, mag }`. |
| `updatePollution` | `{ mag }`. |
| `updateDate`, `setSpeed` | Control del reloj. |
| `simpleSettings`, `advancedSettings` | Cambio de modo de UI. |
| `requestSynchronizeData` | Pide al visor su estado actual. |

Del visor al teléfono:

| Mensaje | Contenido |
|---|---|
| `viewerHeartbeat` | Vacío. 1 Hz. |
| `syncTime` | `{ engineUTC }` en MJD, cada 300 ms mientras está activo. |
| `setSynchronizedData` | Estado completo: tiempo, ubicación, ángulo. |
| `applyLocation` | Propagación de coordenadas elegidas en el teléfono. |

## Comportamiento de `onConnected`

`onConnected` se dispara una primera vez en cuanto el socket de la propia página se une al relay,
antes de que exista ningún peer. `skipFirstCall()` en `apps/web-app/src/lib/protobject.js` descarta
esa primera llamada.

El comportamiento es asimétrico. En `telescope.html` la segunda llamada, la del peer real, se
dispara de forma confiable. En `index.html` no se observó nunca.

Por eso el visor no detecta al teléfono con `onConnected`, sino con un mensaje de aplicación
explícito: el teléfono envía `telescopeConnected` en cuanto su propia conexión se confirma, y eso es
lo que oculta el QR.

## Detección de caída

`Protobject.Core` expone `onConnected` y `onReceived`. No hay evento de desconexión.

La presencia del peer se infiere con un heartbeat en `apps/web-app/src/lib/connection.js`:

| Constante | Valor | Rol |
|---|---|---|
| `HEARTBEAT_MS` | 1000 | Cada lado emite un latido a 1 Hz. |
| `PEER_TIMEOUT_MS` | 2500 | Sin latidos por más tiempo, el peer se da por perdido. |
| `CHECK_MS` | 250 | Frecuencia de la comparación local, sin tráfico. |

El timeout cubre más casos que un evento de cierre: red caída, página congelada y pestaña en
segundo plano no producen un cierre limpio.

`createPeerMonitor` reporta `{ alive, everAlive }`. `everAlive` distingue "todavía no conectó" de
"conectó y se cayó", que necesitan textos distintos en la UI.

`updateView` también marca al peer como visto. Llega a unos 50 Hz, así que una caída se nota por
tráfico real antes que por el siguiente latido perdido.

El latido se mantiene a 1 Hz con payload mínimo porque comparte canal WebRTC con el flujo de
orientación, y saturarlo degrada el seguimiento.

## Depuración

Protobject reenvía la consola del teléfono al visor sólo después de que exista conexión, lo cual
deja sin visibilidad justo la etapa de emparejamiento.

`apps/web-app/src/lib/debug-log.js` dibuja una consola en pantalla en builds de desarrollo, o en
cualquier build con `?debug=1`, y registra el origen y el `ptjuid` de cada página.
