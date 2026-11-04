param(
    [string]$BlenderPath = 'D:\blender.exe',
    [string]$Views = 'all',
    [int]$Samples = 64,
    [int]$Width = 1600,
    [int]$Atlas = 2048,
    [switch]$Draft,
    [switch]$ResumeBake
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw 'Set -BlenderPath to the installed Blender executable.' }
$artLog = Join-Path $repoRoot 'outputs/blender-v6-art-pass.log'
$artArguments = @('--background','--factory-startup','--python-exit-code','1','--python','scripts/build-blender-room-surface-pass.py','--','--views',$Views,'--samples',$Samples,'--width',$Width,'--atlas',$Atlas)
if ($Draft) { $artArguments += '--draft' }
if ($ResumeBake) { $artArguments += '--resume-bake' }
Push-Location $repoRoot
try {
    if (-not $Draft -and -not $ResumeBake) {
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/calibrate-blender-surface-bake.py *> (Join-Path $repoRoot 'outputs/blender-v6-calibration.log')
        if ($LASTEXITCODE -ne 0) { throw 'Diffuse light normalization calibration failed.' }
    }
    & $BlenderPath @artArguments *> $artLog
    $artExit = $LASTEXITCODE
    Get-Content -LiteralPath $artLog -Tail 12
    if ($artExit -ne 0) { throw "Background art pass failed ($artExit). See $artLog" }
    if (-not $Draft) {
        $roundtripLog = Join-Path $repoRoot 'outputs/blender-v6-roundtrip.log'
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/verify-blender-surface-roundtrip.py *> $roundtripLog
        $roundtripExit = $LASTEXITCODE
        Select-String -LiteralPath $roundtripLog -Pattern 'ROUNDTRIP=' | ForEach-Object { $_.Line }
        if ($roundtripExit -ne 0) { throw "Compressed model verification failed. See $roundtripLog" }
    }
} finally {
    Pop-Location
}

