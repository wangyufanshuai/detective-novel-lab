param([Parameter(Mandatory = $true)][string]$Pilot)
$ErrorActionPreference = 'Stop'
$workRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workRoot
try {
    if ($Pilot -notmatch '^gesture-[0-9]+$') { throw 'Invalid pilot name' }
    $workFolder = 'docs/3d-town/classic-occupations-v1/resident-08/' + $Pilot + '/'
    $publicFolder = 'public/assets/classic-occupations/v2/'
    New-Item -ItemType Directory -Path $publicFolder -Force | Out-Null
    foreach ($assetName in @('resident-08', 'workstation')) {
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp ($workFolder + $assetName + '-raw.glb') ($workFolder + $assetName + '-colour.glb') --slots baseColorTexture --quality 90 --effort 60 *> ($workFolder + $assetName + '-colour.log')
        if ($LASTEXITCODE -ne 0) { throw 'Colour compression failed' }
        $meshInput = $workFolder + $assetName + '-colour.glb'
        if ($assetName -eq 'resident-08') {
            & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp $meshInput ($workFolder + $assetName + '-textures.glb') --slots normalTexture --lossless true --effort 60 *> ($workFolder + $assetName + '-normal.log')
            if ($LASTEXITCODE -ne 0) { throw 'Normal compression failed' }
            $meshInput = $workFolder + $assetName + '-textures.glb'
        }
        # Retain the wood's high-bit-depth normal PNG without WebP conversion.
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt $meshInput ($publicFolder + $assetName + '.glb') --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($workFolder + $assetName + '-meshopt.log')
        if ($LASTEXITCODE -ne 0) { throw 'Geometry compression failed' }
    }
} finally { Pop-Location }
