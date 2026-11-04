param()
$ErrorActionPreference = 'Stop'
$portraitRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $portraitRoot
try {
    $portraitProfiles = (Get-Content -LiteralPath 'docs/3d-town/classic-residents-v1/profiles.json' -Raw -Encoding UTF8 | ConvertFrom-Json).profiles
    New-Item -ItemType Directory -Path 'public/assets/classic-residents/v3' -Force | Out-Null
    foreach ($portraitActor in @('resident-03', 'resident-06', 'resident-08')) {
        $portraitProfile = $portraitProfiles | Where-Object actorId -eq $portraitActor
        $portraitFolder = 'docs/3d-town/classic-residents-v3/' + $portraitActor + '/'
        $portraitInput = $portraitFolder + $portraitProfile.id + '-raw.glb'
        $portraitColour = $portraitFolder + $portraitProfile.id + '-colour-webp.glb'
        $portraitTextures = $portraitFolder + $portraitProfile.id + '-textures.glb'
        $portraitOutput = 'public/assets/classic-residents/v3/' + $portraitActor + '.glb'
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp $portraitInput $portraitColour --slots baseColorTexture --quality 90 --effort 60 *> ($portraitFolder + 'webp.log')
        if ($LASTEXITCODE -ne 0) { throw ('Portrait texture compression failed: ' + $portraitActor) }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform webp $portraitColour $portraitTextures --slots normalTexture --lossless true --effort 60 *> ($portraitFolder + 'normal-webp.log')
        if ($LASTEXITCODE -ne 0) { throw ('Portrait lossless normal compression failed: ' + $portraitActor) }
        & 'D:\nvm\v24.14.0\npx.ps1' --yes --package '@gltf-transform/cli@4.5.1' gltf-transform meshopt $portraitTextures $portraitOutput --quantize-position 16 --quantize-normal 10 --quantize-texcoord 16 *> ($portraitFolder + 'meshopt.log')
        if ($LASTEXITCODE -ne 0) { throw ('Portrait geometry compression failed: ' + $portraitActor) }
    }
} finally { Pop-Location }
