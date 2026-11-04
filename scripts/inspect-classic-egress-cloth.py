"""Check new poses for garment/leg intersections and the modified inn work fit."""
from pathlib import Path
import bpy,argparse,hashlib,json,math,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-04');p.add_argument('--step',type=float,default=2);p.add_argument('--formal',action='store_true');p.add_argument('--actor');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
P=BASE/args.pilot
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
if args.formal:
 args.step=.5;fn=read(P/'route-mesh-diagnostic.json');assert fn['passed']and fn['complete']
 assert fn.get('selectedActor')==args.actor,'Form must match the completed Function scope.'
 route_file=ROOT/fn['routeFile'] if fn.get('routeFile') else P/'routes.json'
 assert fn['routesSha256']==sha(route_file)
 for name,value in fn['sourceHashes'].items():assert sha(ROOT/name)==value,name
rows=[];cape_self_checked=False
for entry in read(BASE/'layout-01/cast-candidate.json')['entries']:
 if args.actor and entry['actorId']!=args.actor:continue
 source=P/entry['actorId']/'resident.blend';assert sha(source)==read(source.parent/'authoring-review.json')['sourceSha256']
 manifest=read(ROOT/('public'+entry['manifestUrl']));bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects[manifest['id']+'_skin'];rig=bpy.data.objects[manifest['id']+'_rig'];root=bpy.data.objects['movement_actor']
 mesh=body.data;mesh.calc_loop_triangles();triangles=[tuple(t.vertices)for t in mesh.loop_triangles];materials=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
 weights={v.index:{body.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.vertices}
 legs={i for i,w in weights.items()if sum(value for name,value in w.items()if name.startswith(('thigh_','shin_')))>.5}
 tails={i for i,w in weights.items()if sum(value for name,value in w.items()if name.startswith('tail_'))>.4}
 skin={i for t,m in zip(triangles,materials)if m.startswith('skin')for i in t}
 hands={i for i,w in weights.items()if i in skin and sum(value for name,value in w.items()if name.startswith(('hand_','finger_')))>.5}
 digits=mesh.attributes['AnatomicalFinger'].data
 groups={'legs':[t for t in triangles if all(i in legs for i in t)],
  'skirt':[t for t,m in zip(triangles,materials)if m.startswith('trousers')and all(i in tails and .15<mesh.vertices[i].co.z<.94 for i in t)],
  'fingers':[t for t in triangles if all(digits[i].value!=0 for i in t)],'garment':[t for t in triangles if not any(i in hands for i in t)]}
 # The hand mesh shares its wrist boundary with the forearm. Testing that
 # shared seam reports contact in every pose; anatomical fingers have no such
 # boundary with garments and retain the previous work-review classification.
 pairs=[('fingers','garment')]
 if groups['skirt']:pairs.append(('skirt','legs'))
 if entry['actorId']=='resident-03':
  groups['apron']=[t for t,m in zip(triangles,materials)if m.startswith('accent')and all(i in tails and .15<mesh.vertices[i].co.z<.94 for i in t)]
  pairs.append(('apron','skirt'))
  tool_vertices={i for t,m in zip(triangles,materials)if m.startswith('leather')for i in t if .7<mesh.vertices[i].co.z<1.02 and sum(v for n,v in weights[i].items()if n.startswith('tail_'))>.05}
  groups['apronTools']=[t for t in triangles if all(i in tool_vertices for i in t)]
  pairs.extend([('apronTools','apron'),('apronTools','skirt')])
 if 'ArtClothLayer'in mesh.attributes and entry['actorId']=='resident-08':
  attr=mesh.attributes['ArtClothLayer'].data
  for name,value in [('blouse',1),('cape',2)]:groups[name]=[t for t in triangles if all(attr[i].value==value for i in t)]
  pairs.append(('blouse','cape'))
  cape_sets=[set(t)for t in groups['cape']];cape_self_checked=True
 if 'UniformPart'in mesh.attributes:
  attr=mesh.attributes['UniformPart'].data
  for name,value in [('uniform_trousers',1),('uniform_jacket',3)]:groups[name]=[t for t in triangles if all(attr[i].value==value for i in t)]
  pairs.append(('uniform_trousers','uniform_jacket'))
 desk_tree=None
 if entry['actorId']=='resident-08':
  desk=bpy.data.objects['registration_desk_top'];e=desk.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();desk_tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[tuple(t.vertices)for t in m.loop_triangles],all_triangles=True);e.to_mesh_clear()
 meta=read(source.parent/'authoring-review.json');clips=[(c['clip'],c['frames']-1)for c in meta['clips']]
 clips.extend([('Idle',90),('Walk',24),(manifest['workAction']['clip'],round(manifest['workAction']['durationSeconds']*30))])
 for clip,count in clips:
  bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions.get(clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0)
  maxima={a+'__'+b:0 for a,b in pairs};first={};contact_rows=[];desk_max=0;desk_first=None
  if 'cape'in groups:maxima['cape__self']=0
  for n in range(round(count/args.step)+1):
   frame=1+n*args.step;bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices]
   trees={name:BVHTree.FromPolygons(points,faces,all_triangles=True)for name,faces in groups.items()if faces};values={}
   for a,b in pairs:
    key=a+'__'+b;hits=trees[a].overlap(trees[b]);values[key]=len(hits);maxima[key]=max(maxima[key],len(hits))
    if hits and key not in first:first[key]={'frame':frame,'pairs':len(hits)}
   if 'cape'in trees:
    hits=[(a,b)for a,b in trees['cape'].overlap(trees['cape'])if a<b and not cape_sets[a]&cape_sets[b]]
    key='cape__self';values[key]=len(hits);maxima[key]=max(maxima[key],len(hits))
    if hits and key not in first:first[key]={'frame':frame,'pairs':len(hits)}
   desk_hits=0
   if desk_tree and clip in ('Idle','ReconcileRegister'):
    world=[e.matrix_world@v.co for v in m.vertices];desk_pairs=desk_tree.overlap(BVHTree.FromPolygons(world,triangles,all_triangles=True));desk_hits=len(desk_pairs);desk_max=max(desk_max,desk_hits)
    if desk_pairs and desk_first is None:
     from collections import Counter
     hit_ids={i for a,b in desk_pairs for i in triangles[b]}
     desk_first={'frame':frame,'materials':dict(Counter(materials[b]for a,b in desk_pairs)),
      'dominantBones':dict(Counter(max(weights[i],key=weights[i].get)for i in hit_ids)),
      'worldBounds':[[min(world[i][axis]for i in hit_ids),max(world[i][axis]for i in hit_ids)]for axis in range(3)]}
   if any(values.values())or desk_hits:contact_rows.append({'frame':frame,'pairs':values,'deskPairs':desk_hits})
   e.to_mesh_clear()
  row={'actorId':entry['actorId'],'clip':clip,'sourceSha256':sha(source),'samples':round(count/args.step)+1,'maxima':maxima,'firstContacts':first,'maximumDeskPairs':desk_max,'firstDeskContact':desk_first,'contacts':contact_rows};rows.append(row)
  print(json.dumps({k:v for k,v in row.items()if k!='contacts'}),flush=True)
report={'schema':'classic-egress-cloth.v2','complete':True,'selectedActor':args.actor,'rows':rows,'passed':len(rows)==(6 if args.actor else 18) and all(not any(r['maxima'].values())and not r['maximumDeskPairs']for r in rows),'stepFrames':args.step,'inspectorSha256':sha(Path(__file__)),'humanApproved':False,'formal':args.formal,'capeSelfContactChecked':cape_self_checked,
 'scope':'Sampled source surfaces: anatomical fingers/garment, skirt/legs, apron/skirt, worn apron tools against both layers, uniform jacket/trousers or cape/blouse; revised inn Idle and writing fit against desk. Cape self-contact includes the outer sheet, inner lining and joined rim, excluding only pairs sharing vertex indices. Includes retained Idle, Walk and work for every selected actor. Shared wrist seam and lower skirt hem below 15 cm are excluded. Not continuous collision, trim self-contact, full anatomy, runtime blending or human acceptance.'}
if args.formal:report['functionReviewSha256']=sha(P/'route-mesh-diagnostic.json')
suffix='-'+args.actor if args.actor else ''
(P/('cloth-form-review.json'if args.formal else'cloth-diagnostic'+suffix+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(P/('cloth-inspector-formal.py'if args.formal else'cloth-inspector-diagnostic'+suffix+'.py')).write_bytes(Path(__file__).read_bytes())
print(json.dumps({'passed':report['passed'],'clips':len(rows)}),flush=True)
