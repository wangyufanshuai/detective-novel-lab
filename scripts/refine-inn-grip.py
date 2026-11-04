"""Repair connected blouse weights and fit a reachable, surface-checked thumb."""
from pathlib import Path
import importlib.util,json,math
import bpy
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
w=module('inn_authoring',ROOT/'scripts/build-blender-occupations.py')
d=module('inn_cloth',ROOT/'scripts/inn-cloth-methods.py')
SOURCE=w.PACKAGE/'resident-08/grip-study-04/grip.blend'
OUT=w.PACKAGE/'resident-08/grip-study-05';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];pen=bpy.data.objects['occupation_pen_anchor']
identity=w.hands.mesh_identity(body)
original_component=d.component
def component(body,name):
    match=next(m.name for m in body.data.materials if m.name.split('.')[0]==name)
    return original_component(body,match)
d.component=component
cloth=d.rebind_blouse(body,True)
initial={b.name:b.matrix.copy() for b in rig.pose.bones}
w.inv.RIG=rig;w.inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
for side,sign in [('L',-1),('R',1)]:
    hand=rig.pose.bones['hand_'+side].matrix.copy()
    w.aim_arm(rig,initial,side,hand.translation,hand.to_quaternion(),1,Vector((sign*.55,.05,-.85)))
bpy.context.view_layer.update()
def ccd(names,target):
    for _ in range(26):
        if (rig.pose.bones[names[-1]].tail-target).length<.00012:break
        for name in reversed(names):
            joint=rig.pose.bones[name];origin=joint.head.copy()
            a=rig.pose.bones[names[-1]].tail-origin;b=target-origin
            if min(a.length,b.length)<1e-8:continue
            q=a.rotation_difference(b)
            if q.angle>.25:q=Quaternion(q.axis,.25)
            m=(q.to_matrix()@joint.matrix.to_3x3()).to_4x4();m.translation=origin;joint.matrix=m;bpy.context.view_layer.update()
    return (rig.pose.bones[names[-1]].tail-target).length
pv=[];pf=[]
for o in pen.children_recursive:
    if o.type!='MESH':continue
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();offset=len(pv)
    pv.extend(e.matrix_world@v.co for v in m.vertices);pf.extend(tuple(offset+i for i in t.vertices) for t in m.loop_triangles);e.to_mesh_clear()
pt=BVHTree.FromPolygons(pv,pf,all_triangles=True)
body.data.calc_loop_triangles();labels=body.data.attributes['AnatomicalFinger'].data
ids={f:{v.index for v in body.data.vertices if labels[v.index].value==f} for f in range(1,6)}
faces={f:[tuple(t.vertices) for t in body.data.loop_triangles if all(i in ids[f] for i in t.vertices)] for f in ids}
def contact():
    ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();p=[ev.matrix_world@v.co for v in m.vertices]
    trees={f:BVHTree.FromPolygons(p,faces[f],all_triangles=True) for f in ids}
    rows={str(f):{'pairs':len(trees[f].overlap(pt)),'gap':min(pt.find_nearest(p[i])[3] for i in ids[f])} for f in ids}
    rows['selfPairs']=sum(len(trees[a].overlap(trees[b])) for a in ids for b in ids if a<b)
    ev.to_mesh_clear();return rows
names=[f'finger_R_1_{s}' for s in range(1,4)];starting={n:rig.pose.bones[n].matrix_basis.copy() for n in names}
axis=pen.rotation_quaternion@Vector((0,0,1));across=Vector((1,0,0));across=(across-axis*across.dot(axis)).normalized();around=axis.cross(across).normalized()
trials=[];best=None
for angle in (-60,-30,0,30,60,90,120,150,180):
    for radius in (.014,.019,.024):
        for height in (.035,.050,.065):
            for n,m in starting.items():rig.pose.bones[n].matrix_basis=m
            bpy.context.view_layer.update()
            radial=across*math.cos(math.radians(angle))+around*math.sin(math.radians(angle))
            target=pen.location+axis*height+radial*radius
            error=ccd(names,target);row=contact();gap=row['1']['gap'];pairs=row['1']['pairs']
            angles=[rig.pose.bones[n].rotation_quaternion.angle for n in names]
            score=pairs*10+row['selfPairs']*3+max(0,error-.001)*1000+abs(gap-.0008)*300+sum(max(0,a-1.5) for a in angles)*5
            record={'angle':angle,'radius':radius,'height':height,'error':error,'contacts':row,'jointAngles':angles,'score':score}
            trials.append(record)
            if best is None or score<best[0]:best=(score,{n:rig.pose.bones[n].matrix_basis.copy() for n in names},record)
    print(json.dumps({'searchedAngle':angle,'best':best[2]}),flush=True)
for n,m in best[1].items():rig.pose.bones[n].matrix_basis=m
bpy.context.view_layer.update()
report={'schema':'inn-grip-repair.v1','sourceInput':str(SOURCE.relative_to(ROOT)),'sourceInputSha256':w.sha(SOURCE),
    'inputRestIdentity':identity,'restIdentity':w.hands.mesh_identity(body),'cloth':cloth,
    'selected':best[2],'trials':trials,'contacts':contact(),'penPosition':list(pen.location),'penQuaternion':list(pen.rotation_quaternion),
    'penToHandMatrix':[list(row) for row in pen.matrix_basis.inverted()@rig.pose.bones['hand_R'].matrix],
    'fingerQuaternions':{b.name:list(b.rotation_quaternion) for b in rig.pose.bones if b.name.startswith('finger_R_')},
    'humanArtApproved':False,'accepted':False,'builderSha256':w.sha(Path(__file__))}
assert report['restIdentity']['uvs']==identity['uvs'] and report['restIdentity']['topology']==identity['topology']
report['stretch']=d.retained.stretch(body,cloth['blouseVertices'],[121])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'grip.blend'))
report['sourceSha256']=w.sha(OUT/'grip.blend');(OUT/'builder.py').write_bytes(Path(__file__).read_bytes());w.write(OUT/'grip.json',report)
for name,camera in [('grip','occupation-hands'),('side','occupation-side'),('working','occupation-production')]:
    bpy.context.scene.camera=bpy.data.objects[camera];bpy.context.scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'contacts':report['contacts'],'stretch':report['stretch']}),flush=True)
