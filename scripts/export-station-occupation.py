"""Export only the measured station candidate, preserving the retained sources."""
from pathlib import Path
import importlib.util,json,re
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupations',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
P=w.PACKAGE/'resident-06/gesture-09';source=P/'occupation.blend'
reviews={name:w.read(P/(name+'-review.json')) for name in ('function','form')}
assert all(r['passed'] and r['sourceSha256']==w.sha(source) for r in reviews.values())
assert reviews['form']['functionReviewSha256']==w.sha(P/'function-review.json')
assert reviews['form']['reviewerSha256']==w.sha(ROOT/'scripts/review-station-occupation.py')
old_source=ROOT/'docs/3d-town/classic-residents-v8/resident-06/rb-gu-yuanshan.blend'
bpy.ops.wm.open_mainfile(filepath=str(old_source))
rig=bpy.data.objects['rb-gu-yuanshan_rig'];body=bpy.data.objects['rb-gu-yuanshan_skin']
identity=w.hands.mesh_identity(body)
old_material_indices=[p.material_index for p in body.data.polygons]
old_bones={b.name:[float(v) for row in b.matrix_local for v in row] for b in rig.data.bones}
old_actions={}
for clip,count in [('Idle',90),('Walk',24)]:
    w.hands.bind_action(rig,bpy.data.actions[clip]);rows=[]
    for f in range(1,count+2):
        bpy.context.scene.frame_set(f);rows.append({b.name:[float(v) for row in b.matrix for v in row] for b in rig.pose.bones})
    old_actions[clip]=rows
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=bpy.data.objects['rb-gu-yuanshan_rig'];body=bpy.data.objects['rb-gu-yuanshan_skin']
new_identity=w.hands.mesh_identity(body)
assert all(identity[k]==new_identity[k] for k in ('vertices','positions','uvs','topology')),(identity,new_identity)
assert old_material_indices==[p.material_index for p in body.data.polygons]
normalize=lambda name:re.sub(r'\.\d{3}$','',name)
assert [normalize(n) for n in identity['materials']]==[normalize(n) for n in new_identity['materials']]
assert old_bones=={b.name:[float(v) for row in b.matrix_local for v in row] for b in rig.data.bones}
difference=0;leg_difference=0
for clip,rows in old_actions.items():
    w.hands.bind_action(rig,bpy.data.actions[clip])
    for f,row in enumerate(rows,1):
        bpy.context.scene.frame_set(f)
        difference=max(difference,max(abs(a-b) for bone in rig.pose.bones for a,b in zip(row[bone.name],[float(v) for line in bone.matrix for v in line])))
        leg_difference=max(leg_difference,max(abs(a-b) for bone in rig.pose.bones if bone.name.startswith(('thigh_','shin_','foot_')) for a,b in zip(row[bone.name],[float(v) for line in bone.matrix for v in line])))
assert leg_difference<1e-6
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len([g for g in v.groups if g.weight>1e-6])<=4 for v in body.data.vertices)
# Runtime attaches both exports to the resident's original floor-level origin.
# This origin change is in memory only; the reviewed room .blend is untouched.
root=bpy.data.objects['occupation_actor'];root.location=(0,0,0)
# Blender ACTIONS can match another resident's compatible armature action.
# Scope this in-memory export to the clerk's three reviewed clips.
for action in list(bpy.data.actions):
    if action.name not in ('Idle','Walk','VerifyTimetable'):bpy.data.actions.remove(action)
w.hands.bind_action(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in (root,rig,body):obj.select_set(True)
raw=P/'resident-06-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,
    export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_apply=False,
    export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animation_mode='ACTIONS')
bpy.ops.object.select_all(action='DESELECT');workplace=bpy.data.objects['occupation_workplace']
for obj in [root,workplace,*workplace.children_recursive]:obj.select_set(True)
prop=P/'workstation-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(prop),export_format='GLB',use_selection=True,export_animations=False,
    export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
dg=bpy.context.evaluated_depsgraph_get();points=[]
for obj in workplace.children_recursive:
    if obj.type!='MESH':continue
    ev=obj.evaluated_get(dg);mesh=ev.to_mesh();points.extend(ev.matrix_world@v.co for v in mesh.vertices);ev.to_mesh_clear()
bounds=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
w.write(P/'raw-export.json',{'sourceSha256':w.sha(source),'exporterSha256':w.sha(Path(__file__)),
    'retainedSourceSha256':w.sha(old_source),'meshTopologyUvPositionsRetained':True,'restBonesRetained':True,
    'materialNameRemap':dict(zip(identity['materials'],new_identity['materials'])),
    'maximumIdleWalkBoneMatrixDifference':difference,'maximumIdleWalkLegMatrixDifference':leg_difference,'upperArmAbductionRadians':.11,'skinWeightsChanged':True,
    'resident':{'path':raw.relative_to(ROOT).as_posix(),'sha256':w.sha(raw)},
    'workstation':{'path':prop.relative_to(ROOT).as_posix(),'sha256':w.sha(prop)},'workstationBounds':bounds,
    'humanArtApproved':False,'sourceUnchanged':w.sha(source)==reviews['form']['sourceSha256']})
print(json.dumps({'exported':True,'boneDifference':difference,'workplaceBounds':bounds}),flush=True)
