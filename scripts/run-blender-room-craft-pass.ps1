param([string]$BlenderPath='D:\blender.exe',[switch]$ResumeBake)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    $build=@('--background','--factory-startup','--python-exit-code','1','--python','scripts/build-blender-room-craft-pass.py','--','--views','all','--samples','64','--width','1600','--atlas','2048')
    if($ResumeBake){$build+='--resume-bake'}
    & $BlenderPath @build *> outputs/blender-v9-art-pass.log
    if($LASTEXITCODE -ne 0){throw 'Background craft build failed; inspect outputs/blender-v9-art-pass.log'}
    foreach($script in @('calibrate-blender-area-visibility','verify-blender-craft-atlas','verify-blender-craft-roundtrip','bake-blender-area-visibility')){
        & $BlenderPath --background --factory-startup --python-exit-code 1 --python "scripts/$script.py" *> "outputs/blender-v9-$script.log"
        if($LASTEXITCODE -ne 0){throw "Stage failed: $script"}
        Get-Content -LiteralPath "outputs/blender-v9-$script.log" -Tail 3
    }
} finally {Pop-Location}
