"""Export the reviewed layout into a separate candidate bundle, preserving source."""
from collections import defaultdict
from pathlib import Path
import argparse, bpy, hashlib, importlib.util, json, sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser()
p.add_argument('--pilot', required=True)
p.add_argument('--tag', default='export-candidate-02')
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
P = BASE / args.pilot
OUT = P / args.tag / 'scene'
OUT.mkdir(parents=True, exist_ok=True)
assert not any(OUT.iterdir())
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
spec = importlib.util.spec_from_file_location('retained_exporter', ROOT / 'scripts/export-classic-bookshop-v2.py')
retained = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retained)
source = BASE / 'layout-01/room.blend'
identity = sha(source)
integrity = read(BASE / 'layout-01/layout-integrity.json')
assert integrity['passed'] and integrity['sourceSha256'] == identity
assert read(BASE / 'layout-01/render-review.json')['complete']
for name in ('route-mesh-diagnostic', 'pose-diagnostic', 'cloth-form-review'):
    report = read(P / (name + '.json'))
    assert report['passed']
    for path, value in report.get('sourceHashes', {}).items(): assert sha(ROOT / path) == value
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
navigation = read(BASE / 'layout-01/navigation-candidate.json')
origin = Vector((*navigation['player']['spawn'], navigation['floor']))
collection = bpy.data.collections.new('Reviewed egress layout export')
bpy.context.scene.collection.children.link(collection)
objects, roots, joints = [], {}, {}
for layer in retained.LAYERS:
    obj = bpy.data.objects.new('layer_' + layer, None)
    collection.objects.link(obj)
    obj['layer'] = layer
    roots[layer] = obj
    objects.append(obj)
assert all(layer in roots for room in navigation['interiors'] for layer in room['cutawayLayers'])
actor = bpy.data.objects.new('sample_player', None)
collection.objects.link(actor)
actor.location = origin
actor['binding'] = 'source-static-scale-reference'
objects.append(actor)
for part, pivot in navigation['actorPivots'].items():
    if part == 'body': continue
    joint = bpy.data.objects.new('sample_' + part, None)
    joint.parent = actor
    joint.location = pivot
    collection.objects.link(joint)
    joints[part] = joint
    objects.append(joint)
buckets = defaultdict(lambda: {'vertices': [], 'faces': [], 'uv': [], 'smooth': []})
triangles = 0
for obj in list(bpy.context.scene.objects):
    if obj in objects or obj.type not in ('MESH', 'FONT', 'CURVE') or obj.get('runtimeExcluded') or obj.get('layer') == 'review_resident': continue
    layer, part = obj.get('layer'), obj.get('part', 'static')
    assert layer in roots or layer == 'actor', ('Unclassified object', obj.name, layer)
    e = obj.evaluated_get(dg)
    mesh = e.to_mesh()
    mesh.calc_loop_triangles()
    triangles += len(mesh.loop_triangles)
    uv = mesh.uv_layers.active
    offset = origin + Vector(navigation['actorPivots'][part]) if layer == 'actor' else Vector((0, 0, 0))
    for material_index, material in enumerate(mesh.materials):
        polygons = [poly for poly in mesh.polygons if poly.material_index == material_index]
        if not polygons: continue
        bucket = buckets[(layer, part, material.name)]
        used = sorted({index for poly in polygons for index in poly.vertices})
        mapping = {index: len(bucket['vertices']) + i for i, index in enumerate(used)}
        bucket['vertices'].extend(tuple(e.matrix_world @ mesh.vertices[index].co - offset) for index in used)
        for poly in polygons:
            bucket['faces'].append(tuple(mapping[index] for index in poly.vertices))
            bucket['smooth'].append(poly.use_smooth)
            bucket['uv'].extend(tuple(uv.data[index].uv) if uv else (0, 0) for index in poly.loop_indices)
    e.to_mesh_clear()
for (layer, part, material), values in buckets.items():
    name = 'sample_' + layer + '_' + part + '_' + material
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(values['vertices'], [], values['faces'])
    mesh.update()
    mesh.materials.append(bpy.data.materials[material])
    uv = mesh.uv_layers.new(name='UVMap')
    for loop, value in zip(uv.data, values['uv']): loop.uv = value
    for poly, smooth in zip(mesh.polygons, values['smooth']): poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = (actor if part == 'body' else joints[part]) if layer == 'actor' else roots[layer]
    obj['origin'] = 'project-local-authored'
    obj['layer'] = layer
    objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
    obj.hide_render = False
asset = OUT / 'classic-street-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False, export_yup=True, export_apply=True)
navigation.update({'sourceSha256': identity, 'assetSha256': sha(asset)})
write(OUT / 'navigation-raw.json', navigation)
manifest = read(ROOT / 'public/assets/classic-occupations/v2/manifest.json')
lights = manifest['lights']
fixture_bindings = []
for light in lights:
    obj = bpy.data.objects.get(light['id'])
    if obj and obj.type == 'LIGHT':
        prior = light['position']
        light['position'] = list(obj.matrix_world.translation)
        fixture_bindings.append({'id': light['id'], 'previous': prior, 'position': light['position']})
write(OUT / 'lighting.json', {'fixtures': lights, 'sourceBindings': fixture_bindings, 'retainedCalibrationManifestSha256': sha(ROOT / 'public/assets/classic-occupations/v2/manifest.json')})
assert sha(source) == identity
write(OUT / 'export-review.json', {'complete': True, 'sourceSha256': identity, 'sourceUnchanged': True,
    'asset': {'path': asset.name, 'sha256': sha(asset), 'bytes': asset.stat().st_size}, 'evaluatedTriangles': triangles,
    'materialMeshes': len(buckets), 'layers': list(roots), 'navigationSha256': sha(OUT / 'navigation-raw.json'),
    'lightingSha256': sha(OUT / 'lighting.json'), 'layoutReviewSha256': sha(BASE / 'layout-01/layout-integrity.json'),
    'exporterSha256': sha(Path(__file__)), 'retainedExporterSha256': sha(ROOT / 'scripts/export-classic-bookshop-v2.py'),
    'scope': 'Uncompressed layout candidate with retained material buckets and cutaway hierarchy. No runtime promotion or browser acceptance.', 'humanApproved': False})
(OUT / 'exporter.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete': True, 'triangles': triangles, 'materialMeshes': len(buckets), 'bytes': asset.stat().st_size}), flush=True)
