"""Lower the inn work elbows, then fit a coherent double-sided cape pattern."""
from pathlib import Path
import argparse, bpy, hashlib, json, math, sys
import numpy as np
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--trial',default='cape-13');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
SOURCE=BASE/'step-16/cape-12/resident-08/resident.blend';OUT=BASE/'step-16'/args.trial/'resident-08'
OUT.mkdir(parents=True,exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
identity=sha(SOURCE);bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];root=bpy.data.objects['movement_actor'];mesh=body.data;scene=bpy.context.scene
action=bpy.data.actions['ReconcileRegister'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
root.animation_data_clear();root.location=(0,0,0);root.rotation_euler=(0,0,0)
limb_names=[n+s for s in ('L','R')for n in ('upperarm_','forearm_','hand_')]

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)

def influence(t,side):
    if side=='L':t=min(t,10-t)
    value=smooth((t-.25)/.5)*(1-smooth((t-1.05)/.4))
    if side=='R':value+=smooth((t-8.75)/.35)*(1-smooth((t-9.45)/.35))
    return value

def horizontal_influence(t,side):
    clock=min(t,10-t)if side=='L'else t
    value=smooth((clock-.75)/.25)*(1-smooth((clock-1.05)/.4))
    if side=='R':value+=smooth((t-8.75)/.35)*(1-smooth((t-9.45)/.10))
    return value

saved=[]
for n in range(1201):
    frame=1+n*.25;scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
    saved.append({'frame':frame,'basis':{name:rig.pose.bones[name].matrix_basis.copy()for name in limb_names},
        'world':{name:rig.pose.bones[name].matrix.copy()for name in limb_names}})
# Only six arm channels are replaced. All other curves and actions remain exact.
for layer in action.layers:
    for strip in layer.strips:
        for slot in action.slots:
            bag=strip.channelbag(slot)
            if not bag:continue
            for curve in list(bag.fcurves):
                if any(curve.data_path.startswith('pose.bones["'+name+'"].')for name in limb_names):bag.fcurves.remove(curve)

previous={};motion_rows=[]
for sample in saved:
    frame=sample['frame'];t=(frame-1)/30;scene.frame_set(int(frame),subframe=frame%1)
    for name,value in sample['basis'].items():rig.pose.bones[name].matrix_basis=value
    bpy.context.view_layer.update();errors=[];shifts=[];joint_errors=[]
    for side,sign in [('L',-1),('R',1)]:
        amount=influence(t,side)
        if amount<=0:continue
        names=[n+side for n in ('upperarm_','forearm_','hand_')]
        a,b,c=[sample['world'][n].copy()for n in names];s,j,old_w=a.translation,b.translation,c.translation
        horizontal=horizontal_influence(t,side)
        shift=Vector((-.06*sign*horizontal,-.12*horizontal,.02*amount));w=old_w+shift
        line=w-s;d=line.length;direction=line.normalized();upper=(j-s).length;lower=(old_w-j).length
        assert abs(upper-lower)<d<upper+lower
        along=(upper*upper-lower*lower+d*d)/(2*d);center=s+direction*along
        old_offset=j-center;old=(old_offset-direction*old_offset.dot(direction)).normalized()
        pole=Vector((.12*sign,.35,-1));new=(pole-direction*pole.dot(direction)).normalized()
        bend=Quaternion((1,0,0,0)).slerp(old.rotation_difference(new),amount)@old
        elbow=center+bend*math.sqrt(max(0,upper*upper-along*along))
        upper_matrix=(j-s).rotation_difference(elbow-s).to_matrix().to_4x4()@a;upper_matrix.translation=s
        rig.pose.bones[names[0]].matrix=upper_matrix;bpy.context.view_layer.update()
        fore_matrix=(old_w-j).rotation_difference(w-elbow).to_matrix().to_4x4()@b;fore_matrix.translation=elbow
        rig.pose.bones[names[1]].matrix=fore_matrix;bpy.context.view_layer.update()
        c.translation=w;rig.pose.bones[names[2]].matrix=c;bpy.context.view_layer.update()
        errors.append((rig.pose.bones[names[2]].matrix.translation-w).length);shifts.append(shift.length)
        joint_errors.extend([(rig.pose.bones[names[0]].tail-rig.pose.bones[names[1]].head).length,
            (rig.pose.bones[names[1]].tail-rig.pose.bones[names[2]].head).length])
    for name in limb_names:
        bone=rig.pose.bones[name];assert bone.rotation_mode=='QUATERNION'
        q=bone.rotation_quaternion.copy()
        if name in previous:q.make_compatible(previous[name])
        bone.rotation_quaternion=q;previous[name]=q.copy()
        for prop in ('location','rotation_quaternion','scale'):bone.keyframe_insert(data_path=prop,frame=frame)
    motion_rows.append({'frame':frame,'maximumWristShiftMeters':max(shifts,default=0),'solveErrorMeters':max(errors,default=0),'maximumJointGapMeters':max(joint_errors,default=0)})
for layer in action.layers:
    for strip in layer.strips:
        for slot in action.slots:
            bag=strip.channelbag(slot)
            if bag:
                for curve in bag.fcurves:
                    if any(curve.data_path.startswith('pose.bones["'+name+'"].')for name in limb_names):
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
assert max(r['solveErrorMeters']for r in motion_rows)<1e-5
assert max(r['maximumJointGapMeters']for r in motion_rows)<1e-5
print(json.dumps({'motionBaked':True,'samples':len(motion_rows),'wristSolveError':max(r['solveErrorMeters']for r in motion_rows)}),flush=True)

old_report=json.loads((SOURCE.parent/'cape-sculpt.json').read_text());patches=old_report['patches'];ids=sorted(r['index']for r in patches)
keys=mesh.shape_keys.key_blocks;coords={i:keys[0].data[i].co.copy()for i in ids};labels=mesh.attributes['ArtClothLayer'].data
cape=sorted(i for i in ids if labels[i].value==2);outer=cape[:len(cape)//2];inner=cape[len(cape)//2:];outer_set=set(outer);pair=dict(zip(outer,inner))
uv={}
for poly in mesh.polygons:
    if set(poly.vertices)<=outer_set:
        for loop in poly.loop_indices:uv[mesh.loops[loop].vertex_index]=mesh.uv_layers.active.data[loop].uv.copy()
fields={}
for i in outer:
    u,t=uv[i].x/3.5,uv[i].y/2.3;angle=.105+(math.tau-.21)*u;amount=smooth((t-.10)/.45)
    fields[i]=Vector((math.sin(angle)*amount,-math.cos(angle)*amount,amount));fields[pair[i]]=fields[i]
# The trim has already been reconstructed along the sheet. Attach its small
# cross sections to the closest exterior pattern vertex before moving them.
from mathutils.kdtree import KDTree
kd=KDTree(len(outer))
for i in outer:kd.insert(coords[i],i)
kd.balance()
for i in set(ids)-set(cape):fields[i]=fields[kd.find(coords[i])[1]]
mesh.calc_loop_triangles();faces={v:[tuple(t.vertices)for t in mesh.loop_triangles if all(labels[i].value==v for i in t.vertices)]for v in (1,2)}
cape_sets=[set(f)for f in faces[2]]
poses=[('Idle',1),('Walk',1),('Walk',13)]+[('ReconcileRegister',f)for f in sorted(set(range(1,302,2))|{300})]
cache=[]
for clip,frame in poses:
    rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
    scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    points=[v.co.copy()for v in m.vertices];e.to_mesh_clear()
    body_to_rig=rig.matrix_world.inverted()@body.matrix_world;rig_to_body=body_to_rig.inverted()
    matrices={g.name:(rig_to_body@rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted()@body_to_rig)for g in body.vertex_groups if g.name in rig.pose.bones}
    jacobians={};maximum_error=0
    for i in cape:
        transform=np.zeros((4,4))
        for g in mesh.vertices[i].groups:transform+=np.array(matrices[body.vertex_groups[g.group].name])*g.weight
        expected=transform@np.array([*coords[i],1]);maximum_error=max(maximum_error,(Vector(expected[:3])-points[i]).length)
        jacobians[i]=transform[:3,:3]
    assert maximum_error<2e-6,maximum_error
    cache.append({'clip':clip,'frame':frame,'points':points,'jacobians':jacobians,'blouse':BVHTree.FromPolygons(points,faces[1],all_triangles=True)})

def measure(offset):
    deltas={i:np.array([fields[i][a]*offset[a]for a in range(3)])for i in cape};rows=[]
    for sample in cache:
        points=list(sample['points'])
        for i in cape:points[i]=points[i]+Vector(sample['jacobians'][i]@deltas[i])
        tree=BVHTree.FromPolygons(points,faces[2],all_triangles=True)
        self_hits=sum(a<b and not cape_sets[a]&cape_sets[b]for a,b in tree.overlap(tree))
        contacts=len(tree.overlap(sample['blouse']))
        rows.append({'clip':sample['clip'],'frame':sample['frame'],'blouseCape':contacts,'capeSelf':self_hits})
    return rows

trials=[];best=None
grid=[(x,y,z)for x in (0,.008,.016)for y in (0,.012,.024)for z in (0,.010,.020,.030)]
grid.sort(key=lambda q:sum(v*v for v in q))
for offset in grid:
    rows=measure(offset);contact=sum(r['blouseCape']for r in rows);self_contact=sum(r['capeSelf']for r in rows)
    score=(self_contact>0,contact,sum(x*x for x in offset));result={'offsetMeters':offset,'blouseCapePairs':contact,'selfPairs':self_contact,'rows':rows}
    trials.append(result)
    if best is None or score<best[0]:best=(score,result)
    print(json.dumps({k:v for k,v in result.items()if k!='rows'}),flush=True)
    if not contact and not self_contact:break
offset=best[1]['offsetMeters']
for patch in patches:
    i=patch['index'];q=coords[i]+Vector(tuple(fields[i][a]*offset[a]for a in range(3)))
    for key in keys:key.data[i].co=q
    mesh.vertices[i].co=q;patch['after']=list(q);patch['displacementMeters']=(q-Vector(patch['before'])).length
mesh.shape_keys.update_tag();mesh.update();body.update_tag()
rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1);bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version=0;destination=OUT/'resident.blend';bpy.ops.wm.save_as_mainfile(filepath=str(destination),compress=True)
assert sha(SOURCE)==identity
report={**old_report,'sourceSha256':sha(destination),'parentSourceSha256':identity,'patches':patches,
    'widthAfter':max(mesh.vertices[i].co.x for i in ids)-min(mesh.vertices[i].co.x for i in ids),
    'maximumDisplacementMeters':max(r['displacementMeters']for r in patches),'fitTrials':trials,'selectedFit':best[1],
    'constructionContactsCleared':best[1]['blouseCapePairs']==best[1]['selfPairs']==0,
    'functionPassed':False,'formPassed':False,'humanApproved':False,
    'method':'Continuous cape-12 shell, paired lining and hem follow a smooth UV shoulder allowance. Work approach/release uses lower elbows and a forward wrist clearance path, while grip/writing wrist transforms stay unchanged.'}
(OUT/'cape-sculpt.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
motion={'complete':True,'sourceSha256':sha(destination),'parentSourceSha256':identity,'allowedAction':'ReconcileRegister','allowedBones':limb_names,
    'sampleRateHz':120,'horizontalPath':'lift-first-v1','rows':motion_rows,'humanApproved':False,
    'scope':'Only arm curves of work action may change. Both wrists move only during pre-grasp/release windows defined by influence(); pen and page contact phases and every other bone/action must be independently rechecked.'}
(OUT/'motion-edit.json').write_text(json.dumps(motion,indent=2)+'\n',encoding='utf-8')
meta=json.loads((SOURCE.parent/'authoring-review.json').read_text());meta.update(sourceSha256=sha(destination),parentSourceSha256=identity,capeTrial=args.trial,builderSha256=sha(Path(__file__)),humanArtApproved=False)
(OUT/'authoring-review.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'sourceSha256':sha(destination),'constructionContactsCleared':report['constructionContactsCleared'],'fit':{k:v for k,v in best[1].items()if k!='rows'}}),flush=True)
