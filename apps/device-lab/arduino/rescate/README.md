# Rescate del Leonardo

Un sketch que usa `Keyboard` y escribe sin parar deja la placa inutilizable: el
puerto queda ocupado, las pulsaciones caen sobre el IDE y la ventana del gestor
de arranque —unos 8 segundos tras un doble toque de reset— no alcanza para
operarlo a mano.

`rescate.ino` no abre `Keyboard` ni escribe nada. Deja la placa con un latido
lento en el LED y el puerto libre.

## Recuperar la placa

```powershell
powershell -ExecutionPolicy Bypass -File flash-rescate.ps1
```

1. Desenchufa la placa.
2. Ejecuta el comando.
3. Cuando diga que está vigilando, enchufa la placa y pulsa reset dos veces
   seguidas, rápido.

El script vigila la aparición de un puerto COM nuevo y lanza `avrdude` en el
instante en que aparece, así que no depende de llegar a tiempo con el ratón. Si
`avrdude` falla porque la ventana se cerró, sigue vigilando: basta repetir el
doble reset.

Usa el `avrdude` que ya trae el IDE instalado y el `rescate.hex` versionado aquí al lado. Ese
hex está commiteado a propósito: es el artefacto que tiene que existir justo cuando la placa no
responde, y compilarlo en ese momento agrega un punto de falla.

## Recompilar el sketch de rescate

```bash
arduino-cli compile --fqbn arduino:avr:leonardo --output-dir rescate/build rescate
```

El `arduino-cli` viene embebido en el IDE 2.x, en
`resources/app/lib/backend/resources/`. Necesita `ARDUINO_DIRECTORIES_DATA`
apuntando al directorio de datos del IDE, y `--libraries` apuntando a sus
librerías.

## Evitar que vuelva a pasar

`teclado_mediado` tiene un pin de seguridad: con D4 puenteado a GND no teclea
nada, y la placa se programa como cualquier otra. El puente es la vía normal;
este script es para cuando ya no hay puente que poner.

## Si Windows sigue sin reconocer la placa

Sintoma: Codigo 10 en el administrador de dispositivos, `STATUS_NO_SUCH_DEVICE`, y el telefono
en cambio si la reconoce.

Windows enlaza un controlador al par (VID/PID, identidad) y lo cachea. La identidad es el numero
de serie cuando el dispositivo lo reporta, y la ruta del puerto cuando no:

| Sketch | Modulos PluggableUSB | Numero de serie | Se presenta como |
|---|---|---|---|
| `webusb_potenciometro` | WebUSB | `WUART` | Compuesto |
| `teclado_mediado` | Keyboard | `HIDPC` | Compuesto |
| `rescate` | ninguno | sin serie | CDC simple |

Al pasar de un sketch compuesto a uno simple en el mismo puerto, Windows carga el padre compuesto
sobre un dispositivo que ya no lo es y falla. La placa esta sana.

```powershell
# consola de administrador
powershell -ExecutionPolicy Bypass -File limpiar-usb.ps1
```

Borra los nodos guardados, incluidos los fantasmas de conexiones anteriores. Despues hay que
desenchufar la placa y volver a enchufarla para que Windows la enumere desde cero.

El puente de seguridad de `teclado_mediado` no sirve para esto: el objeto `Keyboard` se construye
antes de `setup()` y registra la interfaz HID ahi mismo, asi que el puente impide teclear pero no
cambia el descriptor.
### La caché de descriptores

Si tras borrar los nodos el problema sigue, falta una caché que `pnputil` no toca:

```
HKLM\SYSTEM\CurrentControlSet\Control\usbflags\<VID><PID><revision>
```

Guarda lo que Windows aprendió del dispositivo la primera vez. El valor `osvc` registra si soporta
descriptores de sistema operativo de Microsoft, que es algo que la librería WebUSB instala para
anunciar su URL y pedir `WinUSB`.

Después de correr un sketch de WebUSB, esa marca queda puesta para el par VID/PID. Un sketch
posterior que no los provee recibe igual la petición, y `usbccgp` —el controlador de dispositivo
compuesto, que al Leonardo le corresponde porque declara asociación de interfaces— no arranca.
Resultado: Código 10.

`limpiar-usb.ps1` borra esa clave junto con los nodos.

Que el gestor de arranque funcione mientras el sketch falla encaja: Caterina se declara CDC simple,
sin asociación de interfaces, así que va directo a `usbser` y nunca pasa por `usbccgp`.
