"""Inspect actual v5 atlas triangles and overlap at felt sample points."""
from pathlib import Path
import bpy,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/3d-rooms/candidates/blender-v5/runtime-baked.blend'))
obj=bpy.data.objects['Baked atlas source'];mesh=obj.data;mesh.calc_loop_triangles()
uv=mesh.uv_layers['RoomAtlasUV'].data
coords=[Vector((corner.uv.x,corner.uv.y,0)) for corner in uv]
faces=[tuple(t.loops) for t in mesh.loop_triangles]
tree=BVHTree.FromPolygons(coords,faces,all_triangles=True)
image=bpy.data.images['Room albedo'];width,height=image.size
pixels=list(image.pixels)
report=[]
for i,t in enumerate(mesh.loop_triangles):
    vertices=[mesh.vertices[v].co for v in t.vertices]
    if not all(abs(v.z-.96350002)<.00001 and abs(v.x)<1.011 and .17<v.y<.83 for v in vertices) or t.area<.01:continue
    centroid=sum((coords[j] for j in t.loops),Vector())/3
    hits=tree.find_nearest_range(centroid,.000001)
    ix=max(0,min(width-1,int(centroid.x*width)));iy=max(0,min(height-1,int(centroid.y*height)))
    color=pixels[(iy*width+ix)*4:(iy*width+ix)*4+3]
    report.append({'triangle':i,'vertices':[list(v) for v in vertices],'uv':[list(uv[j].uv) for j in t.loops],
                   'generated':[list(mesh.attributes['bake_generated_coord'].data[v].vector) for v in t.vertices],
                   'overlaps':[{'triangle':h[2],'distance':h[3],'material':mesh.materials[mesh.loop_triangles[h[2]].material_index].name} for h in hits],
                   'albedoAtCentroid':color})
(ROOT/'outputs/blender-v5-uv-diagnostic.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('UV_DIAG='+json.dumps(report))
