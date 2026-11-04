$ErrorActionPreference = 'Stop'
$handRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $handRoot
try {
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v8' -Force | Out-Null
    foreach ($handActor in @(@('resident-03','rb-xu-zhiwei'),@('resident-06','rb-gu-yuanshan'),@('resident-08','rb-lin-ali'))) {
        $handFolder = 'docs/3d-town/classic-residents-v8/' + $handActor[0] + '/'
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($handFolder + $handActor[1] + '-raw.glb') ($handFolder + 'colour-webp.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($handFolder + 'webp.log')
        if ($LASTEXITCODE -ne 0) { throw 'Hand asset colour compression failed' }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($handFolder + 'colour-webp.glb') ($handFolder + 'textures.glb') --slots normalTexture --lossless true --effort 60 *> ($handFolder + 'normal-webp.log')
        if ($LASTEXITCODE -ne 0) { throw 'Hand asset normal compression failed' }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt ($handFolder + 'textures.glb') ('public/assets/classic-residents/v8/' + $handActor[0] + '.glb') --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($handFolder + 'meshopt.log')
        if ($LASTEXITCODE -ne 0) { throw 'Hand asset geometry compression failed' }
    }
} finally { Pop-Location }
