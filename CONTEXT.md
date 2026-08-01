# VentanaCeleste — contexto del proyecto

Punto de entrada para entender el repo. Describe **lo que existe hoy**; los planes a futuro
viven en [`docs/Architecture.md`](docs/Architecture.md).

## Qué es

Ecosistema educativo de astronomía que combina simulación digital con hardware físico
(*figital*). Renderiza el cielo nocturno con **Stellarium Web Engine** (WebAssembly) sobre un
frontend **Svelte**, y usa el teléfono como sensor de orientación para que apuntar el
dispositivo equivalga a apuntar un telescopio.

Monorepo **pnpm workspaces** (`apps/*` + `packages/*`), resultado de consolidar un repo previo
que tenía las versiones dispersas en varias ramas — ver
[`docs/MIGRATION.md`](docs/MIGRATION.md).

## Aplicaciones

| App | Qué es | Entrada de control | Estado |
|---|---|---|---|
| [`apps/web-app`](apps/web-app) | App principal. Dos páginas: visor (`index.html`) + control/telescopio (`telescope.html`). El visor muestra un QR; el teléfono lo escanea y se emparejan por **Protobject** (WebRTC). El teléfono aporta los sensores. Cómo levantarla y probarla: [`DEVELOPMENT.md`](apps/web-app/DEVELOPMENT.md). | Sensores del teléfono | Funcional |
| [`apps/kiosk-standalone`](apps/kiosk-standalone) | Prototipo mínimo embebido en un telescopio físico. Una sola pantalla, sin red, sin menús. | Arduino emulando **teclado USB-HID** (no Serial) | Funcional |
| `apps/dual-telescope` | Prototipo avanzado: dos pantallas sincronizadas 100% offline (ocular + guía) vía WebSocket, con RFID y potenciómetro por Serial. | Serial real | **No existe todavía** — plan y decisiones abiertas en [`docs/DUAL_TELESCOPE_PLAN.md`](docs/DUAL_TELESCOPE_PLAN.md) |

## Modelo de compartición (3 niveles)

1. **[`packages/core`](packages/core)** (`@ventanaceleste/core`) — usado por todas las apps.
   Solo entra lo que no depende de un framework de UI, un transporte concreto, ni una forma
   concreta de renderizar. JS plano: sin Svelte, sin DOM, sin red.
2. **Compartido parcial** (p. ej. `packages/shared-viewer`) — para lo que compartirían
   `web-app` y `dual-telescope` pero no `kiosk`. **No existe todavía**; depende de resolver la
   dirección del dato de orientación en el modelo dual (ver Decisiones abiertas).
3. **Específico de app** — UI, overlays, transporte real, hardware real.

Referencia completa de la API y del diseño de `core`:
[`packages/core/README.md`](packages/core/README.md).

## Mapa de `packages/core`

```
packages/core/src/
├── time/          Temporal (polyfill) — conversiones ISO/Date ⇄ MJD, reloj del motor
├── telescope/     óptica pura — magnificación, FOV desde ocular, NELM, Bortle
├── orientation/   fusión gyro + RelativeOrientationSensor, calibración, mountingTransform
├── engine/        bootstrap de Stellarium Web Engine + catálogos de datos
├── sync/          messageBus {msg, values} agnóstico de transporte
├── io/            contratos de conectores (Keyboard implementado, Serial es stub)
└── config/        loader de config por entorno (import.meta.env.MODE)
```

## Invariantes que no son obvias en el código

- **Protobject empareja por origen, no solo por `ptjuid`.** Los dos peers deben cargar
  exactamente el mismo scheme + host + puerto o no se conectan nunca. Es la restricción que
  hace difícil probar con un teléfono en la red local. Ver
  [`docs/adr/0001-protobject-peers-must-share-an-origin.md`](docs/adr/0001-protobject-peers-must-share-an-origin.md).
- **`Protobject.Core.onConnected` no es simétrico.** En el visor dispara una sola vez (al
  unirse el propio socket al relay), nunca al llegar el peer. Por eso el visor detecta al
  teléfono con un mensaje explícito `telescopeConnected`, no con `onConnected`.
- **`core` no decide qué dispositivo lee la orientación.** `mountingTransform` se aplica solo
  en los puntos de salida (`onView`/`onCoords`), nunca al estado interno de continuidad, así
  que cualquier dispositivo puede ser la fuente según cómo lo configure cada app.
- **El "Arduino" del kiosk es un teclado.** Emula USB-HID; no hay Serial real en ninguna app.

## Decisiones abiertas

1. **Dirección de la orientación en el modelo dual.** `docs/Architecture.md` §2 dice que va del
   Principal al Secundario; en diseño surgió que probablemente sea al revés (el guía apunta a
   donde apunta el tubo; el ocular apunta con la parte posterior del teléfono). Hay que
   resolverlo **y corregir `Architecture.md`** antes de diseñar `dual-telescope`.
2. `packages/shared-viewer` — depende de (1).
3. Implementación real de `createSerialConnector` (hoy stub) — la necesita `dual-telescope`.

Estado detallado de pendientes y limitaciones: [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Convenciones

- Documentación del repo en **español**.
- Issues en GitHub `gbarrueto/ventana-celeste` vía `gh` (ver `docs/agents/issue-tracker.md`).
- Decisiones arquitectónicas como ADR en `docs/adr/`.
- Sin suite de tests automatizada todavía — la verificación es manual (build + dev + smoke test).
