"""Inspect a saved cape candidate under the retained room composition/light."""
from pathlib import Path
import argparse, bpy, hashlib, importlib.util, json, sys
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]; BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser(); p.add_argument('--trial', default='cape-01'); args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
FOLDER = BASE / 'step-16' / args.trial; SOURCE = FOLDER / 'resident-08/resident.blend'; OUT = FOLDER / 'renders'
OUT.mkdir(exist_ok=True)
assert not any(OUT.iterdir()), 'Preserve a populated render attempt'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = sha(SOURCE)
assert source_hash == json.loads((SOURCE.parent / 'authoring-review.json').read_text(encoding='utf-8'))['sourceSha256']
composition = BASE / 'step-15/renders/composed.blend'
bpy.ops.wm.open_mainfile(filepath=str(composition)); scene = bpy.context.scene
body = bpy.data.objects['rb-lin-ali_skin']; rig = bpy.data.objects['rb-lin-ali_rig']
names = [g.name for g in body.vertex_groups]
action_names = ['Idle', 'Walk', 'ReconcileRegister', 'BackAway', 'BackAway_Origin', 'TurnLeft', 'TurnLeft_Origin']
with bpy.data.libraries.load(str(SOURCE), link=False) as (available, loaded):
    loaded.objects = ['rb-lin-ali_skin']; loaded.actions = list(action_names)
imported = loaded.objects[0]
assert [g.name for g in imported.vertex_groups] == names
body.data = imported.data.copy()
for curve in body.data.shape_keys.animation_data.drivers:
    for variable in curve.driver.variables:
        for target in variable.targets:
            if target.id:
                assert target.id.type == 'ARMATURE'
                target.id = rig
bpy.data.objects.remove(imported, do_unlink=True)
actions = dict(zip(action_names, loaded.actions))
for action in actions.values(): action.use_fake_user = True
home = bpy.data.objects['resident-08_home']; phase = bpy.data.objects['resident-08_phase']; root = rig.parent
room = next(r for r in json.loads((BASE / 'layout-01/navigation-candidate.json').read_text(encoding='utf-8'))['interiors'] if r['id'] == 'inn')
for obj in scene.objects:
    if obj.type in ('MESH', 'CURVE', 'FONT'): obj.visible_camera = obj.get('layer') not in room['cutawayLayers']
spec = importlib.util.spec_from_file_location('room', ROOT / 'scripts/build-blender-classic-railway.py')
renderer = importlib.util.module_from_spec(spec); spec.loader.exec_module(renderer)
devices = renderer.configure(32, 1100); scene.render.resolution_y = 1000
camera = scene.camera; camera.data.type = 'ORTHO'; camera.data.ortho_scale = 2.6

def bind(obj, action):
    obj.animation_data_create(); obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

def pose(clip, frame):
    bind(rig, actions[clip]); bind(root, actions.get(clip + '_Origin'))
    root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
    phase.location = (-.55, .48, 0) if clip == 'Walk' else (0, .48, 0) if clip == 'TurnLeft' else (0, 0, 0)
    phase.rotation_euler = (0, 0, 0); scene.frame_set(frame); bpy.context.view_layer.update()

pose('Idle', 1)
target = home.matrix_world.translation + Vector((0, .16, 1.08))
camera.location = target + Vector((2.5, -3.0, 1.15)); camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.preferences.filepaths.save_version = 0
saved = OUT / 'composed.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(saved), compress=True)
report = {'complete': False, 'sourceSha256': source_hash, 'retainedCompositionSha256': sha(composition), 'compositionSha256': sha(saved),
          'rendererSha256': sha(Path(__file__)), 'devices': devices, 'renders': [], 'humanApproved': False,
          'scope': 'Saved cape silhouette in the retained room light/composition. Four corner orientations, low and ceiling-oblique views plus representative poses. Work props stay in their resting transforms; writing view reviews clothing only.'}
views = [('front-left', 'Idle', 1, (-2.5, -3, 1.15)), ('front-right', 'Idle', 1, (2.5, -3, 1.15)),
         ('rear-left', 'Idle', 1, (-2.5, 3, 1.15)), ('rear-right', 'Idle', 1, (2.5, 3, 1.15)),
         ('low-front', 'Idle', 1, (-1.7, -.85, -.38)), ('ceiling-oblique', 'Idle', 1, (2, -2, 3.5)),
         ('profile', 'Idle', 1, (3.5, 0, .3)), ('walk-stride-first', 'Walk', 1, (2.5, -3, 1.15)),
         ('walk-stride-second', 'Walk', 13, (-2.5, -3, 1.15)), ('writing-cape', 'ReconcileRegister', 151, (2.5, -3, 1.35)),
         ('retreat', 'BackAway', 21, (2.5, -3, 1.15)), ('turn', 'TurnLeft', 25, (2.5, -3, 1.15)),
         ('work-reach', 'ReconcileRegister', 31, (-2.5, -3, 1.15)),
         ('work-return', 'ReconcileRegister', 273, (2.5, -3, 1.15)),
         ('work-return-rear', 'ReconcileRegister', 273, (-2.5, 3, 1.15))]
for name, clip, frame, offset in views:
    pose(clip, frame)
    camera.location = target + Vector(offset); camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    file = OUT / (name + '.png'); scene.render.filepath = str(file); bpy.ops.render.render(write_still=True)
    report['renders'].append({'view': name, 'clip': clip, 'frame': frame, 'file': file.name, 'sha256': sha(file), 'camera': list(camera.location), 'target': list(target)})
    (OUT / 'review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'view': name, 'complete': True}), flush=True)
assert sha(SOURCE) == source_hash
report['complete'] = True
(OUT / 'review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(OUT / 'renderer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete': True, 'renders': len(views)}), flush=True)
