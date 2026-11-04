"""Clear the top of the supported pen before entering or leaving the tripod grip."""
from pathlib import Path
import importlib.util,json
import bpy
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-13/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-14';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
rig=bpy.data.objects['rb-lin-ali_rig'];scene=bpy.context.scene;w.hands.bind_action(rig,bpy.data.actions['ReconcileRegister'])
w.inv.RIG=rig;w.inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
axis=Quaternion(w.read(w.PACKAGE/'resident-08/grip-study-05/grip.json')['penQuaternion'])@Vector((0,0,1));saved=[]
for frame in range(1,302):
    scene.frame_set(frame);bpy.context.view_layer.update();saved.append({'basis':{b.name:b.matrix_basis.copy() for b in rig.pose.bones},'matrices':{b.name:b.matrix.copy() for b in rig.pose.bones}})
changed=[];smooth=w.hands.smooth
for frame,record in enumerate(saved,1):
    t=(frame-1)/30
    amount=smooth((t-1.05)/.40)*(1-smooth((t-1.45)/.45)) if t<2 else smooth((t-8.35)/.40)*(1-smooth((t-8.75)/.35))
    if amount<=1e-8:continue
    scene.frame_set(frame)
    for n,m in record['basis'].items():rig.pose.bones[n].matrix_basis=m
    bpy.context.view_layer.update();hand=record['matrices']['hand_R']
    w.aim_arm(rig,record['matrices'],'R',hand.translation+axis*(.075*amount),hand.to_quaternion(),1,Vector((.55,.55,-.85)))
    for n in ('upperarm_R','forearm_R','hand_R'):w.w.keyed(rig.pose.bones[n],frame)
    changed.append({'frame':frame,'axisOffsetMeters':.075*amount})
scene.frame_set(151);source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'changedFrames':changed,'humanArtApproved':False,'worldBound':False,'scope':'Raise the empty right-hand approach above the pen barrel, preserving pen motion, working grip, left arm and gaze.'})
for name,camera,frame in [('working','occupation-production',151),('approach','occupation-side',42),('withdrawal','occupation-side',265)]:
    scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'changedFrames':len(changed)}),flush=True)
