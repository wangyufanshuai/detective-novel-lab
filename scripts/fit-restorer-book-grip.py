"""Fit an opposed thumb and lower fingers against the actual closed-book mesh."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'docs/3d-town/classic-residents-v9/pilots/book-01'
bpy.ops.wm.open_mainfile(filepath=str(folder/'restorer-inspect-book.blend'))
body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];book=bpy.data.objects['restorer_bound_book']
bpy.context.scene.frame_set(52);bpy.context.view_layer.update()
basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones};matrices={b.name:b.matrix.copy() for b in rig.pose.bones}
rig.animation_data_clear()
body.data.calc_loop_triangles();book.data.calc_loop_triangles();labels=body.data.attributes['AnatomicalFinger'].data
faces={d:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==d for i in t.vertices)] for d in range(-5,0)}
ids={d:{i for f in ff for i in f} for d,ff in faces.items()}
tree=BVHTree.FromPolygons([v.co for v in book.data.vertices],[tuple(t.vertices) for t in book.data.loop_triangles],all_triangles=True)
transform=book.matrix_world.inverted()@body.matrix_world
rows=[]
for dz in (-.025,-.03,-.035,-.04,-.045,-.05):
    for dx in (.022,.028,.034,.040,.046):
        for angle in (-.1,-.25,-.4,-.55,-.7):
            for name,m in basis.items():rig.pose.bones[name].matrix_basis=m
            bpy.context.view_layer.update()
            m=(Quaternion((0,1,0),-.55).to_matrix()@matrices['hand_L'].to_3x3()).to_4x4();m.translation=matrices['hand_L'].translation+Vector((-dx,0,dz));rig.pose.bones['hand_L'].matrix=m
            bpy.context.view_layer.update()
            thumb=rig.pose.bones['finger_L_1_1'];axis=thumb.matrix.to_3x3().inverted()@Vector((0,1,0))
            thumb.rotation_quaternion=thumb.rotation_quaternion@Quaternion(axis,angle)
            bpy.context.view_layer.update()
            ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
            points=[transform@v.co for v in mesh.vertices]
            contacts={}
            for d,ff in faces.items():
                bvh=BVHTree.FromPolygons(points,ff,all_triangles=True)
                distance,i=min((tree.find_nearest(points[i])[3],i) for i in ids[d])
                contacts[d]={'pairs':len(bvh.overlap(tree)),'gap':distance,'point':list(points[i])}
            ev.to_mesh_clear()
            intersections=sum(v['pairs'] for v in contacts.values())
            thumb=contacts[-1];under=min((v for d,v in contacts.items() if d!=-1),key=lambda v:v['gap'])
            score=intersections*.01+thumb['gap']+under['gap']+max(0,.017-thumb['point'][2])+max(0,under['point'][2]+.017)
            rows.append({'dx':dx,'dz':dz,'thumbAngle':angle,'pairs':intersections,'score':score,'contacts':contacts})
rows.sort(key=lambda r:r['score'])
out=folder/'grip-fit-tilt.json';out.write_text(json.dumps({'candidates':rows},indent=2),encoding='utf-8')
print(json.dumps(rows[:6]))
