# Captura que hace Windows en el instante en que aparece la placa.
#
# Los dos datos que deciden son el codigo de problema y el SERVICIO, o sea que
# controlador se le asigno:
#
#   usbccgp  padre de dispositivo compuesto. Correcto para un sketch con Keyboard
#            o WebUSB; incorrecto para uno sin modulos PluggableUSB, y ahi da
#            Codigo 10.
#   usbser   puerto serie CDC. Es lo que corresponde a un sketch limpio.
#   (vacio)  Windows no le asigno controlador.
#
# Uso: ejecuta esto y enchufa la placa. Ctrl+C para cortar.

$ErrorActionPreference = 'SilentlyContinue'

$props = @{
  'problema' = 'DEVPKEY_Device_ProblemCode'
  'servicio' = 'DEVPKEY_Device_Service'
  'ubicacion' = 'DEVPKEY_Device_LocationInfo'
}

function Mostrar($x) {
  Write-Host ''
  Write-Host "  $($x.InstanceId)" -ForegroundColor Cyan
  Write-Host "    estado    : $($x.Status)"
  foreach ($k in $props.Keys) {
    $v = (Get-PnpDeviceProperty -InstanceId $x.InstanceId -KeyName $props[$k]).Data
    Write-Host ("    {0,-10}: {1}" -f $k, $v)
  }
}

Write-Host 'Vigilando VID_2341. Enchufa la placa ahora.' -ForegroundColor Yellow
Write-Host 'Si no aparece nada en 10 s, el problema esta antes de la enumeracion:'
Write-Host 'cable, puerto o alimentacion. Ctrl+C para cortar.'
Write-Host ''

$vistos = @{}
$limite = (Get-Date).AddMinutes(3)

while ((Get-Date) -lt $limite) {
  $ahora = Get-PnpDevice | Where-Object { $_.InstanceId -like '*VID_2341*' }
  foreach ($x in $ahora) {
    $pres = (Get-PnpDeviceProperty -InstanceId $x.InstanceId -KeyName 'DEVPKEY_Device_IsPresent').Data
    if (-not $pres) { continue }
    $clave = "$($x.InstanceId)|$($x.Status)"
    if ($vistos.ContainsKey($clave)) { continue }
    $vistos[$clave] = $true
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] aparecio o cambio:" -ForegroundColor Green
    Mostrar $x
  }
  # Los puertos COM presentes, que es lo que el IDE necesita ver.
  $com = [System.IO.Ports.SerialPort]::GetPortNames() -join ', '
  $clave = "COM|$com"
  if (-not $vistos.ContainsKey($clave)) {
    $vistos[$clave] = $true
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] puertos COM: $com" -ForegroundColor DarkGray
  }
  Start-Sleep -Milliseconds 300
}
