"""Author a finite, two-handed old-book inspection in background Blender.

The existing resident and an independent workstation receive synchronized
actions. This is a visual action asset, not an Agent decision or world event.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import math
import sys
import bpy
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-residents-v9'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
hands=module('retained_hand_methods',ROOT/'scripts/build-blender-resident-hands.py')
inv=module('retained_character_methods',ROOT/'scripts/build-blender-classic-investigator.py');u=inv.u
sha,read,write=hands.sha,hands.read,hands.write
SOURCE=ROOT/'docs/3d-town/classic-residents-v8/resident-03/rb-xu-zhiwei.blend'
ROOM=ROOT/'docs/3d-town/classic-station-v1/classic-station.blend'
BODY_CLIP='InspectBook';PROP_CLIP='InspectBook_Prop';DURATION=8.;FPS=30
REST=Vector((0,-.35,1.0775));RAISED=Vector((0,-.31,1.225))

def correct_cuff_weights(body):
    # A shirt cuff follows the forearm. Binding it to the palm made its fabric
    # twist and collapse whenever the wrist rotated to grasp a book.
    skin_ids={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
    changed=[]
    for side in ('L','R'):
        hand=body.vertex_groups['hand_'+side];forearm=body.vertex_groups['forearm_'+side]
        for v in body.data.vertices:
            if v.index in skin_ids:continue
            weights={g.group:g.weight for g in v.groups}
            if weights.get(hand.index,0)>0:
                forearm.add([v.index],weights[hand.index]+weights.get(forearm.index,0),'REPLACE')
                v.co.z+=.012*max(0,min(1,(1.0-v.co.z)/.03))
                hand.remove([v.index]);changed.append(v.index)
    return changed

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name;return obj

def make_workstation(rig):
    scene_manifest=read(ROOT/'public/assets/classic-station/v1/manifest.json')
    assert sha(ROOM)==scene_manifest['sourceSha256']
    with bpy.data.libraries.load(str(ROOM),link=False) as (src,dst):
        dst.materials=['aged_walnut','polished_walnut']
    assert all(dst.materials)
    for key,mat in zip(('workstand_wood','workstand_top'),dst.materials):u.MATS[key]=mat
    u.material('book_cover','324638',.77);u.material('book_paper','c7bd9f',.94)
    u.material('book_page_edges','a89f87',.95);u.material('book_gilt','9a8254',.40,.65)
    u.material('book_cradle_felt','35423b',.98)
    u.LAY='restorer_workstation';u.PART='original_book_workstation'
    root=bpy.data.objects.new('restorer_workstation',None);bpy.context.collection.objects.link(root);root.matrix_world=rig.matrix_world.copy()
    objects=[];objects.append(u.box('workstand_top',(0,-.35,1.001),(.46,.34,.038),'workstand_top',.008))
    for x in (-.184,.184):
        for y in (-.472,-.228):
            objects.append(u.cylinder('workstand_turned_leg',(x,y,.488),.018,.955,'workstand_wood',20,top=.026))
            objects.append(u.cylinder('workstand_leg_collar',(x,y,.86),.032,.045,'workstand_wood',20))
    for y in (-.477,-.223):objects.append(u.box('workstand_apron',(0,y,.950),(.414,.022,.092),'workstand_wood',.004))
    for x in (-.191,.191):objects.append(u.box('workstand_side_rail',(x,-.35,.950),(.024,.236,.092),'workstand_wood',.004))
    objects.append(u.box('book_cradle_pad',(0,-.35,1.040),(.150,.230,.040),'book_cradle_felt',.002))
    stand=join(objects,'restorer_book_stand');stand.parent=root
    anchor=bpy.data.objects.new('restorer_book_anchor',None);bpy.context.collection.objects.link(anchor);anchor.parent=root
    anchor.rotation_mode='QUATERNION';anchor.location=REST
    parts=[]
    for z in (-.0145,.0145):parts.append(u.box('book_bound_cover',(0,0,z),(.228,.288,.005),'book_cover',.0008))
    parts.append(u.box('book_page_block',(.001,0,0),(.218,.278,.024),'book_paper',.001))
    parts.append(u.box('book_rounded_spine',(-.111,0,0),(.010,.286,.032),'book_cover',.001))
    for y in (-.106,-.070,.070,.106):parts.append(u.box('book_spine_band',(-.116,y,0),(.0028,.005,.026),'book_gilt',.0003))
    for x in (-.096,.096):parts.append(u.box('book_cover_rule',(x,0,.01725),(.0015,.25,.0005),'book_gilt',0))
    for y in (-.124,.124):parts.append(u.box('book_cover_rule',(0,y,.01725),(.193,.0015,.0005),'book_gilt',0))
    for y,width in [(.04,.095),(.02,.072),(-.045,.050)]:parts.append(u.box('book_cover_deboss',(0,y,.01725),(width,.002,.0005),'book_gilt',0))
    for z in (-.009,-.006,-.003,0,.003,.006,.009):parts.append(u.box('book_page_grain',(.1105,0,z),(.0008,.275,.00045),'book_page_edges',0))
    book=join(parts,'restorer_bound_book');book.parent=anchor
    return root,stand,anchor,book

def elbow(shoulder,wrist,upper,lower,pole):
    line=wrist-shoulder;distance=line.length
    assert 0.025<distance<upper+lower,(distance,upper+lower)
    direction=line.normalized();a=(upper*upper-lower*lower+distance*distance)/(2*distance)
    normal=pole-direction*pole.dot(direction)
    if normal.length<1e-6:normal=Vector((1,0,0))-direction*direction.x
    return shoulder+direction*a+normal.normalized()*math.sqrt(max(0,upper*upper-a*a))

def keyed(obj,frame):
    for prop in ('location','rotation_quaternion','scale'):obj.keyframe_insert(data_path=prop,frame=frame)

def make_actions(body,rig,anchor):
    hands.bind_action(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
    basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
    initial={b.name:b.matrix.copy() for b in rig.pose.bones}
    body_action=bpy.data.actions.new(BODY_CLIP);body_action.use_fake_user=True;rig.animation_data.action=body_action
    prop_action=bpy.data.actions.new(PROP_CLIP);prop_action.use_fake_user=True;anchor.animation_data_create();anchor.animation_data.action=prop_action
    inv.RIG=rig;inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
    metadata=[]
    for frame in range(1,int(DURATION*FPS)+2):
        scene=bpy.context.scene;scene.frame_set(frame);t=(frame-1)/FPS
        reach=hands.smooth((t-.40)/1.15)*(1-hands.smooth((t-6.60)/1.0))
        pose_reach=hands.smooth((reach-.4)/.3)
        carry=hands.smooth((t-1.80)/1.0)*(1-hands.smooth((t-5.20)/1.10))
        inspection=hands.smooth((t-2.95)/.4)*(1-hands.smooth((t-4.80)/.4))
        yaw=.14*math.sin((t-3.0)*math.pi)*inspection
        orientation=Quaternion((0,0,1),yaw)@Quaternion((1,0,0),-.8*carry)
        center=REST.lerp(RAISED,carry);anchor.location=center;anchor.rotation_quaternion=orientation
        for name,matrix in basis.items():rig.pose.bones[name].matrix_basis=matrix
        bpy.context.view_layer.update()
        targets={}
        for sign,side in [(-1,'L'),(1,'R')]:
            name='hand_'+side;wrist_start=initial[name].translation
            contact=center+orientation@Vector((sign*.192,0,.046))
            raised=Vector((sign*.35,-.20,1.25))
            open_grip=center+orientation@Vector((sign*.265,0,.046))
            if reach<.4:wrist=wrist_start.lerp(raised,hands.smooth(reach/.4))
            elif reach<.7:wrist=raised.lerp(open_grip,hands.smooth((reach-.4)/.3))
            else:wrist=open_grip.lerp(contact,hands.smooth((reach-.7)/.3))
            targets[side]=list(wrist)
            if reach>1e-8:
                shoulder=rig.pose.bones['upperarm_'+side].head.copy()
                old_elbow=initial['forearm_'+side].translation
                upper=(inv.BONES['upperarm_'+side][1]-inv.BONES['upperarm_'+side][0]).length
                lower=(inv.BONES['forearm_'+side][1]-inv.BONES['forearm_'+side][0]).length
                resting_pole=old_elbow-(shoulder+wrist_start)/2
                pole=resting_pole.normalized().lerp(Vector((sign,.12,-.12)).normalized(),hands.smooth(reach/.4))
                joint=elbow(shoulder,wrist,upper,lower,pole)
                inv.worldbone('upperarm_'+side,shoulder,joint);inv.worldbone('forearm_'+side,joint,wrist)
                desired=(orientation@Quaternion((0,1,0),sign*.55)@Quaternion((0,0,1),sign*math.pi/2)).to_matrix()@rig.data.bones[name].matrix_local.to_3x3()
                natural=rig.pose.bones['forearm_'+side].matrix.to_3x3()@initial['forearm_'+side].to_3x3().inverted()@initial[name].to_3x3()
                rotation=natural.to_quaternion().slerp(desired.to_quaternion(),pose_reach)
                matrix=rotation.to_matrix().to_4x4();matrix.translation=wrist;rig.pose.bones[name].matrix=matrix
            for finger in range(1,6):
                for segment in range(1,4):
                    bone_name=f'finger_{side}_{finger}_{segment}';bone=rig.pose.bones[bone_name];rest=rig.data.bones[bone_name]
                    toward=Vector((sign*.22 if finger==1 else 0,1,0))
                    axis=(rest.tail_local-rest.head_local).cross(toward).normalized();axis=rest.matrix_local.to_3x3().inverted()@axis
                    extra=(.025 if finger==1 else (.12,.10,.055)[segment-1])*pose_reach
                    bone.rotation_quaternion=bone.rotation_quaternion@Quaternion(axis,extra)
            bpy.context.view_layer.update()
            thumb=rig.pose.bones[f'finger_{side}_1_1']
            axis=thumb.matrix.to_3x3().inverted()@(orientation@Vector((0,1,0)))
            thumb.rotation_quaternion=thumb.rotation_quaternion@Quaternion(axis,sign*.49*hands.smooth((reach-.7)/.15))
        head=rig.pose.bones['head'];head.rotation_quaternion=head.rotation_quaternion@Quaternion((1,0,0),.16*carry)
        bpy.context.view_layer.update()
        for bone in rig.pose.bones:keyed(bone,frame)
        keyed(anchor,frame)
        metadata.append({'frame':frame,'time':t,'reach':reach,'carry':carry,'bookPosition':list(center),'wristTargets':targets,
            'bothHandsRequired':1.65<=t<=6.55})
    return metadata

def evaluate(body,rig,anchor,book,frames):
    hands.bind_action(rig,bpy.data.actions[BODY_CLIP]);anchor.animation_data.action=bpy.data.actions[PROP_CLIP]
    labels=body.data.attributes['AnatomicalFinger'].data
    body.data.calc_loop_triangles();book.data.calc_loop_triangles()
    fingers={s:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value*s>0 for i in t.vertices)] for s in (-1,1)}
    skin_ids={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
    hand_groups={g.index for g in body.vertex_groups if g.name.startswith(('hand_','finger_'))}
    hand_ids={v.index for v in body.data.vertices if v.index in skin_ids and sum(g.weight for g in v.groups if g.group in hand_groups)>.5}
    hand_faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in hand_ids for i in t.vertices)]
    garment_faces=[tuple(t.vertices) for t in body.data.loop_triangles if not any(i in hand_ids for i in t.vertices)]
    stand=bpy.data.objects['restorer_book_stand'];stand.data.calc_loop_triangles()
    stand_tree=BVHTree.FromPolygons([stand.matrix_world@v.co for v in stand.data.vertices],[tuple(t.vertices) for t in stand.data.loop_triangles],all_triangles=True)
    book_faces=[tuple(t.vertices) for t in book.data.loop_triangles];rows=[]
    for key in frames:
        f=key['frame'];bpy.context.scene.frame_set(math.floor(f),subframe=f-math.floor(f));bpy.context.view_layer.update()
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        points=[body.matrix_world@v.co for v in mesh.vertices]
        vertices=[book.matrix_world@v.co for v in book.data.vertices]
        tree=BVHTree.FromPolygons(vertices,book_faces,all_triangles=True)
        contacts={}
        whole_hand=BVHTree.FromPolygons(points,hand_faces,all_triangles=True)
        garment=BVHTree.FromPolygons(points,garment_faces,all_triangles=True)
        for sign,side in [(-1,'L'),(1,'R')]:
            faces=fingers[sign];finger_tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
            used={i for face in faces for i in face}
            distances=[tree.find_nearest(points[i])[3] for i in used]
            thumb_ids=[i for i in used if abs(labels[i].value)==1];other_ids=[i for i in used if abs(labels[i].value)>1]
            contacts[side]={'intersectingTrianglePairs':len(finger_tree.overlap(tree)),'minimumSurfaceDistanceMeters':min(distances),
                'thumbGapMeters':min(tree.find_nearest(points[i])[3] for i in thumb_ids),
                'lowerFingerGapMeters':min(tree.find_nearest(points[i])[3] for i in other_ids),
                'fingerGarmentTrianglePairs':len(finger_tree.overlap(garment))}
        digit_trees={d:BVHTree.FromPolygons(points,[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==d for i in t.vertices)],all_triangles=True) for d in list(range(-5,0))+list(range(1,6))}
        finger_pairs=0
        for side in (-1,1):
            for a in range(1,6):
                for b in range(a+1,6):finger_pairs+=len(digit_trees[side*a].overlap(digit_trees[side*b]))
        rows.append({**key,'contacts':contacts,'fingerSelfTrianglePairs':finger_pairs,'handBookTrianglePairs':len(whole_hand.overlap(tree)),
            'handStandTrianglePairs':len(whole_hand.overlap(stand_tree)),'bookStandTrianglePairs':len(tree.overlap(stand_tree))})
        evaluated.to_mesh_clear()
    return rows

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='book-01');parser.add_argument('--width',type=int,default=1000);parser.add_argument('--samples',type=int,default=32)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    folder=PACKAGE/'pilots'/args.pilot
    previous=read(ROOT/'public/assets/classic-residents/v8/resident-03.json');assert sha(SOURCE)==previous['sourceSha256']
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
    body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];input_identity=hands.mesh_identity(body)
    cuff_vertices=correct_cuff_weights(body)
    identity=hands.mesh_identity(body)
    root,stand,anchor,book=make_workstation(rig);frames=make_actions(body,rig,anchor)
    assert hands.mesh_identity(body)==identity
    contact=evaluate(body,rig,anchor,book,frames)
    held=[row for row in contact if row['bothHandsRequired']]
    maximum=max(row['contacts'][side]['intersectingTrianglePairs'] for row in held for side in ('L','R'))
    gap=max(row['contacts'][side]['minimumSurfaceDistanceMeters'] for row in held for side in ('L','R'))
    scene=bpy.context.scene;u.configure(args.samples,args.width);scene.render.resolution_y=args.width
    u.camera('book-front',(0,-4.0,1.7),(0,-.18,1.2),1.45)
    u.camera('book-side',(2.3,-1.8,1.5),(0,-.20,1.2),1.50)
    u.camera('book-contact',(.9,-2.0,1.65),(0,-.24,1.10),.8)
    folder.mkdir(parents=True,exist_ok=True);source=folder/'restorer-inspect-book.blend'
    (folder/'builder.py').write_bytes(Path(__file__).read_bytes())
    scene.frame_set(1);scene.camera=bpy.data.objects['book-front'];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source))
    write(folder/'authoring-review.json',{'schema':'classic-restorer-book-pilot.v1','sourceSha256':sha(source),
        'sourceInputs':[{'path':SOURCE.relative_to(ROOT).as_posix(),'sha256':sha(SOURCE)},{'path':ROOM.relative_to(ROOT).as_posix(),'sha256':sha(ROOM)}],
        'builderSha256':sha(Path(__file__)),'restMeshIdentity':identity,'inputRestMeshIdentity':input_identity,'cuffWeightVertices':cuff_vertices,'cuffHemShorteningMeters':.012,'duration':DURATION,'frames':contact,
        'maximumHeldFingerBookTrianglePairs':maximum,'maximumHeldContactGapMeters':gap,
        'humanArtApproved':False,'worldBound':False,'physicsSimulation':False,
        'scope':'Kinematic closed-book inspection. Does not open the cover or turn individual pages. Pilot contacts remain subject to review.'})
    renders=[]
    for name,camera_name,frame in [('reach','book-side',45),('grasp','book-contact',52),('inspect','book-front',111),('inspect-side','book-side',111),('return','book-front',196)]:
        scene.frame_set(frame);scene.camera=bpy.data.objects[camera_name]
        path=folder/'renders'/f'{name}.png';path.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True);renders.append({'name':name,'frame':frame,'path':path.relative_to(folder).as_posix(),'sha256':sha(path)})
    write(folder/'render-review.json',{'sourceSha256':sha(source),'renders':renders,'samples':args.samples,'renderer':'Cycles'})
    print(json.dumps({'source':str(source),'maximumHeldFingerBookTrianglePairs':maximum,'maximumHeldContactGapMeters':gap,
        'maxima':{key:max(r[key] for r in contact) for key in ('handBookTrianglePairs','handStandTrianglePairs','bookStandTrianglePairs')},
        'fingerGarmentPairs':max(r['contacts'][s]['fingerGarmentTrianglePairs'] for r in contact for s in ('L','R'))}),flush=True)

if __name__=='__main__':main()
