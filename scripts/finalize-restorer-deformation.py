"""Reopen a scoped sleeve/gaze edit and review the saved delivery geometry."""
from pathlib import Path
import bpy,importlib.util,json,math,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deform',ROOT/'scripts/build-restorer-deformation.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
w=d.w;P=d.PACKAGE;PILOT=P/'pilots/sleeves-gaze-03';OUT=P/'resident-03';OUT.mkdir(parents=True,exist_ok=True)
FRAMES=[{'frame':1+i/2,'time':i/60,'bothHandsRequired':1.65<=i/60<=6.55} for i in range(481)]

def mesh_identity(body):
    return {'positions':[tuple(v.co) for v in body.data.vertices],
        'weights':[sorted((body.vertex_groups[g.group].name,round(g.weight,7)) for g in v.groups if g.weight>1e-6) for v in body.data.vertices],
        'topology':[(tuple(p.vertices),p.material_index) for p in body.data.polygons],
        'materials':[m.name for m in body.data.materials],
        'uv':{l.name:[tuple(v.uv) for v in l.data] for l in body.data.uv_layers}}

def matrix(m):return [float(v) for row in m for v in row]
def set_frame(f):bpy.context.scene.frame_set(math.floor(f),subframe=f-math.floor(f));bpy.context.view_layer.update()
def rest(rig):return {b.name:(matrix(b.matrix_local),b.parent.name if b.parent else None) for b in rig.data.bones}
def prop_identity():
    root=bpy.data.objects['restorer_workstation'];items={}
    for obj in [root,*root.children_recursive]:
        items[obj.name]={'parent':obj.parent.name if obj.parent else None,'mesh':w.hands.mesh_identity(obj) if obj.type=='MESH' else None}
    return items
def actions(rig):
    rows={}
    for clip,count in [('Idle',90),('Walk',24),('InspectBook',240)]:
        w.hands.bind_action(rig,bpy.data.actions[clip]);rows[clip]=[]
        for f in range(1,count+2):
            set_frame(f);rows[clip].append({b.name:matrix(b.matrix) for b in rig.pose.bones})
    return rows
def prop_poses():
    root=bpy.data.objects['restorer_workstation'];objects=[root,*root.children_recursive];rows=[]
    for item in FRAMES:
        set_frame(item['frame']);rows.append({obj.name:matrix(obj.matrix_world) for obj in objects})
    return rows

def evaluate(body,rig,anchor,book,blouse_ids):
    w.hands.bind_action(rig,bpy.data.actions[w.BODY_CLIP]);anchor.animation_data.action=bpy.data.actions[w.PROP_CLIP]
    labels=body.data.attributes['AnatomicalFinger'].data;body.data.calc_loop_triangles();book.data.calc_loop_triangles()
    tris=[tuple(t.vertices) for t in body.data.loop_triangles]
    finger_faces={s:[t for t in tris if all(labels[i].value*s>0 for i in t)] for s in (-1,1)}
    digit_faces={s:[t for t in tris if all(labels[i].value==s for i in t)] for s in list(range(-5,0))+list(range(1,6))}
    finger_ids={s:{i for t in faces for i in t} for s,faces in finger_faces.items()}
    skin_ids={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
    hand_groups={g.index for g in body.vertex_groups if g.name.startswith(('hand_','finger_'))}
    hand_ids={v.index for v in body.data.vertices if v.index in skin_ids and sum(g.weight for g in v.groups if g.group in hand_groups)>.5}
    hand_faces=[t for t in tris if all(i in hand_ids for i in t)];garment_faces=[t for t in tris if not any(i in hand_ids for i in t)]
    stand=bpy.data.objects['restorer_book_stand'];stand.data.calc_loop_triangles()
    stand_tree=BVHTree.FromPolygons([stand.matrix_world@v.co for v in stand.data.vertices],[tuple(t.vertices) for t in stand.data.loop_triangles],all_triangles=True)
    book_faces=[tuple(t.vertices) for t in book.data.loop_triangles]
    selected=set(blouse_ids);edges=[tuple(e.vertices) for e in body.data.edges if all(i in selected for i in e.vertices)]
    lengths=[(body.data.vertices[a].co-body.data.vertices[b].co).length for a,b in edges]
    rows=[]
    for key in FRAMES:
        set_frame(key['frame']);evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        points=[body.matrix_world@v.co for v in mesh.vertices];book_points=[book.matrix_world@v.co for v in book.data.vertices]
        tree=BVHTree.FromPolygons(book_points,book_faces,all_triangles=True)
        hand=BVHTree.FromPolygons(points,hand_faces,all_triangles=True);garment=BVHTree.FromPolygons(points,garment_faces,all_triangles=True)
        contacts={}
        for sign,side in [(-1,'L'),(1,'R')]:
            ids=finger_ids[sign];finger=BVHTree.FromPolygons(points,finger_faces[sign],all_triangles=True)
            thumb=[i for i in ids if abs(labels[i].value)==1];other=[i for i in ids if abs(labels[i].value)>1]
            contacts[side]={'intersectingTrianglePairs':len(finger.overlap(tree)),
                'thumbGapMeters':min(tree.find_nearest(points[i])[3] for i in thumb),
                'lowerFingerGapMeters':min(tree.find_nearest(points[i])[3] for i in other),
                'fingerGarmentTrianglePairs':len(finger.overlap(garment))}
        digits={digit:BVHTree.FromPolygons(points,faces,all_triangles=True) for digit,faces in digit_faces.items()}
        pairs=sum(len(digits[s*a].overlap(digits[s*b])) for s in (-1,1) for a in range(1,6) for b in range(a+1,6))
        ratios=sorted((mesh.vertices[a].co-mesh.vertices[b].co).length/length for (a,b),length in zip(edges,lengths) if length>1e-5)
        attention=w.hands.smooth((key['time']-.42)/.8)*(1-w.hands.smooth((key['time']-6.5)/.8))
        target=rig.matrix_world.inverted()@(anchor.matrix_world@Vector((0,-.06,.017)));gaze={}
        for side in ('L','R'):
            bone=rig.pose.bones['eye_'+side];forward=bone.matrix.to_3x3()@(rig.data.bones[bone.name].matrix_local.to_3x3().inverted()@Vector((0,-1,0)))
            gaze[side]={'targetAngleDegrees':math.degrees(forward.angle(target-bone.head)) if attention>.99 else None,'quaternion':list(bone.rotation_quaternion)}
        rows.append({**key,'contacts':contacts,'fingerSelfTrianglePairs':pairs,'handBookTrianglePairs':len(hand.overlap(tree)),
            'handStandTrianglePairs':len(hand.overlap(stand_tree)),'bookStandTrianglePairs':len(tree.overlap(stand_tree)),
            'sleeveStretch':{'p95EdgeLengthRatio':ratios[int(len(ratios)*.95)],'maximumEdgeLengthRatio':max(ratios),'edgesOver2':sum(v>2 for v in ratios)},'gaze':gaze})
        evaluated.to_mesh_clear()
        if len(rows)%120==0:print('Reviewed',len(rows),'of',len(FRAMES),'poses',flush=True)
    return rows

def main():
    manifest=w.read(ROOT/'public/assets/classic-residents/v9/resident-03.json');assert w.sha(d.SOURCE)==manifest['sourceSha256']
    bpy.ops.wm.open_mainfile(filepath=str(d.SOURCE));body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig']
    old_mesh=mesh_identity(body);old_rest=rest(rig);old_actions=actions(rig);old_props=prop_identity();old_prop_poses=prop_poses()
    pilot=w.read(PILOT/'authoring-review.json');assert w.sha(PILOT/'restorer-deformation.blend')==pilot['sourceSha256']
    assert w.sha(PILOT/'builder.py')==pilot['builderSha256']==w.sha(ROOT/'scripts/build-restorer-deformation.py')
    bpy.ops.wm.open_mainfile(filepath=str(PILOT/'restorer-deformation.blend'));bpy.context.preferences.filepaths.save_version=0
    w.u.configure(48,1200);scene=bpy.context.scene;scene.render.resolution_y=1200
    # All room-scale views retain the corrected low camera from v9.
    views=[('front-left','final-front-left',111),('front-right','final-front-right',111),('back-left','final-back-left',111),('back-right','final-back-right',111),
        ('low','final-low',111),('ceiling','final-ceiling',111),('grasp','final-grasp',52),('approach','final-approach',33),
        ('rest','final-rest',1),('return','final-return',196),('gaze','v10-face',111),('sleeves','v10-shoulder',111)]
    scene.frame_set(111);scene.camera=bpy.data.objects['final-front-right'];source=OUT/'rb-xu-zhiwei.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig']
    current=mesh_identity(body);bones=rest(rig)
    assert all(current[k]==old_mesh[k] for k in ('topology','uv','materials'))
    assert all(bones[k]==v for k,v in old_rest.items()) and set(bones)-set(old_rest)=={'eye_L','eye_R'}
    changed_positions=[i for i,(a,b) in enumerate(zip(old_mesh['positions'],current['positions'])) if a!=b]
    changed_weights=[i for i,(a,b) in enumerate(zip(old_mesh['weights'],current['weights'])) if a!=b]
    # The harmonic solve rewrites the whole connected blouse, including tiny
    # normalization changes below the pilot's 1e-6 change-report threshold.
    allowed_weights=set(pilot['weights']['blouseVertices'])|set(pilot['gaze']['collarVertices'])|{i for ids in pilot['gaze']['eyeVertices'].values() for i in ids}
    assert set(changed_positions)<=set(pilot['weights']['shapeVertices'])
    assert set(changed_weights)<=allowed_weights
    assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len([g for g in v.groups if g.weight>1e-6])<=4 for v in body.data.vertices)
    new_actions=actions(rig);difference={}
    for clip,rows in old_actions.items():
        difference[clip]=max(abs(a-b) for index,row in enumerate(rows) for name,values in row.items() if clip!='InspectBook' or name!='head' for a,b in zip(values,new_actions[clip][index][name]))
    assert max(difference.values())<1e-6,difference
    assert old_props==prop_identity() and old_prop_poses==prop_poses()
    for name in bones:
        assert max(abs(a-b) for a,b in zip(new_actions['InspectBook'][0][name],new_actions['InspectBook'][-1][name]))<1e-6
    anchor=bpy.data.objects['restorer_book_anchor'];book=bpy.data.objects['restorer_bound_book']
    rows=evaluate(body,rig,anchor,book,pilot['weights']['blouseVertices'])
    maxima={k:max(r[k] for r in rows) for k in ('fingerSelfTrianglePairs','handBookTrianglePairs','handStandTrianglePairs','bookStandTrianglePairs')}
    maxima['fingerGarmentTrianglePairs']=max(r['contacts'][s]['fingerGarmentTrianglePairs'] for r in rows for s in ('L','R'))
    gaps={k:max(r['contacts'][s][k] for r in rows if r['bothHandsRequired'] for s in ('L','R')) for k in ('thumbGapMeters','lowerFingerGapMeters')}
    stretch={k:max(r['sleeveStretch'][k] for r in rows) for k in rows[0]['sleeveStretch']}
    gaze=max(e['targetAngleDegrees'] for r in rows for e in r['gaze'].values() if e['targetAngleDegrees'] is not None)
    report={'sourceSha256':w.sha(source),'reviewerSha256':w.sha(Path(__file__)),'pilotSourceSha256':pilot['sourceSha256'],'reopenedDeliverySource':True,
        'changedPositionVertices':changed_positions,'changedWeightVertices':changed_weights,'maximumOldActionMatrixDifference':difference,
        'oldRestBonesRetained':50,'addedEyeBones':2,'topologyUvMaterialsRetained':True,'workstationMeshesAndAll481PosesRetained':True,
        'actionEndpointsMatch':True,'maxima':maxima,'heldContactGaps':gaps,'sleeveStretchMaxima':stretch,'maximumAttentiveGazeAngleDegrees':gaze,
        'frames':rows,'limitations':['Surface triangle checks do not prove all cloth self-intersection or anatomical skin containment.','Gaze uses anatomical eye forward axes; no eyelid or facial expression animation.'],
        'worldBound':False,'humanArtApproved':False}
    w.write(OUT/'saved-source-review.json',report)
    assert all(v==0 for v in maxima.values()),maxima
    assert all(v<.003 for v in gaps.values()),gaps
    assert stretch['maximumEdgeLengthRatio']<2 and stretch['edgesOver2']==0,stretch
    assert gaze<6,gaze
    renders=[]
    for name,camera,frame in views:
        set_frame(frame);scene.camera=bpy.data.objects[camera];path=OUT/'renders'/f'{name}.png';path.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        renders.append({'name':name,'frame':frame,'path':path.relative_to(OUT).as_posix(),'sha256':w.sha(path)})
    w.write(OUT/'render-review.json',{'sourceSha256':w.sha(source),'renderer':'Cycles','samples':48,'renders':renders})
    w.hands.bind_action(rig,bpy.data.actions['Idle']);scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
    raw=OUT/'resident-03-raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animation_mode='ACTIONS')
    w.write(OUT/'raw-export.json',{'sourceSha256':w.sha(source),'resident':{'path':raw.relative_to(ROOT).as_posix(),'sha256':w.sha(raw)},'workstationReuse':manifest['workAction']['workstation'],'reviewerSha256':w.sha(Path(__file__))})
    print(json.dumps({'sourceSha256':w.sha(source),'changedPositionVertices':len(changed_positions),'changedWeightVertices':len(changed_weights),'maxima':maxima,'gaps':gaps,'stretch':stretch,'gazeDegrees':gaze,'renders':len(renders)}))

if __name__=='__main__':main()
