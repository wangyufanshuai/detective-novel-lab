"""Compare every clip in the merged candidate against normalized Blender poses."""
from pathlib import Path
import argparse, bpy, hashlib, json, sys
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser()
p.add_argument('--pilot', required=True)
p.add_argument('--actor', required=True)
p.add_argument('--tag', default='export-candidate-02')
p.add_argument('--asset', default='resident-raw.glb')
p.add_argument('--report', default='roundtrip-review.json')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
P = BASE / args.pilot
OUT = P / args.tag / args.actor
assert not (OUT / args.report).exists()

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def bind(obj, action):
    obj.animation_data_create()
    obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]
def frame(value):
    bpy.context.scene.frame_set(int(value), subframe=value % 1)
    bpy.context.view_layer.update()
def points(objects):
    values = []
    for obj in objects:
        e = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = e.to_mesh()
        values.extend(e.matrix_world @ v.co for v in mesh.vertices)
        e.to_mesh_clear()
    return values
def tree(values):
    result = KDTree(len(values))
    for i, v in enumerate(values): result.insert(v, i)
    result.balance()
    return result

source = P / args.actor / 'resident.blend'
receipt = read(OUT / 'export-review.json')
asset = OUT / args.asset
identity = sha(source)
assert receipt['complete'] and receipt['sourceSha256'] == identity
if args.asset == 'resident-raw.glb': assert receipt['asset']['sha256'] == sha(asset)
else:
    optimized = read(OUT / 'optimization-review.json')
    assert optimized['complete'] and optimized['optimized']['sha256'] == sha(asset)
entry = next(e for e in read(BASE / 'layout-01/cast-candidate.json')['entries'] if e['actorId'] == args.actor)
manifest = read(ROOT / ('public' + entry['manifestUrl']))
bpy.ops.wm.open_mainfile(filepath=str(source))
body = bpy.data.objects[manifest['id'] + '_skin']
rig = bpy.data.objects[manifest['id'] + '_rig']
root = bpy.data.objects['movement_actor']
if root.parent: root.parent.location = (0, 0, 0)
expected = []
fractions = (0, .008333333333, .0708333333, .1416666667, .2083333333, .2875, .35, .475, .5625, .6916666667, .7020833333, .8083333333, .9041666667, .9916666667, 1)
for clip in receipt['clips']:
    bind(rig, bpy.data.actions[clip['clip']])
    bind(root, bpy.data.actions.get(clip['clip'] + '_Origin'))
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    samples = []
    for fraction in fractions:
        seconds = fraction * clip['seconds']
        frame(1 + seconds * 30)
        samples.append((seconds, points([body])))
    expected.append((clip['clip'], samples))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=str(asset))
imported = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
assert imported
helpers = [o.name for o in bpy.context.scene.objects if o.type == 'MESH' and o not in imported]
bindings = []
for obj in [*bpy.data.objects, *bpy.data.shape_keys]:
    if not obj.animation_data: continue
    ad = obj.animation_data
    available = {track.name: (track.strips[0].action, track.strips[0].action_slot) for track in ad.nla_tracks if len(track.strips) == 1}
    default_matrix = obj.matrix_basis.copy() if isinstance(obj, bpy.types.Object) else None
    bindings.append((obj, available, default_matrix))
    ad.action = None
    ad.use_nla = False
rows = []
for clip, samples in expected:
    bound = []
    for obj, available, default_matrix in bindings:
        obj.animation_data.action = None
        if default_matrix is not None: obj.matrix_basis = default_matrix
        elif isinstance(obj, bpy.types.Key):
            for key in obj.key_blocks: key.value = 0
        if clip in available:
            action, slot = available[clip]
            obj.animation_data.action = action
            obj.animation_data.action_slot = slot
            bound.append(obj.name)
    assert any(obj.type == 'ARMATURE' and obj.name in bound for obj in bpy.data.objects)
    results = []
    for seconds, wanted in samples:
        frame(seconds * 120)
        actual = points(imported)
        forward, reverse = tree(actual), tree(wanted)
        maximum = max(max(forward.find(v)[2] for v in wanted), max(reverse.find(v)[2] for v in actual))
        results.append({'timeSeconds': seconds, 'maximumSymmetricVertexDistanceMeters': maximum, 'sourceVertices': len(wanted), 'importedVertices': len(actual)})
    row = {'clip': clip, 'boundAnimationData': bound, 'samples': results, 'maximumDistanceMeters': max(r['maximumSymmetricVertexDistanceMeters'] for r in results)}
    row['passed'] = row['maximumDistanceMeters'] < .001
    rows.append(row)
    print(json.dumps({k: v for k, v in row.items() if k != 'samples'}), flush=True)

report = {'schema': 'classic-egress-export-roundtrip.v1', 'complete': True, 'actorId': args.actor,
          'sourceSha256': identity, 'assetSha256': sha(asset), 'exportReviewSha256': sha(OUT / 'export-review.json'),
          'sourceUnchanged': sha(source) == identity, 'rows': rows, 'passed': all(r['passed'] for r in rows) and sha(source) == identity,
          'maximumDistanceMeters': max(r['maximumDistanceMeters'] for r in rows), 'importerDisplayHelpersExcluded': helpers,
          'assetVariant': args.asset, 'reviewerSha256': sha(Path(__file__)), 'scope': 'All six normalized merged clips in the named asset against saved Blender source at fifteen times each, including subframes. Bidirectional nearest-vertex distances; no browser, blend or target-device acceptance.', 'humanApproved': False}
(OUT / args.report).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(OUT / (Path(args.report).stem + '-reviewer.py')).write_bytes(Path(__file__).read_bytes())
print(json.dumps({'passed': report['passed'], 'actor': args.actor, 'clips': len(rows), 'maximumDistanceMeters': report['maximumDistanceMeters']}), flush=True)
