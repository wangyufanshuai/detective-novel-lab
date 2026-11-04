"""Inspect the retained inn body and desk before making a localized fit change."""
from pathlib import Path
import bpy,json
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/3d-town/classic-motion-v2/step-03/resident-08/resident.blend'))
rig=bpy.data.objects['rb-lin-ali_rig'];body=bpy.data.objects['rb-lin-ali_skin'];desk=bpy.data.objects['registration_desk_top']
e=desk.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[tuple(t.vertices)for t in m.loop_triangles],all_triangles=True);e.to_mesh_clear()
for clip in ('Idle','ReconcileRegister'):
 rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=bpy.data.actions[clip].slots[0]
 frames=(1,16,31,46,61,76,91)if clip=='Idle'else(1,31,61,91,121,151,181,211,241,271,301)
 for frame in frames:
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();tris=[tuple(t.vertices)for t in m.loop_triangles];v=[e.matrix_world@x.co for x in m.vertices]
  hits=tree.overlap(BVHTree.FromPolygons(v,tris,all_triangles=True));indices=set(i for a,b in hits for i in tris[b]);materials=Counter(body.data.materials[body.data.polygons[m.loop_triangles[b].polygon_index].material_index].name for a,b in hits)
  rest_bounds=[[min(body.data.vertices[i].co[a]for i in indices),max(body.data.vertices[i].co[a]for i in indices)]for a in range(3)]if indices else None
  print(json.dumps({'clip':clip,'frame':frame,'contacts':len(hits),'materials':dict(materials),'restBounds':rest_bounds}),flush=True);e.to_mesh_clear()
print(json.dumps({'bodyMaterials':[m.name for m in body.data.materials],'attributes':[(a.name,a.domain,a.data_type)for a in body.data.attributes]}),flush=True)
