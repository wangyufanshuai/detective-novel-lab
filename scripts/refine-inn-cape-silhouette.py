"""Resculpt the existing cape's shoulder wings into a close, falling silhouette."""
from pathlib import Path
import argparse, bmesh, bpy, hashlib, json, math, sys
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
parser = argparse.ArgumentParser(); parser.add_argument('--trial', default='cape-07')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
assert args.trial.startswith('cape-') and args.trial[5:].isdigit()
SOURCE = BASE / 'step-15/resident-08/resident.blend'
OUT = BASE / 'step-16' / args.trial / 'resident-08'
OUT.mkdir(parents=True, exist_ok=False)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
input_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body = bpy.data.objects['rb-lin-ali_skin']; mesh = body.data
labels = mesh.attributes['ArtClothLayer'].data
keys = mesh.shape_keys.key_blocks
points = [v.co.copy() for v in keys[0].data]
cape = {i for i in range(len(points)) if labels[i].value == 2}
trim = {i for p in mesh.polygons if mesh.materials[p.material_index].name.split('.')[0] == 'accent'
        for i in p.vertices if points[i].z > 1.20} - cape
ids = cape | trim
assert len(cape) == 5626 and len(trim) == 992
assert all((key.data[i].co - points[i]).length < 1e-8 for key in keys for i in ids), 'Cape must not inherit skirt offsets'
mesh.calc_loop_triangles()
triangles = [tuple(t.vertices) for t in mesh.loop_triangles if all(labels[i].value == 1 for i in t.vertices)]
surface = BVHTree.FromPolygons(points, triangles, all_triangles=True)
blouse_ids = sorted({i for t in triangles for i in t})

def envelope(coords):
    # A short cape bridges the concavity between sleeves and torso. A convex
    # supporting hull avoids fitting it into that crease or onto the inner shell.
    bm = bmesh.new()
    for i in blouse_ids: bm.verts.new(coords[i])
    bmesh.ops.convex_hull(bm, input=list(bm.verts), use_existing_faces=False)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces)); bm.normal_update()
    bm.verts.index_update()
    tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in bm.faces])
    bm.free(); return tree

rest_envelope = envelope(points)
support_center = Vector((0, 0, 1.25))

def support_contact(tree, q):
    # Radial projection of a convex support is continuous around the shoulder.
    # Closest-face projection of an interior point can jump from front to back.
    direction = (q - support_center).normalized()
    hit, normal, _, _ = tree.ray_cast(support_center + direction * 2, -direction, 2)
    assert hit is not None and normal.dot(direction) > .08
    return hit, normal, direction
old_weights = [{body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in mesh.vertices]

def smooth(value):
    v = min(1, max(0, value)); return v * v * (3 - 2 * v)

def barycentric(p, a, b, c):
    u, v, w = b - a, c - a, p - a
    uu, uv, vv, wu, wv = u.dot(u), u.dot(v), v.dot(v), w.dot(u), w.dot(v)
    determinant = uu * vv - uv * uv
    assert abs(determinant) > 1e-16
    y, z = (vv * wu - uv * wv) / determinant, (uu * wv - uv * wu) / determinant
    values = [max(0, 1 - y - z), max(0, y), max(0, z)]; total = sum(values)
    return [value / total for value in values]

patches = []
ray_fits = 0
for i in sorted(ids):
    original = points[i]
    amount = smooth((abs(original.x) - .12) / .20) * (1 - smooth((original.z - 1.48) / .08))
    target = original.copy()
    target.x -= math.copysign(.072 * amount, original.x)
    target.z -= .052 * amount
    nearest, normal, direction = support_contact(rest_envelope, target)
    facing = mesh.vertices[i].normal.dot(normal)
    clearance = .008 + (.002 if facing > 0 else 0)
    if i in trim: clearance = .0108
    signed = (target - nearest).dot(normal)
    if signed < clearance:
        target += direction * ((clearance - signed) / normal.dot(direction)); ray_fits += 1
    nearest, normal, triangle, distance = surface.find_nearest(target)
    coefficients = barycentric(nearest, *[points[j] for j in triangles[triangle]])
    weights = {}
    for j, coefficient in zip(triangles[triangle], coefficients):
        for name, value in old_weights[j].items(): weights[name] = weights.get(name, 0) + value * coefficient
    weights = dict(sorted(weights.items(), key=lambda row: row[1], reverse=True)[:4])
    total = sum(weights.values()); weights = {n: v / total for n, v in weights.items() if v > 0}
    for group in list(mesh.vertices[i].groups): body.vertex_groups[group.group].remove([i])
    for name, weight in weights.items(): body.vertex_groups[name].add([i], weight, 'REPLACE')
    for key in keys: key.data[i].co = target
    mesh.vertices[i].co = target
    patches.append({'index': i, 'before': list(original), 'after': list(target), 'weightsBefore': old_weights[i],
                    'weightsAfter': weights, 'displacementMeters': (target - original).length})
mesh.shape_keys.update_tag(); mesh.update(); body.update_tag(); bpy.context.view_layer.update()
# Retain the narrow pattern, then add bounded movement ease over actual poses.
# Fit against a closed convex supporting hull. Inverse skinning carries each
# small correction back into the rest mesh, preserving shoulder bridging.
rig = bpy.data.objects['rb-lin-ali_rig']; root = bpy.data.objects['movement_actor']
graph = {i: set() for i in ids}
for edge in mesh.edges:
    a, b = edge.vertices
    if a in ids and b in ids: graph[a].add(b); graph[b].add(a)
pattern = {i: keys[0].data[i].co.copy() for i in ids}
neighbors = KDTree(len(ids))
for i in ids: neighbors.insert(pattern[i], i)
neighbors.balance()
for i in ids:
    for _, j, distance in neighbors.find_range(pattern[i], .006):
        if i != j: graph[i].add(j)
ordered_ids = sorted(ids); local = {i: j for j, i in enumerate(ordered_ids)}
names = sorted({name for row in patches for name in row['weightsAfter']})
edge_a = np.array([local[i] for i in ordered_ids for j in graph[i]], dtype=np.int32)
edge_b = np.array([local[j] for i in ordered_ids for j in graph[i]], dtype=np.int32)
edge_w = np.array([1 / max((pattern[i] - pattern[j]).length, .003) for i in ordered_ids for j in graph[i]])
edge_total = np.bincount(edge_a, weights=edge_w, minlength=len(ids))
initial_weights = np.array([[r['weightsAfter'].get(name, 0) for name in names] for r in patches])
values = initial_weights.copy()
neck_pin = np.array([pattern[i].z > 1.50 and abs(pattern[i].x) < .15 for i in ordered_ids])
for _ in range(24):
    mean = np.column_stack([np.bincount(edge_a, weights=edge_w * values[edge_b, n], minlength=len(ids)) / edge_total for n in range(len(names))])
    values = .5 * values + .5 * mean; values[neck_pin] = initial_weights[neck_pin]
for row, patch in enumerate(patches):
    i = patch['index']; keep = sorted(range(len(names)), key=lambda n: -values[row, n])[:4]
    denominator = sum(values[row, n] for n in keep)
    weights = {names[n]: float(values[row, n] / denominator) for n in keep if values[row, n] > 1e-8}
    for group in list(mesh.vertices[i].groups): body.vertex_groups[group.group].remove([i])
    for name, weight in weights.items(): body.vertex_groups[name].add([i], weight, 'REPLACE')
    patch['weightsAfter'] = weights
mesh.update(); body.update_tag(); bpy.context.view_layer.update()
new_weights = {r['index']: r['weightsAfter'] for r in patches}
rest_inverse = {b.name: b.matrix_local.inverted() for b in rig.data.bones}
body_to_rig = rig.matrix_world.inverted() @ body.matrix_world
rig_to_body = body_to_rig.inverted()
cape_triangles = [tuple(t.vertices) for t in mesh.loop_triangles if all(i in cape for i in t.vertices)]

def bind(obj, action):
    obj.animation_data_create(); obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

motion_fits = []
for iteration in range(10):
    offsets = {}; max_pairs = 0; corrected_samples = 0
    for clip, count, step in [('Idle', 90, 15), ('Walk', 24, 4), ('ReconcileRegister', 300, 10),
                              ('BackAway', 60, 12), ('ApproachWork', 60, 12), ('TurnLeft', 48, 12)]:
        bind(rig, bpy.data.actions[clip]); bind(root, bpy.data.actions.get(clip + '_Origin'))
        root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
        for frame in sorted({1 + t for t in range(0, count + 1, step)} | {count + 1}):
            bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
            evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); sample_mesh = evaluated.to_mesh()
            posed = [v.co.copy() for v in sample_mesh.vertices]
            underlayer = BVHTree.FromPolygons(posed, triangles, all_triangles=True)
            support = envelope(posed)
            cape_tree = BVHTree.FromPolygons(posed, cape_triangles, all_triangles=True)
            contact_pairs = cape_tree.overlap(underlayer)
            max_pairs = max(max_pairs, len(contact_pairs))
            contact_ids = {i for a, b in contact_pairs for i in cape_triangles[a]}
            contact_normals = {i: Vector() for i in contact_ids}
            for a, b in contact_pairs:
                v0, v1, v2 = [posed[j] for j in triangles[b]]
                normal = (v1 - v0).cross(v2 - v0).normalized()
                if normal.dot((v0 + v1 + v2) / 3 - support_center) < 0: normal.negate()
                for i in cape_triangles[a]: contact_normals[i] += normal
            transforms = {b.name: b.matrix @ rest_inverse[b.name] for b in rig.pose.bones}
            for i in sorted(contact_ids):
                q = posed[i]
                # Use the actual sleeve contact normal. A hull around an arm
                # extended far from the torso includes empty space, so fitting
                # toward that hull would pull the cape away from the shoulder.
                direction = contact_normals[i].normalized()
                if direction.length < .5: direction = support_contact(support, q)[2]
                corrected_samples += 1
                skin = Matrix([[0.] * 4 for _ in range(4)])
                for name, weight in new_weights[i].items(): skin += transforms[name] * weight
                linear = (rig_to_body @ skin @ body_to_rig).to_3x3()
                delta = linear.inverted_safe() @ (direction * .003)
                if i not in offsets or delta.length > offsets[i].length: offsets[i] = delta
            evaluated.to_mesh_clear()
    expanded = dict(offsets)
    for i, delta in offsets.items():
        for j in graph[i]:
            eased = delta * .6
            if j not in expanded or eased.length > expanded[j].length: expanded[j] = eased
    capped = 0
    for i, delta in expanded.items():
        target = keys[0].data[i].co + delta
        if (target - pattern[i]).length > .025:
            target = pattern[i] + (target - pattern[i]).normalized() * .025; capped += 1
        for key in keys: key.data[i].co = target
        mesh.vertices[i].co = target
    mesh.shape_keys.update_tag(); mesh.update(); body.update_tag(); bpy.context.view_layer.update()
    motion_fits.append({'iteration': iteration, 'maximumPairsBeforeCorrection': max_pairs, 'correctedSamples': corrected_samples,
                        'correctedVertices': len(expanded), 'verticesAtBound': capped,
                        'maximumStepMeters': max((v.length for v in expanded.values()), default=0)})
    print(json.dumps(motion_fits[-1]), flush=True)
    if not expanded: break
for row in patches:
    i = row['index']; row['after'] = list(keys[0].data[i].co)
    row['displacementMeters'] = (keys[0].data[i].co - points[i]).length
bind(rig, bpy.data.actions['Idle']); bind(root, None)
root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version = 0
destination = OUT / 'resident.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
assert sha(SOURCE) == input_hash
metadata = json.loads((SOURCE.parent / 'authoring-review.json').read_text(encoding='utf-8'))
metadata.update(sourceSha256=sha(destination), inputSourceSha256=input_hash, capeTrial=args.trial,
                builderSha256=sha(Path(__file__)), humanArtApproved=False, scope='Unreviewed silhouette candidate; retained animation curves and skirt morphs, newly fitted cape mesh and binding.')
(OUT / 'authoring-review.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
report = {'complete': True, 'sourceSha256': sha(destination), 'inputSourceSha256': input_hash,
          'capeVertices': len(cape), 'trimVertices': len(trim), 'patches': patches,
          'widthBefore': max(points[i].x for i in ids) - min(points[i].x for i in ids),
          'widthAfter': max(keys[0].data[i].co.x for i in ids) - min(keys[0].data[i].co.x for i in ids),
          'maximumDisplacementMeters': max(r['displacementMeters'] for r in patches),
          'outerEnvelopeFits': ray_fits,
          'motionFitIterations': motion_fits,
          'bindingSmoothing': {'iterations': 24, 'neckAnchors': int(np.sum(neck_pin)), 'maximumInfluenceChange': float(np.max(np.abs(values - initial_weights)))},
          'maximumMotionEaseMeters': max((keys[0].data[i].co - pattern[i]).length for i in ids),
          'humanApproved': False, 'functionPassed': False, 'formPassed': False,
          'method': '72 mm lateral draw-in and 52 mm downward drape; continuous 3D radial projection onto convex blouse support, 8/10 mm initial normal clearance. Transferred binding receives 24 fabric-neighbor smoothing passes with neckline anchors. Actual intersecting cape triangles receive 3 mm ease along the contacted sleeve normal, spread to neighbors and the opposite shell. Six sampled clips, maximum 25 mm additional rest displacement. No runtime cloth simulation or formal acceptance is implied.'}
(OUT / 'cape-sculpt.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(OUT / 'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({k: v for k, v in report.items() if k != 'patches'}), flush=True)
