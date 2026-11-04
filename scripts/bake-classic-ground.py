"""Bake metre-space support heights from the retained, evaluated Blender room."""
from pathlib import Path
import bpy, hashlib, json, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
NAV=ROOT/'public/assets/classic-bookshop/v2/navigation.json'
OUT=ROOT/'public/assets/classic-motion/v1'
REVIEW=ROOT/'docs/3d-town/classic-motion-v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,value): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
nav=json.loads(NAV.read_text(encoding='utf-8'))
assert nav['sourceSha256']==sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.scene.frame_set(1)
dg=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[];owners=[]
for obj in bpy.context.scene.objects:
    if obj.type not in ('MESH','CURVE','FONT') or obj.get('layer') in ('actor','review_resident'):continue
    e=obj.evaluated_get(dg);mesh=e.to_mesh();mesh.calc_loop_triangles()
    points=[e.matrix_world@v.co for v in mesh.vertices];chosen=[]
    for tri in mesh.loop_triangles:
        a,b,c=[points[i] for i in tri.vertices]
        # Only upward-facing surfaces in the authored floor/kerb height band.
        # This excludes furniture, wall ledges and every roof/ceiling.
        if min(a.z,b.z,c.z)<-.04 or max(a.z,b.z,c.z)>.23:continue
        normal=(b-a).cross(c-a)
        if normal.length<1e-9 or normal.normalized().z<.7:continue
        chosen.append(tuple(tri.vertices))
    if chosen:
        offset=len(vertices);vertices.extend(points)
        faces.extend(tuple(offset+i for i in tri) for tri in chosen)
        owners.append({'name':obj.name,'triangles':len(chosen)})
    e.to_mesh_clear()
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
x0,x1,y0,y1=nav['bounds'];step=.06
width=math.ceil((x1-x0)/step)+1;height=math.ceil((y1-y0)/step)+1
samples=[]
for j in range(height):
    for i in range(width):
        hit=tree.ray_cast(Vector((x0+i*step,y0+j*step,.24)),Vector((0,0,-1)),.30)[0]
        samples.append(None if hit is None else round(hit.z*1000))
data={'schema':'classic-ground.v1','sourceSha256':sha(SOURCE),'assetSha256':nav['assetSha256'],
      'navigationSha256':sha(NAV),'origin':[x0,y0],'step':step,'width':width,'height':height,
      'units':'millimetres','heights':samples,'supportRadius':.085}
target=OUT/'ground.json';write(target,data)
write(REVIEW/'ground-bake.json',{'schema':'classic-ground-bake.v1','sourceSha256':sha(SOURCE),
      'assetSha256':nav['assetSha256'],'navigationSha256':sha(NAV),'scriptSha256':sha(Path(__file__)),
      'groundSha256':sha(target),'samples':len(samples),'missingSamples':samples.count(None),
      'heightRangeMillimetres':[min(v for v in samples if v is not None),max(v for v in samples if v is not None)],
      'surfaceObjects':owners,'scope':'Actual evaluated upward floor faces. Missing support remains missing; no invented flat fallback.',
      'humanApproved':False})
print(json.dumps({'ground':str(target),'sha256':sha(target),'samples':len(samples),'missing':samples.count(None),'objects':len(owners)}),flush=True)
