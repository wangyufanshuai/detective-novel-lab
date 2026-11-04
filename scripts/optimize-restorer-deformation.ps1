$ErrorActionPreference = 'Stop'
$workRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workRoot
try {
    $workFolder = 'docs/3d-town/classic-residents-v10/resident-03/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v10' -Force | Out-Null
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($workFolder + 'resident-03-raw.glb') ($workFolder + 'resident-03-colour.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($workFolder + 'resident-03-colour.log')
    if ($LASTEXITCODE -ne 0) { throw 'Colour compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($workFolder + 'resident-03-colour.glb') ($workFolder + 'resident-03-textures.glb') --slots normalTexture --lossless true --effort 60 *> ($workFolder + 'resident-03-normal.log')
    if ($LASTEXITCODE -ne 0) { throw 'Normal compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($workFolder + 'resident-03-textures.glb') 'public/assets/classic-residents/v10/resident-03.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($workFolder + 'resident-03-meshopt.log')
    if ($LASTEXITCODE -ne 0) { throw 'Geometry compression failed' }
} finally { Pop-Location }
