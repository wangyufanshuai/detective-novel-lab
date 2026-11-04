"""Background Blender diagnostic: current walking sources against the authored room."""
from pathlib import Path
import bpy, hashlib, json, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/classic-motion-v1'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
routes=read(P/'routes.json');cast=read(ROOT/'public/assets/classic-occupations/v2/cast.json')['entries']
sources={'resident-03':ROOT/'docs/3d-town/classic-residents-v10/resident-03/rb-xu-zhiwei.blend',
 'resident-06':ROOT/'docs/3d-town/classic-occupations-v1/resident-06/gesture-09/occupation.blend',
 'resident-08':ROOT/'docs/3d-town/classic-occupations-v1/resident-08/gesture-14/occupation.blend'}
room=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend'
vertices=[];faces=[];owners=[]
def collect(objects,shift=Vector((0,0,0))):
 dg=bpy.context.evaluated_depsgraph_get()
 for obj in objects:
  if obj.type not in ('MESH','CURVE','FONT'):continue
  e=obj.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles();off=len(vertices)
  vertices.extend(e.matrix_world@v.co+shift for v in m.vertices)
  faces.extend(tuple(off+i for i in t.vertices) for t in m.loop_triangles);owners.extend(obj.name for t in m.loop_triangles);e.to_mesh_clear()
bpy.ops.wm.open_mainfile(filepath=str(room));bpy.context.scene.frame_set(1)
collect([o for o in bpy.context.scene.objects if o.get('layer') not in ('actor','review_resident')])
for e in cast:
 bpy.ops.wm.open_mainfile(filepath=str(sources[e['actorId']]));bpy.context.scene.frame_set(1)
 if e['actorId']=='resident-03':
  workplace=bpy.data.objects['restorer_workstation'];collect([workplace,*workplace.children_recursive],Vector((*e['position'],routes['floor'])))
 else:
  workplace=bpy.data.objects['occupation_workplace'];collect([workplace,*workplace.children_recursive])
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True);rows=[];ground=[]
for e in cast:
 manifest=read(ROOT/('public'+e['manifestUrl']));source=sources[e['actorId']];assert sha(source)==manifest['sourceSha256']
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin']
 origin=rig.matrix_world.translation.copy();assert max(abs(v) for v in rig.matrix_world.to_euler())<1e-6
 foot_groups={side:body.vertex_groups['foot_'+side].index for side in ('L','R')}
 feet={side:[v.index for v in body.data.vertices if any(g.group==group and g.weight>.5 for g in v.groups)] for side,group in foot_groups.items()}
 action=bpy.data.actions['Walk'];rig.animation_data_create();rig.animation_data.action=action
 if action.slots:rig.animation_data.action_slot=action.slots[0]
 for route in [r for r in routes['routes'] if r['passage']['actorId']==e['actorId']]:
  distance=0;frames=[];sole_samples=[];sample_count=0
  for index,row in enumerate(route['trace']):
   distance+=row['moved']
   if index%6 and index!=len(route['trace'])-1:continue
   sample_count+=1
   frame=1+(distance/manifest['animation']['strideMeters']*24)%24
   bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));dg=bpy.context.evaluated_depsgraph_get()
   evaluated=body.evaluated_get(dg);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
   rotation=Matrix.Rotation(row['yaw'],4,'Z');offset=Vector((*row['position'],routes['floor']))
   points=[rotation@(evaluated.matrix_world@v.co-origin)+offset for v in mesh.vertices]
   gaps={}
   for side,ids in feet.items():
    probes=sorted((points[i] for i in ids),key=lambda p:p.z)[:24];values=[]
    for point in probes:
     support=tree.ray_cast(Vector((point.x,point.y,.4)),Vector((0,0,-1)),.6)[0]
     if support is not None:values.append(point.z-support.z)
    gaps[side]=min(values) if values else None
   sole_samples.append({'time':row['t'],'minimumSoleGap':gaps})
   # Sole/floor contact is measured separately. Keep all anatomy above 6 cm,
   # including the moving feet when lifted, in the room-intersection probe.
   triangles=[tuple(t.vertices) for t in mesh.loop_triangles if min(points[i].z for i in t.vertices)>routes['floor']+.06]
   body_tree=BVHTree.FromPolygons(points,triangles,all_triangles=True)
   hits=tree.overlap(body_tree);objects={}
   for a,b in hits:objects[owners[a]]=objects.get(owners[a],0)+1
   if objects:frames.append({'time':row['t'],'position':row['position'],'yaw':row['yaw'],'objects':objects})
   ray=tree.ray_cast(Vector((*row['position'],routes['floor']+.12)),Vector((0,0,-1)),.6)
   if ray[0] is not None:ground.append({'position':row['position'],'surface':owners[ray[2]],'surfaceZ':ray[0].z,'originGap':routes['floor']-ray[0].z})
   evaluated.to_mesh_clear()
  item={'passage':route['passage'],'samples':sample_count,'contacts':frames,'soleSamples':sole_samples}
  rows.append(item);print(json.dumps({'actor':e['actorId'],'scene':route['passage']['sceneId'],'kind':route['passage']['kind'],'contactSamples':len(frames),'first':frames[:2]}),flush=True)
report={'sourceHashes':{str(p.relative_to(ROOT)):sha(p) for p in [room,*sources.values()]},'routesSha256':sha(P/'routes.json'),'inspectorSha256':sha(Path(__file__)),
 'rows':rows,'groundSamples':ground,'passed':not any(r['contacts'] for r in rows),'humanApproved':False,
 'scope':'Source Walk poses sampled at 10 Hz along renderer routes against source room and current workplace triangles. Sole contact below 6 cm is excluded from overlaps; 24 lowest weighted foot vertices per foot are probed separately. A point origin gap is not proof of floating shoes. Not continuous collision or runtime-blend proof.'}
(P/'mesh-diagnostic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'groundGapMin':min(g['originGap'] for g in ground),'groundGapMax':max(g['originGap'] for g in ground)}),flush=True)
