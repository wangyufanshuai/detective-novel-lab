param()
$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskProjectRoot
try {
    $taskPackage = Join-Path $taskProjectRoot 'docs\3d-town\classic-railway-v2'
    $taskAsset = Join-Path $taskProjectRoot 'public\assets\classic-railway\v2\classic-railway.glb'
    $taskExport = Get-Content -Raw (Join-Path $taskPackage 'runtime-export.json') | ConvertFrom-Json
    if ($taskExport.optimization) { throw 'This package is already optimized. Export the reviewed Blender source again before running this script.' }
    if ((Get-FileHash -LiteralPath $taskAsset -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExport.asset.sha256) { throw 'Raw export identity mismatch' }
    New-Item -ItemType Directory -Force (Join-Path $taskPackage 'meshes'),(Join-Path $taskPackage 'runtime') | Out-Null
    Copy-Item -LiteralPath $taskAsset -Destination (Join-Path $taskPackage 'meshes\classic-railway-raw.glb')
    Copy-Item -LiteralPath (Join-Path $taskPackage 'runtime-export.json') -Destination (Join-Path $taskPackage 'runtime\raw-export.json')
    & npx --yes --package '@gltf-transform/cli@4.5.1' gltf-transform resize (Join-Path $taskPackage 'meshes\classic-railway-raw.glb') (Join-Path $taskPackage 'runtime\resized.glb') --width 512 --height 512 *> (Join-Path $taskPackage 'runtime\resize.log')
    if ($LASTEXITCODE -ne 0) { throw 'Texture resize failed' }
    & npx --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp (Join-Path $taskPackage 'runtime\resized.glb') (Join-Path $taskPackage 'runtime\webp.glb') --quality 90 --slots baseColorTexture *> (Join-Path $taskPackage 'runtime\texture-optimization.log')
    if ($LASTEXITCODE -ne 0) { throw 'Texture compression failed' }
    & npx --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt (Join-Path $taskPackage 'runtime\webp.glb') $taskAsset --quantize-position 16 --quantize-texcoord 16 --quantize-normal 10 *> (Join-Path $taskPackage 'runtime\geometry-optimization.log')
    if ($LASTEXITCODE -ne 0) { throw 'Geometry compression failed' }
    & python (Join-Path $PSScriptRoot 'record-classic-room-v2-export.py')
    if ($LASTEXITCODE -ne 0) { throw 'Final optimized asset validation failed' }
    & python (Join-Path $PSScriptRoot 'calibrate-classic-room-v2.py')
    if ($LASTEXITCODE -ne 0) { throw 'Runtime lighting calibration failed' }
} finally { Pop-Location }
