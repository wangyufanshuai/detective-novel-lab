"""Shorten the capelet at the arms while preserving its longer front and back."""
from pathlib import Path
import importlib.util,json
import bpy
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-08/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-09';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];labels=body.data.attributes['ArtClothLayer'].data
cape={v.index for v in body.data.vertices if labels[v.index].value==2}
trim={i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0]=='accent' for i in p.vertices if body.data.vertices[i].co.z>1.28}
shirt={v.index for v in body.data.vertices if labels[v.index].value==1}
body.data.calc_loop_triangles();faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in shirt for i in t.vertices)]
tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],faces,all_triangles=True);kd=KDTree(len(shirt))
for i in shirt:kd.insert(body.data.vertices[i].co,i)
kd.balance();identity=w.hands.mesh_identity(body);changes=[]
for i in cape|trim:
    v=body.data.vertices[i];original=v.co.copy()
    amount=w.hands.smooth((abs(v.co.x)-.135)/.11)*(1-w.hands.smooth((v.co.z-1.30)/.15))
    v.co.z+=.105*amount
    _,normal,_,_=tree.find_nearest(v.co);v.co+=normal*(.006*w.hands.smooth((abs(v.co.x)-.12)/.10))
    near=kd.find_n(v.co,6);den=sum(1/max(d,.001)**2 for _,_,d in near);weights={}
    for _,j,d in near:
        a=1/max(d,.001)**2/den
        for g in body.data.vertices[j].groups:
            n=body.vertex_groups[g.group].name;weights[n]=weights.get(n,0)+g.weight*a
    weights=dict(sorted(weights.items(),key=lambda r:r[1],reverse=True)[:4]);total=sum(weights.values())
    for g in list(v.groups):body.vertex_groups[g.group].remove([i])
    for n,value in weights.items():body.vertex_groups[n].add([i],value/total,'REPLACE')
    changes.append((v.co-original).length)
body.data.update();bpy.context.scene.frame_set(151);bpy.context.view_layer.update()
source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'restMeshBefore':identity,'restMeshAfter':w.hands.mesh_identity(body),'maximumTailoringMeters':max(changes),'capeVertices':len(cape|trim),
    'humanArtApproved':False,'worldBound':False,'method':'Side capelet shortened for arm mobility; front/back length retained; new shoulder binding follows the repaired blouse.'})
for name,camera,frame in [('working','occupation-production',151),('side','occupation-side',151),('approach','occupation-side',36),('rest','occupation-production',1)]:
    bpy.context.scene.frame_set(frame);bpy.context.scene.camera=bpy.data.objects[camera];bpy.context.scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'complete':True}),flush=True)
