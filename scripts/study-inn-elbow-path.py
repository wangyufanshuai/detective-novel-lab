"""Compare elbow bend planes while holding the saved wrist transforms fixed."""
from pathlib import Path
import bpy, hashlib, json, math
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/classic-motion-v2/step-16/cape-12'
SOURCE=P/'resident-08/resident.blend'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];mesh=body.data
rig.animation_data.action=bpy.data.actions['ReconcileRegister'];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
mesh.calc_loop_triangles();labels=mesh.attributes['ArtClothLayer'].data;digits=mesh.attributes['AnatomicalFinger'].data
faces={v:[tuple(t.vertices)for t in mesh.loop_triangles if all(labels[i].value==v for i in t.vertices)]for v in (1,2)}
cape_sets=[set(t)for t in faces[2]]
fingers=[tuple(t.vertices)for t in mesh.loop_triangles if all(digits[i].value!=0 for i in t.vertices)]
desk=bpy.data.objects['registration_desk_top'];e=desk.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles()
desk_tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[tuple(t.vertices)for t in m.loop_triangles],all_triangles=True);e.to_mesh_clear()
triangles=[tuple(t.vertices)for t in mesh.loop_triangles]

def adjust(saved, side, pole, amount=1, wrist_delta=None):
    names=[n+side for n in ('upperarm_','forearm_','hand_')]
    a,b,c=[saved[n].copy()for n in names];s,j,w=a.translation,b.translation,c.translation
    old_w=w.copy()
    if wrist_delta is not None:w=w+wrist_delta;c.translation=w
    line=w-s;d=line.length;direction=line.normalized();upper=(j-s).length;lower=(old_w-j).length
    along=(upper*upper-lower*lower+d*d)/(2*d);center=s+direction*along
    normal=pole-direction*pole.dot(direction)
    old=(j-center).normalized();new=normal.normalized()
    rotation=old.rotation_difference(new)
    bend=Quaternion((1,0,0,0)).slerp(rotation,amount)@old
    elbow=center+bend*math.sqrt(max(0,upper*upper-along*along))
    upper_rotation=(j-s).rotation_difference(elbow-s).to_matrix().to_4x4()
    upper_matrix=upper_rotation@a;upper_matrix.translation=s
    rig.pose.bones[names[0]].matrix=upper_matrix;bpy.context.view_layer.update()
    lower_rotation=(old_w-j).rotation_difference(w-elbow).to_matrix().to_4x4()
    lower_matrix=lower_rotation@b;lower_matrix.translation=elbow
    rig.pose.bones[names[1]].matrix=lower_matrix;bpy.context.view_layer.update()
    rig.pose.bones[names[2]].matrix=c;bpy.context.view_layer.update()
    return {'oldElbow':list(j),'newElbow':list(elbow),'wrist':list(w),
            'wristError':(rig.pose.bones[names[2]].matrix.translation-w).length}

def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)

def influence(t, side):
    if side=='L':t=min(t,10-t)
    amount=smooth((t-.25)/.50)*(1-smooth((t-1.05)/.40))
    if side=='R':amount+=smooth((t-8.75)/.35)*(1-smooth((t-9.45)/.35))
    return amount

rows=[]
for name,shift,pole in [('retained',None,None),('forward-06',(-.06,-.12,.02),(.12,.35,-1)),('forward-09',(-.09,-.12,.03),(.12,.35,-1)),('high-06',(-.06,-.10,.04),(.12,.35,-1)),('backward-elbow',(-.06,-.12,.02),(.12,.8,-1))]:
    values=[]
    for frame in (1,21,31,41,51,81,91,101,111,151,211,251,261,271,273,281,301):
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        saved={b.name:b.matrix.copy()for b in rig.pose.bones};limbs={}
        if pole:
            for side,sign in [('L',-1),('R',1)]:
                amount=influence((frame-1)/30,side)
                if amount>0:limbs[side]=adjust(saved,side,Vector((pole[0]*sign,pole[1],pole[2])),amount,Vector((shift[0]*sign,shift[1],shift[2]))*amount)
        e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices]
        blouse=BVHTree.FromPolygons(points,faces[1],all_triangles=True);cape=BVHTree.FromPolygons(points,faces[2],all_triangles=True)
        values.append({'frame':frame,'blouseCape':len(blouse.overlap(cape)),
            'capeSelf':sum(a<b and not cape_sets[a]&cape_sets[b]for a,b in cape.overlap(cape)),
            'fingersBlouse':len(BVHTree.FromPolygons(points,fingers,all_triangles=True).overlap(blouse)),
            'desk':len(desk_tree.overlap(BVHTree.FromPolygons([e.matrix_world@v for v in points],triangles,all_triangles=True))),
            'limbs':limbs});e.to_mesh_clear()
    maxima={k:max(r[k]for r in values)for k in ('blouseCape','capeSelf','fingersBlouse','desk')}
    rows.append({'name':name,'pole':pole,'shift':shift,'maxima':maxima,'rows':values});print(json.dumps({'name':name,'maxima':maxima}),flush=True)
report={'complete':True,'sourceSha256':sha(SOURCE),'rows':rows,'sourceUnchanged':True,'scope':'In-memory bend-plane study at 17 authored work poses. Wrists stay fixed; no continuous motion, complete hand contact or art approval.'}
(P/'elbow-path-study.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(P/'elbow-path-study.py').write_bytes(Path(__file__).read_bytes())
