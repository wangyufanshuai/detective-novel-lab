"""Check posed envelope fitting and the inverse skin map, without saving a blend."""
from pathlib import Path
import argparse, bpy, hashlib, json, sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(); p.add_argument('--trial', required=True); args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
folder = ROOT / 'docs/3d-town/classic-motion-v2/step-16' / args.trial
source = folder / 'resident-08/resident.blend'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
body = bpy.data.objects['rb-lin-ali_skin']; rig = bpy.data.objects['rb-lin-ali_rig']; root = bpy.data.objects['movement_actor']
initial_to_rig = rig.matrix_world.inverted() @ body.matrix_world
mesh = body.data; keys = mesh.shape_keys.key_blocks; labels = mesh.attributes['ArtClothLayer'].data
mesh.calc_loop_triangles(); triangles = [tuple(t.vertices) for t in mesh.loop_triangles if all(labels[i].value == 1 for i in t.vertices)]
cape_faces = [tuple(t.vertices) for t in mesh.loop_triangles if all(labels[i].value == 2 for i in t.vertices)]
ids = [i for i in range(len(mesh.vertices)) if labels[i].value == 2]

def bind(obj, action):
    obj.animation_data_create(); obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

rows = []
for clip, frame in [('Idle', 1), ('Walk', 17), ('ReconcileRegister', 151), ('ReconcileRegister', 273)]:
    bind(rig, bpy.data.actions[clip]); bind(root, None); root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
    bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
    e = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); m = e.to_mesh(); points = [v.co.copy() for v in m.vertices]; e.to_mesh_clear()
    tree = BVHTree.FromPolygons(points, triangles, all_triangles=True)
    contacts = BVHTree.FromPolygons(points, cape_faces, all_triangles=True).overlap(tree)
    to_rig = rig.matrix_world.inverted() @ body.matrix_world; to_body = to_rig.inverted()
    transforms = {b.name: b.matrix @ b.bone.matrix_local.inverted() for b in rig.pose.bones}
    skin_errors = []; violations = []; matrices = {}
    for i in ids:
        q = points[i]; radial = Vector((q.x, q.y, 0)).normalized()
        hit, normal, _, _ = tree.ray_cast(Vector((radial.x * 1.2, radial.y * 1.2, q.z)), -radial, 1.2)
        skin = Matrix([[0.] * 4 for _ in range(4)])
        for g in mesh.vertices[i].groups: skin += transforms[body.vertex_groups[g.group].name] * g.weight
        matrix = to_body @ skin @ to_rig; matrices[i] = matrix
        predicted = matrix @ keys[0].data[i].co
        skin_errors.append((predicted - q).length)
        if hit is not None:
            amount = Vector((hit.x, hit.y, 0)).length + .005 / max(.3, abs(normal.dot(radial))) - Vector((q.x, q.y, 0)).length
            if amount > .0002:
                violations.append({'id': i, 'required': amount, 'point': list(q), 'rest': list(keys[0].data[i].co), 'hit': list(hit), 'normal': list(normal), 'skinPredictionError': skin_errors[-1]})
    violations.sort(key=lambda r: -r['required'])
    probe = violations[0]['id'] if violations else ids[0]
    original = keys[0].data[probe].co.copy(); delta = Vector((.001, .002, .003))
    for key in keys: key.data[probe].co = original + delta
    mesh.vertices[probe].co = original + delta
    mesh.shape_keys.update_tag(); mesh.update(); body.update_tag(); bpy.context.view_layer.update()
    e = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); m = e.to_mesh(); observed = m.vertices[probe].co - points[probe]; e.to_mesh_clear()
    predicted_delta = matrices[probe].to_3x3() @ delta
    for key in keys: key.data[probe].co = original
    mesh.vertices[probe].co = original
    mesh.shape_keys.update_tag(); mesh.update(); body.update_tag(); bpy.context.view_layer.update()
    contact_samples = []
    for a, b in contacts[:12]:
        face = cape_faces[a]; blouse = triangles[b]
        contact_samples.append({'cape': list(face), 'blouse': list(blouse), 'capePoints': [list(points[i]) for i in face],
                                'blousePoints': [list(points[i]) for i in blouse], 'capeRest': [list(keys[0].data[i].co) for i in face]})
    rows.append({'clip': clip, 'frame': frame, 'toRigDrift': max(abs(x-y) for a,b in zip(to_rig,initial_to_rig) for x,y in zip(a,b)), 'pairs': len(contacts), 'contactSamples': contact_samples, 'maximumSkinPredictionError': max(skin_errors), 'violations': len(violations), 'worst': violations[:6],
                 'probe': probe, 'observedDelta': list(observed), 'predictedDelta': list(predicted_delta), 'deltaError': (predicted_delta - observed).length})
report = {'sourceSha256': sha(source), 'modifiers': [{'name': m.name, 'type': m.type, 'preserveVolume': getattr(m, 'use_deform_preserve_volume', None)} for m in body.modifiers], 'rows': rows}
(folder / 'envelope-diagnostic-detailed.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'clip': r['clip'], 'frame': r['frame'], 'pairs': r['pairs'], 'toRigDrift': r['toRigDrift'], 'worst': r['worst'][:1], 'contactSamples': r['contactSamples'][:2]} for r in rows]), flush=True)
