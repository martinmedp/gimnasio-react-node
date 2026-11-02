# Respaldo del gimnasio: base de datos MySQL + imagenes subidas.
# Uso manual:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\respaldo.ps1
# Parametros opcionales:
#   -Destino          carpeta donde se guardan los respaldos (por defecto C:\respaldos-gimnasio)
#   -CarpetaExterna   segunda copia (un disco USB, una carpeta sincronizada con la nube)
#   -Conservar        cuantos respaldos guardar (por defecto 14)
# Si la base tuviera contrasena, definala en la variable de entorno
# RESPALDO_DB_PASSWORD (no la escriba en este archivo).

param(
  [string]$Destino = 'C:\respaldos-gimnasio',
  [string]$Base = 'gimnasio_db',
  [string]$Usuario = 'root',
  [string]$MysqlDump = 'C:\xampp\mysql\bin\mysqldump.exe',
  [string]$CarpetaExterna = '',
  [int]$Conservar = 14
)

# Cualquier error detiene el script y cae en el bloque catch del final
$ErrorActionPreference = 'Stop'

$marca = Get-Date -Format 'yyyyMMdd-HHmm'
# $PSScriptRoot es la carpeta "scripts"; su carpeta padre es el proyecto
$raiz = Split-Path -Parent $PSScriptRoot
$uploads = Join-Path $raiz 'backend\uploads'
$archivoSql = Join-Path $Destino "$Base-$marca.sql"
$archivoZip = Join-Path $Destino "respaldo-$marca.zip"
$log = Join-Path $Destino 'respaldo.log'

function Escribir-Log($mensaje) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $mensaje
  Write-Host $linea
  Add-Content -Path $log -Value $linea
}

try {
  if (-not (Test-Path $Destino)) {
    New-Item -ItemType Directory -Path $Destino | Out-Null
  }
  if (-not (Test-Path $MysqlDump)) {
    throw "No se encontro mysqldump en $MysqlDump"
  }

  # --single-transaction: copia consistente sin bloquear la base mientras
  #   la aplicacion se usa (las tablas son InnoDB).
  # --result-file: mysqldump escribe el archivo el mismo. No se usa ">"
  #   porque PowerShell lo guardaria en UTF-16 y el archivo quedaria danado.
  $argumentos = @(
    "--user=$Usuario",
    '--single-transaction',
    '--routines',
    '--triggers',
    '--default-character-set=utf8mb4',
    "--result-file=$archivoSql",
    $Base
  )
  if ($env:RESPALDO_DB_PASSWORD) {
    $argumentos = @("--password=$($env:RESPALDO_DB_PASSWORD)") + $argumentos
  }

  & $MysqlDump @argumentos
  if ($LASTEXITCODE -ne 0) {
    throw "mysqldump termino con codigo $LASTEXITCODE (esta MySQL encendido?)"
  }

  # Comprobacion: un volcado completo termina con "Dump completed".
  # Si no, el respaldo quedo a medias y no sirve
  $ultimasLineas = Get-Content -Path $archivoSql -Tail 3
  if (-not ($ultimasLineas -match 'Dump completed')) {
    throw 'El volcado de la base parece incompleto (no termina con "Dump completed")'
  }

  # Un solo .zip con el volcado y la carpeta de imagenes
  $contenido = @($archivoSql)
  if (Test-Path $uploads) {
    $contenido += $uploads
  }
  Compress-Archive -Path $contenido -DestinationPath $archivoZip -Force
  Remove-Item $archivoSql

  $tamano = [math]::Round((Get-Item $archivoZip).Length / 1MB, 2)
  Escribir-Log "OK: $archivoZip ($tamano MB)"

  # Segunda copia, si se indico una carpeta externa
  if ($CarpetaExterna) {
    if (Test-Path $CarpetaExterna) {
      Copy-Item -Path $archivoZip -Destination $CarpetaExterna
      Escribir-Log "Copia externa en $CarpetaExterna"
    }
    else {
      Escribir-Log "AVISO: la carpeta externa $CarpetaExterna no esta disponible"
    }
  }

  # Rotacion: se conservan los mas recientes y se borran los demas
  $antiguos = Get-ChildItem -Path $Destino -Filter 'respaldo-*.zip' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Conservar
  foreach ($antiguo in $antiguos) {
    Remove-Item $antiguo.FullName
    Escribir-Log "Eliminado respaldo antiguo: $($antiguo.Name)"
  }
}
catch {
  # Si fallo a medias, no dejar un volcado parcial
  if (Test-Path $archivoSql) {
    Remove-Item $archivoSql -ErrorAction SilentlyContinue
  }
  Escribir-Log "ERROR: $($_.Exception.Message)"
  exit 1
}