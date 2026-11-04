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
$artArguments = @('--background','--factory-startup','--python-exit-code','1','--python','scripts/build-blender-room-material-pass.py','--','--views',$Views,'--samples',$Samples,'--width',$Width,'--atlas',$Atlas)
if ($Draft) { $artArguments += '--draft' }
if ($ResumeBake) { $artArguments += '--resume-bake' }
Push-Location $repoRoot
try {
    # The unit/radiance/axis calibration is unchanged from the pinned v7 run.
    # Its original source and measurements remain hash-verified by the v8 tests.
    $artLog = Join-Path $repoRoot 'outputs/blender-v8-art-pass.log'
    & $BlenderPath @artArguments *> $artLog
    Get-Content -LiteralPath $artLog -Tail 12
    if ($LASTEXITCODE -ne 0) { throw "Background material pass failed. See $artLog" }
    if (-not $Draft) {
        $roundtripLog = Join-Path $repoRoot 'outputs/blender-v8-roundtrip.log'
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/verify-blender-material-roundtrip.py *> $roundtripLog
        if ($LASTEXITCODE -ne 0) { throw "Compressed model verification failed. See $roundtripLog" }
        Select-String -LiteralPath $roundtripLog -Pattern 'ROUNDTRIP=' | ForEach-Object { $_.Line }
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/verify-blender-prop-atlas.py
        if ($LASTEXITCODE -ne 0) { throw 'Saved macro UV verification failed.' }
    }
} finally { Pop-Location }
