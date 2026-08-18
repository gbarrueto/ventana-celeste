# Pendientes

Documento temporal. Su contenido pasa a GitHub Projects como tareas y entonces este archivo se
elimina.

Regla: los documentos de referencia describen lo que existe. Todo lo que sea investigación, deuda o
trabajo futuro va aquí.

## Orientación

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

Sin decidir. Distinto de `zenithRateGuardDeg`, que ya existe, está en uso desde que la zona dinámica
quedó activa, y sólo topa cuánto se amplifica la tasa de acimut cerca del cenit, sin limitar a dónde
se puede apuntar.

## Hardware

### Verificar la reconexión del enfocador en el aparato

La reconexión está implementada y verificada contra un WebUSB simulado: caída del cable, evento
`connect`, evento perdido cubierto por el reintento, y `stop()`.

Falta el hardware. El punto que decide es si **Android muestra su propio diálogo de permiso al
reenchufar**, por debajo de WebUSB, y si la casilla de usar por defecto lo suprime. Si aparece cada
vez, el límite no es de la aplicación y hay que ir al teclado HID.

- `apps/dual-telescope/src/focuser.js`

### Plan B: enfocador por teclado

Si la reconexión por WebUSB resulta poco fiable en uso real, la alternativa es que el Arduino actúe
como teclado USB, que es lo que ya hace `kiosk` y no requiere permisos ni reconexión.

Cambia el modelo de datos, no sólo el transporte. El potenciómetro entrega una **posición absoluta**
y un teclado entrega **eventos discretos**, así que el enfoque pasaría a acumularse por pasos. Con
eso la posición del software puede quedar desfasada de la del mando físico, y haría falta o bien una
tecla de puesta a cero, o bien un mando sin posición absoluta, como un encoder rotatorio.

`createKeyboardConnector()` en `core` ya cubre el mapeo de teclas a acciones.

### Mover el enfocador al dispositivo de control

El USB no se delega: quien tiene el cable tiene el dispositivo, así que el guía no puede abrir una
placa enchufada al ocular. Lo que sí se delega sobre el relay es el control, porque reabrir un
dispositivo ya autorizado usa `getDevices()` y no exige gesto. El emparejamiento inicial no, porque
`requestDevice()` necesita activación de usuario real sobre esa página.

Con el tercer dispositivo de control de la fase siguiente, conviene enchufar el Arduino ahí en vez
de al ocular. El potenciómetro está en el tubo pero el cable puede correr hasta el control, y así el
teléfono del ocular queda como pantalla pura, sin hardware ni permisos. Encaja con el eje mediado:
hay una persona experta operando.

### Medir los puntos de foco reales

`PUNTOS_DE_FOCO` en `focuser.js` tiene valores provisionales. Cada ocular enfoca en una posición
distinta del recorrido del potenciómetro y esos números salen de medir contra el hardware.

### Detectar el cambio de ocular

`setEyepiece()` existe y mueve el punto de foco. Falta el hardware que avise qué ocular está puesto.

Se resuelve con señales eléctricas que lee el Arduino, no con RFID. El detalle del circuito está sin
definir.

### Verificar kiosk contra hardware real

La entrada del Arduino como teclado en `kiosk` no se probó desde la migración a monorepo.

## Despliegue y arranque

### IP estática para el dispositivo principal

La dirección del principal se detecta y se publica sola, así que el emparejamiento funciona con
cualquier IP. Sigue cambiando entre arranques, lo cual obliga a reescanear el QR cada vez.

Fijarla desde la configuración del punto de acceso del teléfono la volvería estable, y con eso el
guía podría guardar la URL como marcador.

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

### Desfase del guía en desarrollo

En producción la latencia es buena: dos motores WASM y un teléfono haciendo de punto de acceso no
dieron problema.

En desarrollo el guía va con algo de desfase. La topología es distinta —los dos dispositivos pasan
por la PC en vez de por el teléfono que hace de punto de acceso— así que probablemente venga de ahí.
No afecta al prototipo; queda anotado por si molesta al desarrollar.

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

## Documentación

### Documentar el hardware físico

No hay ningún documento del montaje. `apps/device-lab/arduino/README.md` cubre sólo el sketch del
potenciómetro.

Falta: qué telescopio, cómo se monta cada teléfono, qué oculares, el circuito que detecta el ocular
puesto, el cableado y qué placa lleva cada prototipo. Para un proyecto figital es la mitad ausente de la documentación.

### Elegir licencia

El repo no tiene archivo de licencia, lo cual por defecto significa todos los derechos reservados.
Decisión de Alessio Bellino como gestor del proyecto.

Stellarium Web Engine, redistribuido en `packages/core/assets/`, es MIT y arrastra una obligación de
atribución que hoy no está cubierta.

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

Hay un candidato concreto a primer test: el script que verifica las tasas del giroscopio contra
rotaciones conocidas y contra la derivada numérica del apuntado. Hoy vive fuera del repo.

### Temporal por polyfill

Se usa `@js-temporal/polyfill` en vez del `Temporal` nativo. El soporte nativo en los navegadores
móviles donde corren estas apps no está verificado. El polyfill agrega peso al bundle.
