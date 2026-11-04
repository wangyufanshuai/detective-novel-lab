"""Diagnose prospective local quaternion/morph fades on the reviewed sources.

This does not save the source or claim to reproduce a browser renderer. Root
placement and foot planting during locomotion still require runtime review.
"""
from pathlib import Path
import argparse, bpy, hashlib, json, math, sys
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser()
p.add_argument('--pilot', required=True)
p.add_argument('--actor')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
P = BASE / args.pilot

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def bind(obj, action):
    obj.animation_data_create()
    obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]

formal = read(P / 'cloth-form-review.json')
assert formal['formal'] and formal['passed']
assert formal.get('selectedActor') in (None, args.actor)
assert read(P / 'pose-diagnostic.json')['passed']
rows = []
sources = {}

for entry in read(BASE / 'layout-01/cast-candidate.json')['entries']:
    actor = entry['actorId']
    if args.actor and actor != args.actor: continue
    source = P / actor / 'resident.blend'
    identity = sha(source)
    assert identity == read(source.parent / 'authoring-review.json')['sourceSha256']
    assert len([r for r in formal['rows'] if r['actorId'] == actor]) == 6
    assert all(r['sourceSha256'] == identity for r in formal['rows'] if r['actorId'] == actor)
    sources[source.relative_to(ROOT).as_posix()] = identity
    manifest = read(ROOT / ('public' + entry['manifestUrl']))
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig = bpy.data.objects[manifest['id'] + '_rig']
    body = bpy.data.objects[manifest['id'] + '_skin']
    root = bpy.data.objects['movement_actor']
    bind(root, None)
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    mesh = body.data
    mesh.calc_loop_triangles()
    triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
    materials = [mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
    weights = {v.index: {body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in mesh.vertices}
    tails = {i for i, w in weights.items() if sum(v for n, v in w.items() if n.startswith('tail_')) > .4}
    legs = {i for i, w in weights.items() if sum(v for n, v in w.items() if n.startswith(('thigh_', 'shin_'))) > .5}
    skin = {i for t, m in zip(triangles, materials) if m.startswith('skin') for i in t}
    hands = {i for i, w in weights.items() if i in skin and sum(v for n, v in w.items() if n.startswith(('hand_', 'finger_'))) > .5}
    digits = mesh.attributes['AnatomicalFinger'].data
    groups = {
        'legs': [t for t in triangles if all(i in legs for i in t)],
        'skirt': [t for t, m in zip(triangles, materials) if m.startswith('trousers') and all(i in tails and .15 < mesh.vertices[i].co.z < .94 for i in t)],
        'fingers': [t for t in triangles if all(digits[i].value != 0 for i in t)],
        'garment': [t for t in triangles if not any(i in hands for i in t)],
    }
    pairs = [('fingers', 'garment')]
    if groups['skirt']: pairs.append(('skirt', 'legs'))
    if actor == 'resident-03':
        groups['apron'] = [t for t, m in zip(triangles, materials) if m.startswith('accent') and all(i in tails and .15 < mesh.vertices[i].co.z < .94 for i in t)]
        tool_vertices = {i for t, m in zip(triangles, materials) if m.startswith('leather') for i in t if .7 < mesh.vertices[i].co.z < 1.02 and sum(v for n, v in weights[i].items() if n.startswith('tail_')) > .05}
        groups['apronTools'] = [t for t in triangles if all(i in tool_vertices for i in t)]
        pairs.extend([('apron', 'skirt'), ('apronTools', 'apron'), ('apronTools', 'skirt')])
    for attr_name, options in [('ArtClothLayer', [('blouse', 1), ('cape', 2)]), ('UniformPart', [('uniform_trousers', 1), ('uniform_jacket', 3)])]:
        if attr_name in mesh.attributes and (attr_name != 'ArtClothLayer' or actor == 'resident-08'):
            attr = mesh.attributes[attr_name].data
            for name, value in options: groups[name] = [t for t in triangles if all(attr[i].value == value for i in t)]
            pairs.append(tuple(name for name, _ in options))
    cape_sets = [set(t) for t in groups.get('cape', [])]
    feet = {s: [i for i, w in weights.items() if w.get('foot_' + s, 0) > .5] for s in ('L', 'R')}
    cache = {}
    def capture(clip, seconds):
        count = float(bpy.data.actions[clip].frame_range[1]) - 1
        f = 1 + ((seconds * 30) % count if clip in ('Walk', 'Idle') else min(count, max(0, seconds * 30)))
        key = (clip, round(f, 8))
        if key not in cache:
            bind(rig, bpy.data.actions[clip])
            bpy.context.scene.frame_set(math.floor(f), subframe=f % 1)
            bpy.context.view_layer.update()
            cache[key] = ({b.name: b.matrix_basis.decompose() for b in rig.pose.bones}, [k.value for k in mesh.shape_keys.key_blocks][1:])
        return cache[key]

    # Retain the current action semantics. These two proposed start phases are
    # diagnosed separately; the script does not choose a successful result.
    plans = [
        ('idle-retreat', 'Idle', 0, 'BackAway', 0, .18),
        ('retreat-turn', 'BackAway', 2, 'TurnLeft', 0, .18),
        ('turn-walk-stride', 'TurnLeft', 1.6, 'Walk', 0, .18),
        ('turn-walk-passing', 'TurnLeft', 1.6, 'Walk', .2, .18),
        ('approach-idle', 'ApproachWork', 2, 'Idle', 0, .18),
        ('idle-work', 'Idle', 0, manifest['workAction']['clip'], 0, .3),
        ('work-idle', manifest['workAction']['clip'], manifest['workAction']['durationSeconds'] - .35, 'Idle', 0, .35),
    ]
    for f in (1, 5, 9, 13, 17, 21):
        plans.extend([(f'walk-{f}-turn', 'Walk', (f - 1) / 30, 'TurnLeft', 0, .18),
                      (f'walk-{f}-idle', 'Walk', (f - 1) / 30, 'Idle', 0, .18)])
    prepared = []
    for name, a, at, b, bt, duration in plans:
        samples = []
        n = math.ceil(duration * 60)
        for i in range(n + 1):
            q = i / n
            t = q * duration
            samples.append((t, q * q * (3 - 2 * q), capture(a, at + t), capture(b, bt + t)))
        prepared.append((name, a, at, b, bt, duration, samples))
    capture('Idle', 0)
    bind(rig, bpy.data.actions['Idle'])
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    e = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    m = e.to_mesh()
    floor = min((e.matrix_world @ m.vertices[i].co).z for indices in feet.values() for i in indices)
    e.to_mesh_clear()
    bind(rig, None)
    for bone in rig.pose.bones: bone.rotation_mode = 'QUATERNION'
    for driver in mesh.shape_keys.animation_data.drivers: driver.mute = True
    for name, a, at, b, bt, duration, samples in prepared:
        maximum = {x + '__' + y: 0 for x, y in pairs}
        if cape_sets: maximum['cape__self'] = 0
        contacts = []
        minimum_gap = math.inf
        maximum_lowest_gap = -math.inf
        for t, blend, (first, first_weights), (second, second_weights) in samples:
            for bone in rig.pose.bones:
                ap, aq, asc = first[bone.name]
                bp, bq, bsc = second[bone.name]
                bone.matrix_basis = Matrix.LocRotScale(ap.lerp(bp, blend), aq.slerp(bq, blend), asc.lerp(bsc, blend))
            for key, av, bv in zip(list(mesh.shape_keys.key_blocks)[1:], first_weights, second_weights): key.value = av * (1 - blend) + bv * blend
            bpy.context.view_layer.update()
            e = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
            m = e.to_mesh()
            points = [v.co.copy() for v in m.vertices]
            trees = {g: BVHTree.FromPolygons(points, faces, all_triangles=True) for g, faces in groups.items() if faces}
            values = {x + '__' + y: len(trees[x].overlap(trees[y])) for x, y in pairs}
            if cape_sets:
                values['cape__self'] = sum(a < b and not cape_sets[a] & cape_sets[b] for a, b in trees['cape'].overlap(trees['cape']))
            for key, value in values.items(): maximum[key] = max(maximum[key], value)
            if any(values.values()): contacts.append({'seconds': t, 'weight': blend, 'pairs': values})
            lowest = min((e.matrix_world @ m.vertices[i].co).z - floor for indices in feet.values() for i in indices)
            minimum_gap = min(minimum_gap, lowest)
            maximum_lowest_gap = max(maximum_lowest_gap, lowest)
            e.to_mesh_clear()
        row = {'actorId': actor, 'name': name, 'outgoing': [a, at], 'incoming': [b, bt], 'durationSeconds': duration, 'samples': len(samples), 'maximumContacts': maximum, 'contacts': contacts,
               'minimumSoleHeightFromIdleFloorMeters': minimum_gap, 'maximumLowestSoleHeightFromIdleFloorMeters': maximum_lowest_gap,
               'garmentPassed': not any(maximum.values()), 'floorPenetrationPassed': minimum_gap >= -.003}
        rows.append(row)
        print(json.dumps({k: v for k, v in row.items() if k != 'contacts'}), flush=True)
    assert sha(source) == identity

assert len(rows) == (19 if args.actor else 57), 'Incomplete blend plan'
report = {'schema': 'classic-egress-blends.v1', 'complete': True, 'selectedActor': args.actor, 'sourceHashes': sources, 'formReviewSha256': sha(P / 'cloth-form-review.json'),
          'inspectorSha256': sha(Path(__file__)), 'rows': rows, 'garmentPassed': all(r['garmentPassed'] for r in rows), 'floorPenetrationPassed': all(r['floorPenetrationPassed'] for r in rows),
          'scope': 'Prospective 60 Hz local quaternion/scale/translation and independent morph-weight smooth fades. Same garment surface groups and hem/wrist exclusions as source Form, including nonadjacent cape shell self-contact. Root placement is held fixed; this does not establish foot planting, room clearance, exact Three.js playback, continuous collision or human motion approval.',
          'humanApproved': False, 'sourceUnchanged': True}
(P / 'blend-diagnostic.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(P / 'blend-inspector.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete': True, 'transitions': len(rows), 'garmentPassed': report['garmentPassed'], 'floorPenetrationPassed': report['floorPenetrationPassed']}), flush=True)
