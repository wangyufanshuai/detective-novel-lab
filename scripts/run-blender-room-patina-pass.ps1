param([string]$BlenderPath='D:\blender.exe',[switch]$ResumeBake)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    $build=@('--background','--factory-startup','--python-exit-code','1','--python','scripts/build-blender-room-patina-pass.py','--','--views','all','--samples','64','--width','1600','--atlas','2048')
    if($ResumeBake){$build+='--resume-bake'}
    & $BlenderPath @build *> outputs/blender-v11-art-pass.log
    if($LASTEXITCODE -ne 0){throw 'Background patina build failed; inspect outputs/blender-v11-art-pass.log'}
    foreach($script in @('verify-blender-patina-structure','verify-blender-patina-documents','verify-blender-patina-atlas','verify-blender-patina-roundtrip','bake-blender-patina-visibility')){
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python "scripts/$script.py" *> "outputs/blender-v11-$script.log"
        if($LASTEXITCODE -ne 0){throw "Stage failed: $script"}
        Get-Content -LiteralPath "outputs/blender-v11-$script.log" -Tail 3
    }
} finally {Pop-Location}
