"""Match cape binding to the repaired blouse and fit continuous linen cuffs."""
from pathlib import Path
import importlib.util,json,math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-02/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-03';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];scene=bpy.context.scene
labels=body.data.attributes['ArtClothLayer'].data;body.data.calc_loop_triangles()
shirt={v.index for v in body.data.vertices if labels[v.index].value==1}
cape={v.index for v in body.data.vertices if labels[v.index].value==2}
trim={i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0]=='accent' for i in p.vertices if body.data.vertices[i].co.z>1.28}
kd=KDTree(len(shirt))
for i in shirt:kd.insert(body.data.vertices[i].co,i)
kd.balance();before=w.hands.mesh_identity(body)
old={i:{body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[i].groups} for i in cape|trim}
for i in cape|trim:
    vertex=body.data.vertices[i];near=kd.find_n(vertex.co,6);den=sum(1/max(distance,.001)**2 for _,_,distance in near);weights={}
    for _,j,distance in near:
        amount=(1/max(distance,.001)**2)/den
        for g in body.data.vertices[j].groups:
            name=body.vertex_groups[g.group].name;weights[name]=weights.get(name,0)+g.weight*amount
    weights=dict(sorted(weights.items(),key=lambda row:row[1],reverse=True)[:4]);total=sum(weights.values())
    for g in list(vertex.groups):body.vertex_groups[g.group].remove([i])
    for n,v in weights.items():body.vertex_groups[n].add([i],v/total,'REPLACE')
# Rebuild only the existing cuff coordinates. Its lower ring envelopes the
# actual wrist; the upper ring overlaps the sleeve smoothly by a few mm.
cuff={i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0]=='shirt' for i in p.vertices if body.data.vertices[i].co.z<1.05}
for i in cuff:
    v=body.data.vertices[i];sign=1 if v.co.x>0 else -1;side='R' if sign>0 else 'L'
    angle=math.atan2((v.co.x-sign*.278)/.036,-(v.co.y+.025)/.038)
    t=max(0,min(1,(v.co.z-.943)/.024))
    v.co=Vector((sign*.278+(.037+t*.001)*math.sin(angle),-.025-(.039+t*.001)*math.cos(angle),.942+t*.027))
    for g in list(v.groups):body.vertex_groups[g.group].remove([i])
    body.vertex_groups['forearm_'+side].add([i],1,'REPLACE')
body.data.update()
faces={label:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==label for i in t.vertices)] for label in (1,2)}
def measure(frames):
    rows=[]
    for f in frames:
        scene.frame_set(f);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();p=[v.co.copy() for v in m.vertices]
        a=BVHTree.FromPolygons(p,faces[1],all_triangles=True);b=BVHTree.FromPolygons(p,faces[2],all_triangles=True)
        rows.append({'frame':f,'capeBlousePairs':len(a.overlap(b))});e.to_mesh_clear()
    return rows
rows=measure(range(1,302,10));scene.frame_set(151)
source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'restIdentityBefore':before,'restIdentityAfter':w.hands.mesh_identity(body),'capeVertices':len(cape),'capeTrimVertices':len(trim),'cuffVertices':len(cuff),
    'capeBlouseSamples':rows,'humanArtApproved':False,'worldBound':False})
for name,camera,frame in [('working','occupation-production',151),('hands','occupation-hands',151),('side','occupation-side',151),('pickup','occupation-side',56),('rest','occupation-production',1)]:
    scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'capeBlouseMaximumPairs':max(r['capeBlousePairs'] for r in rows)}),flush=True)
