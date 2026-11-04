$ErrorActionPreference = 'Stop'
$drapeRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $drapeRoot
try {
    $drapeFolder = 'docs/3d-town/classic-residents-v4/resident-08/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v4' -Force | Out-Null
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($drapeFolder + 'rb-lin-ali-raw.glb') ($drapeFolder + 'colour-webp.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($drapeFolder + 'webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Drape colour compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($drapeFolder + 'colour-webp.glb') ($drapeFolder + 'textures.glb') --slots normalTexture --lossless true --effort 60 *> ($drapeFolder + 'normal-webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Drape normal compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($drapeFolder + 'textures.glb') 'public/assets/classic-residents/v4/resident-08.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($drapeFolder + 'meshopt.log')
    if ($LASTEXITCODE -ne 0) { throw 'Drape geometry compression failed' }
} finally { Pop-Location }
