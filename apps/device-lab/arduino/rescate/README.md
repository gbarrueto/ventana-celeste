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

Usa el `avrdude` y el `hex` que ya trae el IDE instalado; no hace falta nada más.

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
