$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$exePath = Join-Path $toolsDir 'bonjou.exe'

Uninstall-BinFile -Name 'bonjou'

if (Test-Path $exePath) {
  Remove-Item $exePath -Force
}