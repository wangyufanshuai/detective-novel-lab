"""Evaluate authored entry/exit poses against the revised room and supports."""
from pathlib import Path
import bpy,argparse,hashlib,json,math,sys
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2';LAYOUT=BASE/'layout-01'
parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='step-02');parser.add_argument('--step',type=float,default=2);parser.add_argument('--actor');parser.add_argument('--reference-pilot');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
P=BASE/args.pilot
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action.slots:obj.animation_data.action_slot=action.slots[0]
vertices=[];faces=[];owners=[]
def collect(objects,shift=Vector((0,0,0))):
 dg=bpy.context.evaluated_depsgraph_get()
 for obj in objects:
  if obj.type not in ('MESH','CURVE','FONT'):continue
  e=obj.evaluated_get(dg);m=e.to_mesh();m.calc_loop_triangles();offset=len(vertices)
  vertices.extend(e.matrix_world@v.co+shift for v in m.vertices)
  faces.extend(tuple(offset+i for i in t.vertices)for t in m.loop_triangles);owners.extend(obj.name for _ in m.loop_triangles);e.to_mesh_clear()
cast=read(LAYOUT/'cast-candidate.json')['entries'];room=LAYOUT/'room.blend';bpy.ops.wm.open_mainfile(filepath=str(room));bpy.context.scene.frame_set(1)
assert not args.actor or args.actor in {e['actorId']for e in cast}
collect([o for o in bpy.context.scene.objects if not o.get('runtimeExcluded')and o.get('layer')not in ('actor','review_resident')])
sources=[]
for entry in cast:
 folder=BASE/args.reference_pilot if args.actor and entry['actorId']!=args.actor and args.reference_pilot else P
 source=folder/entry['actorId']/'resident.blend';assert sha(source)==read(source.parent/'authoring-review.json')['sourceSha256'];sources.append(source)
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 origin=bpy.data.objects['movement_actor'].matrix_world.translation.copy();workplace=bpy.data.objects['restorer_workstation'if entry['actorId']=='resident-03'else'occupation_workplace']
 collect([workplace,*workplace.children_recursive],Vector((*entry['position'],.18))-origin)
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True);rows=[]
for entry,source in zip(cast,sources):
 if args.actor and entry['actorId']!=args.actor:continue
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(1);bpy.context.view_layer.update();meta=read(source.parent/'authoring-review.json')
 manifest=read(ROOT/('public'+entry['manifestUrl']));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];root=bpy.data.objects['movement_actor'];origin=root.matrix_world.translation.copy()
 bind(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);rest={b.name:b.matrix_basis.copy()for b in rig.pose.bones}
 groups={side:body.vertex_groups['foot_'+side].index for side in ('L','R')}
 feet={side:[v.index for v in body.data.vertices if any(g.group==group and g.weight>.5 for g in v.groups)]for side,group in groups.items()}
 for phase,clip,base_yaw in [('retreat','BackAway',0),('turn-away','TurnLeft',0),('turn-to-work','TurnLeft',math.pi/2),('approach','ApproachWork',0)]:
  spec=next(c for c in meta['clips']if c['clip']==clip);bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions[spec['originClip']])
  rotation=Matrix.Rotation(base_yaw,4,'Z');offset=Vector((*entry['position'],.18));offset.y+=0 if phase=='retreat'else entry['retreatMeters']
  frames=sorted(set([1+i*args.step for i in range(math.floor((spec['frames']-1)/args.step)+1)]+[spec['frames']]))
  contacts=[];support=[];anchors={};max_drift=0;endpoint_error=0;planted_gaps=[]
  for frame in frames:
   bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   evaluated=body.evaluated_get(dg);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
   points=[rotation@(evaluated.matrix_world@v.co-origin)+offset for v in mesh.vertices]
   triangles=[tuple(t.vertices)for t in mesh.loop_triangles if min(points[i].z for i in t.vertices)>.24]
   hits=tree.overlap(BVHTree.FromPolygons(points,triangles,all_triangles=True));found={}
   for a,b in hits:found[owners[a]]=found.get(owners[a],0)+1
   if found:contacts.append({'frame':frame,'objects':found})
   gaps={};q=(frame-1)/(spec['frames']-1);q=1-q if clip=='ApproachWork'else q
   for side,indices in feet.items():
    values=[]
    for point in sorted((points[i]for i in indices),key=lambda p:p.z)[:24]:
     hit=tree.ray_cast(Vector((point.x,point.y,.4)),Vector((0,0,-1)),.6)[0]
     if hit is not None:values.append(point.z-hit.z)
    gaps[side]=min(values)if values else None
    if 'feet'in spec['rootMotion'][0]:
     index=min(spec['frames']-2,int(frame-1));left=spec['rootMotion'][index]['feet'][side];right=spec['rootMotion'][index+1]['feet'][side]
     region=round(left['progress'],6)if left['planted']and right['planted']and abs(left['progress']-right['progress'])<1e-8 else None
    else:
     a,b=(.08,.46)if side=='L'else(.50,.90);region='initial'if q<=a else'landed'if q>=b else None
    if region is not None:
     point=rotation@(rig.matrix_world@rig.pose.bones['foot_'+side].head-origin)+offset;key=(side,region)
     if key not in anchors:anchors[key]=point
     max_drift=max(max_drift,(point-anchors[key]).length)
     if gaps[side]is not None:planted_gaps.append(gaps[side])
   support.append({'frame':frame,'minimumSoleGap':gaps})
   if frame in (1,spec['frames']):endpoint_error=max(endpoint_error,max(abs(a-b)for bone in rig.pose.bones for a,b in zip([v for row in bone.matrix_basis for v in row],[v for row in rest[bone.name]for v in row])))
   evaluated.to_mesh_clear()
  item={'actorId':entry['actorId'],'phase':phase,'samples':len(frames),'contacts':contacts,'support':support,'maximumPlantedAnkleDrift':max_drift,'maximumAbsolutePlantedSoleGap':max(map(abs,planted_gaps),default=None),'maximumIdleEndpointMatrixDifference':endpoint_error}
  rows.append(item);print(json.dumps({'actor':entry['actorId'],'phase':phase,'contactSamples':len(contacts),'drift':max_drift,'endpointError':endpoint_error,'first':contacts[:1]}),flush=True)
report={'complete':True,'selectedActor':args.actor,'sourceHashes':{str(p.relative_to(ROOT)):sha(p)for p in [room,*sources]},'inspectorSha256':sha(Path(__file__)),'castSha256':sha(LAYOUT/'cast-candidate.json'),
 'stepFrames':args.step,'rows':rows,'passed':len(rows)==(4 if args.actor else 12) and all(not r['contacts']and r['maximumPlantedAnkleDrift']<.004 and r['maximumAbsolutePlantedSoleGap']is not None and r['maximumAbsolutePlantedSoleGap']<.003 and r['maximumIdleEndpointMatrixDifference']<.001 for r in rows),
 'scope':'Saved authored root and rig poses against the revised static room and workplaces. Planted ankle drift and lowest weighted boot vertices are measured. Not runtime-blend, continuous collision or self-cloth acceptance.','humanApproved':False}
(P/'pose-diagnostic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(P/'pose-inspector.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'passed':report['passed'],'phases':len(rows)}),flush=True)
