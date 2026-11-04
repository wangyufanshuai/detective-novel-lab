"""Report surface distance for the restorer's three worn tools."""
from pathlib import Path
import bpy,json,sys,argparse,hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-12');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);P=ROOT/'docs/3d-town/classic-motion-v2'/a.pilot;source=P/'resident-03/resident.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];mesh=body.data;mesh.calc_loop_triangles();tails={v.index for v in mesh.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith('tail_'))>.05}
tris=[tuple(t.vertices)for t in mesh.loop_triangles];mats=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
apron=[t for t,m in zip(tris,mats)if m.startswith('accent')and all(i in tails for i in t)];tools={i for t,m in zip(tris,mats)if m.startswith('leather')for i in t if i in tails and .7<mesh.vertices[i].co.z<1.02};groups={name:[i for i in tools if test(mesh.vertices[i].co.x)]for name,test in [('left_brush',lambda x:x<0),('right_brush',lambda x:0<x<.08),('book_spine',lambda x:x>.08)]};rows=[]
for clip,frames in [('Idle',[1]),('Walk',[1,7,13,19,25])]:
 action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 for f in frames:
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices];e.to_mesh_clear();tree=BVHTree.FromPolygons(points,apron,all_triangles=True)
  for name,indices in groups.items():
   center=sum((points[i]for i in indices),Vector())/len(indices);hit,normal,index,distance=tree.find_nearest(center);rows.append({'clip':clip,'frame':f,'tool':name,'vertices':len(indices),'center':list(center),'nearestApronPoint':list(hit),'distanceMeters':distance,'localYGap':center.y-hit.y})
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'rows':rows,'scope':'Tool centers to closest sampled apron surface, including patch pocket; not exact attachment or intersection acceptance.'};(P/'apron-tool-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report),flush=True)
