# Borra los nodos de dispositivo que Windows guardó para la placa.
#
# Por que hace falta: Windows enlaza un controlador al par (VID/PID, identidad) y
# lo cachea. La identidad es el numero de serie cuando el dispositivo lo reporta,
# y la ruta del puerto cuando no. Un sketch con Keyboard o WebUSB reporta serie y
# se presenta como dispositivo COMPUESTO; un sketch sin esos modulos no reporta
# serie y se presenta como CDC simple.
#
# Al pasar de uno a otro en el mismo puerto, Windows intenta cargar el padre
# compuesto sobre un dispositivo que ya no lo es y falla con Codigo 10,
# STATUS_NO_SUCH_DEVICE. La placa esta sana; lo que sobra es el nodo viejo.
#
# Requiere consola de administrador.

$ErrorActionPreference = 'Stop'

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host 'Hace falta una consola de administrador.' -ForegroundColor Red
  Write-Host 'Abre PowerShell como administrador y vuelve a ejecutarlo.'
  exit 1
}

$nodos = Get-PnpDevice | Where-Object { $_.InstanceId -like 'USB\VID_2341*' -or $_.InstanceId -like 'HID\VID_2341*' }

if (-not $nodos) { Write-Host 'No hay nodos de Arduino registrados.'; exit 0 }

Write-Host 'Nodos encontrados:' -ForegroundColor Yellow
foreach ($n in $nodos) { Write-Host ('  {0,-8} {1}' -f $n.Status, $n.InstanceId) }
Write-Host ''

foreach ($n in $nodos) {
  Write-Host "Quitando $($n.InstanceId)"
  # /force alcanza tambien a los fantasmas, que son los de conexiones anteriores.
  & pnputil /remove-device $n.InstanceId /force 2>&1 | Select-Object -Last 1
}

Write-Host ''
Write-Host ''
Write-Host 'Borrando la cache de descriptores (usbflags)...' -ForegroundColor Yellow

# usbflags cachea, por VID+PID+revision, cosas que Windows aprendio del
# dispositivo la primera vez. La mas relevante aca es osvc: si soporta
# descriptores de sistema operativo de Microsoft. La libreria WebUSB los instala,
# asi que un sketch de WebUSB deja esa marca puesta. Con un sketch posterior que
# no los provee, Windows los pide igual por el dato cacheado y la enumeracion
# falla con Codigo 10.
#
# pnputil no toca esta clave: por eso borrar los nodos de dispositivo no alcanza.
$flags = 'HKLM:\SYSTEM\CurrentControlSet\Control\usbflags'
$claves = Get-ChildItem $flags -ErrorAction SilentlyContinue |
          Where-Object { $_.PSChildName -like '2341*' }
if (-not $claves) {
  Write-Host '  no hay entradas para VID 2341'
} else {
  foreach ($k in $claves) {
    Write-Host ('  quitando ' + $k.PSChildName)
    Remove-Item $k.PSPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'Listo. Desenchufa la placa, espera cinco segundos y vuelve a enchufarla.' -ForegroundColor Green
Write-Host 'Windows la va a enumerar desde cero, sin el enlace viejo.'
