"""Read-only v7 grip UV coverage diagnosis from saved authoring geometry."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/3d-rooms/candidates/blender-v7/runtime-baked.blend'))
source=bpy.data.objects['magnifier_grip'];deps=bpy.context.evaluated_depsgraph_get()
evaluated=source.evaluated_get(deps);original=evaluated.to_mesh()
tree=KDTree(len(original.vertices))
for v in original.vertices:tree.insert(source.matrix_world@v.co,v.index)
tree.balance()
obj=bpy.data.objects['Baked atlas source'];mesh=obj.data;mesh.calc_loop_triangles()
uv=mesh.uv_layers['RoomAtlasUV'].data
img=bpy.data.images['Room albedo'];w,h=img.size
pixels=np.empty(w*h*4,dtype=np.float32);img.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
rows=[]
for tri in mesh.loop_triangles:
    if mesh.materials[tri.material_index].name!='Oxblood Leather':continue
    if not all(tree.find(obj.matrix_world@mesh.vertices[i].co)[2]<1e-5 for i in tri.vertices):continue
    uvs=np.array([uv[j].uv[:] for j in tri.loops]);pts=uvs*np.array([w,h])
    area=abs(float(np.linalg.det(np.stack([pts[1]-pts[0],pts[2]-pts[0]]))))/2
    center=uvs.mean(axis=0);x,y=(center*np.array([w,h])).astype(int)
    color=pixels[min(h-1,y),min(w-1,x),:3].tolist()
    samples=[]
    for a,b in [(1/3,1/3),(.1,.1),(.8,.1),(.1,.8),(.45,.45),(.45,.1),(.1,.45)]:
        point=(uvs[0]*a+uvs[1]*b+uvs[2]*(1-a-b))*[w,h]
        sx,sy=point.astype(int);samples.append(float(max(pixels[min(h-1,sy),min(w-1,sx),:3])))
    rows.append({'index':tri.index,'areaPixels':area,'uv':uvs.tolist(),'centerRGB':color,'sampleMaxRGB':samples,
                 'material':mesh.materials[tri.material_index].name})
areas=np.array([r['areaPixels'] for r in rows]);dark=[r for r in rows if max(r['centerRGB'])<.001]
report={'schema':'game-room.grip-atlas-diagnostic.v1','source':'read-only saved v7 baked blend',
        'sourceBlendSha256':hashlib.sha256((ROOT/'docs/3d-rooms/candidates/blender-v7/runtime-baked.blend').read_bytes()).hexdigest(),
        'verifierSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'triangles':len(rows),'areaQuantilesPixels':np.quantile(areas,[0,.1,.5,.9,1]).tolist(),
        'trianglesUnderOnePixel':int((areas<1).sum()),'blackCentroids':len(dark),
        'sampleBlackCount':sum(x<.001 for r in rows for x in r['sampleMaxRGB']),
        'totalSamples':len(rows)*7,'blackExamples':dark[:15],'allRows':rows}
out=ROOT/'outputs/blender-v7-grip-uv-diagnostic.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8')
print('GRIP_ATLAS_DIAG='+json.dumps({k:v for k,v in report.items() if k not in ('allRows','blackExamples')}),flush=True)
evaluated.to_mesh_clear()
