"""Reopen, validate and render the authored work asset before browser delivery."""
from pathlib import Path
import bpy,json,importlib.util,copy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('work',ROOT/'scripts/build-blender-restorer-work.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
PILOT=w.PACKAGE/'pilots/book-08';OUT=w.PACKAGE/'resident-03';OUT.mkdir(parents=True,exist_ok=True)

def capture_mesh(body):
    return {'positions':[tuple(v.co) for v in body.data.vertices],
        'weights':[sorted((body.vertex_groups[g.group].name,round(g.weight,7)) for g in v.groups if g.weight>1e-6) for v in body.data.vertices],
        'topology':[(tuple(p.vertices),p.material_index) for p in body.data.polygons],
        'uv':{l.name:[tuple(d.uv) for d in l.data] for l in body.data.uv_layers}}

bpy.ops.wm.open_mainfile(filepath=str(w.SOURCE));old_mesh=capture_mesh(bpy.data.objects['rb-xu-zhiwei_skin'])
old_rest={b.name:([list(row) for row in b.matrix_local],b.parent.name if b.parent else None) for b in bpy.data.objects['rb-xu-zhiwei_rig'].data.bones}
old_actions={}
for clip,count in [('Idle',90),('Walk',24)]:
    rig=bpy.data.objects['rb-xu-zhiwei_rig'];w.hands.bind_action(rig,bpy.data.actions[clip]);rows=[]
    for f in range(1,count+2):
        bpy.context.scene.frame_set(f);rows.append({b.name:[float(x) for row in b.matrix for x in row] for b in rig.pose.bones})
    old_actions[clip]=rows

pilot_report=w.read(PILOT/'authoring-review.json');assert w.sha(PILOT/'restorer-inspect-book.blend')==pilot_report['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(PILOT/'restorer-inspect-book.blend'));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];book=bpy.data.objects['restorer_bound_book'];anchor=bpy.data.objects['restorer_book_anchor']
new_mesh=capture_mesh(body);assert old_mesh['topology']==new_mesh['topology'] and old_mesh['uv']==new_mesh['uv']
assert old_rest=={b.name:([list(row) for row in b.matrix_local],b.parent.name if b.parent else None) for b in rig.data.bones}
changed_positions=[i for i,(a,b) in enumerate(zip(old_mesh['positions'],new_mesh['positions'])) if a!=b]
changed_weights=[i for i,(a,b) in enumerate(zip(old_mesh['weights'],new_mesh['weights'])) if a!=b]
assert set(changed_positions)<=set(pilot_report['cuffWeightVertices'])==set(changed_weights)
assert all(abs(old_mesh['positions'][i][a]-new_mesh['positions'][i][a])<1e-7 for i in changed_positions for a in (0,1))
assert all(0<new_mesh['positions'][i][2]-old_mesh['positions'][i][2]<=.012001 for i in changed_positions)
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len([g for g in v.groups if g.weight>1e-6])<=4 for v in body.data.vertices)
retention=0
for clip,rows in old_actions.items():
    w.hands.bind_action(rig,bpy.data.actions[clip])
    for f,old in enumerate(rows,1):
        bpy.context.scene.frame_set(f)
        retention=max(retention,max(abs(a-b) for bone in rig.pose.bones for a,b in zip(old[bone.name],[float(x) for row in bone.matrix for x in row])))
assert retention<1e-6
metadata=[{'frame':1+i/2,'time':i/60,'bothHandsRequired':1.65<=i/60<=6.55} for i in range(481)]
frames=w.evaluate(body,rig,anchor,book,metadata)
maxima={k:max(row[k] for row in frames) for k in ('handBookTrianglePairs','handStandTrianglePairs','bookStandTrianglePairs','fingerSelfTrianglePairs')}
maxima['fingerGarmentTrianglePairs']=max(row['contacts'][s]['fingerGarmentTrianglePairs'] for row in frames for s in ('L','R'))
contacts={k:max(row['contacts'][s][k] for row in frames if row['bothHandsRequired'] for s in ('L','R')) for k in ('thumbGapMeters','lowerFingerGapMeters')}
w.write(OUT/'saved-contact-review.json',{'pilotSha256':pilot_report['sourceSha256'],'reviewerSha256':w.sha(Path(__file__)),
    'evaluatorSha256':w.sha(ROOT/'scripts/build-blender-restorer-work.py'),'frames':frames,'maxima':maxima,'heldContactGaps':contacts,
    'changedCuffPositionVertices':changed_positions,'changedCuffWeightVertices':changed_weights,'maximumOldActionMatrixDifference':retention,
    'topologyAndUvRetained':True,'fiftyRestBonesRetained':True,'humanArtApproved':False})
assert all(v==0 for v in maxima.values()),maxima
assert all(v<.003 for v in contacts.values()),contacts
# Refine cameras without changing the accepted animation.
w.u.configure(48,1200);scene=bpy.context.scene;scene.render.resolution_y=1200
views=[('front-left',(-3,-4,2.2),(0,-.15,.91),2.25,111),('front-right',(3,-4,2.2),(0,-.15,.91),2.25,111),
    ('back-left',(-3,3,2.2),(0,-.15,.91),2.25,111),('back-right',(3,3,2.2),(0,-.15,.91),2.25,111),
    ('low',(2,-3,.46),(0,-.15,1.05),2.15,111),('ceiling',(-2,-3,4.5),(0,-.15,1.0),2.05,111),
    ('grasp',(.9,-2,1.65),(0,-.24,1.10),.9,52),('approach',(1.9,-3,1.5),(0,-.15,1.13),1.45,33),
    ('rest',(2.3,-3.5,1.7),(0,-.15,.89),2.18,1),('return',(.9,-2,1.65),(0,-.24,1.1),.9,196)]
for name,pos,target,size,f in views:w.u.camera('final-'+name,pos,target,size)
scene.frame_set(111);scene.camera=bpy.data.objects['final-front-right'];bpy.ops.file.pack_all()
source=OUT/'rb-xu-zhiwei.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));source_hash=w.sha(source)
# Reopen the exact delivery file; the earlier pilot never stands in for it.
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];anchor=bpy.data.objects['restorer_book_anchor'];book=bpy.data.objects['restorer_bound_book']
assert capture_mesh(body)==new_mesh
check=w.evaluate(body,rig,anchor,book,metadata)
assert check==frames
review=w.read(OUT/'saved-contact-review.json');review.update(sourceSha256=source_hash,reopenedDeliverySource=True);w.write(OUT/'saved-contact-review.json',review)
renders=[]
for name,_,_,_,f in views:
    scene.frame_set(f);scene.camera=bpy.data.objects['final-'+name];path=OUT/'renders'/f'{name}.png';path.parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);renders.append({'name':name,'frame':f,'path':path.relative_to(OUT).as_posix(),'sha256':w.sha(path)})
w.write(OUT/'render-review.json',{'sourceSha256':source_hash,'renderer':'Cycles','samples':48,'renders':renders})
w.hands.bind_action(rig,bpy.data.actions['Idle']);scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
raw=OUT/'resident-03-raw.glb'
opts=dict(export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
bpy.ops.export_scene.gltf(filepath=str(raw),export_animation_mode='ACTIONS',**opts)
bpy.ops.object.select_all(action='DESELECT');root=bpy.data.objects['restorer_workstation']
for obj in [root,*root.children_recursive]:obj.select_set(True)
prop_raw=OUT/'workstation-raw.glb'
bpy.ops.export_scene.gltf(filepath=str(prop_raw),export_animation_mode='ACTIVE_ACTIONS',**opts)
stand=bpy.data.objects['restorer_book_stand'];points=[stand.matrix_world@v.co for v in stand.data.vertices]
bounds=[[min(v[a] for v in points),max(v[a] for v in points)] for a in range(3)]
w.write(OUT/'raw-export.json',{'sourceSha256':source_hash,'resident':{'path':raw.relative_to(ROOT).as_posix(),'sha256':w.sha(raw)},
    'workstation':{'path':prop_raw.relative_to(ROOT).as_posix(),'sha256':w.sha(prop_raw)},'workstationBounds':bounds,
    'pilot':{'path':str((PILOT/'restorer-inspect-book.blend').relative_to(ROOT)).replace('\\','/'),'sha256':pilot_report['sourceSha256']},
    'builderSha256':w.sha(Path(__file__)),'humanArtApproved':False,'worldBound':False})
print(json.dumps({'sourceSha256':source_hash,'maxima':maxima,'heldContactGaps':contacts,'renders':len(renders),'cuffVertices':len(changed_weights)}))
