"""Locate contact geometry and endpoint pose differences without altering sources."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/3d-town/classic-motion-v2'
cast=json.loads((BASE/'layout-01/cast-candidate.json').read_text(encoding='utf-8'))['entries']
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action.slots:obj.animation_data.action_slot=action.slots[0]
for entry in cast:
 bpy.ops.wm.open_mainfile(filepath=str(BASE/'step-02'/entry['actorId']/'resident.blend'))
 manifest=json.loads((ROOT/('public'+entry['manifestUrl'])).read_text(encoding='utf-8'))
 rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];root=bpy.data.objects['movement_actor']
 bind(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 idle={b.name:b.matrix_basis.copy()for b in rig.pose.bones}
 print(json.dumps({'actor':entry['actorId'],'idleLegs':{n:{'head':list(rig.pose.bones[n].head),'tail':list(rig.pose.bones[n].tail)}for n in ['pelvis','thigh_L','shin_L','foot_L','tail_L']if n in rig.pose.bones}}),flush=True)
 bind(rig,bpy.data.actions['BackAway']);bind(root,bpy.data.actions['BackAway_Origin']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 errors={b.name:max(abs(b.matrix_basis[i][j]-idle[b.name][i][j])for i in range(4)for j in range(4))for b in rig.pose.bones}
 print(json.dumps({'endpointDifferences':{k:v for k,v in errors.items()if v>.0001}}),flush=True)
 targets=['restorer_book_stand']if entry['actorId']=='resident-03'else['registration_desk_top']if entry['actorId']=='resident-08'else[]
 for frame in [1,9,17,25,33,41,49]:
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();e=body.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles()
  points=[e.matrix_world@v.co for v in m.vertices];tris=[tuple(t.vertices)for t in m.loop_triangles];tree=BVHTree.FromPolygons(points,tris,all_triangles=True)
  for name in targets:
   obj=bpy.data.objects.get(name)
   if not obj:continue
   oe=obj.evaluated_get(dg);om=oe.to_mesh();om.calc_loop_triangles();ot=[tuple(t.vertices)for t in om.loop_triangles];op=[oe.matrix_world@v.co for v in om.vertices]
   hits=tree.overlap(BVHTree.FromPolygons(op,ot,all_triangles=True));indices=set(i for a,b in hits for i in tris[a]);weights={}
   for index in indices:
    for group in body.data.vertices[index].groups:
     label=body.vertex_groups[group.group].name;weights[label]=weights.get(label,0)+group.weight
   if indices:print(json.dumps({'frame':frame,'target':name,'contacts':len(hits),'center':list(sum((points[i]for i in indices),Vector())/len(indices)),'weights':sorted(weights.items(),key=lambda p:-p[1])[:8],'bounds':[[min(points[i][axis]for i in indices),max(points[i][axis]for i in indices)]for axis in range(3)]}),flush=True)
   oe.to_mesh_clear()
  e.to_mesh_clear()
