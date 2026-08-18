#!/usr/bin/env bash
# Shebang portable a propósito: la ruta absoluta de Termux
# (/data/data/com.termux/files/usr/bin/bash) sólo existe ahí, y hacía que el
# script no se pudiera correr en ningún otro lado — ni siquiera para probarlo en
# la PC. `env bash` funciona en Termux (termux-exec reescribe estas rutas) y
# también en Linux/macOS/Git Bash. Si por lo que sea no arranca: `bash start.sh`.
#
# Arranque de dual-telescope en el dispositivo principal.
#
# El dispositivo que corre este script **es el principal**: sirve la app y hace
# de relay. Por defecto también es el que lleva los sensores; si las pruebas de
# montaje dicen lo contrario, se cambia con SENSOR_SOURCE (ver abajo) sin tocar
# una línea de código.
#
# Uso:
#   ./start.sh                      # fuente de sensores: ocular (por defecto)
#   SENSOR_SOURCE=guide ./start.sh  # la fuente pasa a ser el guía
#   PORT=9000 ./start.sh            # otro puerto
#   PULL=1 ./start.sh               # actualizar desde git antes de arrancar
#
# Este script NO compila. El build se hace en la PC y el dispositivo sólo baja
# el resultado: compilar en Android es lento y es la razón de que kiosk necesite
# subir el límite de memoria de Node. Ver docs/deployment.md.

set -euo pipefail

cd "$(dirname "$0")"

export SENSOR_SOURCE="${SENSOR_SOURCE:-ocular}"
export PORT="${PORT:-8080}"

if [ "${PULL:-0}" = "1" ]; then
  echo "[start] actualizando desde git…"
  git pull --ff-only
fi

if [ ! -d dist ]; then
  echo "[start] ERROR: no existe dist/." >&2
  echo "        Este dispositivo no compila. Genera el build en la PC y publícalo," >&2
  echo "        después tráelo con: PULL=1 ./start.sh   (ver docs/deployment.md)" >&2
  exit 1
fi

# El paquete de despliegue trae relay.mjs con 'ws' ya embebido, así que el
# dispositivo no necesita node_modules. Dentro del repo se usa el fuente.
if [ -f relay.mjs ]; then
  RELAY="relay.mjs"
elif [ -f server/relay.js ]; then
  RELAY="server/relay.js"
else
  echo "[start] ERROR: no encuentro el relay (ni relay.mjs ni server/relay.js)." >&2
  exit 1
fi

# Las URLs las imprime el relay al levantar. La IP sale de Node y no de aquí:
# `ip route get` y `hostname -i` devuelven loopback en Termux, o sea una
# dirección que el guía no puede alcanzar aunque este equipo sea el punto de
# acceso.
exec node "$RELAY"
