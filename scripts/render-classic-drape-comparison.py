"""Original source models, side by side under the same Blender lights."""
from pathlib import Path
import importlib.util
import hashlib
import json
import bpy

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v4'
spec = importlib.util.spec_from_file_location('drape_comparison_stage', ROOT / 'scripts/build-blender-classic-investigator.py')
inv = importlib.util.module_from_spec(spec); spec.loader.exec_module(inv); u = inv.u
bpy.ops.wm.read_factory_settings(use_empty=True)
inputs = {}
for version, x in [(3, -.43), (4, .43)]:
    source = ROOT / f'docs/3d-town/classic-residents-v{version}/resident-08/rb-lin-ali.blend'
    inputs[source.relative_to(ROOT).as_posix()] = hashlib.sha256(source.read_bytes()).hexdigest()
    with bpy.data.libraries.load(str(source), link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in ('rb-lin-ali_skin', 'rb-lin-ali_rig')]
    for obj in dst.objects:
        bpy.context.collection.objects.link(obj)
        if obj.type == 'ARMATURE': obj.location.x = x
inv.stage(); u.camera('drape-comparison', (.3, -8, 1.88), (0, 0, 1.34), 1.88)
devices = u.configure(64, 1600)
scene = bpy.context.scene; scene.render.resolution_y = 1000; scene.camera = bpy.data.objects['drape-comparison']
scene.render.filepath = str(PACKAGE / 'drape-comparison.png')
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(PACKAGE / 'drape-comparison.blend'))
bpy.ops.render.render(write_still=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
(PACKAGE / 'comparison-review.json').write_text(json.dumps({'sourceInputs':inputs,
    'builderSha256':sha(Path(__file__)), 'stageSourceSha256':sha(PACKAGE / 'drape-comparison.blend'),
    'renderSha256':sha(PACKAGE / 'drape-comparison.png'), 'size':[1600,1000], 'samples':64, 'devices':devices,
    'left':'preserved v3', 'right':'v4 drape candidate', 'humanArtApproved':False}, indent=2) + '\n', encoding='utf-8')
