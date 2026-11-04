"""Read the saved cape and its underlying blouse before changing the silhouette."""
from pathlib import Path
import bpy, hashlib, json
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/3d-town/classic-motion-v2/step-15/resident-08/resident.blend'
OUT = ROOT / 'docs/3d-town/classic-motion-v2/step-16'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body = bpy.data.objects['rb-lin-ali_skin']
labels = body.data.attributes['ArtClothLayer'].data
body.data.calc_loop_triangles()
points = body.data.shape_keys.key_blocks[0].data if body.data.shape_keys else body.data.vertices
groups = {name: [i for i in range(len(points)) if labels[i].value == label] for name, label in [('blouse', 1), ('cape', 2)]}
groups['trim'] = sorted({i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0] == 'accent'
                         for i in p.vertices if points[i].co.z > 1.20} - set(groups['cape']))
result = {'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'objects': [o.name for o in bpy.data.objects], 'groups': {}}
for name, ids in groups.items():
    result['groups'][name] = {'vertices': len(ids), 'bounds': [[min(points[i].co[a] for i in ids), max(points[i].co[a] for i in ids)] for a in range(3)],
        'outermost': [{'index': i, 'co': list(points[i].co), 'weights': {body.vertex_groups[g.group].name: g.weight for g in body.data.vertices[i].groups}}
                      for i in sorted(ids, key=lambda i: abs(points[i].co.x), reverse=True)[:12]],
        'zBands': [{'z': z, 'width': max((abs(points[i].co.x) for i in ids if z <= points[i].co.z < z + .05), default=0) * 2}
                   for z in [1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50, 1.55]]}
result['shapeKeys'] = {key.name: max((key.data[i].co - body.data.shape_keys.key_blocks[0].data[i].co).length for i in groups['cape']) for key in body.data.shape_keys.key_blocks}
(OUT / 'baseline-cape-inspection.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: {f: v for f, v in group.items() if f != 'outermost'} for k, group in result['groups'].items()}))
