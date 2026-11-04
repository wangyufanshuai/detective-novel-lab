param(
    [string]$BlenderPath = 'D:\blender.exe',
    [string]$Views = 'all',
    [int]$Samples = 64,
    [int]$Width = 1440
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) {
    $blenderCommand = Get-Command blender -ErrorAction SilentlyContinue
    if ($null -eq $blenderCommand) { throw 'Set -BlenderPath to an installed Blender executable.' }
    $BlenderPath = $blenderCommand.Source
}
$logDirectory = Join-Path $repoRoot 'outputs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory 'blender-room-review.log'
Push-Location $repoRoot
try {
    & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/build-blender-room-review.py -- --views $Views --samples $Samples --width $Width *> $logPath
    $renderExit = $LASTEXITCODE
    Get-Content -LiteralPath $logPath -Tail 8
    if ($renderExit -ne 0) { throw "Blender render failed ($renderExit). See $logPath" }
    Write-Output 'Background Blender finished. Art/runtime approval remains pending.'
} finally {
    Pop-Location
}
