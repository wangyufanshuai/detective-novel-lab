"""Source mesh Function diagnostic for all candidate resident routes."""
from pathlib import Path
import bpy,argparse,hashlib,json,math,sys
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-04');p.add_argument('--stride',type=int,default=6);p.add_argument('--actor');p.add_argument('--reference-pilot');p.add_argument('--route-pilot');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
P=BASE/args.pilot
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
route_file=(BASE/args.route_pilot if args.route_pilot else P)/'routes.json'
routes=read(route_file);assert routes['passed'];cast=read(BASE/'layout-01/cast-candidate.json')['entries'];room=BASE/'layout-01/room.blend'
assert not args.actor or args.actor in {r['actorId']for r in cast}
for name,value in routes['sourceHashes'].items():assert sha(ROOT/name)==value,name
vertices=[];faces=[];owners=[]
def collect(objects,shift=Vector((0,0,0))):
 dg=bpy.context.evaluated_depsgraph_get()
 for obj in objects:
  if obj.type not in ('MESH','CURVE','FONT'):continue
  e=obj.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles();off=len(vertices)
  vertices.extend(e.matrix_world@v.co+shift for v in m.vertices);faces.extend(tuple(off+i for i in t.vertices)for t in m.loop_triangles);owners.extend(obj.name for _ in m.loop_triangles);e.to_mesh_clear()
bpy.ops.wm.open_mainfile(filepath=str(room));bpy.context.scene.frame_set(1)
collect([o for o in bpy.context.scene.objects if not o.get('runtimeExcluded')and o.get('layer')not in ('actor','review_resident')])
sources=[]
for entry in cast:
 folder=BASE/args.reference_pilot if args.actor and entry['actorId']!=args.actor and args.reference_pilot else P
 source=folder/entry['actorId']/'resident.blend';assert sha(source)==read(source.parent/'authoring-review.json')['sourceSha256'];sources.append(source)
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 origin=bpy.data.objects['movement_actor'].matrix_world.translation.copy();work=bpy.data.objects['restorer_workstation'if entry['actorId']=='resident-03'else'occupation_workplace']
 collect([work,*work.children_recursive],Vector((*entry['position'],routes['floor']))-origin)
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True);rows=[]
report={'schema':'classic-egress-route-mesh.v1','complete':False,'passed':False,'sourceHashes':{str(s.relative_to(ROOT)):sha(s)for s in [room,*sources]},'inspectorSha256':sha(Path(__file__)),'routesSha256':sha(route_file),'routeFile':route_file.relative_to(ROOT).as_posix(),'selectedActor':args.actor,'sampleStride':args.stride,'rows':rows,'humanApproved':False,
 'scope':'Authored body/root and existing Walk source poses against the revised actual room/workplace mesh. Nominal 10 Hz plus every clip boundary. No transition blending, continuous collision or browser acceptance.'}
for entry,source in zip(cast,sources):
 if args.actor and entry['actorId']!=args.actor:continue
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1);bpy.context.view_layer.update();manifest=read(ROOT/('public'+entry['manifestUrl']))
 rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];root=bpy.data.objects['movement_actor'];origin=root.matrix_world.translation.copy()
 for route in [r for r in routes['routes']if r['passage']['actorId']==entry['actorId']]:
  trace=route['trace'];contacts=[];samples=0;selected=set(range(0,len(trace),args.stride));selected.add(len(trace)-1)
  for i in range(1,len(trace)):
   if trace[i]['clip']!=trace[i-1]['clip']:selected.update([i-1,i])
  active=None
  for index in sorted(selected):
   row=trace[index];clip=row['clip']
   if active!=clip:
    bind(rig,bpy.data.actions[clip]);bind(root,None if clip=='Walk'else bpy.data.actions[clip+'_Origin']);root.location=(0,0,0);root.rotation_euler=(0,0,0);active=clip
   frame=row['frame'];bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
   e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();rotation=Matrix.Rotation(row['baseYaw'],4,'Z');offset=Vector((*row['basePosition'],routes['floor']))
   points=[rotation@(e.matrix_world@v.co-origin)+offset for v in m.vertices];triangles=[tuple(t.vertices)for t in m.loop_triangles if min(points[i].z for i in t.vertices)>routes['floor']+.06]
   hits=tree.overlap(BVHTree.FromPolygons(points,triangles,all_triangles=True));found={}
   for a,b in hits:found[owners[a]]=found.get(owners[a],0)+1
   if found:contacts.append({'time':row['t'],'clip':clip,'frame':frame,'position':row['position'],'objects':found})
   e.to_mesh_clear();samples+=1
  rows.append({'passage':route['passage'],'samples':samples,'contacts':contacts})
  print(json.dumps({'actor':entry['actorId'],'scene':route['passage']['sceneId'],'kind':route['passage']['kind'],'contactSamples':len(contacts),'first':contacts[:1]}),flush=True)
  (P/'route-mesh-diagnostic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report['complete']=True;report['passed']=len(rows)==(14 if args.actor else 42) and all(not r['contacts']for r in rows)
(P/'route-mesh-diagnostic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(P/'route-inspector.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'passed':report['passed'],'routes':len(rows),'samples':sum(r['samples']for r in rows)}),flush=True)
