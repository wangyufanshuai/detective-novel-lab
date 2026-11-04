param(
    [string]$Pilot = 'step-15',
    [ValidateSet('actors', 'scene')][string]$Scope = 'actors',
    [ValidateSet('', 'resident-03', 'resident-06', 'resident-08')][string]$Actor = ''
)
$ErrorActionPreference = 'Stop'
if ($Pilot -notmatch '^step-[0-9]+([/\\]cape-[0-9]+)?$') { throw 'Invalid candidate name' }
if ($Actor -and $Scope -ne 'actors') { throw 'Actor selection requires actor scope' }
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskBase = Join-Path $taskProjectRoot ('docs\3d-town\classic-motion-v2\' + $Pilot + '\export-candidate-02')
$taskCache = Join-Path $taskProjectRoot 'output\gltf-cli-cache'
$taskCliPrefix = @('--cache', $taskCache, '--registry', 'https://registry.npmjs.org', '--yes', '--package', '@gltf-transform/cli@4.5.1', 'gltf-transform')
function Invoke-AssetTransform([string[]]$TransformArguments, [string]$LogPath) {
    & 'D:\nvm\v24.14.0\npx.ps1' @taskCliPrefix @TransformArguments *> $LogPath
    if ($LASTEXITCODE -ne 0) { throw ('Asset conversion failed; inspect ' + $LogPath) }
}
$taskEntries = if ($Scope -eq 'scene') { @('scene') } elseif ($Actor) { @($Actor) } else { @('resident-03', 'resident-06', 'resident-08') }
foreach ($taskEntry in $taskEntries) {
    $taskFolder = Join-Path $taskBase $taskEntry
    $taskExportPath = Join-Path $taskFolder 'export-review.json'
    $taskExport = Get-Content -LiteralPath $taskExportPath -Raw | ConvertFrom-Json
    if (-not $taskExport.complete) { throw 'Incomplete source export' }
    if ($Scope -eq 'actors') {
        $taskRoundtrip = Get-Content -LiteralPath (Join-Path $taskFolder 'roundtrip-review.json') -Raw | ConvertFrom-Json
        if (-not $taskRoundtrip.passed -or $taskRoundtrip.assetSha256 -ne $taskExport.asset.sha256) { throw 'Raw merged animation round trip is unverified' }
    }
    $taskRaw = Join-Path $taskFolder $taskExport.asset.path
    if ((Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExport.asset.sha256) { throw 'Raw asset identity mismatch' }
    $taskFinal = Join-Path $taskFolder 'optimized.glb'
    if (Test-Path -LiteralPath $taskFinal) { throw 'Preserve the existing optimized candidate' }
    Invoke-AssetTransform @('inspect', $taskRaw) (Join-Path $taskFolder 'raw-inspection.txt')
    $taskTextureInput = $taskRaw
    if ($Scope -eq 'scene') {
        $taskTextureInput = Join-Path $taskFolder 'resized.glb'
        Invoke-AssetTransform @('resize', $taskRaw, $taskTextureInput, '--width', '512', '--height', '512') (Join-Path $taskFolder 'resize.log')
    }
    $taskColour = Join-Path $taskFolder 'colour.glb'
    Invoke-AssetTransform @('webp', $taskTextureInput, $taskColour, '--slots', 'baseColorTexture', '--quality', '90', '--effort', '60') (Join-Path $taskFolder 'colour.log')
    Invoke-AssetTransform @('meshopt', $taskColour, $taskFinal, '--quantize-position', '16', '--quantize-weight', '16', '--quantize-normal', '10', '--quantize-texcoord', '16') (Join-Path $taskFolder 'meshopt.log')
    Invoke-AssetTransform @('inspect', $taskFinal) (Join-Path $taskFolder 'optimized-inspection.txt')
    $taskResult = [ordered]@{
        complete = $true; scope = $Scope; entry = $taskEntry; tool = '@gltf-transform/cli@4.5.1'
        sourceAssetSha256 = $taskExport.asset.sha256; exportReviewSha256 = (Get-FileHash -LiteralPath $taskExportPath -Algorithm SHA256).Hash.ToLowerInvariant()
        optimized = [ordered]@{ path = 'optimized.glb'; sha256 = (Get-FileHash -LiteralPath $taskFinal -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = (Get-Item -LiteralPath $taskFinal).Length }
        sourceBytes = (Get-Item -LiteralPath $taskRaw).Length
        steps = @('Scene textures only: resize to 512 px', 'Base color WebP quality 90; normal images retained', 'Meshopt: position, weight and UV 16 bits; normals 10 bits; no simplification')
        scriptSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
        verification = 'Compression completed; geometry, animation and runtime rechecks remain'; humanApproved = $false; browserIntegrated = $false
    }
    [System.IO.File]::WriteAllText((Join-Path $taskFolder 'optimization-review.json'), ($taskResult | ConvertTo-Json -Depth 8) + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $taskFolder 'optimizer.ps1')
    $taskResult | Select-Object entry, sourceBytes, optimized | ConvertTo-Json -Depth 4 -Compress
}
