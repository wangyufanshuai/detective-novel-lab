"""Bounded wrist-height fitting for the approach and withdrawal, retaining gaze."""
from pathlib import Path
import importlib.util,json,math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-11/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-13';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];scene=bpy.context.scene
w.hands.bind_action(rig,bpy.data.actions['ReconcileRegister'])
w.inv.RIG=rig;w.inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
saved=[]
for frame in range(1,302):
    scene.frame_set(frame);bpy.context.view_layer.update();saved.append({'basis':{b.name:b.matrix_basis.copy() for b in rig.pose.bones},'matrices':{b.name:b.matrix.copy() for b in rig.pose.bones}})
body.data.calc_loop_triangles();labels=body.data.attributes['ArtClothLayer'].data;digits=body.data.attributes['AnatomicalFinger'].data
faces={label:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==label for i in t.vertices)] for label in (1,2)}
finger_faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(digits[i].value!=0 for i in t.vertices)]
edges=[(a,b,(body.data.vertices[a].co-body.data.vertices[b].co).length) for edge in body.data.edges for a,b in [tuple(edge.vertices)] if labels[a].value==labels[b].value==1 and (body.data.vertices[a].co-body.data.vertices[b].co).length>1e-5]
smooth=w.hands.smooth
def apply(frame,shift):
    scene.frame_set(frame);record=saved[frame-1]
    for n,m in record['basis'].items():rig.pose.bones[n].matrix_basis=m
    bpy.context.view_layer.update();t=(frame-1)/30
    for side,sign in [('L',-1),('R',1)]:
        clock=min(t,10-t) if side=='L' else t
        amount=smooth((clock-.45)/.50)*(1-smooth((clock-1.05)/.45))
        if side=='R':amount+=smooth((t-8.8)/.35)*(1-smooth((t-9.45)/.35))
        if amount>1e-6:
            hand=record['matrices']['hand_'+side];target=hand.translation+Vector((0,0,-shift*amount))
            w.aim_arm(rig,record['matrices'],side,target,hand.to_quaternion(),1,Vector((sign*.55,.55,-.85)))
    bpy.context.view_layer.update()
def measure():
    e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();v=[p.co.copy() for p in m.vertices]
    a=BVHTree.FromPolygons(v,faces[1],all_triangles=True);b=BVHTree.FromPolygons(v,faces[2],all_triangles=True);f=BVHTree.FromPolygons(v,finger_faces,all_triangles=True)
    row={'capeBlousePairs':len(a.overlap(b)),'fingerBlousePairs':len(f.overlap(a)),'stretch':max((m.vertices[a].co-m.vertices[b].co).length/l for a,b,l in edges)}
    e.to_mesh_clear();return row
trials=[]
for shift in (.048,.060):
    rows=[]
    for frame in (24,27,31,34,36,39,41,44,266,269,271,274,276,279,281,284):
        apply(frame,shift);row=measure();rows.append({'frame':frame,**row})
    maxima={k:max(r[k] for r in rows) for k in ('capeBlousePairs','fingerBlousePairs','stretch')}
    score=maxima['capeBlousePairs']*10+maxima['fingerBlousePairs']*1000+max(0,maxima['stretch']-1.99)*100+shift
    trials.append({'shift':shift,'maxima':maxima,'score':score,'rows':rows});print(json.dumps(trials[-1]['maxima']|{'shift':shift}),flush=True)
best=min(trials,key=lambda r:r['score'])
for frame in range(1,302):
    apply(frame,best['shift'])
    for side in ('L','R'):
        for n in ('upperarm_','forearm_','hand_'):w.w.keyed(rig.pose.bones[n+side],frame)
scene.frame_set(151);source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'heightFit':{'selected':best,'trials':trials},'humanArtApproved':False,'worldBound':False,'scope':'Lower the approach and withdrawal wrists by at most 60 mm; preserve working grip, pen motion, retained legs and register gaze.'})
for name,camera,frame in [('working','occupation-production',151),('side','occupation-side',151),('approach','occupation-side',31),('withdrawal','occupation-side',276)]:
    scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'selectedShift':best['shift']}),flush=True)
