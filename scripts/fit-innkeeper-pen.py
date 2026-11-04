"""Fit a tripod writing grip on an evaluated candidate, without runtime export."""
from pathlib import Path
import importlib.util
import math
import json
import bpy
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation_authoring',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-01/occupation.blend'
OUT=w.PACKAGE/'resident-08/grip-study-04';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];pen=bpy.data.objects['occupation_pen_anchor']
bpy.context.scene.frame_set(121);bpy.context.view_layer.update()
basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones};initial={b.name:b.matrix.copy() for b in rig.pose.bones}
rig.animation_data_clear();pen.animation_data_clear()
w.inv.RIG=rig;w.inv.BONES={b.name:(b.head_local.copy(),b.tail_local.copy()) for b in rig.data.bones}
direction=Vector((-.10,.52,1)).normalized();tip=Vector((.105,-.405,1.104));grip=tip+direction*.041
orientation=Vector((0,0,1)).rotation_difference(direction)
pen.location=tip;pen.rotation_quaternion=orientation
across=Vector((1,0,0));across=(across-direction*across.dot(direction)).normalized()
roll=Quaternion((0,1,0),.72)@Quaternion((1,0,0),-1.10)@rig.data.bones['hand_R'].matrix_local.to_quaternion()
w.aim_arm(rig,initial,'R',Vector((.165,-.305,1.185)),roll,1)
bpy.context.view_layer.update()


def ccd(names,target,passes=24):
    for _ in range(passes):
        if (rig.pose.bones[names[-1]].tail-target).length<.00015:break
        for name in reversed(names):
            joint=rig.pose.bones[name];origin=joint.head.copy()
            current=rig.pose.bones[names[-1]].tail-origin;goal=target-origin
            if current.length<1e-8 or goal.length<1e-8:continue
            rotation=current.rotation_difference(goal)
            if rotation.angle>.30:rotation=Quaternion(rotation.axis,.30)
            matrix=(rotation.to_matrix()@joint.matrix.to_3x3()).to_4x4();matrix.translation=origin
            joint.matrix=matrix;bpy.context.view_layer.update()
    return (rig.pose.bones[names[-1]].tail-target).length


errors={}
targets={1:grip-across*.019+direction*.006,2:grip+across*.019+direction*.006,3:grip+across*.020-direction*.010+Vector((0,-.004,.002))}
for finger,target in targets.items():
    names=[f'finger_R_{finger}_{segment}' for segment in range(1,4)]
    errors[str(finger)]=ccd(names,target)
bpy.context.view_layer.update()
body.data.calc_loop_triangles();labels=body.data.attributes['AnatomicalFinger'].data
pen_vertices=[];pen_faces=[]
for obj in pen.children_recursive:
    if obj.type!='MESH':continue
    ob=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ob.to_mesh();m.calc_loop_triangles();offset=len(pen_vertices)
    pen_vertices.extend(ob.matrix_world@v.co for v in m.vertices);pen_faces.extend(tuple(offset+i for i in t.vertices) for t in m.loop_triangles);ob.to_mesh_clear()
tree=BVHTree.FromPolygons(pen_vertices,pen_faces,all_triangles=True)
search=[]
for finger,radials,axials in [(1,[-.021,-.025,-.029,-.033,-.037],[.002,.010,.018]),(3,[.011,.013,.015,.017],[-.010,-.006,.0])]:
    names=[f'finger_R_{finger}_{segment}' for segment in range(1,4)]
    starting={name:rig.pose.bones[name].matrix_basis.copy() for name in names}
    ids={v.index for v in body.data.vertices if labels[v.index].value==finger}
    faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in ids for i in t.vertices)]
    trials=[]
    for radial in radials:
        for axial in axials:
            for name,matrix in starting.items():rig.pose.bones[name].matrix_basis=matrix
            bpy.context.view_layer.update()
            target=grip+across*radial+direction*axial
            error=ccd(names,target)
            ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();points=[body.matrix_world@v.co for v in mesh.vertices]
            pairs=len(BVHTree.FromPolygons(points,faces,all_triangles=True).overlap(tree))
            gap=min(tree.find_nearest(points[i])[3] for i in ids);ev.to_mesh_clear()
            score=pairs+abs(gap-.0015)*100+error*2
            trials.append((score,{name:rig.pose.bones[name].matrix_basis.copy() for name in names},
                           {'finger':finger,'radial':radial,'axial':axial,'pairs':pairs,'gap':gap,'endError':error}))
    best=min(trials,key=lambda row:row[0])
    for name,matrix in best[1].items():rig.pose.bones[name].matrix_basis=matrix
    bpy.context.view_layer.update();search.append({'selected':best[2],'trials':[row[2] for row in trials]})
    print(json.dumps(best[2]),flush=True)
ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();points=[body.matrix_world@v.co for v in mesh.vertices]
contacts={}
for finger in range(1,6):
    ids={v.index for v in body.data.vertices if labels[v.index].value==finger}
    faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in ids for i in t.vertices)]
    finger_tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
    contacts[str(finger)]={'gapMeters':min(tree.find_nearest(points[i])[3] for i in ids),'intersectingTrianglePairs':len(finger_tree.overlap(tree))}
ev.to_mesh_clear()
pen_to_hand=pen.matrix_basis.inverted()@rig.pose.bones['hand_R'].matrix
report={'schema':'innkeeper-pen-grip-study.v1','inputSha256':w.sha(SOURCE),'fingerEndErrorsMeters':errors,
        'contacts':contacts,'penPosition':list(tip),'penQuaternion':list(orientation),'penToHandMatrix':[list(row) for row in pen_to_hand],
        'fingerQuaternions':{b.name:list(b.rotation_quaternion) for b in rig.pose.bones if b.name.startswith('finger_R_')},
        'contactSearch':search,'humanArtApproved':False,'accepted':False,'builderSha256':w.sha(Path(__file__))}
for name,camera in [('grip','occupation-hands'),('grip-side','occupation-side')]:
    bpy.context.scene.camera=bpy.data.objects[camera];bpy.context.scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'grip.blend'))
(OUT/'builder.py').write_bytes(Path(__file__).read_bytes());report['sourceSha256']=w.sha(OUT/'grip.blend');w.write(OUT/'grip.json',report)
print(json.dumps({'errors':errors,'contacts':contacts}),flush=True)
