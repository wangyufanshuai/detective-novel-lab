$ErrorActionPreference = 'Stop'
$workRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workRoot
try {
    $workFolder = 'docs/3d-town/classic-residents-v9/resident-03/'
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v9' -Force | Out-Null
    foreach ($workAsset in @('resident-03','workstation')) {
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($workFolder + $workAsset + '-raw.glb') ($workFolder + $workAsset + '-colour.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($workFolder + $workAsset + '-colour.log')
        if ($LASTEXITCODE -ne 0) { throw 'Work action colour compression failed' }
        $workInput = $workFolder + $workAsset + '-colour.glb'
        if ($workAsset -eq 'resident-03') {
            & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp $workInput ($workFolder + $workAsset + '-textures.glb') --slots normalTexture --lossless true --effort 60 *> ($workFolder + $workAsset + '-normal.log')
            if ($LASTEXITCODE -ne 0) { throw 'Work action normal compression failed' }
            $workInput = $workFolder + $workAsset + '-textures.glb'
        }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt $workInput ('public/assets/classic-residents/v9/' + $workAsset + '.glb') --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($workFolder + $workAsset + '-meshopt.log')
        if ($LASTEXITCODE -ne 0) { throw 'Work action geometry compression failed' }
    }
} finally { Pop-Location }
