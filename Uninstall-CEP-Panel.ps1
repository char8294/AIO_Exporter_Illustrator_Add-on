$ErrorActionPreference = "Stop"

$extensionId = "com.local.aioexporter"

if (-not $env:APPDATA) {
    throw "APPDATA is not set."
}

$targetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$target = Join-Path $targetRoot $extensionId

$targetRootFull = [System.IO.Path]::GetFullPath($targetRoot).TrimEnd("\", "/")
$targetFull = [System.IO.Path]::GetFullPath($target).TrimEnd("\", "/")
$requiredPrefix = $targetRootFull + [System.IO.Path]::DirectorySeparatorChar

if (-not $targetFull.StartsWith($requiredPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved extension path is outside the CEP extensions folder: $targetFull"
}

if (Test-Path -LiteralPath $targetFull) {
    Remove-Item -LiteralPath $targetFull -Recurse -Force
    Write-Host "Removed AIO Exporter CEP panel from:"
    Write-Host $targetFull
} else {
    Write-Host "AIO Exporter CEP panel is not installed at:"
    Write-Host $targetFull
}

Write-Host ""
Write-Host "Restart Adobe Illustrator if it is currently open."
