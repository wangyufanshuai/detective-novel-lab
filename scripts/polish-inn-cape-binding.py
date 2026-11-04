"""Smooth a retained cape field and fit bounded local patches by actual contact."""
from pathlib import Path
import bpy, hashlib, json
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT = Path(__file__).resolve().parents[1]; BASE = ROOT / 'docs/3d-town/classic-motion-v2'
SOURCE = BASE / 'step-16/cape-06/resident-08/resident.blend'
OUT = BASE / 'step-16/cape-08/resident-08'; OUT.mkdir(parents=True, exist_ok=False)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body = bpy.data.objects['rb-lin-ali_skin']; rig = bpy.data.objects['rb-lin-ali_rig']; root = bpy.data.objects['movement_actor']
mesh = body.data; keys = mesh.shape_keys.key_blocks; labels = mesh.attributes['ArtClothLayer'].data
old_report = json.loads((SOURCE.parent / 'cape-sculpt.json').read_text()); patches = old_report['patches']
ids = sorted(r['index'] for r in patches); local = {i: j for j, i in enumerate(ids)}
pattern = {i: keys[0].data[i].co.copy() for i in ids}
mesh.calc_loop_triangles()
faces = {v: [tuple(t.vertices) for t in mesh.loop_triangles if all(labels[i].value == v for i in t.vertices)] for v in (1, 2)}
graph = {i: set() for i in ids}
for edge in mesh.edges:
    a, b = edge.vertices
    if a in local and b in local: graph[a].add(b); graph[b].add(a)
tree = KDTree(len(ids))
for i in ids: tree.insert(pattern[i], i)
tree.balance()
for i in ids: graph[i].update(j for _, j, d in tree.find_range(pattern[i], .006) if i != j)
names = sorted({name for r in patches for name in r['weightsAfter']})
a = np.array([local[i] for i in ids for j in graph[i]], dtype=np.int32)
b = np.array([local[j] for i in ids for j in graph[i]], dtype=np.int32)
w = np.array([1 / max((pattern[i] - pattern[j]).length, .003) for i in ids for j in graph[i]])
total = np.bincount(a, weights=w, minlength=len(ids))
initial = np.array([[r['weightsAfter'].get(name, 0) for name in names] for r in patches])
values = initial.copy(); pin = np.array([pattern[i].z > 1.50 and abs(pattern[i].x) < .15 for i in ids])
for _ in range(24):
    mean = np.column_stack([np.bincount(a, weights=w * values[b, n], minlength=len(ids)) / total for n in range(len(names))])
    values = .5 * values + .5 * mean; values[pin] = initial[pin]
for row, patch in enumerate(patches):
    i = patch['index']; keep = sorted(range(len(names)), key=lambda n: -values[row, n])[:4]
    denominator = sum(values[row, n] for n in keep)
    weights = {names[n]: float(values[row, n] / denominator) for n in keep if values[row, n] > 1e-8}
    for g in list(mesh.vertices[i].groups): body.vertex_groups[g.group].remove([i])
    for name, weight in weights.items(): body.vertex_groups[name].add([i], weight, 'REPLACE')
    patch['weightsAfter'] = weights

def update(coords):
    for i, q in coords.items():
        for key in keys: key.data[i].co = q
        mesh.vertices[i].co = q
    mesh.shape_keys.update_tag(); mesh.update(); body.update_tag(); bpy.context.view_layer.update()

def bind(obj, action):
    obj.animation_data_create(); obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

def evaluate(poses):
    rows = []; contacts = set()
    for clip, frame in poses:
        bind(rig, bpy.data.actions[clip]); bind(root, None); root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
        bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
        e = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); m = e.to_mesh(); points = [v.co.copy() for v in m.vertices]
        pairs = BVHTree.FromPolygons(points, faces[2], all_triangles=True).overlap(BVHTree.FromPolygons(points, faces[1], all_triangles=True))
        contacts.update(i for a, b in pairs for i in faces[2][a]); e.to_mesh_clear()
        rows.append({'clip': clip, 'frame': frame, 'pairs': len(pairs)})
    return rows, contacts

poses = [('Idle', f) for f in range(1, 92, 15)] + [('Walk', f) for f in range(1, 26, 2)]
poses += [('ReconcileRegister', f) for f in sorted(set(range(1, 302, 5)) | {273})]
poses += [(clip, f) for clip, count in [('BackAway', 60), ('ApproachWork', 60), ('TurnLeft', 48)] for f in range(1, count + 2, 12)]
update(pattern); current = {i: q.copy() for i, q in pattern.items()}; initial_rows, contacts = evaluate(poses)
rows = initial_rows; fits = []
for iteration in range(6):
    if not contacts: break
    influence = {i: 1.0 for i in contacts}; frontier = set(contacts)
    for depth in range(1, 4):
        next_frontier = {j for i in frontier for j in graph[i]} - set(influence)
        influence.update({i: .5 ** depth for i in next_frontier}); frontier = next_frontier
    active = sorted({(r['clip'], r['frame']) for r in rows if r['pairs']} | {('Idle', 1), ('Walk', 17), ('ReconcileRegister', 151)})
    baseline, _ = evaluate(active); best_score = sum(r['pairs'] for r in baseline); best = None
    trials = []
    for amount in (.002, .004, .008):
        for axis in range(3):
            for sign in (-1, 1):
                delta = Vector((0, 0, 0)); delta[axis] = sign * amount
                trial = {i: current[i] + delta * weight for i, weight in influence.items()}
                if any((q - pattern[i]).length > .016 for i, q in trial.items()): continue
                update(trial); measured, _ = evaluate(active); score = sum(r['pairs'] for r in measured)
                trials.append({'axis': axis, 'deltaMeters': sign * amount, 'pairs': score})
                if score < best_score:
                    best_score = score; best = (trial, axis, sign * amount)
                update({i: current[i] for i in influence})
    if best is None:
        fits.append({'iteration': iteration, 'improved': False, 'trials': trials}); break
    trial, axis, delta = best; current.update(trial); update(current)
    rows, contacts = evaluate(poses)
    fits.append({'iteration': iteration, 'improved': True, 'axis': axis, 'deltaMeters': delta, 'patchVertices': len(influence),
                 'allPosePairs': sum(r['pairs'] for r in rows), 'maximumPairs': max(r['pairs'] for r in rows), 'trials': trials})
    print(json.dumps({k:v for k,v in fits[-1].items() if k!='trials'}), flush=True)
for patch in patches:
    i = patch['index']; patch['after'] = list(keys[0].data[i].co)
    patch['displacementMeters'] = (keys[0].data[i].co - Vector(patch['before'])).length
bind(rig, bpy.data.actions['Idle']); bind(root, None); root.location = (0,0,0); root.rotation_euler = (0,0,0)
bpy.context.scene.frame_set(1); bpy.context.view_layer.update(); bpy.context.preferences.filepaths.save_version = 0
destination = OUT / 'resident.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
assert sha(SOURCE) == source_hash
report = {'complete': True, 'sourceSha256': sha(destination), 'inputSourceSha256': old_report['inputSourceSha256'], 'parentSourceSha256': source_hash,
          'capeVertices': old_report['capeVertices'], 'trimVertices': old_report['trimVertices'], 'patches': patches,
          'widthBefore': old_report['widthBefore'], 'widthAfter': max(current[i].x for i in ids)-min(current[i].x for i in ids),
          'maximumDisplacementMeters': max(r['displacementMeters'] for r in patches),
          'bindingSmoothingPasses': 24, 'fitIterations': fits, 'initialRows': initial_rows, 'finalRows': rows,
          'constructionContactsCleared': not contacts, 'maximumLocalFitMeters': max((current[i]-pattern[i]).length for i in ids),
          'functionPassed': False, 'formPassed': False, 'humanApproved': False,
          'method': 'Retained cape-06 narrow pattern, 24 surface-connected binding smoothing passes and up to 16 mm local rest patches chosen by actual sampled surface contact. Changes limited to cape/trim geometry and binding; no runtime cloth simulation.'}
(OUT/'cape-sculpt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
metadata = json.loads((SOURCE.parent/'authoring-review.json').read_text())
metadata.update(sourceSha256=sha(destination), parentSourceSha256=source_hash, capeTrial='cape-08', builderSha256=sha(Path(__file__)), humanArtApproved=False)
(OUT/'authoring-review.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({k:v for k,v in report.items() if k not in ['patches','initialRows','finalRows','fitIterations']}),flush=True)
