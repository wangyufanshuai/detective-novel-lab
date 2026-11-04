"""Actual three-person portrait render from the saved production candidates."""
from pathlib import Path
import bpy
import importlib.util
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v3'
spec = importlib.util.spec_from_file_location('portrait_stage', ROOT / 'scripts/build-blender-classic-investigator.py')
inv = importlib.util.module_from_spec(spec); spec.loader.exec_module(inv); u = inv.u
bpy.ops.wm.read_factory_settings(use_empty=True)
profiles = {p['actorId']: p for p in json.loads((ROOT / 'docs/3d-town/classic-residents-v1/profiles.json').read_text(encoding='utf-8'))['profiles']}
inputs = {}
for index, actor in enumerate(['resident-03', 'resident-06', 'resident-08']):
    profile = profiles[actor]; source = PACKAGE / actor / (profile['id'] + '.blend')
    inputs[source.relative_to(ROOT).as_posix()] = hashlib.sha256(source.read_bytes()).hexdigest()
    with bpy.data.libraries.load(str(source), link=False) as (src, dst):
        dst.objects = [name for name in src.objects if name in [profile['id'] + '_skin', profile['id'] + '_rig']]
    for obj in dst.objects:
        bpy.context.collection.objects.link(obj)
        if obj.type == 'ARMATURE':
            obj.location.x = (index - 1) * .66
inv.stage(); u.camera('portrait-lineup', (.2, -8, 1.92), (0, 0, 1.52), 2.18)
devices = u.configure(64, 1920)
scene = bpy.context.scene; scene.render.resolution_y = 1080; scene.camera = bpy.data.objects['portrait-lineup']
scene.render.filepath = str(PACKAGE / 'portrait-lineup.png')
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(PACKAGE / 'portrait-lineup.blend'))
bpy.ops.render.render(write_still=True)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
(PACKAGE / 'portrait-lineup-review.json').write_text(json.dumps({
    'sourceInputs': inputs, 'stageBuilderSha256': sha(Path(__file__)),
    'stageSourceSha256': sha(PACKAGE / 'portrait-lineup.blend'), 'renderSha256': sha(PACKAGE / 'portrait-lineup.png'),
    'engine': 'Cycles', 'samples': 64, 'size': [1920, 1080], 'devices': devices,
    'humanArtApproved': False, 'scope': 'Actual shared-lighting render of the three saved sources, cropped at torso height.'
}, indent=2) + '\n', encoding='utf-8')
print('ACTUAL_BLENDER_PORTRAIT_LINEUP_RENDERED', flush=True)
