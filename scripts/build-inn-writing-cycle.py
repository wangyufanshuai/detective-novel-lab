"""Author a supported pen pickup, register-writing and return cycle in Blender."""
from pathlib import Path
import argparse,importlib.util,json,math,sys
import bpy
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='gesture-02');parser.add_argument('--input',default='grip-study-05/grip.blend');parser.add_argument('--no-render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SOURCE=w.PACKAGE/'resident-08'/args.input;GRIP_PATH=w.PACKAGE/'resident-08/grip-study-05/grip.json';GRIP=w.read(GRIP_PATH)
assert w.sha(GRIP_PATH.with_name('grip.blend'))==GRIP['sourceSha256']
OUT=w.PACKAGE/'resident-08'/args.pilot;OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig']
pen=bpy.data.objects['occupation_pen_anchor'];workplace=bpy.data.objects['occupation_workplace']
bpy.context.view_layer.update()
held={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
left_held=rig.pose.bones['hand_L'].matrix.copy();pen_to_hand=Matrix(GRIP['penToHandMatrix'])
grip_quats={n:Quaternion(q) for n,q in GRIP['fingerQuaternions'].items()}
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
retained=ROOT/'docs/3d-town/classic-residents-v8/resident-08/rb-lin-ali.blend'
with bpy.data.libraries.load(str(retained),link=False) as (src,dst):dst.actions=['Idle','Walk']
assert all(dst.actions)
for action in dst.actions:action.use_fake_user=True
w.hands.bind_action(rig,bpy.data.actions['Idle']);scene.frame_set(1);bpy.context.view_layer.update()
basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones};initial={b.name:b.matrix.copy() for b in rig.pose.bones}
w.inv.RIG=rig;w.inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
rotation=Quaternion(GRIP['penQuaternion']);axis=rotation@Vector((0,0,1))
rest=Vector((.280,-.290,1.0775))
write=Vector((.105,-.429,1.10135))
for mat in bpy.data.materials:w.u.MATS[mat.name]=mat
w.u.LAY='occupation_workplace';w.u.PART='authored_workplace'
for o in list(bpy.data.objects):
    if o.name in ('pen_rest_base','occupation_pen_socket','pen_rest_hollow_socket','pen_rest_nib_seat'):bpy.data.objects.remove(o,do_unlink=True)
base=w.parent_local(w.u.cylinder('pen_rest_base',(.280,-.290,1.0765),.029,.008,'occupation_brass',24),workplace)
socket=bpy.data.objects.new('occupation_pen_socket',None);bpy.context.collection.objects.link(socket);w.parent_local(socket,workplace)
socket.location=rest;socket.rotation_mode='QUATERNION';socket.rotation_quaternion=rotation
verts=[];faces=[];count=24
for radius,z in ((.010,.004),(.010,.016),(.007,.004),(.007,.016)):
    verts.extend((radius*math.cos(i*math.tau/count),radius*math.sin(i*math.tau/count),z) for i in range(count))
for i in range(count):
    j=(i+1)%count
    faces.extend([(i,j,count+j,count+i),(2*count+j,2*count+i,3*count+i,3*count+j),(count+i,count+j,3*count+j,3*count+i),(i,2*count+i,2*count+j,j)])
w.parent_local(w.u.mesh('pen_rest_hollow_socket',verts,faces,'occupation_brass',True),socket)
# A shallow angled seat supports the nib; the hollow tube never intersects it.
seat=w.parent_local(w.u.cylinder('pen_rest_nib_seat',(0,0,.0008),.0068,.001,'occupation_pen',24),socket)
body_action=bpy.data.actions.new('ReconcileRegister');body_action.use_fake_user=True;w.hands.bind_action(rig,body_action)
prop_action=bpy.data.actions.new('WriteRegister_Prop');prop_action.use_fake_user=True
pen.animation_data_create();pen.animation_data.action=prop_action
smooth=w.hands.smooth
def mix(a,b,t):return a.lerp(b,smooth(t))
def pen_at(t):
    if t<2:return rest.copy(),'grasp' if t>1.5 else 'approach'
    if t<2.45:return mix(rest,rest+axis*.075,(t-2)/.45),'lift'
    if t<3.10:return mix(rest+axis*.075,write+Vector((0,0,.055)),(t-2.45)/.65),'over-register'
    if t<3.35:return mix(write+Vector((0,0,.055)),write,(t-3.10)/.25),'lower-nib'
    if t<7:
        q=(t-3.35)/3.65*3;line=min(2,int(q));p=q-line
        start=write+Vector((0,line*.027,0));end=start+Vector((.072,0,0))
        if p<.79:
            s=p/.79;stroke=Vector((.072*s,.0015*math.sin(s*math.tau*5),.0005*(1-math.cos(s*math.tau*5))))
            return start+stroke,'write'
        nxt=write+Vector((0,(line+1)*.027,0)) if line<2 else end
        a=(p-.79)/.21
        return mix(end,nxt,a)+Vector((0,0,.014*math.sin(math.pi*a)**2)),'line-lift'
    last=write+Vector((.072,.054,0))
    if t<7.30:return mix(last,last+Vector((0,0,.055)),(t-7)/.30),'lift-from-page'
    if t<7.95:return mix(last+Vector((0,0,.055)),rest+axis*.075,(t-7.30)/.65),'return'
    if t<8.25:return mix(rest+axis*.075,rest,(t-7.95)/.30),'seat-pen'
    return rest.copy(),'release'
def pose_at(t):
    for n,m in basis.items():rig.pose.bones[n].matrix_basis=m
    attention=smooth(t/1.6)*(1-smooth((t-8.45)/1.30))
    for n in ('chest','head'):
        rig.pose.bones[n].rotation_quaternion=basis[n].to_quaternion().slerp(held[n].to_quaternion(),attention)
    bpy.context.view_layer.update()
    p,phase=pen_at(t);pen.location=p;pen.rotation_quaternion=rotation
    target=Matrix.LocRotScale(p,rotation,Vector((1,1,1)))@pen_to_hand
    rest_target=Matrix.LocRotScale(rest,rotation,Vector((1,1,1)))@pen_to_hand
    start=initial['hand_R'].translation;clear=start+Vector((.08,.08,.035));raised=Vector((.38,.045,1.22));hover=rest_target.translation+axis*.075
    if t<.35:right=mix(start,clear,t/.35)
    elif t<1.05:right=mix(clear,raised,(t-.35)/.70)
    elif t<1.45:right=mix(raised,hover,(t-1.05)/.4)
    elif t<1.90:right=mix(hover,rest_target.translation,(t-1.45)/.45)
    elif t<8.35:right=target.translation
    elif t<8.75:right=mix(rest_target.translation,hover,(t-8.35)/.40)
    elif t<9.10:right=mix(hover,raised,(t-8.75)/.35)
    elif t<9.45:right=raised
    elif t<9.8:right=mix(raised,clear,(t-9.45)/.35)
    else:right=mix(clear,start,(t-9.8)/.20)
    right_amount=smooth((t-.67)/.35)*(1-smooth((t-9.10)/.35))
    # Keep the elbow pole away from the shoulder-to-wrist line. A near-parallel
    # pole flips the elbow in front of the hand during the lift.
    w.aim_arm(rig,initial,'R',right,target.to_quaternion(),right_amount,Vector((.55,.55,-.85)))
    # The open hand forms the tripod before descending along the pen axis.
    for n,q in grip_quats.items():rig.pose.bones[n].rotation_quaternion=basis[n].to_quaternion().slerp(q,right_amount)
    left_clock=min(t,10-t)
    start_l=initial['hand_L'].translation;clear_l=start_l+Vector((-.08,.08,.035));lift_l=Vector((-.35,.045,1.22));hover_l=left_held.translation+Vector((0,0,.07))
    if left_clock<.35:left=mix(start_l,clear_l,left_clock/.35)
    elif left_clock<1.05:left=mix(clear_l,lift_l,(left_clock-.35)/.70)
    elif left_clock<1.45:left=mix(lift_l,hover_l,(left_clock-1.05)/.40)
    elif left_clock<1.85:left=mix(hover_l,left_held.translation,(left_clock-1.45)/.40)
    else:left=left_held.translation
    left_amount=smooth((left_clock-.67)/.35)
    w.aim_arm(rig,initial,'L',left,left_held.to_quaternion(),left_amount,Vector((-.55,.55,-.85)))
    for n,m in held.items():
        if n.startswith('finger_L_'):rig.pose.bones[n].rotation_quaternion=basis[n].to_quaternion().slerp(m.to_quaternion(),left_amount)
    if t in (0,10):
        for n,m in basis.items():rig.pose.bones[n].matrix_basis=m
    bpy.context.view_layer.update();return phase
scene.render.fps=30;scene.frame_start=1;scene.frame_end=301
rows=[]
for frame in range(1,302):
    t=(frame-1)/30;scene.frame_set(frame);phase=pose_at(t)
    for b in rig.pose.bones:w.w.keyed(b,frame)
    for key in ('location','rotation_quaternion','scale'):pen.keyframe_insert(data_path=key,frame=frame)
    rows.append({'frame':frame,'time':t,'phase':phase,'pen':list(pen.location)})
    if frame%60==1:print(json.dumps({'frame':frame,'phase':phase}),flush=True)
scene.frame_set(151);bpy.context.view_layer.update();w.u.configure(32,1100)
source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'schema':'inn-writing-cycle.v1','sourceSha256':w.sha(source),'inputSha256':w.sha(SOURCE),
    'gripReviewSha256':w.sha(GRIP_PATH),'builderSha256':w.sha(Path(__file__)),
    'retainedActionSourceSha256':w.sha(retained),'durationSeconds':10,'fps':30,'frames':rows,
    'newGeometry':'Original hollow brass pen socket and nib seat; existing register and desk retained.',
    'humanArtApproved':False,'worldBound':False})
if not args.no_render:
    for name,camera,frame in [('working','occupation-production',151),('hands','occupation-hands',151),('side','occupation-side',151),('rest','occupation-hands',1),('pickup','occupation-hands',56),('return','occupation-hands',245)]:
        scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'saved':str(source),'sha256':w.sha(source)}),flush=True)
