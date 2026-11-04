param()
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    & npx --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt 'docs/3d-town/classic-investigator-v1/investigator-raw.glb' 'public/assets/classic-investigator/v1/investigator.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> 'docs/3d-town/classic-investigator-v1/optimization.log'
    if ($LASTEXITCODE -ne 0) { throw 'Character compression failed' }
    & python 'scripts/record-classic-investigator-export.py'
    if ($LASTEXITCODE -ne 0) { throw 'Character payload validation failed' }
} finally { Pop-Location }
