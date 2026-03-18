Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$Nuspec = Join-Path $RootDir 'packaging/chocolatey/bonjou.nuspec'

if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    throw 'choco CLI not found. Install Chocolatey CLI first.'
}

$apiKey = $env:CHOCO_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw 'CHOCO_API_KEY environment variable is required for push.'
}

Push-Location $RootDir
try {
    choco pack $Nuspec
    $nupkg = Get-ChildItem -Path $RootDir -Filter 'bonjou.*.nupkg' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $nupkg) {
        throw 'No .nupkg produced by choco pack.'
    }

    choco push $nupkg.FullName --source https://push.chocolatey.org/ --api-key $apiKey
    Write-Host "Chocolatey publish complete: $($nupkg.Name)"
}
finally {
    Pop-Location
}
