# Especificación Técnica y Plan de Arquitectura: VentanaCeleste Monorepo

## 1. Contexto del Proyecto
**VentanaCeleste** es un ecosistema educativo astronómico que combina simulaciones digitales con hardware físico (*figital*). Utiliza el **Stellarium Web Engine** (compilado a WebAssembly) integrado con un frontend reactivo en **Svelte** para renderizar el cielo nocturno en tiempo real.

Actualmente existen dos versiones desarrolladas en un único repositorio con múltiples ramas (que será migrado a `legacy`):
1. **App Principal:** Aplicación web completa en Svelte que utiliza **Protobject** (sobre PeerJS / WebRTC) para conectar un móvil via QR como control remoto/sensor.
2. **Prototipo Mínimo (Kiosk/Standalone):** Versión embebida dentro de un telescopio físico, donde un móvil/pantalla recibe eventos directamente de un **Arduino** (vía comunicación Serial) para controlar zoom y movimiento sin menús de configuración.

---

## 2. Nuevo Prototipo Avanzado (Dual Sync & Hardware Offline)
El objetivo principal es simular la experiencia completa y fiel de un telescopio astrofotográfico/visual real utilizando dos pantallas sincronizadas de manera **100% offline**:

* **Móvil Principal (Ocular):** 
  * Renderiza la vista principal con Stellarium.
  * Conectado por cable USB/Serial a un **Arduino** con lectores **RFID** (cambio físico de oculares = ajuste de FOV) y **Potenciómetro** (control manual de enfoque / Blur).
  * Actúa como **Hotspot Wi-Fi (AP)** de la red local.
  * Corre un **servidor WebSocket nativo** (HTTP + WS).
* **Móvil Secundario (Guidescope / Telescopio Guía):**
  * Conectado a la red Wi-Fi del móvil principal como cliente WebSocket.
  * Mantiene un **FOV amplio y fijo** (simulando un tubo guía con cámara de guiado).
  * Recibe en tiempo real la orientación del telescopio y los datos globales de simulación.

### Clasificación de Estados y Sincronización

| Estado / Variable | Tipo de Alcance | Protocolo / Canal | Comentario |
| :--- | :--- | :--- | :--- |
| **Orientación (Alt / Az / Roll)** | **Global Sync** | WebSocket (30-60 Hz, Binary/ArrayBuffer) | Transmitido continuamente desde el Principal al Secundario. |
| **Parámetros Astronómicos** | **Global Sync** | WebSocket (JSON Handshake) | Hora UTC, Ubicación GPS, Clase Bortle, Contaminación. |
| **Campo de Visión (FOV)** | **Local** | Local Store (Svelte) | **Principal:** Cambia según chip RFID en Arduino.<br>**Guidescope:** Fijo en campo amplio (~5°–8°). |
| **Enfoque (Focus Blur)** | **Local** | Local Store (Svelte) | **Principal:** Ajustado via Potenciómetro.<br>**Guidescope:** Siempre en enfoque perfecto. |

---

## 3. Reestructuración del Proyecto (Monorepo Strategy)

Para evitar la duplicación de código astronómico y organizar las distintas aplicaciones, el proyecto se reestructurará utilizando **pnpm workspaces**:

```text
ventana-celeste/
├── packages/
│   ├── core/                    # Motor de Stellarium (Wasm), Svelte Stores, Física, Transformaciones
│   └── shared-ui/               # Componentes UI reutilizables (Canvas, Retículos, HUD, Controles)
└── apps/
    ├── web-app/                 # App Principal (Legacy Svelte + Protobject/QR)
    ├── kiosk-standalone/        # Prototipo Mínimo (Standalone + Arduino USB)
    └── dual-telescope/          # Prototipo Avanzado (WebSocket Server + Dual Sync + RFID/Pot)
```

---

## 4. Arquitectura del `@ventanaceleste/core`

El núcleo astronómico se diseña como una capa reactiva neutra bajo el patrón **Pluggable I/O Connectors**:

1. **Agnosticismo del Hardware:** `@ventanaceleste/core` no conoce la procedencia de los datos (Arduino, WebSocket, WebRTC o Keyboard).
2. **Svelte Stores Centrales:** Expone stores reactivos como `telescopeOrientation`, `fov`, `focusBlur`, `skyTime`, etc.
3. **Pluggable Connectors:**
   * **SerialInputConnector:** Lee la trama del Arduino (`potentiometer`, `rfid_tag`) y actualiza los stores locales (`focusBlur.set(val)`).
   * **WebSocketServerOutputConnector:** Suscrito a `telescopeOrientation`, transmite las coordenadas hacia el móvil secundario.
   * **WebSocketClientInputConnector:** Usado por el *Guidescope*, recibe el payload remoto y actualiza su propio store de orientación.

---

## 5. Instrucciones para el Agente / Asistente en VSCode

Al asistir en el desarrollo de la solución:
1. **Segregación:** Asegurar que las dependencias de Stellarium Web Engine residan en `packages/core`.
2. **Performance de Red:** Utilizar transmisiones ligeras (arreglos de números / TypedArrays) en el WebSocket loop para mantener la latencia por debajo de 16ms (~60fps).
3. **Desacoplamiento:** No importar lógica de red o hardware directamente dentro de los componentes del renderizador de Canvas; utilizar siempre conectores que interactúen con los *Svelte Stores*.