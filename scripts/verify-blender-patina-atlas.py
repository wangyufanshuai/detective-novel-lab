"""Inspect saved craft geometry and actual atlas triangles independently."""
from pathlib import Path
import bpy,json,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v11'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'runtime-baked.blend'))
mesh=bpy.data.objects['Baked atlas source'].data;mesh.calc_loop_triangles()
uv=mesh.uv_layers['RoomAtlasUV'].data;authored=mesh.attributes['metric_uv_authored'].data
coords=[Vector((*item.uv,0)) for item in uv]
tree=BVHTree.FromPolygons(coords,[tuple(t.loops) for t in mesh.loop_triangles],all_triangles=True)
overlaps=[];collapsed=[];outside=[];samples=0
for tri in mesh.loop_triangles:
    if not authored[tri.polygon_index].value:continue
    samples+=1;a,b,c=[coords[i] for i in tri.loops]
    if (b-a).cross(c-a).length<1e-14:collapsed.append(tri.index)
    if any(v.x<0 or v.x>1 or v.y<0 or v.y>1 for v in [a,b,c]):outside.append(tri.index)
    other=[hit[2] for hit in tree.find_nearest_range((a+b+c)/3,1e-9) if hit[2]!=tri.index]
    if other:overlaps.append({'triangle':tri.index,'overlapping':other})
authoring=json.loads((OUT/'craft-uv-authoring.json').read_text())
source_degenerate=[];deps=bpy.context.evaluated_depsgraph_get()
for record in authoring['objects']:
    obj=bpy.data.objects[record['object']];evaluated=obj.evaluated_get(deps);source=evaluated.to_mesh();source.calc_loop_triangles()
    zero=[t.index for t in source.loop_triangles if t.area<1e-16]
    if zero:source_degenerate.append({'object':obj.name,'triangles':zero})
    evaluated.to_mesh_clear()
report={'schema':'game-room.craft-atlas-audit.v1','sourceBlendSha256':hashlib.sha256((OUT/'runtime-baked.blend').read_bytes()).hexdigest(),
    'verifierSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sampledTriangles':samples,
    'collapsedUVTriangles':collapsed,'outsideAtlasTriangles':outside,'triangleCentroidOverlaps':overlaps,'sourceDegenerateTriangles':source_degenerate,
    'passed':not any([collapsed,outside,overlaps,source_degenerate]),'humanApproval':False,
    'scope':'centroid overlap sampling is not an exhaustive triangle-intersection proof; geometry is checked in object coordinates'}
(OUT/'craft-atlas-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('CRAFT_ATLAS='+json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Craft atlas/geometry verification failed')
