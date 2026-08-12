# Pendientes

Documento temporal. Su contenido pasa a GitHub Projects como tareas y entonces este archivo se
elimina.

Regla: los documentos de referencia describen lo que existe. Todo lo que sea investigación, deuda o
trabajo futuro va aquí.

## Orientación

### Verificar que dual-telescope realmente reutiliza el módulo de orientación

El seguimiento en `dual-telescope` es notoriamente peor que el de `kiosk`, que ya funcionaba bien
con suavizado.

`dual-telescope` sí llama a `createOrientationController` de core, pero con dos opciones que apagan
mecanismos completos:

| Opción | kiosk | dual-telescope | Efecto en dual-telescope |
|---|---|---|---|
| `fovThreshold` | `0.2` (default) | `0` | `requiredMode` nunca da `'gyro'`. Sin conmutación de modo. |
| `dynamicThreshold` | `0.06` (default) | `0` | `inDynamicZone` nunca es verdadero. La zona dinámica queda muerta. |

Con FOV de ocular en `0.05` rad, `kiosk` entra en la zona dinámica e integra el giroscopio escalado
por zoom, con `dynamicSmoothingFactor` a `0.15`. `dual-telescope` corre sólo el camino del
quaternion con suavizado exponencial.

Ambos ceros se pusieron para escapar de un bug: en modo giroscopio se integran los ejes crudos del
dispositivo, y con el montaje rotado 90° eso daba deriva con el aparato quieto y ejes cambiados.

Determinar si la diferencia de calidad viene de ahí, y si la zona dinámica se puede recuperar
corrigiendo los ejes en vez de apagándola. Relacionado con [corrección de ejes en el camino del
giroscopio](#corrección-de-ejes-en-el-camino-del-giroscopio).

- `packages/core/src/orientation/controller.js`
- `apps/dual-telescope/src/sky.js`
- `apps/kiosk-standalone/src/App.svelte`

### Corrección de ejes en el camino del giroscopio

`quaternionToPointing()` corrige el montaje sólo en el camino del quaternion. La integración del
giroscopio lee los ejes crudos del dispositivo (`gyroSensor.x`, `.z`) y no tiene equivalente.

Con el teléfono rotado en el tubo, esos ejes no corresponden a altura y acimut.

### Transformación de imagen newtoniana

Un newtoniano entrega la imagen rotada y reflejada respecto de lo que se ve a ojo desnudo. Hoy no
se aplica ninguna transformación.

Distinto de la disposición física del canvas, que ya está resuelta.

### Referencia de norte

El apuntado es relativo: no hay norte absoluto. El magnetómetro funciona en los dispositivos
medidos, así que `AbsoluteOrientationSensor` es viable.

Decidir si el norte se toma del magnetómetro o de una calibración manual apuntando a un objeto
conocido, que además funcionaría como paso de producto.

### Unificar el signo de yaw

Tres apps escriben `observer.yaw = -h` y `dual-telescope` escribe `observer.yaw = yaw`.

Debería resolverse en un solo punto en vez de en cada app.

### Clamp de altitud a 85°

En alt-az el acimut es indefinido en el cenit. Un tope por software evita la degeneración a costa
de impedir apuntar al cenit.

Sin decidir.

## Hardware

### Evaluar WebUSB frente a reconexiones

WebUSB funciona y reconecta sin gesto del usuario mediante `getDevices()`, lo cual permite que el
teléfono viva dentro del tubo.

Falta medir con qué frecuencia se cae la conexión en uso real. Si requiere reconexiones constantes,
no es viable y hay que volver al enfoque de teclado HID, que es lo que ya usa `kiosk` con el
Arduino como teclado USB.

Web Serial no es una alternativa: medido en el dispositivo, no está disponible en Android.

- `apps/dual-telescope/src/focuser.js`
- `apps/device-lab/io.html`

### Medir los puntos de foco reales

`PUNTOS_DE_FOCO` en `focuser.js` tiene valores provisionales. Cada ocular enfoca en una posición
distinta del recorrido del potenciómetro y esos números salen de medir contra el hardware.

### Cambio de ocular por RFID

`setEyepiece()` existe y mueve el punto de foco. Falta el lector RFID y el cableado del evento.

### Verificar kiosk contra hardware real

La entrada del Arduino como teclado en `kiosk` no se probó desde la migración a monorepo.

### Actualizar el stub de `createSerialConnector`

`packages/core/src/io/connectors.js` tiene un stub de Web Serial que lanza error, escrito cuando se
suponía que Web Serial era el camino para RFID y potenciómetro. Web Serial no existe en Android.

Eliminarlo o reemplazarlo por el contrato de WebUSB que se terminó usando.

## Despliegue y arranque

### `start.sh` muestra una IP inutilizable

El guía necesita abrir la app en la IP LAN del dispositivo principal. `start.sh` la calcula con
`ip route get 1` y cae a `hostname -i`, que en Termux devuelve una dirección de loopback.

El script debe mostrar la IP real del host.

- `apps/dual-telescope/start.sh`

### Entregar la URL al teléfono guía sin escribirla

Copiar una IP a mano en el teléfono guía en cada arranque es el paso más lento del montaje.

Opciones a evaluar: QR en la pantalla del principal, mDNS con un nombre fijo, o una página de
arranque en el guía que descubra al principal.

### Rama de deploy y comandos de build para kiosk

`dual-telescope` tiene `pack:deploy`, `publish:deploy`, una rama de deploy huérfana y un paquete sin
dependencias. `kiosk-standalone` no tiene nada de eso: se arranca en Termux con `pnpm run dev`, o
sea que el dispositivo necesita el repo completo, `node_modules` y compilar en Android.

Replicar el esquema de `dual-telescope`. `kiosk` no necesita relay, así que el paquete es `dist/`
más un servidor de estáticos y el script de arranque.

Resuelve además dos pendientes que hoy dependen de esto: [modo `development` en
Termux](#kiosk-en-termux-corre-en-modo-development) y el empaquetado de catálogos locales.

### Empaquetado de catálogos locales

`kiosk` y `dual-telescope` en deploy siguen apuntando a los servidores remotos. Los paths locales
están comentados en el config de `kiosk`.

Compartido entre las dos apps.

### `kiosk` en Termux corre en modo `development`

El arranque usa `pnpm run dev`, o sea `vite`, así que `import.meta.env.MODE` vale `'development'` y
`loadConfig` elige `config.dev.js`.

Hoy los dos configs son idénticos salvo el campo `env`. Deja de ser inofensivo en cuanto
`config.prod.js` apunte a los catálogos locales: el dispositivo en campo seguiría yendo a los
servidores remotos.

`vite --mode production` mantiene el dev server y selecciona el config correcto.

### Medir latencia en la topología real

Dos motores WASM y un teléfono haciendo de punto de acceso. Sin medición sobre el montaje real.

### Instalación como PWA

Pospuesto para los prototipos actuales, donde no evita ningún paso: el proceso relay hace falta
igual y el beneficio es asimétrico. Un service worker exige contexto seguro, así que el dispositivo
principal, servido por `localhost`, podría instalarse, y el guía, que recibe la página por IP de LAN
sobre HTTP plano, no. Igualarlos exige HTTPS con certificado en una IP de LAN, o sea `mkcert` y su
CA instalada en los dos teléfonos.

**No es un descarte.** Las versiones futuras de hogar y educativa se instalan en dispositivos de
terceros, sin montaje físico, sin relay y sin punto de acceso propio. Ahí el PWA pasa a ser el
mecanismo de distribución, no una comodidad: ícono, pantalla completa, arranque de un toque y
funcionamiento sin conexión.

Eso cambia el orden de las decisiones. Las apps futuras se sirven por HTTPS desde un dominio, con lo
cual la restricción de contexto seguro desaparece y con ella la asimetría. Conviene revisar esto
antes de diseñar esas versiones, no después.

## Aplicaciones

### Portar el overlay de seeing a dual-telescope

Hoy el desenfoque del enfocador se aplica con un filtro CSS sobre el canvas. `aplicarBlur()` es el
punto donde el overlay real se enchufa cuando exista.

El overlay de `web-app` necesita una reescritura antes de portarse.

### Manejo de errores visible en kiosk

`web-app` muestra los fallos de sensores en la fase `'error'` del overlay de calibración. `kiosk` no
tiene ninguna superficie visible para fallos de sensores ni de carga de catálogos.

### Llamadas directas a Protobject en web-app

Cerca de 15 llamadas a `Protobject.Core.send(...)` en componentes de `web-app` no pasan por
`messageBus`.

Limita qué tan intercambiable es el transporte: cambiar a WebSocket obliga a tocarlas.

### `packages/shared-viewer`

Nivel intermedio de compartición entre `web-app` y `dual-telescope`. Mencionado en el diseño
original de core, nunca diseñado.

## Transversal

### Sin tests automatizados

Ninguna app tiene suite de tests. Toda la verificación es manual: build, arranque del dev server y
scripts Node ad-hoc para los módulos de matemática.

### Temporal por polyfill

Se usa `@js-temporal/polyfill` en vez del `Temporal` nativo. El soporte nativo en los navegadores
móviles donde corren estas apps no está verificado. El polyfill agrega peso al bundle.
