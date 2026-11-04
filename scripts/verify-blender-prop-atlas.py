"""Independently inspect saved atlas chart connectivity and macro overlaps."""
from pathlib import Path
import bpy,json,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v8'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'runtime-baked.blend'))
mesh=bpy.data.objects['Baked atlas source'].data;mesh.calc_loop_triangles()
uv=mesh.uv_layers['RoomAtlasUV'].data;authored=mesh.attributes['metric_uv_authored'].data
coords=[Vector((item.uv.x,item.uv.y,0)) for item in uv]
faces=[tuple(tri.loops) for tri in mesh.loop_triangles]
tree=BVHTree.FromPolygons(coords,faces,all_triangles=True)
parents={};edges={};materials={};overlaps=[]
def find(i):
    while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
    return i
for tri in mesh.loop_triangles:
    if not authored[tri.polygon_index].value:continue
    parents[tri.index]=tri.index
    name=mesh.materials[tri.material_index].name;materials.setdefault(name,[]).append(tri.index)
    keys=[(vertex,round(uv[loop].uv.x,7),round(uv[loop].uv.y,7)) for vertex,loop in zip(tri.vertices,tri.loops)]
    for i in range(3):
        key=tuple(sorted((keys[i],keys[(i+1)%3])))
        if key in edges:parents[find(tri.index)]=find(edges[key])
        else:edges[key]=tri.index
    centroid=sum((coords[i] for i in tri.loops),Vector())/3
    other=[hit[2] for hit in tree.find_nearest_range(centroid,1e-9) if hit[2]!=tri.index]
    if other:overlaps.append({'triangle':tri.index,'overlappingTriangles':other})
charts={name:len({find(index) for index in indices}) for name,indices in materials.items()}
expected={'Oxblood Leather':3,'Optics Satin Brass':1,'Optics Polished Edge':7}
report={'schema':'game-room.prop-atlas-topology.v1','sourceBlendSha256':hashlib.sha256((OUT/'runtime-baked.blend').read_bytes()).hexdigest(),
        'verifierSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'chartsByMaterial':charts,
        'expectedChartsByMaterial':expected,'triangleCentroidOverlaps':overlaps,'sampledTriangles':len(parents),
        'passed':charts==expected and not overlaps,'humanApproval':False,
        'scope':'Saved Blender UV charts; centroid overlap sampling is not an exhaustive triangle-intersection proof.'}
(OUT/'prop-atlas-topology.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('PROP_UV_TOPOLOGY='+json.dumps(report),flush=True)
if not report['passed']:raise RuntimeError('Saved prop UV topology did not match the authored charts')
