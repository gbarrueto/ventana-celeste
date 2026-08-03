#!/data/data/com.termux/files/usr/bin/bash
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
# subir el límite de memoria de Node. Ver docs/DEPLOYMENT.md.

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
  echo "        Este dispositivo no compila. Generá el build en la PC y publicalo," >&2
  echo "        después traelo con: PULL=1 ./start.sh   (ver docs/DEPLOYMENT.md)" >&2
  exit 1
fi

# Sin node_modules no hay 'ws'. Se instala una vez, no en cada arranque.
if [ ! -d node_modules ] && [ ! -d ../../node_modules ]; then
  echo "[start] ERROR: faltan dependencias. Corré 'pnpm install' una vez en el dispositivo." >&2
  exit 1
fi

# IP en la LAN, para poder abrir el guía desde el otro teléfono.
IP="$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || true)"
[ -z "$IP" ] && IP="$(hostname -i 2>/dev/null | awk '{print $1}' || echo '<ip-del-dispositivo>')"

echo "[start] fuente de sensores : $SENSOR_SOURCE"
echo "[start] ocular (este equipo): http://localhost:$PORT/"
echo "[start] guía (otro teléfono): http://$IP:$PORT/guide.html"
echo

# El relay sirve los estáticos y hace de puente entre los dos roles.
exec node server/relay.js
