# Sketches de prueba — entrada del potenciómetro

Sketch para **Arduino Leonardo**: manda la posición del potenciómetro por **WebUSB**.

Se probaron tres caminos y este es el que quedó. Los otros dos se descartaron con medición, no por
preferencia:

- **Web Serial** — no existe en Chrome para Android (medido el 2026-08-11). Servía en escritorio,
  pero la app corre en el teléfono.
- **HID gamepad** — habría funcionado, pero disfrazar un potenciómetro de joystick sólo tenía
  sentido si no quedaba nada mejor. WebUSB manda el número directamente.

La página que lo recibe es [`../io.html`](../io.html) (pestaña **Hardware**).

## Antes de empezar

**Conexión del potenciómetro lineal** (las tres patas), igual para los tres sketches:

```
extremo 1  ->  5V
cursor     ->  A0
extremo 2  ->  GND
```

Si al girar el valor va al revés, se invierten los dos extremos. No hay que tocar el código.

**Levantar la página de prueba**, desde la raíz del repo:

```bash
pnpm --filter @ventanaceleste/device-lab dev
```

Se abre en el **teléfono** (no en la PC, que es justamente lo que se quiere comprobar):
`https://<ip-de-la-PC>:5174/io.html` — hay que aceptar el aviso del certificado una vez.

**Conectar el Leonardo al teléfono por USB-OTG.** El teléfono tiene que alimentarlo; con algunos
cables OTG baratos no arranca, y eso se nota porque el LED de la placa queda apagado.

## Lo primero: mirar el cuadro de disponibilidad

Antes de cargar ningún sketch, abre `io.html` y mira la tarjeta **DISPONIBILIDAD**. Eso ya
descarta caminos sin tocar el hardware:

| Si dice | Entonces |
|---|---|
| WebUSB **sí** | Es el camino elegido |
| WebUSB **no** | Habría que reabrir la evaluación: el más probable de vuelta sería HID gamepad |

> **Medido el 2026-08-11 en el teléfono de prueba: Web Serial NO está disponible**, WebUSB sí.
> Eso es lo que decidió el camino.

También conviene anotar el user agent que muestra: si algún día cambia el navegador del
dispositivo, esto explica por qué cambió el resultado.

---

## Puesta en marcha

1. Instalar la librería **WebUSB** (Arduino IDE → Gestor de librerías).
2. Cargar `webusb_potenciometro/webusb_potenciometro.ino`.
3. En `io.html`, botón **WebUSB** y elegir la placa.

El botón ahora **abre el dispositivo y lee**, no sólo lo enumera: reclama la interfaz que tenga un
endpoint bulk de entrada, manda el control transfer que anuncia al host (equivalente a DTR — la
librería de Arduino no emite nada hasta recibirlo) y muestra lo que llega.

**Bien:** lista las interfaces con sus endpoints y después aparecen `P:512`, `P:640`… al girar.
**Mal, y qué significa cada uno:**

| Mensaje | Qué pasa |
|---|---|
| aparece el producto pero **no llega nada** al girar | Antes era el propio probe, que sólo enumeraba. Si sigue pasando: revisar que el sketch tenga el guard `if (!Salida) return;` y que se haya cargado la versión WebUSB |
| `unable to claim interface` | El sistema tomó el dispositivo con su driver y no lo suelta. No es el sketch |
| `sin endpoint bulk de entrada` | La placa no está exponiendo la interfaz WebUSB: casi seguro se cargó otro sketch |
| dice `NO vendor-specific` al elegir interfaz | Se reclamó la de CDC en vez de la de WebUSB. No debería pasar ya, pero si pasa el sketch cargado no es el WebUSB |

**Cómo se ve un Leonardo con el sketch WebUSB cargado** (medido, 2026-08-11):

```
iface 0 clase 2  : in/interrupt/1        <- CDC control
iface 1 clase 10 : out/bulk/2 in/bulk/3  <- CDC datos (el puerto serie de siempre)
iface 2 clase 255: out/bulk/4 in/bulk/5  <- WebUSB  ← esta es la que hay que usar
```

Que aparezcan tres interfaces es lo normal: la placa expone el puerto serie *y además* el de
WebUSB. Por eso la selección no puede ser "el primer bulk de entrada que aparezca" — ese es el de
CDC, al que no le escribe nadie, y entonces no llega nada aunque el resto esté perfecto.

---

## Detalles de los sketches que conviene conocer

Dos decisiones del sketch que no son cosméticas:

- **Tope de 20 ms entre envíos.** 50 Hz alcanza de sobra para un enfocador. Mandar más rápido
  sólo llena el canal, que ya nos costó tiempo en `web-app`.
- **Banda muerta de 4 cuentas.** El ADC nunca está quieto: sin esto el valor tiembla y se manda
  ruido de forma continua aunque nadie toque nada. 4 sobre 1024 es ~0,4% del recorrido.

El rango es `0..1023` porque el Leonardo tiene ADC de 10 bits. Otras placas dan otro rango (el
ESP32, 12 bits). El valor crudo no llega a la app: se normaliza a `0..1` en el borde, con mínimo y
máximo de configuración, en `apps/dual-telescope/src/focuser.js`.

## Estado

**Funcionando** (2026-08-11): el valor llega y sigue al potenciómetro en tiempo real.

## Distribución del teclado

`teclado_mediado` separa los campos con `:`. La librería `Keyboard` envía códigos de tecla con
distribución US, así que el carácter que llega depende de la distribución configurada en el
anfitrión:

| Distribución del teléfono | Llega |
|---|---|
| Inglés | `:` |
| Español | `ñ` |

**El teclado del dispositivo tiene que estar en inglés.** Medido en el aparato.

## Entradas al aire y enumeración USB

Medido en las dos placas: **una entrada analógica sin circuito conectado impide que Windows
reconozca la placa.**

Una entrada sin nada conectado no tiene tensión definida y su lectura salta sola, así que la
condición de banda muerta se cumple casi en cada vuelta y la placa emite sin parar desde el primer
instante. Ese caudal durante la ventana de enumeración la rompe, y la placa deja de reconocerse
hasta que se le carga un sketch que no emita.

| Placa | Sketch | Lee A1 | Emite sin circuito | Windows la reconoce |
|---|---|---|---|---|
| 2 | teclado, puente puesto | no emite nada | no | sí |
| 1 | teclado | sí | ruido de `R` constante | no |
| 1 | WebUSB | no lee A1 | no | sí |

Android tolera el mismo caudal sin problema, así que el síntoma sólo aparece en el escritorio.

Consecuencias:

- `LEER_OCULAR` en `teclado_mediado` queda en `0` mientras el circuito del ocular no exista.
- El ocular es removible por diseño, así que su entrada tiene que quedar definida también cuando no
  hay ocular puesto. La forma que no agrega componentes es que el ocular aporte la resistencia de
  arriba del divisor y la fija quede abajo, contra masa.
- Para recuperar una placa que ya no se reconoce, basta cargarle un sketch que no emita:
  `.\subir.ps1 rescate`.

## Versión de USB declarada: tiene que coincidir con el sketch

La versión que el dispositivo declara en su descriptor debe corresponder con lo que el sketch
realmente entrega:

| Sketch | Aporta descriptor BOS | Debe declarar |
|---|---|---|
| Con librería WebUSB | sí | 2.1 (`0x210`) |
| Cualquier otro | no | 2.0 (`0x200`) |

Declarar 2.1 significa, según la especificación, «tengo descriptor BOS». Windows lo pide; si no
llega, `usbccgp` no arranca y el dispositivo queda con Código 10, «se ha especificado un dispositivo
inexistente». Android no lo pide, así que ahí el síntoma no aparece.

**El error a evitar.** Las instrucciones de instalación de la librería WebUSB piden editar
`cores/arduino/USBCore.h` y poner `USB_VERSION` en `0x210`. Eso lo deja global: a partir de ahí
**todos** los sketches de esa instalación prometen un BOS que no tienen, y ninguno funciona en
Windows salvo el de WebUSB. La placa sigue funcionando en Android, lo cual hace el diagnóstico
confuso.

**Cómo se resuelve.** La constante está bajo `#ifndef`, así que se decide por sketch al compilar en
lugar de por instalación:

```
--build-property "build.extra_flags={build.usb_flags} -DUSB_VERSION=0x200"
```

`subir.ps1` lo hace solo: busca `WebUSB.h` en el sketch y elige `0x210` o `0x200`. Con eso da igual
cómo haya quedado editado el core.

Hay que conservar `{build.usb_flags}`, porque de ahí salen VID y PID.

**Si se usa el IDE**, conviene devolver `USBCore.h` a `0x200` y poner la excepción para WebUSB en un
`platform.local.txt` junto a `boards.txt`. Editar el core deja el problema latente para cualquier
otro proyecto de esa instalación.

**Cómo se llegó.** Lo señaló que una placa programada desde otra máquina funcionara y la misma placa
programada desde esta, no. El sketch no era la variable: lo era el firmware que genera cada
instalación, y la diferencia estaba en esa edición del core.
