$ErrorActionPreference = 'Stop'
$uniformRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $uniformRoot
try {
    $uniformFolder = 'docs/3d-town/classic-residents-v5/resident-06/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v5' -Force | Out-Null
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($uniformFolder + 'rb-gu-yuanshan-raw.glb') ($uniformFolder + 'colour-webp.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($uniformFolder + 'webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Uniform colour compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($uniformFolder + 'colour-webp.glb') ($uniformFolder + 'textures.glb') --slots normalTexture --lossless true --effort 60 *> ($uniformFolder + 'normal-webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Uniform normal compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($uniformFolder + 'textures.glb') 'public/assets/classic-residents/v5/resident-06.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($uniformFolder + 'meshopt.log')
    if ($LASTEXITCODE -ne 0) { throw 'Uniform geometry compression failed' }
} finally { Pop-Location }
