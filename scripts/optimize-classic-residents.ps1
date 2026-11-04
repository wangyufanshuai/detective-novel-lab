param()
$ErrorActionPreference = 'Stop'
$residentTaskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $residentTaskRoot
try {
    $residentProfiles = (Get-Content -LiteralPath 'docs/3d-town/classic-residents-v1/profiles.json' -Raw -Encoding UTF8 | ConvertFrom-Json).profiles
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v1' -Force | Out-Null
    foreach ($residentActor in @('resident-03', 'resident-06', 'resident-08')) {
        $residentProfile = $residentProfiles | Where-Object actorId -eq $residentActor
        $residentInput = 'docs/3d-town/classic-residents-v1/' + $residentActor + '/' + $residentProfile.id + '-raw.glb'
        $residentOutput = 'public/assets/classic-residents/v1/' + $residentActor + '.glb'
        $residentLog = 'docs/3d-town/classic-residents-v1/' + $residentActor + '/optimization.log'
        & npx --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt $residentInput $residentOutput --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> $residentLog
        if ($LASTEXITCODE -ne 0) { throw ('Resident compression failed: ' + $residentActor) }
    }
    & 'D:\python\python.exe' 'scripts/record-classic-residents-export.py'
    if ($LASTEXITCODE -ne 0) { throw 'Resident export verification failed' }
} finally { Pop-Location }
