$ErrorActionPreference = 'Stop'
$finishRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $finishRoot
try {
    $finishFolder = 'docs/3d-town/classic-residents-v6/resident-06/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v6' -Force | Out-Null
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($finishFolder + 'rb-gu-yuanshan-raw.glb') ($finishFolder + 'colour-webp.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($finishFolder + 'webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Finish colour compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($finishFolder + 'colour-webp.glb') ($finishFolder + 'textures.glb') --slots normalTexture --lossless true --effort 60 *> ($finishFolder + 'normal-webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Finish normal compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($finishFolder + 'textures.glb') 'public/assets/classic-residents/v6/resident-06.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($finishFolder + 'meshopt.log')
    if ($LASTEXITCODE -ne 0) { throw 'Finish geometry compression failed' }
} finally { Pop-Location }
