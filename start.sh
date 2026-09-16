#!/usr/bin/env bash
# Shebang portable a propósito: la ruta absoluta de Termux
# (/data/data/com.termux/files/usr/bin/bash) sólo existe ahí, y hacía que el
# script no se pudiera correr en ningún otro lado — ni siquiera para probarlo en
# la PC. `env bash` funciona en Termux (termux-exec reescribe estas rutas) y
# también en Linux/macOS/Git Bash. Si por lo que sea no arranca: `bash start.sh`.
#
# Arranque de kiosk-standalone en el dispositivo.
#
# Uso:
#   ./start.sh              # arranca en el puerto por defecto (5174)
#   PORT=8080 ./start.sh    # otro puerto
#   PULL=1 ./start.sh       # actualizar desde git antes de arrancar
#
# Este script NO compila. El build se hace en la PC y el dispositivo sólo baja
# el resultado: compilar en Android es lento y es la razón de que kiosk necesite
# subir el límite de memoria de Node. Ver docs/deployment.md.

set -euo pipefail

cd "$(dirname "$0")"

export PORT="${PORT:-5174}"

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

if [ -f server.mjs ]; then
  SERVER="server.mjs"
else
  echo "[start] ERROR: no encuentro server.mjs." >&2
  exit 1
fi

exec node "$SERVER"
