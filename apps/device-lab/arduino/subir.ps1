# Compila y sube un sketch usando la ventana del gestor de arranque.
#
# Sirve mientras Windows no reconozca la placa en modo aplicacion: el gestor de
# arranque es un programa aparte, se declara CDC simple y si enumera, asi que
# programar sigue siendo posible aunque el sketch despues no aparezca como COM.
#
# Uso:
#   .\subir.ps1                      # sube teclado_mediado
#   .\subir.ps1 rescate              # sube el sketch de rescate
#   .\subir.ps1 teclado_mediado      # explicito
#
# Pasos: desenchufa la placa, ejecuta esto, y cuando lo pida enchufala y pulsa
# reset DOS VECES seguidas, rapido.

param([string]$Sketch = 'teclado_mediado')

$ErrorActionPreference = 'Stop'

$ide     = Join-Path $env:LOCALAPPDATA 'Programs\Arduino IDE\resources\app\lib\backend\resources'
$cli     = Join-Path $ide 'arduino-cli.exe'
$datos   = Join-Path $env:LOCALAPPDATA 'Arduino15'
$libs    = Join-Path $datos 'libraries'
$avrdude = Join-Path $datos 'packages\arduino\tools\avrdude\8.0.0-arduino1\bin\avrdude.exe'
$conf    = Join-Path $datos 'packages\arduino\tools\avrdude\8.0.0-arduino1\etc\avrdude.conf'
$carpeta = Join-Path $PSScriptRoot $Sketch

foreach ($p in @($cli, $avrdude, $conf, $carpeta)) {
  if (-not (Test-Path $p)) { Write-Host "No encuentro: $p" -ForegroundColor Red; exit 1 }
}

$env:ARDUINO_DIRECTORIES_DATA = $datos
$salida = Join-Path $carpeta 'build'

Write-Host "Compilando $Sketch..." -ForegroundColor Cyan
& $cli compile --fqbn arduino:avr:leonardo --libraries $libs --output-dir $salida $carpeta
if ($LASTEXITCODE -ne 0) { Write-Host 'Fallo la compilacion.' -ForegroundColor Red; exit 1 }

$hex = Join-Path $salida "$Sketch.ino.hex"
if (-not (Test-Path $hex)) { Write-Host "No se genero $hex" -ForegroundColor Red; exit 1 }

# El puerto del gestor de arranque aparece unos 8 segundos y despues se va. En
# vez de correr a seleccionarlo a mano, se vigila su aparicion y se lanza
# avrdude en el instante en que existe.
$base = [System.IO.Ports.SerialPort]::GetPortNames()
Write-Host ''
Write-Host "Puertos antes: $($base -join ', ')"
Write-Host 'Enchufa la placa y pulsa reset DOS VECES, rapido.' -ForegroundColor Yellow
Write-Host ''

$limite = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $limite) {
  $nuevo = [System.IO.Ports.SerialPort]::GetPortNames() | Where-Object { $base -notcontains $_ } | Select-Object -First 1
  if ($nuevo) {
    Write-Host "Gestor de arranque en $nuevo" -ForegroundColor Green
    & $avrdude -C $conf -patmega32u4 -cavr109 -P $nuevo -b57600 -D -U "flash:w:$hex`:i"
    if ($LASTEXITCODE -eq 0) {
      Write-Host ''
      Write-Host "$Sketch cargado." -ForegroundColor Green
      exit 0
    }
    Write-Host 'Se cerro la ventana. Repite el doble reset.' -ForegroundColor Yellow
    $base = [System.IO.Ports.SerialPort]::GetPortNames()
  }
  Start-Sleep -Milliseconds 100
}

Write-Host 'Se agotaron los 2 minutos sin ver el gestor de arranque.' -ForegroundColor Red
exit 1
