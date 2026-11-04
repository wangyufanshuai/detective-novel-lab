"""Export the source-bound, reviewed inn body and synchronized writing props."""
from pathlib import Path
import argparse,importlib.util,json,sys
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
p=argparse.ArgumentParser();p.add_argument('--pilot',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=w.PACKAGE/'resident-08'/args.pilot;source=P/'occupation.blend';identity=w.sha(source)
fn=w.read(P/'function-review.json');form=w.read(P/'form-review.json')
assert fn['passed'] and form['passed'] and fn['sourceSha256']==identity==form['sourceSha256']
assert form['functionReviewSha256']==w.sha(P/'function-review.json') and form['inspectorSha256']==w.sha(ROOT/'scripts/inspect-inn-motion.py')
retained=ROOT/'docs/3d-town/classic-residents-v8/resident-08/rb-lin-ali.blend'
bpy.ops.wm.open_mainfile(filepath=str(retained));body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig']
old_mesh=w.hands.mesh_identity(body);old_bones={b.name:[v for row in b.matrix_local for v in row] for b in rig.data.bones};clips={}
for clip,count in [('Idle',90),('Walk',24)]:
    w.hands.bind_action(rig,bpy.data.actions[clip]);rows=[]
    for frame in range(1,count+2):
        bpy.context.scene.frame_set(frame);rows.append({b.name:[v for row in b.matrix for v in row] for b in rig.pose.bones})
    clips[clip]=rows
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];new_mesh=w.hands.mesh_identity(body)
assert all(old_mesh[k]==new_mesh[k] for k in ('vertices','uvs','topology'))
assert all(old_bones[b.name]==[v for row in b.matrix_local for v in row] for b in rig.data.bones if b.name in old_bones)
assert {b.name for b in rig.data.bones}-old_bones.keys()=={'eye_L','eye_R'}
difference=0
for clip,rows in clips.items():
    w.hands.bind_action(rig,bpy.data.actions[clip])
    for frame,row in enumerate(rows,1):
        bpy.context.scene.frame_set(frame)
        difference=max(difference,max(abs(a-b) for bone in rig.pose.bones if bone.name in row for a,b in zip(row[bone.name],[v for line in bone.matrix for v in line])))
assert difference<1e-6,difference
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len([g for g in v.groups if g.weight>1e-6])<=4 for v in body.data.vertices)
root=bpy.data.objects['occupation_actor'];root.location=(0,0,0)
for action in list(bpy.data.actions):
    if action.name not in ('Idle','Walk','ReconcileRegister'):bpy.data.actions.remove(action)
w.hands.bind_action(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in (root,rig,body):o.select_set(True)
raw=P/'resident-08-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,
    export_anim_slide_to_zero=True,export_skins=True,export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animation_mode='ACTIONS')
# Reopen the untouched source to scope the second export to the prop action.
bpy.ops.wm.open_mainfile(filepath=str(source));root=bpy.data.objects['occupation_actor'];root.location=(0,0,0)
for action in list(bpy.data.actions):
    if action.name!='WriteRegister_Prop':bpy.data.actions.remove(action)
pen=bpy.data.objects['occupation_pen_anchor'];pen.animation_data.action=bpy.data.actions['WriteRegister_Prop'];bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
workplace=bpy.data.objects['occupation_workplace'];bpy.ops.object.select_all(action='DESELECT')
for o in (root,workplace,*workplace.children_recursive):o.select_set(True)
prop=P/'workstation-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(prop),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,
    export_anim_slide_to_zero=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animation_mode='ACTIONS')
points=[]
for o in workplace.children_recursive:
    if o.type!='MESH':continue
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points.extend(e.matrix_world@v.co for v in m.vertices);e.to_mesh_clear()
bounds=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
w.write(P/'raw-export.json',{'sourceSha256':identity,'exporterSha256':w.sha(Path(__file__)),'retainedSourceSha256':w.sha(retained),
    'oldMeshIdentity':old_mesh,'newMeshIdentity':new_mesh,'topologyAndUvRetained':True,'originalRestBonesRetained':True,'maximumRetainedIdleWalkMatrixDifference':difference,
    'resident':{'path':raw.relative_to(ROOT).as_posix(),'sha256':w.sha(raw)},'workstation':{'path':prop.relative_to(ROOT).as_posix(),'sha256':w.sha(prop)},
    'workstationBounds':bounds,'sourceUnchanged':w.sha(source)==identity,'humanArtApproved':False})
print(json.dumps({'exported':True,'workstationBounds':bounds,'sourceUnchanged':w.sha(source)==identity}),flush=True)
