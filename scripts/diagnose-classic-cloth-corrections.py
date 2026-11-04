"""Locate sampled garment defects and contact-foot errors without editing sources."""
from pathlib import Path
import bpy, json, math, hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/classic-motion-v2/step-05'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
def frame(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
def bounds(points):return [[min(p[a] for p in points),max(p[a] for p in points)]for a in range(3)]if points else None
rows=[]
for entry in read(P.parent/'layout-01/cast-candidate.json')['entries']:
 source=P/entry['actorId']/'resident.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
 manifest=read(ROOT/('public'+entry['manifestUrl']));body=bpy.data.objects[manifest['id']+'_skin'];rig=bpy.data.objects[manifest['id']+'_rig'];root=bpy.data.objects['movement_actor']
 mesh=body.data;mesh.calc_loop_triangles();tris=[tuple(t.vertices)for t in mesh.loop_triangles];mats=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
 weights={v.index:{body.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.vertices}
 legs={i for i,w in weights.items()if sum(v for n,v in w.items()if n.startswith(('thigh_','shin_')))>.5}
 tails={i for i,w in weights.items()if sum(v for n,v in w.items()if n.startswith('tail_'))>.4}
 groups={'legs':[t for t in tris if all(i in legs for i in t)],'skirt':[t for t,m in zip(tris,mats)if m.startswith('trousers')and all(i in tails and .22<mesh.vertices[i].co.z<.88 for i in t)],'apron':[t for t,m in zip(tris,mats)if m.startswith('accent')and all(i in tails and .22<mesh.vertices[i].co.z<.88 for i in t)]}
 if 'UniformPart'in mesh.attributes:
  a=mesh.attributes['UniformPart'].data
  for name,value in [('uniform_trousers',1),('uniform_jacket',3)]:groups[name]=[t for t in tris if all(a[i].value==value for i in t)]
 contacts=[]
 for old in read(P/'cloth-form-review.json')['rows']:
  if old['actorId']!=entry['actorId']:continue
  for pair,maximum in old['maxima'].items():
   if not maximum:continue
   sample=max(old['contacts'],key=lambda r:r['pairs'][pair]);f=sample['frame'];a,b=pair.split('__')
   bind(rig,bpy.data.actions[old['clip']]);bind(root,bpy.data.actions.get(old['clip']+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0);frame(f)
   e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices]
   hits=BVHTree.FromPolygons(points,groups[a],all_triangles=True).overlap(BVHTree.FromPolygons(points,groups[b],all_triangles=True))
   ids=[set(i for h in hits for i in groups[name][h[side]])for side,name in enumerate((a,b))]
   shared=sum(bool(set(groups[a][ia])&set(groups[b][ib]))for ia,ib in hits)
   result={'clip':old['clip'],'frame':f,'pair':pair,'count':len(hits),'sharedVertexPairs':shared,'contactBounds':[bounds([points[i]for i in subset])for subset in ids],
    'contactRestBounds':[bounds([mesh.vertices[i].co for i in subset])for subset in ids],
    'triangles':[{'a':list(groups[a][ia]),'b':list(groups[b][ib]),'aPoints':[list(points[i])for i in groups[a][ia]],'bPoints':[list(points[i])for i in groups[b][ib]]}for ia,ib in hits]}
   contacts.append(result);e.to_mesh_clear()
   print(json.dumps({'actor':entry['actorId'],**{k:v for k,v in result.items()if k!='triangles'}}),flush=True)
 errors=[];meta=read(source.parent/'authoring-review.json')
 for spec in meta['clips']:
  bind(rig,bpy.data.actions[spec['clip']]);bind(root,bpy.data.actions[spec['originClip']]);anchors={}
  for n in range((spec['frames']-1)*2+1):
   f=1+n*.5;frame(f)
   for side in ('L','R'):
    index=min(spec['frames']-2,int(f-1));l=spec['rootMotion'][index]['feet'][side];r=spec['rootMotion'][index+1]['feet'][side]
    if not(l['planted']and r['planted']and abs(l['progress']-r['progress'])<1e-8):continue
    region=round(l['progress'],6);point=rig.matrix_world@rig.pose.bones['foot_'+side].head;key=(side,region)
    if key not in anchors:anchors[key]=(f,point.copy())
    af,ap=anchors[key];errors.append({'clip':spec['clip'],'frame':f,'side':side,'region':region,'anchorFrame':af,'drift':(point-ap).length,'position':list(point),'delta':list(point-ap)})
 worst=sorted(errors,key=lambda r:-r['drift'])[:12];print(json.dumps({'actor':entry['actorId'],'worstFeet':worst[:4]}),flush=True)
 rows.append({'actor':entry['actorId'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'modifiers':[{'type':m.type,'name':m.name,'preserveVolume':getattr(m,'use_deform_preserve_volume',None)}for m in body.modifiers],'contacts':contacts,'worstFeet':worst})
out=P/'correction-locations.json';out.write_text(json.dumps({'rows':rows,'complete':True,'inspectorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'complete':True,'report':str(out)}),flush=True)
