# Sketches de prueba — entrada del potenciómetro

Tres sketches para **Arduino Leonardo**, uno por cada camino posible. La idea es probarlos en
orden y **parar en el primero que funcione en el teléfono**: no hace falta que anden los tres.

La página que los recibe es [`../io.html`](../io.html) (IO Probe).

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
pnpm --filter @ventanaceleste/orientation-lab dev
```

Se abre en el **teléfono** (no en la PC, que es justamente lo que se quiere comprobar):
`https://<ip-de-la-PC>:5174/io.html` — hay que aceptar el aviso del certificado una vez.

**Conectar el Leonardo al teléfono por USB-OTG.** El teléfono tiene que alimentarlo; con algunos
cables OTG baratos no arranca, y eso se nota porque el LED de la placa queda apagado.

## Lo primero: mirar el cuadro de disponibilidad

Antes de cargar ningún sketch, abrí `io.html` y mirá la tarjeta **DISPONIBILIDAD**. Eso ya
descarta caminos sin tocar el hardware:

| Si dice | Entonces |
|---|---|
| Web Serial **sí** | Plan A sirve. Es el más simple, ir con ese |

> Medido el 2026-08-11 en el teléfono de prueba: **Web Serial no está disponible**. Confirma lo
> que se sospechaba y descarta el Plan A en Android.
| Web Serial **no**, WebUSB **sí** | Saltar al Plan B |
| las dos **no** | Plan C (gamepad), que funciona seguro |

También conviene anotar el user agent que muestra: si algún día cambia el navegador del
dispositivo, esto explica por qué cambió el resultado.

---

## Plan A — Web Serial

1. Cargar `serial_potenciometro/serial_potenciometro.ino`.
2. En `io.html`, botón **Web Serial**.
3. Elegir el Leonardo en el diálogo de permiso.
4. Girar el potenciómetro durante los 3 segundos que lee.

**Bien:** aparecen líneas `P:512`, `P:640`… cambiando al girar.
**Mal:** *"navigator.serial no existe"* → el navegador no implementa la API; pasar al Plan B.

## Plan B — WebUSB

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
| `unable to claim interface` | El sistema tomó el dispositivo con su driver y no lo suelta. No es el sketch. Motivo suficiente para pasar al Plan C |
| `sin endpoint bulk de entrada` | La placa no está exponiendo la interfaz WebUSB: casi seguro se cargó otro sketch |

## Plan C — HID gamepad

1. Instalar la librería **Joystick** de MHeironimus (Gestor de librerías → "ArduinoJoystickLibrary").
2. Cargar `gamepad_potenciometro/gamepad_potenciometro.ino`.
3. En `io.html`, mirar la tarjeta **EJES DE GAMEPAD**. **Girar el potenciómetro**: los navegadores
   no muestran un mando hasta que hay actividad, así que si no se toca nada parece que no está.

**Bien:** aparece el nombre del dispositivo y una barra que sigue al potenciómetro.
**Mal:** no aparece nunca aun girando → el teléfono no lo reconoce como mando.

---

## Detalles de los sketches que conviene conocer

Los tres comparten dos decisiones, y ninguna es cosmética:

- **Tope de 20 ms entre envíos.** 50 Hz alcanza de sobra para un enfocador. Mandar más rápido
  sólo llena el canal, que ya nos costó tiempo en `web-app`.
- **Banda muerta de 4 cuentas.** El ADC nunca está quieto: sin esto el valor tiembla y se manda
  ruido de forma continua aunque nadie toque nada. 4 sobre 1024 es ~0,4% del recorrido.

El rango es `0..1023` porque el Leonardo tiene ADC de 10 bits. Otras placas dan otro rango (el
ESP32, 12 bits), y **por eso el valor crudo no debería llegar a la app**: se normaliza a `0..1` en
el borde, con mínimo y máximo de configuración. Cambiar de potenciómetro pasa a ser dos números,
no tocar lógica. Ver §5.4 de [`../../../docs/DUAL_TELESCOPE_PLAN.md`](../../../docs/DUAL_TELESCOPE_PLAN.md).

## Qué reportar

Con saber esto alcanza para elegir y seguir:

1. Qué dice el cuadro de disponibilidad (las cuatro filas).
2. Cuál de los tres planes llegó a mostrar el valor cambiando.
3. Si alguno falló, con qué mensaje exacto.
