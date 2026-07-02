$ErrorActionPreference = "Stop"

$extensionId = "com.local.aioexporter"
$legacyExtensionId = "com.local.tripleformatexporter"
$source = Join-Path $PSScriptRoot "cep-panel"
$targetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$target = Join-Path $targetRoot $extensionId
$legacyTarget = Join-Path $targetRoot $legacyExtensionId

if (-not (Test-Path -LiteralPath $source)) {
    throw "CEP panel source folder was not found: $source"
}

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}

if (Test-Path -LiteralPath $legacyTarget) {
    Remove-Item -LiteralPath $legacyTarget -Recurse -Force
}

Copy-Item -LiteralPath $source -Destination $target -Recurse -Force

foreach ($version in 8..13) {
    $key = "HKCU:\Software\Adobe\CSXS.$version"
    New-Item -Path $key -Force | Out-Null
    New-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
}

Write-Host "Installed AIO Exporter CEP panel to:"
Write-Host $target
Write-Host ""
Write-Host "Restart Adobe Illustrator, then open Window > Extensions > AIO Exporter."
