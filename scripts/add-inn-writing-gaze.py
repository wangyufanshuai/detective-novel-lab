"""Add bounded head and eye attention to the physical register."""
from pathlib import Path
import argparse,importlib.util,json,math,sys
import bpy
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
w=module('occupation',ROOT/'scripts/build-blender-occupations.py');d=module('cloth_components',ROOT/'scripts/build-restorer-deformation.py')
p=argparse.ArgumentParser();p.add_argument('--input',default='gesture-10');p.add_argument('--pilot',default='gesture-11');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SOURCE=w.PACKAGE/'resident-08'/args.input/'occupation.blend';OUT=w.PACKAGE/'resident-08'/args.pilot;OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];scene=bpy.context.scene
eyes,_=d.component(body,next(m.name for m in body.data.materials if m.name.split('.')[0]=='eye_detail'))
assert len(eyes)==2 and all(len(ids)==181 for ids in eyes)
centers={};indices={}
for ids in eyes:
    points=[body.data.vertices[i].co for i in ids];c=Vector([(min(p[a] for p in points)+max(p[a] for p in points))/2 for a in range(3)]);side='L' if c.x<0 else 'R';centers[side]=c;indices[side]=ids
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for side,c in centers.items():
    bone=rig.data.edit_bones.new('eye_'+side);bone.head=c;bone.tail=c+Vector((0,-.014,0));bone.parent=rig.data.edit_bones['head']
bpy.ops.object.mode_set(mode='OBJECT')
for side,ids in indices.items():
    group=body.vertex_groups.new(name='eye_'+side)
    for i in ids:
        for g in list(body.data.vertices[i].groups):body.vertex_groups[g.group].remove([i])
    group.add(ids,1,'REPLACE')
target=Vector((.01,-.42,1.103));rows=[]
for clip,count in [('Idle',90),('Walk',24),('ReconcileRegister',300)]:
    w.hands.bind_action(rig,bpy.data.actions[clip]);baseline=[]
    for frame in range(1,count+2):scene.frame_set(frame);baseline.append(rig.pose.bones['head'].rotation_quaternion.copy())
    for frame,base in enumerate(baseline,1):
        scene.frame_set(frame);t=(frame-1)/30;attention=w.hands.smooth((t-.30)/.90)*(1-w.hands.smooth((t-8.65)/.90)) if clip=='ReconcileRegister' else 0
        head=rig.pose.bones['head'];head.rotation_quaternion=base;bpy.context.view_layer.update();center=(centers['L']+centers['R'])/2;extra=0
        for _ in range(4):
            deformation=head.matrix@rig.data.bones['head'].matrix_local.inverted();direction=deformation.to_3x3().inverted()@(target-deformation@center).normalized()
            residual=math.atan2(-direction.z,math.hypot(direction.x,direction.y));extra=max(0,min(.50,extra+residual-.37)) if attention else 0
            head.rotation_quaternion=base@Quaternion((1,0,0),extra);bpy.context.view_layer.update()
        head.rotation_quaternion=base@Quaternion((1,0,0),extra*attention);head.keyframe_insert(data_path='rotation_quaternion',frame=frame);bpy.context.view_layer.update()
        row={'clip':clip,'frame':frame,'attention':attention,'extraHeadPitchRadians':extra*attention,'eyes':{}}
        for side,center in centers.items():
            bone=rig.pose.bones['eye_'+side];bone.rotation_mode='QUATERNION';deformation=head.matrix@rig.data.bones['head'].matrix_local.inverted();eye_center=deformation@center
            direction=deformation.to_3x3().inverted()@(target-eye_center).normalized();yaw=max(-.20,min(.20,math.atan2(direction.x,-direction.y)));pitch=max(-.12,min(.45,math.atan2(-direction.z,math.hypot(direction.x,direction.y))))
            desired=Quaternion((0,0,1),yaw*attention)@Quaternion((1,0,0),pitch*attention);rest=rig.data.bones[bone.name].matrix_local.to_3x3();bone.rotation_quaternion=(rest.inverted()@desired.to_matrix()@rest).to_quaternion();bone.keyframe_insert(data_path='rotation_quaternion',frame=frame);bpy.context.view_layer.update()
            aim=bone.matrix.to_3x3()@(rest.inverted()@Vector((0,-1,0)));row['eyes'][side]={'targetAngleDegrees':math.degrees(aim.angle(target-eye_center)) if attention>.99 else None,'pitchRadians':pitch*attention,'yawRadians':yaw*attention}
        rows.append(row)
    print(json.dumps({'clip':clip,'frames':count+1}),flush=True)
w.hands.bind_action(rig,bpy.data.actions['ReconcileRegister']);scene.frame_set(151);source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'schema':'inn-writing-gaze.v1','sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'gazeFrames':rows,'eyeIndices':indices,'target':list(target),'headPitchLimitRadians':.50,'eyePitchLimitRadians':.45,'eyeYawLimitRadians':.20,
    'humanArtApproved':False,'worldBound':False,'scope':'Authored register attention during work; no blinking, facial expressions or independent Agent decisions.'})
for name,camera in [('working','occupation-production'),('side','occupation-side'),('hands','occupation-hands')]:
    scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'complete':True}),flush=True)
