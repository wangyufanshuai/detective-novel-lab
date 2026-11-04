"""Measure actual projecting stonework and foliage for walking clearance."""
from pathlib import Path
import bpy,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1)
dg=bpy.context.evaluated_depsgraph_get();colliders=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH' or not obj.name.startswith(('leaf(', 'entry_pilaster_', 'inn_corner_quoin(', 'downpipe')):continue
 e=obj.evaluated_get(dg);mesh=e.to_mesh();points=[e.matrix_world@v.co for v in mesh.vertices];e.to_mesh_clear()
 if not points or min(p.z for p in points)>2.1:continue
 bounds=[[min(p[i] for p in points),max(p[i] for p in points)]for i in range(3)]
 colliders.append({'id':'projection_'+obj.name,'center':[(a+b)/2 for a,b in bounds[:2]],'size':[max(.02,b-a)for a,b in bounds[:2]],'angle':0})
nav=json.loads((ROOT/'public/assets/classic-bookshop/v2/navigation.json').read_text())
data={'sourceSha256':sha(source),'assetSha256':nav['assetSha256'],'colliders':sorted(colliders,key=lambda c:c['id'])}
out=ROOT/'app/town-play/art-sample/motion-clearance.ts'
out.write_text('// Generated from evaluated Blender meshes by scripts/bake-classic-clearance.py.\nexport const classicMotionClearance = '+json.dumps(data,ensure_ascii=False,indent=2)+' as const;\n',encoding='utf-8')
report={**data,'scriptSha256':sha(Path(__file__)),'outputSha256':sha(out),'scope':'Measured conservative XY extents of projecting doorway stonework, downpipes and foliage. Other furniture remains in the navigation contract.'}
(ROOT/'docs/3d-town/classic-motion-v1/clearance-bake.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'colliders':len(colliders),'outputSha256':sha(out)}),flush=True)
