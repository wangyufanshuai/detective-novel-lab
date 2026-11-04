"""Independently re-read the candidate and limit changes to the declared cape."""
from pathlib import Path
import argparse, bpy, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[1]; BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser(); p.add_argument('--trial', default='cape-01'); args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
OUT = BASE / 'step-16' / args.trial; candidate = OUT / 'resident-08/resident.blend'
original = BASE / 'step-15/resident-08/resident.blend'
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
digest = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
patch = json.loads((candidate.parent / 'cape-sculpt.json').read_text(encoding='utf-8'))
assert patch['sourceSha256'] == sha(candidate) and patch['inputSourceSha256'] == sha(original)
allowed = {r['index']: r for r in patch['patches']}
motion_file = candidate.parent / 'motion-edit.json'
motion = json.loads(motion_file.read_text(encoding='utf-8')) if motion_file.exists() else None
motion_paths = set()
if motion:
    assert motion['sourceSha256'] == sha(candidate) and motion['allowedAction'] == 'ReconcileRegister'
    bones = [n + side for side in ('L', 'R') for n in ('upperarm_', 'forearm_', 'hand_')]
    assert motion['allowedBones'] == bones
    motion_paths = {'pose.bones["' + n + '"].' + prop for n in bones for prop in ('location', 'rotation_quaternion', 'scale')}

def snapshot(source):
    bpy.ops.wm.open_mainfile(filepath=str(source)); body = bpy.data.objects['rb-lin-ali_skin']; mesh = body.data; rig = bpy.data.objects['rb-lin-ali_rig']
    labels = mesh.attributes['ArtClothLayer'].data
    ids = {i for i in range(len(mesh.vertices)) if labels[i].value == 2}
    ids |= {i for poly in mesh.polygons if mesh.materials[poly.material_index].name.split('.')[0] == 'accent' for i in poly.vertices if mesh.vertices[i].co.z > 1.20}
    assert ids == set(allowed), 'Declared edits must equal the actual cape and trim labels'
    keys = {k.name: [list(v.co) for v in k.data] for k in mesh.shape_keys.key_blocks}
    weights = [{body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in mesh.vertices]
    actions = {}
    for action in bpy.data.actions:
        curves = []
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    bag = strip.channelbag(slot)
                    if bag:
                        for curve in bag.fcurves:
                            if motion and action.name == motion['allowedAction'] and curve.data_path in motion_paths: continue
                            curves.append((curve.data_path, curve.array_index, [(list(k.co), list(k.handle_left), list(k.handle_right), k.interpolation) for k in curve.keyframe_points]))
        actions[action.name] = digest(sorted(curves, key=lambda r: (r[0], r[1])))
    retained = {
        'topology': digest([[list(poly.vertices), poly.material_index, poly.use_smooth] for poly in mesh.polygons]),
        'uv': digest({layer.name: [list(d.uv) for d in layer.data] for layer in mesh.uv_layers}),
        'artLabels': digest({name: [d.value for d in mesh.attributes[name].data] for name in ['ArtClothLayer', 'AnatomicalFinger']}),
        'materials': digest([m.name for m in mesh.materials]),
        'packedImages': digest({im.name: hashlib.sha256(bytes(im.packed_file.data)).hexdigest() for im in bpy.data.images if im.packed_file}),
        'restBones': digest({b.name: [[float(v) for v in row] for row in b.matrix_local] for b in rig.data.bones}),
        'actionsExceptDeclaredWorkArmCurves' if motion else 'actions': digest(actions),
        'shapeDrivers': digest([(f.data_path, f.driver.expression, [(v.name, v.type, [(t.id.name if t.id else None, t.data_path) for t in v.targets]) for v in f.driver.variables]) for f in mesh.shape_keys.animation_data.drivers])}
    return keys, weights, retained

before, before_weights, a = snapshot(original)
after, after_weights, b = snapshot(candidate)
assert before.keys() == after.keys()
same = {key: a[key] == b[key] for key in a}
outside = [i for i in range(len(before_weights)) if i not in allowed]
same['outsideCapeWeights'] = all(before_weights[i] == after_weights[i] for i in outside)
same['outsideCapeEveryShape'] = all(before[key][i] == after[key][i] for key in before for i in outside)
maximum_patch_error = max(abs(after[key][i][axis] - row['after'][axis]) for i, row in allowed.items() for key in before for axis in range(3))
assert all(before[key][i] == row['before'] for i, row in allowed.items() for key in before)
maximum_weight_error = max(abs(after_weights[i].get(n, 0) - row['weightsAfter'].get(n, 0)) for i, row in allowed.items() for n in set(after_weights[i]) | set(row['weightsAfter']))
assert all(len(after_weights[i]) <= 4 and abs(sum(after_weights[i].values()) - 1) < 1e-6 for i in allowed)
passed = all(same.values()) and maximum_patch_error < 1e-7 and maximum_weight_error < 1e-7
report = {'complete': True, 'passed': passed, 'sourceSha256': sha(candidate), 'retainedSourceSha256': sha(original),
          'identical': same, 'declaredCapeVertices': len(allowed), 'maximumPatchError': maximum_patch_error, 'maximumWeightError': maximum_weight_error,
          'reviewerSha256': sha(Path(__file__)), 'humanApproved': False,
          'scope': 'Reopened original and candidate. Only cape and trim geometry/binding may differ, exactly as declared. Every other shape vertex and skin weight, all topology, UVs, labels, packed images, driver expressions, action keyframes and rest matrices are compared.'}
if motion:
    report['motionEditSha256'] = sha(motion_file)
    report['scope'] = 'Reopened original and candidate. Cape/trim geometry and binding may differ as declared. Exactly six work arm transform channels are excluded from curve equality and require independent motion-retention-review. Every other action curve, static shape vertex/weight outside the cape, topology, UV, art label, packed image, rest bone and driver is compared.'
(OUT / 'retention-review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(OUT / 'retention-reviewer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps(report), flush=True)
