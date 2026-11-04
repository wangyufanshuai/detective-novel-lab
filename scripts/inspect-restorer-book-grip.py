"""Read-only contact measurements from a retained pilot, in book coordinates."""
from pathlib import Path
import bpy,json,sys
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
pilot=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'book-01'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'docs/3d-town/classic-residents-v9/pilots/{pilot}/restorer-inspect-book.blend'))
body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];book=bpy.data.objects['restorer_bound_book']
bpy.context.scene.frame_set(int(sys.argv[sys.argv.index('--')+2]) if '--' in sys.argv and len(sys.argv)>sys.argv.index('--')+2 else 52);bpy.context.view_layer.update()
ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
transform=book.matrix_world.inverted()@body.matrix_world
points=[transform@v.co for v in mesh.vertices]
body.data.calc_loop_triangles();book.data.calc_loop_triangles()
faces=[tuple(t.vertices) for t in book.data.loop_triangles]
tree=BVHTree.FromPolygons([v.co for v in book.data.vertices],faces,all_triangles=True)
labels=body.data.attributes['AnatomicalFinger'].data
rows=[]
for side in (-1,1):
    for digit in range(1,6):
        ids={v.index for v in body.data.vertices if labels[v.index].value==side*digit}
        tris=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in ids for i in t.vertices)]
        bvh=BVHTree.FromPolygons(points,tris,all_triangles=True)
        near=sorted((tree.find_nearest(points[i])[3],i) for i in ids)[:3]
        rows.append({'side':side,'digit':digit,'intersectionPairs':len(bvh.overlap(tree)),
            'bounds':[[min(points[i][axis] for i in ids),max(points[i][axis] for i in ids)] for axis in range(3)],
            'nearest':[{'distance':d,'vertex':i,'bookSpace':list(points[i])} for d,i in near]})
angles={}
for side in ('L','R'):
    q={name:(rig.pose.bones[name+'_'+side].matrix.to_quaternion()@rig.data.bones[name+'_'+side].matrix_local.to_quaternion().inverted()) for name in ('upperarm','forearm','hand')}
    angles[side]={a+'_'+b:q[a].rotation_difference(q[b]).angle for a,b in [('upperarm','forearm'),('forearm','hand')]}
skin_ids={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
hg={g.index for g in body.vertex_groups if g.name.startswith(('hand_','finger_'))}
hi={v.index for v in body.data.vertices if v.index in skin_ids and sum(g.weight for g in v.groups if g.group in hg)>.5}
garment=[t for t in body.data.loop_triangles if not any(i in hi for i in t.vertices)]
gt=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in garment],all_triangles=True)
collisions=[]
for d in list(range(-5,0))+list(range(1,6)):
    ff=[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==d for i in t.vertices)]
    ft=BVHTree.FromPolygons(points,ff,all_triangles=True)
    for a,b in ft.overlap(gt):
        tr=garment[b];collisions.append({'digit':d,'material':body.data.materials[tr.material_index].name,'restCenter':list(sum((body.data.vertices[i].co for i in tr.vertices),__import__('mathutils').Vector())/3)})
print(json.dumps({'scale':list(rig.scale),'rows':rows,'angles':angles,'garmentContacts':collisions}))
ev.to_mesh_clear()
