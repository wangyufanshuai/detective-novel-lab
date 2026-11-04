$ErrorActionPreference = 'Stop'
$silhouetteRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $silhouetteRoot
try {
    $silhouetteFolder = 'docs/3d-town/classic-residents-v7/resident-06/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v7' -Force | Out-Null
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($silhouetteFolder + 'rb-gu-yuanshan-raw.glb') ($silhouetteFolder + 'colour-webp.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($silhouetteFolder + 'webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Silhouette colour compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($silhouetteFolder + 'colour-webp.glb') ($silhouetteFolder + 'textures.glb') --slots normalTexture --lossless true --effort 60 *> ($silhouetteFolder + 'normal-webp.log')
    if ($LASTEXITCODE -ne 0) { throw 'Silhouette normal compression failed' }
    & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($silhouetteFolder + 'textures.glb') 'public/assets/classic-residents/v7/resident-06.glb' --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($silhouetteFolder + 'meshopt.log')
    if ($LASTEXITCODE -ne 0) { throw 'Silhouette geometry compression failed' }
} finally { Pop-Location }
