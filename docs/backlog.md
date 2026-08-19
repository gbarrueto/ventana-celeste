# Backlog

Documento temporal. Cada sección es un problema abierto, descrito para poder convertirse en un issue
sin volver a investigarlo. Cuando pasen a GitHub Projects, este archivo se elimina.

Reemplaza a `pendientes.md`. Lo que se cerró está en [changelog.md](changelog.md).

---

# Orientación

## El norte sale invertido 180°

**Qué pasa.** El magnetómetro entrega norte real, pero apuntando al norte la vista muestra el sur.
El error es exactamente 180° en acimut; la altura está bien.

**Causa.** `dual-telescope` declara el eje óptico como `'+y'` y después invierte la altura con
`mountingTransform`:

```js
// apps/dual-telescope/src/sky.js
opticalAxis: '+y',
mountingTransform: (yaw, pitch) => ({ yaw, pitch: -pitch }),
```

Pero el teléfono apunta por su parte **baja**, o sea por su eje `-y`. Comprobado numéricamente sobre
2000 orientaciones al azar: `'+y'` con la altura negada y `'-y'` sin transformar dan la misma altura
y difieren **exactamente 180°** en acimut. Las dos formas son indistinguibles con orientación
relativa, porque ahí no hay referencia absoluta. El magnetómetro es lo que revela cuál de las dos es
la correcta.

**Arreglo propuesto.** Declarar el eje que el teléfono realmente usa y quitar la corrección
compensatoria:

```js
opticalAxis: '-y',
mountingTransform: (yaw, pitch) => ({ yaw, pitch }),   // o quitar la opción
```

**Dónde.** `apps/dual-telescope/src/sky.js`, opciones de `createOrientationController`.
La derivación vive en `quaternionToPointing()` de `packages/core/src/orientation/controller.js`.

**Cómo se verifica.** Con el magnetómetro activo, apuntar al norte y comprobar que la vista muestra
el norte. `apps/device-lab/sky.html` permite elegir `AbsoluteOrientationSensor`.

**Nota.** Cierra de paso la duda de si el norte se toma del magnetómetro o de una calibración
manual: el magnetómetro funciona en los dispositivos medidos.

## Unificar el signo de yaw

**Qué pasa.** Cada app decide por su cuenta el signo con que escribe el acimut en el motor:

| App | Escritura |
|---|---|
| `web-app` | `observer.yaw = -h` |
| `kiosk-standalone` | `observer.yaw = -h` |
| `device-lab` | `observer.yaw = -yaw` |
| `dual-telescope` | `observer.yaw = yaw` |

**Por qué importa.** Son cuatro lugares donde equivocarse, y el síntoma —el cielo se mueve al revés—
es fácil de confundir con un problema de montaje o de sensores. Cualquier app nueva tiene que
adivinar cuál de los dos criterios seguir.

**Qué habría que hacer.** Fijar la convención en un solo punto. El candidato natural es el propio
`core`, que ya define en qué convención salen `yaw` y `pitch`, y dejar que las apps escriban el valor
tal cual llega.

**Dónde.**
- `apps/web-app/src/lib/stellarium.js`, `updateStellariumView()`
- `apps/kiosk-standalone/src/App.svelte`, `updateStellariumView()`
- `apps/dual-telescope/src/sky.js`, `apply()`
- `apps/device-lab/sky.html`

---

# Enfocador

## Detectar qué ocular está puesto

**Qué pasa.** El punto de foco depende del ocular montado, que es la mecánica que el instrumento
quiere reproducir. El software ya lo soporta, pero nada le avisa del cambio: `setEyepiece()` existe y
mueve el punto de foco, y hoy no lo llama nadie.

**Decisión ya tomada.** Señales eléctricas leídas por el Arduino. No RFID.

**Qué hay que definir.** El circuito. La opción que menos cambia lo que ya existe es que cada ocular
cierre un divisor resistivo distinto, leído por una entrada analógica: un solo pin más, y el mismo
patrón que el potenciómetro ya usa. Cada ocular queda identificado por un tramo de valores del ADC.

**Qué hay que hacer, en orden.**

1. **Circuito.** Un contacto por ocular que el montaje cierre al encastrarlo, con una resistencia
   distinta por ocular.
2. **Sketch.** Leer el pin y emitir una línea propia, al estilo de la que ya emite la posición.
   Protocolo actual, en `apps/device-lab/arduino/webusb_potenciometro/`:
   ```
   P:<0..1023>    posición del potenciómetro
   ```
   Haría falta algo como `L:<n>` para el ocular. Conviene mantener el formato de una línea por
   lectura, porque el lado del navegador ya lo parsea así.
3. **Aplicación.** `consumir()` en `apps/dual-telescope/src/focuser.js` sólo reconoce `P:`. Hay que
   agregar el caso `L:` y llamar a `setEyepiece()` con la clave correspondiente.
4. **Claves.** Las de `PUNTOS_DE_FOCO` (`len1`…`len4`) tienen que corresponderse con los tramos del
   ADC. Ver [Definir los oculares](#definir-los-oculares-y-medir-sus-puntos-de-foco).

**Dónde.**
- `apps/device-lab/arduino/webusb_potenciometro/`
- `apps/dual-telescope/src/focuser.js` — `consumir()`, `PUNTOS_DE_FOCO`, `setEyepiece()`

## Definir los oculares y medir sus puntos de foco

**Qué pasa.** `PUNTOS_DE_FOCO` en `apps/dual-telescope/src/focuser.js` tiene valores inventados,
repartidos parejo:

```js
export const PUNTOS_DE_FOCO = { '': 0.5, len1: 0.2, len2: 0.4, len3: 0.6, len4: 0.8 };
```

**La física, que conviene tener clara antes de medir.** En un telescopio real el enfocador desplaza
el ocular a lo largo del eje óptico, y hay foco cuando el plano focal del ocular coincide con el del
telescopio. Lo que mueve el punto de foco al cambiar de ocular **no es la distancia focal**, sino
dónde queda el plano focal del ocular respecto de su asiento en el portaocular. Dos oculares que
coinciden en eso son *parfocales* y se intercambian sin reenfocar; los que no, obligan a corregir.

O sea que hay dos magnitudes distintas por ocular, y hoy el código sólo usa una:

| Magnitud | Qué determina | Dónde vive |
|---|---|---|
| Distancia focal (mm) | Aumento y campo visual | Sin definir en `dual-telescope` |
| Desplazamiento del plano focal | Posición del foco en el recorrido | `PUNTOS_DE_FOCO` |

**Qué hay que hacer.**

1. **Listar los oculares reales del prototipo**, con su distancia focal.
2. **Derivar el campo visual de cada uno.** `core` ya lo calcula:
   `computeFovFromEyepiece(focalLength, eyepieceFocalLength)` en
   `packages/core/src/telescope/Telescope.js`. `kiosk-standalone` ya usa este patrón, con un
   telescopio de 200 mm de apertura y 1200 mm de focal y una tabla `LENS_FOCAL_LENGTHS`
   (`apps/kiosk-standalone/src/App.svelte`). Conviene reutilizar la idea en vez de inventar otra.
3. **Medir el punto de foco de cada ocular** sobre el recorrido real del potenciómetro, o bien
   elegir valores que hagan la mecánica legible si los oculares del prototipo resultan parfocales.
   Con oculares parfocales no hay efecto que reproducir, y habría que decidir si se simula igual por
   valor pedagógico.

**Decisión pendiente.** Si el cambio de ocular debe además cambiar el campo visual, hoy el zoom es un
control independiente del ocular.

**Dónde.**
- `apps/dual-telescope/src/focuser.js` — `PUNTOS_DE_FOCO`, `tolerancia`, `exponente`
- `packages/core/src/telescope/Telescope.js`
- `apps/kiosk-standalone/src/App.svelte` — `LENS_FOCAL_LENGTHS`

## Plan B: enfocador por teclado

**Cuándo aplica.** Sólo si la reconexión manual por WebUSB resulta molesta en el montaje real. Hoy
no lo es: perder la conexión requiere desenchufar el cable o reiniciar la placa, que son pasos de
montaje, no cosas que pasen solas.

**Qué cambiaría.** Que el Arduino actúe como teclado USB, igual que en `kiosk`. Un teclado no pide
permiso ni gesto, así que la reconexión deja de ser un problema.

**El costo, que no es sólo cambiar de transporte.** El potenciómetro entrega **posición absoluta** y
un teclado entrega **eventos discretos**. El enfoque pasaría a acumularse por pasos, y la posición
del software podría desfasarse de la del mando físico. Haría falta o una tecla de puesta a cero, o
cambiar el mando por un encoder rotatorio, que tampoco tiene posición absoluta.

**Qué ya existe.** `createKeyboardConnector()` en `packages/core/src/io/connectors.js` cubre el mapeo
de teclas a acciones. `kiosk-standalone` lo usa hoy con las teclas `+` y `-`, verificado contra el
hardware.

---

# Despliegue

## Rehacer el arranque de kiosk con la arquitectura de dual-telescope

**Qué pasa.** `kiosk-standalone` se arranca en Termux con `pnpm run dev`, o sea el dev server de
Vite. De ahí salen tres problemas que son el mismo:

1. **El dispositivo necesita el repo completo**, `node_modules` y compilar en Android, que es lento
   y es la razón de que el script suba el límite de memoria de Node a 1536 MB.
2. **Corre en modo `development`**, así que `import.meta.env.MODE` vale `'development'` y
   `loadConfig` elige `config.dev.js`. Hoy es inofensivo porque los dos configs son idénticos salvo
   el campo `env`.
3. **Los catálogos apuntan a los servidores remotos.** Los paths locales están comentados en el
   config, y activarlos requiere que el dispositivo corra en modo producción, o sea el punto 2.

**Qué hay que hacer.** Replicar lo que `dual-telescope` ya tiene y funciona:

| Pieza | En `dual-telescope` |
|---|---|
| Empaquetado | `scripts/pack-deploy.mjs` |
| Publicación en rama huérfana | `scripts/publish-deploy.mjs` |
| Arranque en el dispositivo | `start.sh` |
| Servidor de estáticos | `server/relay.js` |

`kiosk` no necesita relay, así que su paquete es `dist/` más un servidor de estáticos y el script de
arranque. El resto del esquema aplica igual: rama de deploy huérfana, clon con `--depth 1`, y el
dispositivo sin toolchain.

Con el build hecho en la PC, el modo pasa a ser `production` por construcción y los catálogos locales
dejan de estar bloqueados.

**Dónde.**
- `apps/kiosk-standalone/package.json` — scripts
- `apps/kiosk-standalone/src/config/`
- `apps/dual-telescope/scripts/`, `apps/dual-telescope/start.sh` — el modelo a copiar
- [deployment.md](deployment.md) — habría que extenderlo a `kiosk`

## Instalación como PWA

**Estado.** Pospuesto para los prototipos actuales, donde no evita ningún paso: el proceso relay hace
falta igual y el beneficio es asimétrico. Un service worker exige contexto seguro, así que el
dispositivo principal, servido por `localhost`, podría instalarse, y el guía, que recibe la página
por IP de LAN sobre HTTP plano, no. Igualarlos exige HTTPS con certificado en una IP de LAN, o sea
`mkcert` y su CA instalada en los dos teléfonos.

**Por qué sigue abierto.** Las versiones de hogar y educativa se instalan en dispositivos de
terceros, sin montaje físico, sin relay y sin punto de acceso propio. Ahí el PWA pasa a ser el
mecanismo de distribución, no una comodidad: ícono, pantalla completa, arranque de un toque y
funcionamiento sin conexión.

Esas apps se sirven por HTTPS desde un dominio, con lo cual la restricción de contexto seguro
desaparece y con ella la asimetría. **Conviene revisarlo antes de diseñar esas versiones, no
después.**

---

# Documentación

## Documentar el hardware físico

**Qué falta.** No hay ningún documento del montaje. `apps/device-lab/arduino/README.md` cubre sólo el
sketch del potenciómetro.

Sin cubrir: qué telescopio, cómo se monta cada teléfono, qué oculares, el circuito que detecta el
ocular puesto, el cableado y qué placa lleva cada prototipo.

Para un proyecto figital es la mitad ausente de la documentación: alguien que entra puede leer todo
el software y seguir sin saber qué hay del otro lado del cable.

## Elegir licencia

**Qué pasa.** El repo no tiene archivo de licencia, lo cual por defecto significa todos los derechos
reservados. Es incómodo justo cuando entra gente nueva.

Stellarium Web Engine, redistribuido en `packages/core/assets/`, es MIT y arrastra una obligación de
atribución que hoy no está cubierta.

**Decisión de Alessio Bellino** como gestor del proyecto.

---

# Aplicaciones

## Portar el overlay de seeing a dual-telescope

**Qué pasa.** El desenfoque del enfocador se aplica con un filtro CSS sobre el canvas del cielo. Con
los efectos de seeing apagados alcanza, y el pipeline WebGL de turbulencia no aportaría nada.

**Dónde engancha.** `aplicarBlur()` en `apps/dual-telescope/src/focuser.js` es el único punto que
toca el canvas, así que portar el overlay es apuntar esa función a su canvas y nada más.

**Bloqueo.** El overlay de `web-app` necesita una reescritura antes de portarse.

## Manejo de errores visible en kiosk

**Qué pasa.** `web-app` muestra los fallos de sensores en la fase `'error'` del overlay de
calibración. `kiosk-standalone` no tiene ninguna superficie visible para fallos de sensores ni de
carga de catálogos.

**Por qué importa.** Es una instalación desatendida en un museo: un fallo silencioso se ve igual que
un aparato apagado, y nadie puede diagnosticarlo sin conectar un cable.

**Qué existe.** El controlador ya reporta por `onError`, y `dual-telescope` ya tiene un aviso en
pantalla para la calibración que puede servir de modelo (`crearAvisoCalibracion()` en
`apps/dual-telescope/src/sky.js`).

## Llamadas directas a Protobject en web-app

**Qué pasa.** Cerca de 15 llamadas a `Protobject.Core.send(...)` en componentes de `web-app`
(`DateTimePicker`, `GlobePicker`, `Menu`) no pasan por `messageBus`.

**Por qué importa.** Limita qué tan intercambiable es el transporte. La promesa del bus es que
cambiar de Protobject a WebSocket sea un argumento de constructor; con estas llamadas sueltas, hay
que tocarlas una por una.

**Dónde.** `apps/web-app/src/telescope/`, `apps/web-app/src/lib/protobject.js`.

## `packages/shared-viewer`

**Qué es.** Un nivel intermedio de compartición entre `web-app` y `dual-telescope`: lo que las dos
necesitan y `kiosk` no. Mencionado en el diseño original de `core`, nunca diseñado.

**Estado.** Sin evidencia todavía de que haga falta. Conviene esperar a tener duplicación real que
justifique el paquete, en vez de crearlo por simetría.

---

# Transversal

## Sin tests automatizados

**Qué pasa.** Ninguna app tiene suite de tests. La verificación es manual: build, arranque del dev
server, y scripts Node ad-hoc para lo que es matemática pura.

**Candidatos concretos**, los dos ya escritos y en verde, hoy fuera del repo:

- Tasas del giroscopio contra rotaciones conocidas y contra la derivada numérica del apuntado.
- Ciclo de conexión del enfocador contra un WebUSB simulado: caída del cable, reconexión por evento,
  reconexión por reintento, revocación de permiso.

**Qué falta.** Decidir el runner y dónde viven. Sin eso, agregar más scripts sueltos no construye
una suite.

## Temporal por polyfill

**Qué pasa.** Se usa `@js-temporal/polyfill` en vez del `Temporal` nativo, en
`packages/core/src/time/`. El soporte nativo en los navegadores móviles donde corren estas apps no
está verificado, y el polyfill agrega peso al bundle.

**Qué habría que hacer.** Medir si los dispositivos de destino ya traen `Temporal` nativo. Si lo
traen, el polyfill se puede cargar condicionalmente o eliminar.
