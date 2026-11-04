"""Read the retained actor and room meshes in background Blender."""
from pathlib import Path
import json
import hashlib
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/classic-occupations-v1'
OUT.mkdir(parents=True, exist_ok=True)


def bounds(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [obj.matrix_world @ v.co for v in mesh.vertices]
    result = [[min(v[a] for v in points), max(v[a] for v in points)] for a in range(3)]
    evaluated.to_mesh_clear()
    return result


result = {'actors': [], 'room': {}, 'sources': {}}
for actor, name in [('resident-06', 'rb-gu-yuanshan'), ('resident-08', 'rb-lin-ali')]:
    path = ROOT / f'docs/3d-town/classic-residents-v8/{actor}/{name}.blend'
    result['sources'][path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig = bpy.data.objects[name + '_rig']
    body = bpy.data.objects[name + '_skin']
    rig.animation_data.action = bpy.data.actions['Idle']
    rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    joints = ['root', 'pelvis', 'spine', 'head', 'upperarm_L', 'forearm_L', 'hand_L', 'upperarm_R', 'forearm_R', 'hand_R', 'finger_R_1_1', 'finger_R_2_1', 'finger_R_3_1']
    result['actors'].append({'actorId': actor, 'rigMatrix': [list(row) for row in rig.matrix_world],
                            'bodyBounds': bounds(body), 'materials': [m.name for m in body.data.materials],
                            'bones': {b.name: {'head': list(b.head), 'tail': list(b.tail), 'matrix': [list(row) for row in b.matrix]} for b in rig.pose.bones if b.name in joints}})
path = ROOT / 'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
result['sources'][path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(path))
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.name.startswith(('station_counter', 'station_staff', 'reception_', 'inn_counter', 'desk_')):
        result['room'][obj.name] = {'bounds': bounds(obj), 'layer': obj.get('layer')}
(OUT / 'source-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'actors': [{'actorId': a['actorId'], 'rigMatrix': a['rigMatrix'], 'bodyBounds': a['bodyBounds'], 'bones': {n: {'head': d['head'], 'tail': d['tail']} for n, d in a['bones'].items()}} for a in result['actors']], 'room': result['room']}, ensure_ascii=False))
