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

param(
  [string]$Sketch = 'teclado_mediado',
  # Cambiar la definicion de placa cambia el PID que declara el dispositivo, y con
  # eso Windows la trata como hardware nuevo, sin la cache del par VID/PID viejo.
  # arduino:avr:micro declara 8037 en vez del 8036 del Leonardo. Mismo micro y
  # mismo gestor de arranque, asi que la carga funciona igual.
  [string]$Fqbn = 'arduino:avr:leonardo'
)

$ErrorActionPreference = 'Stop'

$ide     = Join-Path $env:LOCALAPPDATA 'Programs\Arduino IDE\resources\app\lib\backend\resources'
$cli     = Join-Path $ide 'arduino-cli.exe'
$datos   = Join-Path $env:LOCALAPPDATA 'Arduino15'
# Dos rutas de librerias: las que trae el IDE y las del cuaderno de bocetos,
# donde vive WebUSB por haberse instalado desde el gestor de librerias.
$libsIde = Join-Path $datos 'libraries'
$libsUsr = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Arduino\libraries'
$avrdude = Join-Path $datos 'packages\arduino\tools\avrdude\8.0.0-arduino1\bin\avrdude.exe'
$conf    = Join-Path $datos 'packages\arduino\tools\avrdude\8.0.0-arduino1\etc\avrdude.conf'
$carpeta = Join-Path $PSScriptRoot $Sketch

foreach ($p in @($cli, $avrdude, $conf, $carpeta)) {
  if (-not (Test-Path $p)) { Write-Host "No encuentro: $p" -ForegroundColor Red; exit 1 }
}

# La version de USB que declara el dispositivo tiene que coincidir con lo que el
# sketch realmente entrega:
#
#   con libreria WebUSB  -> aporta descriptor BOS  -> 2.1
#   cualquier otro       -> no aporta BOS          -> 2.0
#
# Declarar 2.1 sin entregar BOS hace que Windows lo pida, no lo reciba, y que
# usbccgp no arranque: Codigo 10. Android no lo pide y no se entera.
#
# Las instrucciones de instalacion de la libreria WebUSB piden editar USBCore.h y
# poner 0x210. Eso lo deja global, o sea que TODOS los sketches pasan a prometer
# un BOS que no tienen. De ahi venia el problema.
#
# Se decide por sketch en vez de por instalacion. La constante esta bajo #ifndef,
# asi que esto gana sin tocar el core, y da igual como haya quedado editado.
$usaWebUsb = Select-String -Path (Join-Path $carpeta '*.ino') -Pattern 'WebUSB\.h' -Quiet
$usbVersion = if ($usaWebUsb) { '0x210' } else { '0x200' }
$flagsUsb = "{build.usb_flags} -DUSB_VERSION=$usbVersion"
Write-Host "USB $usbVersion ($(if ($usaWebUsb) { 'el sketch usa WebUSB' } else { 'sin WebUSB' }))" -ForegroundColor DarkGray

$env:ARDUINO_DIRECTORIES_DATA = $datos
$salida = Join-Path $carpeta 'build'

Write-Host "Compilando $Sketch..." -ForegroundColor Cyan
& $cli compile --fqbn $Fqbn --libraries $libsIde --libraries $libsUsr --build-property "build.extra_flags=$flagsUsb" --output-dir $salida $carpeta
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
