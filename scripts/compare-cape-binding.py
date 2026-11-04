"""Compare cape binding fields on identical geometry; diagnostic only."""
from pathlib import Path
import bpy, hashlib, json
import numpy as np
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'docs/3d-town/classic-motion-v2/step-16/cape-06'
source = P / 'resident-08/resident.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
body = bpy.data.objects['rb-lin-ali_skin']; rig = bpy.data.objects['rb-lin-ali_rig']; origin = bpy.data.objects['movement_actor']
mesh = body.data; labels = mesh.attributes['ArtClothLayer'].data
patches = json.loads((P / 'resident-08/cape-sculpt.json').read_text())['patches']
ids = sorted(r['index'] for r in patches); local = {i: j for j, i in enumerate(ids)}
points = {i: mesh.shape_keys.key_blocks[0].data[i].co.copy() for i in ids}
mesh.calc_loop_triangles()
faces = {value: [tuple(t.vertices) for t in mesh.loop_triangles if all(labels[i].value == value for i in t.vertices)] for value in (1, 2)}
graph = {i: set() for i in ids}
for edge in mesh.edges:
    a, b = edge.vertices
    if a in local and b in local: graph[a].add(b); graph[b].add(a)
tree = KDTree(len(ids))
for i in ids: tree.insert(points[i], i)
tree.balance()
for i in ids:
    graph[i].update(j for _, j, distance in tree.find_range(points[i], .006) if i != j)
names = sorted({name for r in patches for key in ('weightsBefore', 'weightsAfter') for name in r[key]})
a = np.array([local[i] for i in ids for j in graph[i]], dtype=np.int32)
b = np.array([local[j] for i in ids for j in graph[i]], dtype=np.int32)
w = np.array([1 / max((points[i] - points[j]).length, .003) for i in ids for j in graph[i]])
total = np.bincount(a, weights=w, minlength=len(ids))
current = np.array([[r['weightsAfter'].get(name, 0) for name in names] for r in patches])
original = np.array([[r['weightsBefore'].get(name, 0) for name in names] for r in patches])
pin = np.array([points[i].z > 1.50 and abs(points[i].x) < .15 for i in ids])

def smooth(count):
    values = current.copy()
    for _ in range(count):
        average = np.column_stack([np.bincount(a, weights=w * values[b, col], minlength=len(ids)) / total for col in range(len(names))])
        values = .5 * values + .5 * average; values[pin] = current[pin]
    return values

def bind(obj, action):
    obj.animation_data_create(); obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

results = []
for name, values in [('transferred', current), ('retained', original), ('smooth24', smooth(24)), ('smooth72', smooth(72))]:
    for row, i in enumerate(ids):
        keep = sorted(range(len(names)), key=lambda n: -values[row, n])[:4]
        normalizer = sum(values[row, n] for n in keep)
        for g in list(mesh.vertices[i].groups): body.vertex_groups[g.group].remove([i])
        for n in keep:
            if values[row, n] > 1e-8: body.vertex_groups[names[n]].add([i], float(values[row, n] / normalizer), 'REPLACE')
    mesh.update(); body.update_tag(); bpy.context.view_layer.update()
    clips = []
    for clip, frames in [('Idle', range(1, 92, 15)), ('Walk', range(1, 26, 4)), ('ReconcileRegister', sorted(set(range(1, 302, 10)) | {273}))]:
        bind(rig, bpy.data.actions[clip]); bind(origin, None); origin.location = (0, 0, 0); origin.rotation_euler = (0, 0, 0)
        counts = []
        for frame in frames:
            bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
            e = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); m = e.to_mesh(); coords = [v.co.copy() for v in m.vertices]
            counts.append({'frame': frame, 'pairs': len(BVHTree.FromPolygons(coords, faces[1], all_triangles=True).overlap(BVHTree.FromPolygons(coords, faces[2], all_triangles=True)))})
            e.to_mesh_clear()
        clips.append({'clip': clip, 'maximumPairs': max(r['pairs'] for r in counts), 'contacts': [r for r in counts if r['pairs']]})
    result = {'binding': name, 'clips': clips}; results.append(result)
    print(json.dumps(result), flush=True)
report = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'results': results, 'scope': 'Same saved cape geometry, binding comparison in memory only. No sources changed; no formal acceptance.'}
(P / 'binding-comparison.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
