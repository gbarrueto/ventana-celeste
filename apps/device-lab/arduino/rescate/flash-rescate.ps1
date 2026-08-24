# Carga el sketch de rescate en un Leonardo que quedó inutilizable.
#
# El problema: un sketch que usa Keyboard puede teclear sin parar, y entonces el
# puerto queda ocupado y la ventana del gestor de arranque —unos 8 segundos tras
# un doble toque de reset— no alcanza para operar el IDE a mano.
#
# La solución es no operar a mano. Este script vigila la aparición de un puerto
# COM nuevo y lanza avrdude en el instante en que aparece.
#
# Uso:
#   1. Desenchufa la placa.
#   2. Ejecuta este script.
#   3. Cuando diga que está vigilando, enchufa la placa y pulsa reset dos veces
#      seguidas, rápido.
#
# Las rutas salen del IDE ya instalado; no hace falta nada más.

$ErrorActionPreference = 'Stop'

$avrdude = Join-Path $env:LOCALAPPDATA 'Arduino15\packages\arduino\tools\avrdude\8.0.0-arduino1\bin\avrdude.exe'
$conf    = Join-Path $env:LOCALAPPDATA 'Arduino15\packages\arduino\tools\avrdude\8.0.0-arduino1\etc\avrdude.conf'
$hex     = Join-Path $PSScriptRoot 'build\rescate.ino.hex'

foreach ($p in @($avrdude, $conf, $hex)) {
  if (-not (Test-Path $p)) { Write-Host "No encuentro: $p" -ForegroundColor Red; exit 1 }
}

# GetPortNames es inmediato, así que se puede sondear seguido sin lanzar procesos.
$base = [System.IO.Ports.SerialPort]::GetPortNames()
Write-Host "Puertos antes de empezar: $($base -join ', ')"
Write-Host ''
Write-Host 'Vigilando. Enchufa la placa y pulsa reset DOS VECES, rapido.' -ForegroundColor Yellow
Write-Host 'Ctrl+C para cortar.'
Write-Host ''

$limite = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $limite) {
  $ahora = [System.IO.Ports.SerialPort]::GetPortNames()
  $nuevo = $ahora | Where-Object { $base -notcontains $_ } | Select-Object -First 1

  if ($nuevo) {
    Write-Host "Puerto del gestor de arranque: $nuevo" -ForegroundColor Green
    # avr109 es el protocolo del gestor de arranque Caterina del 32u4.
    & $avrdude -C $conf -patmega32u4 -cavr109 -P $nuevo -b57600 -D -U "flash:w:$hex`:i"
    if ($LASTEXITCODE -eq 0) {
      Write-Host ''
      Write-Host 'Listo. La placa ya no teclea; el puerto vuelve a ser usable.' -ForegroundColor Green
      exit 0
    }
    Write-Host ''
    Write-Host 'avrdude fallo. Suele ser que se cerro la ventana: reintenta el doble reset.' -ForegroundColor Yellow
    # El puerto del gestor desaparece al cerrarse, asi que se vuelve a la base.
    $base = [System.IO.Ports.SerialPort]::GetPortNames()
  }

  Start-Sleep -Milliseconds 100
}

Write-Host 'Se agotaron los 2 minutos sin ver un puerto nuevo.' -ForegroundColor Red
exit 1
