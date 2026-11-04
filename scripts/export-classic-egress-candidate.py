"""Export six source-bound clips and merge animation data on one normalized skin.

The reviewed .blend is never saved. Nothing is written into public/. Exporting
one active rig/root pair at a time keeps driven cloth and root motion together.
"""
from pathlib import Path
import argparse, bpy, copy, hashlib, json, struct, sys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser()
p.add_argument('--pilot', required=True)
p.add_argument('--actor', required=True)
p.add_argument('--tag', default='export-candidate')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
P = BASE / args.pilot
OUT = P / args.tag / args.actor
OUT.mkdir(parents=True, exist_ok=True)
assert not any(OUT.iterdir()), 'Use a separate export candidate; preserve existing output.'

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def bind(obj, action):
    obj.animation_data_create()
    obj.animation_data.action = action
    if action and action.slots: obj.animation_data.action_slot = action.slots[0]
def unpack(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20 + size])
    size2, kind2 = struct.unpack_from('<II', raw, 20 + size)
    assert kind2 == 0x004e4942 and len(doc['buffers']) == 1
    return doc, raw[28 + size:28 + size + doc['buffers'][0]['byteLength']]
def pack(path, doc, binary):
    doc['buffers'] = [{'byteLength': len(binary)}]
    payload = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(payload) + len(binary)) + struct.pack('<II', len(payload), 0x4e4f534a) + payload + struct.pack('<II', len(binary), 0x004e4942) + binary)
def accessor_bytes(doc, binary, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a
    v = doc['bufferViews'][a['bufferView']]
    item_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a['componentType']] * {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', item_size)
    return b''.join(binary[start + i * stride:start + i * stride + item_size] for i in range(a['count']))
def geometry_signature(doc, binary):
    result = []
    for mesh in doc['meshes']:
        primitives = []
        for primitive in mesh['primitives']:
            refs = dict(primitive['attributes'])
            refs['indices'] = primitive['indices']
            for n, target in enumerate(primitive.get('targets', [])):
                refs.update({f'morph-{n}-{name}': index for name, index in target.items()})
            primitives.append({name: hashlib.sha256(accessor_bytes(doc, binary, index)).hexdigest() for name, index in sorted(refs.items())})
        result.append({'name': mesh.get('name'), 'targets': mesh.get('extras', {}).get('targetNames'), 'primitives': primitives})
    return result

entry = next(e for e in read(BASE / 'layout-01/cast-candidate.json')['entries'] if e['actorId'] == args.actor)
manifest = read(ROOT / ('public' + entry['manifestUrl']))
source = P / args.actor / 'resident.blend'
identity = sha(source)
authoring = read(source.parent / 'authoring-review.json')
assert authoring['sourceSha256'] == identity
for name in ('route-mesh-diagnostic', 'pose-diagnostic', 'retention-review', 'cloth-form-review'):
    review = read(P / (name + '.json'))
    assert review['passed'], name
    assert review.get('selectedActor') in (None, args.actor), name
    if 'sourceSha256' in review: assert review['sourceSha256'] == identity, name
    if name == 'cloth-form-review':
        assert review['formal'] and len([r for r in review['rows'] if r['actorId'] == args.actor]) == 6
        if args.actor == 'resident-08' and (source.parent / 'cape-sculpt.json').exists():
            assert review.get('capeSelfContactChecked'), 'Rebuilt cape requires sampled shell self-contact review.'
            assert all(r['maxima'].get('cape__self') == 0 for r in review['rows'] if r['actorId'] == args.actor)
    for row in review.get('rows', []):
        if row.get('actorId') == args.actor and 'sourceSha256' in row: assert row['sourceSha256'] == identity
    for path, value in review.get('sourceHashes', {}).items(): assert sha(ROOT / path) == value
if (source.parent / 'motion-edit.json').exists():
    motion = read(P / 'motion-retention-review.json')
    assert motion['complete'] and motion['passed'] and motion['sourceSha256'] == identity
clips = [('Idle', 3.0), ('Walk', manifest['animation']['walkDurationSeconds']), (manifest['workAction']['clip'], manifest['workAction']['durationSeconds'])]
clips.extend((c['clip'], c['durationSeconds']) for c in authoring['clips'])
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
assert scene.render.fps == 30 and scene.render.fps_base == 1
rig = bpy.data.objects[manifest['id'] + '_rig']
body = bpy.data.objects[manifest['id'] + '_skin']
root = bpy.data.objects['movement_actor']
normalization = {'parent': root.parent.name if root.parent else None, 'previousTranslation': list(root.parent.location) if root.parent else [0, 0, 0]}
if root.parent:
    assert root.parent.name == 'occupation_actor'
    assert max(abs(x) for x in root.parent.rotation_euler) < 1e-6
    root.parent.location = (0, 0, 0)
durations = {a.name: float(a.frame_range[1] - a.frame_range[0]) / 30 for a in bpy.data.actions}
for action in bpy.data.actions:
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if not bag: continue
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        co, left, right = key.co.copy(), key.handle_left.copy(), key.handle_right.copy()
                        key.co.x = (co.x - 1) * 4 + 1
                        key.handle_left.x = (left.x - 1) * 4 + 1
                        key.handle_right.x = (right.x - 1) * 4 + 1
                    curve.update()
scene.render.fps = 120
assert max(abs(durations[a.name] - float(a.frame_range[1] - a.frame_range[0]) / 120) for a in bpy.data.actions) < 1e-6
selected = {rig, body}
parent = rig.parent
while parent:
    selected.add(parent)
    parent = parent.parent
bpy.ops.object.select_all(action='DESELECT')
for obj in selected: obj.select_set(True)

merged = None
merged_binary = b''
clip_reports = []
temporary = OUT / 'in-progress-clip.glb'
for clip, seconds in clips:
    bind(rig, bpy.data.actions[clip])
    bind(root, bpy.data.actions.get(clip + '_Origin'))
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', use_selection=True, export_animations=True,
        export_animation_mode='ACTIVE_ACTIONS', export_nla_strips_merged_animation_name=clip,
        export_force_sampling=True, export_frame_step=1, export_anim_slide_to_zero=True,
        export_skins=True, export_apply=False, export_extras=True, export_cameras=False, export_lights=False,
        export_yup=True, export_morph=True, export_morph_animation=True, export_try_sparse_sk=False, export_rest_position_armature=True)
    doc, binary = unpack(temporary)
    assert len(doc['animations']) == 1
    animation = doc['animations'][0]
    animation['name'] = clip
    starts = [doc['accessors'][s['input']]['min'][0] for s in animation['samplers']]
    ends = [doc['accessors'][s['input']]['max'][0] for s in animation['samplers']]
    assert abs(min(starts)) < 1e-6 and abs(max(ends) - seconds) < 1e-5, (clip, min(starts), max(ends), seconds)
    signature = geometry_signature(doc, binary)
    if merged is None:
        merged, merged_binary = copy.deepcopy(doc), binary
        geometry = signature
        names = {n['name']: i for i, n in enumerate(merged['nodes'])}
        assert len(names) == len(merged['nodes']), 'Duplicate node names prevent unambiguous animation binding.'
    else:
        assert signature == geometry, 'Exported base mesh, skin weights or morph deltas changed between clips.'
        remapped = copy.deepcopy(animation)
        memo = {}
        def append_accessor(index):
            global merged_binary
            if index in memo: return memo[index]
            a = copy.deepcopy(doc['accessors'][index])
            assert 'sparse' not in a and 'extensions' not in a
            view = copy.deepcopy(doc['bufferViews'][a['bufferView']])
            assert view['buffer'] == 0 and 'extensions' not in view
            offset = view.get('byteOffset', 0)
            payload = binary[offset:offset + view['byteLength']]
            merged_binary += b'\0' * (-len(merged_binary) % 4)
            view['byteOffset'] = len(merged_binary)
            merged_binary += payload
            a['bufferView'] = len(merged['bufferViews'])
            merged['bufferViews'].append(view)
            memo[index] = len(merged['accessors'])
            merged['accessors'].append(a)
            return memo[index]
        for sampler in remapped['samplers']:
            sampler['input'] = append_accessor(sampler['input'])
            sampler['output'] = append_accessor(sampler['output'])
        for channel in remapped['channels']:
            node = doc['nodes'][channel['target']['node']]
            channel['target']['node'] = names[node['name']]
        merged['animations'].append(remapped)
    clip_reports.append({'clip': clip, 'seconds': seconds, 'channels': len(animation['channels']), 'animatedWeightChannels': sum(c['target']['path'] == 'weights' for c in animation['channels']), 'individualExportSha256': sha(temporary)})
    print(json.dumps(clip_reports[-1]), flush=True)

asset = OUT / 'resident-raw.glb'
pack(asset, merged, merged_binary)
assert sha(source) == identity
report = {'schema': 'classic-egress-candidate-export.v1', 'complete': True, 'actorId': args.actor, 'sourceSha256': identity,
          'sourceUnchanged': True, 'originNormalization': normalization, 'asset': {'path': asset.name, 'sha256': sha(asset), 'bytes': asset.stat().st_size},
          'clips': clip_reports, 'morphTargets': len(body.data.shape_keys.key_blocks) - 1, 'perClipGeometryIdentical': True,
          'temporaryExportFps': 120, 'sourceFps': 30, 'exporterSha256': sha(Path(__file__)),
          'reviewHashes': {name: sha(P / (name + '.json')) for name in ('route-mesh-diagnostic', 'pose-diagnostic', 'retention-review', 'cloth-form-review')},
          'scope': 'Normalized uncompressed candidate only. Six independently baked active rig/root pairs share identical geometry. Round-trip comparison, runtime blends, optimization and browser acceptance remain.', 'humanApproved': False, 'browserIntegrated': False}
(OUT / 'export-review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(OUT / 'exporter.py').write_bytes(Path(__file__).read_bytes())
temporary.unlink()
print(json.dumps({'complete': True, 'actor': args.actor, 'clips': len(clips), 'bytes': asset.stat().st_size}), flush=True)
