"""Transfer the blouse's rest-shape repair to its original overlying cape."""
from pathlib import Path
import importlib.util,json
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
ORIGINAL=w.PACKAGE/'resident-08/grip-study-04/grip.blend';SOURCE=w.PACKAGE/'resident-08/gesture-03/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-04';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ORIGINAL));old_body=bpy.data.objects['rb-lin-ali_skin'];old_points=[v.co.copy() for v in old_body.data.vertices]
labels=old_body.data.attributes['ArtClothLayer'].data;shirt={i for i in range(len(old_points)) if labels[i].value==1}
old_body.data.calc_loop_triangles();faces=[tuple(t.vertices) for t in old_body.data.loop_triangles if all(i in shirt for i in t.vertices)]
tree=BVHTree.FromPolygons(old_points,faces,all_triangles=True);kd=KDTree(len(shirt))
for i in shirt:kd.insert(old_points[i],i)
kd.balance()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];scene=bpy.context.scene;labels=body.data.attributes['ArtClothLayer'].data
cape={v.index for v in body.data.vertices if labels[v.index].value==2}
trim={i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0]=='accent' for i in p.vertices if body.data.vertices[i].co.z>1.28}
changed=[]
for i in cape|trim:
    near=kd.find_n(old_points[i],8);den=sum(1/max(d,.003)**2 for _,_,d in near);delta=Vector();weights={}
    for _,j,d in near:
        amount=(1/max(d,.003)**2)/den;delta+=(body.data.vertices[j].co-old_points[j])*amount
        for g in body.data.vertices[j].groups:
            n=body.vertex_groups[g.group].name;weights[n]=weights.get(n,0)+g.weight*amount
    _,normal,_,_=tree.find_nearest(old_points[i])
    body.data.vertices[i].co=old_points[i]+delta+normal*.006
    weights=dict(sorted(weights.items(),key=lambda row:row[1],reverse=True)[:4]);total=sum(weights.values())
    for g in list(body.data.vertices[i].groups):body.vertex_groups[g.group].remove([i])
    for n,v in weights.items():body.vertex_groups[n].add([i],v/total,'REPLACE')
    changed.append({'vertex':i,'distance':(body.data.vertices[i].co-old_points[i]).length})
body.data.update();scene.frame_set(151);bpy.context.view_layer.update()
source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'originalShapeSha256':w.sha(ORIGINAL),
    'builderSha256':w.sha(Path(__file__)),'changedCapeVertices':len(changed),'maximumCapeRestAdjustmentMeters':max(r['distance'] for r in changed),
    'humanArtApproved':False,'worldBound':False,'method':'Interpolate the underlying original-to-repaired blouse displacement and new skin weights; retain cape topology, UV and folds with a 6 mm outward ease.'})
for name,camera,frame in [('working','occupation-production',151),('hands','occupation-hands',151),('side','occupation-side',151),('pickup','occupation-side',56),('rest','occupation-production',1)]:
    scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'changedVertices':len(changed)}),flush=True)
