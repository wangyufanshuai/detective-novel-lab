$ErrorActionPreference = 'Stop'
$workRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workRoot
try {
    $workFolder = 'docs/3d-town/classic-occupations-v1/resident-06/gesture-09/'
    $publicFolder = 'public/assets/classic-occupations/v1/'
    New-Item -ItemType Directory -Path $publicFolder -Force | Out-Null
    foreach ($assetName in @('resident-06', 'workstation')) {
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($workFolder + $assetName + '-raw.glb') ($workFolder + $assetName + '-colour.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($workFolder + $assetName + '-colour.log')
        if ($LASTEXITCODE -ne 0) { throw 'Colour compression failed' }
        $meshInput = $workFolder + $assetName + '-colour.glb'
        # The room wood normal is a high bit-depth PNG. Keep those pixels
        # unchanged: WebP's 8-bit conversion is not a lossless source match.
        if ($assetName -eq 'resident-06') {
            & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp $meshInput ($workFolder + $assetName + '-textures.glb') --slots normalTexture --lossless true --effort 60 *> ($workFolder + $assetName + '-normal.log')
            if ($LASTEXITCODE -ne 0) { throw 'Normal compression failed' }
            $meshInput = $workFolder + $assetName + '-textures.glb'
        }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt $meshInput ($publicFolder + $assetName + '.glb') --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($workFolder + $assetName + '-meshopt.log')
        if ($LASTEXITCODE -ne 0) { throw 'Geometry compression failed' }
    }
} finally { Pop-Location }
