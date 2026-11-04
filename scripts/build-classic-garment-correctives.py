"""Fit smooth pose-space garment corrections and bake them as exportable morphs.

This is a pose corrective, not a physical cloth simulation. The saved rig,
original bone channels, topology, UVs and texture data remain inspectable.
"""
from pathlib import Path
import argparse, bpy, hashlib, json, math, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--source-pilot',default='step-06-rig');p.add_argument('--pilot',default='step-06');p.add_argument('--actor');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
def frame(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
def linear(action,prefix):
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for c in bag.fcurves:
      if c.data_path.startswith(prefix):
       for k in c.keyframe_points:k.interpolation='LINEAR'

for entry in read(BASE/'layout-01/cast-candidate.json')['entries']:
 actor=entry['actorId']
 if args.actor and actor!=args.actor:continue
 source=BASE/args.source_pilot/actor/'resident.blend';meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256']
 out=BASE/args.pilot/actor;out.mkdir(parents=True,exist_ok=True);assert not(out/'resident.blend').exists(),'Use a new candidate.'
 bpy.ops.wm.open_mainfile(filepath=str(source));manifest=read(ROOT/('public'+entry['manifestUrl']))
 rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];root=bpy.data.objects['movement_actor'];mesh=body.data
 assert not mesh.shape_keys,'Do not replace existing corrective keys.'
 changed_walk_bones=[]
 if actor in ('resident-03','resident-08'):
  # The retained Walk rotated long skirt panels with individual thighs. Its
  # outer apron could consequently cross the opposite panel by over 20 cm.
  # Keep the skirt attached to the moving pelvis and let the corrective
  # surface carry leg clearance; preserve every non-garment bone channel.
  bind(rig,bpy.data.actions['Idle']);bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);frame(1)
  tails_idle={b.name:b.matrix.copy()for b in rig.pose.bones if b.name.startswith('tail_')};pelvis_idle=rig.pose.bones['pelvis'].matrix.copy();changed_walk_bones=list(tails_idle)
  walk=bpy.data.actions['Walk'];paths=tuple('pose.bones["'+n+'"].'for n in tails_idle)
  for layer in walk.layers:
   for strip in layer.strips:
    for slot in walk.slots:
     bag=strip.channelbag(slot)
     if bag:
      for c in list(bag.fcurves):
       if c.data_path.startswith(paths):bag.fcurves.remove(c)
  bind(rig,walk);previous={}
  for n in range(97):
   f=1+n*.25;frame(f);transform=rig.pose.bones['pelvis'].matrix@pelvis_idle.inverted()
   for name,matrix in tails_idle.items():
    bone=rig.pose.bones[name];bone.matrix=transform@matrix;bpy.context.view_layer.update()
    rotation='rotation_quaternion'if bone.rotation_mode=='QUATERNION'else'rotation_euler'
    if name in previous:
     if rotation=='rotation_euler':bone.rotation_euler.make_compatible(previous[name])
     elif bone.rotation_quaternion.dot(previous[name])<0:bone.rotation_quaternion.negate()
    previous[name]=getattr(bone,rotation).copy()
    for prop in ('location',rotation,'scale'):bone.keyframe_insert(data_path=prop,frame=f,group=name)
  for path in paths:linear(walk,path)
 mesh.calc_loop_triangles();tris=[tuple(t.vertices)for t in mesh.loop_triangles];materials=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
 weights={v.index:{body.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.vertices}
 tails={i for i,w in weights.items()if sum(v for n,v in w.items()if n.startswith('tail_'))>.4}
 legs={i for i,w in weights.items()if sum(v for n,v in w.items()if n.startswith(('thigh_','shin_')))>.5}
 skirt={i for t,m in zip(tris,materials)if m.startswith('trousers')for i in t if i in tails and .14<mesh.vertices[i].co.z<.94}
 apron={i for t,m in zip(tris,materials)if m.startswith('accent')for i in t if i in tails and .14<mesh.vertices[i].co.z<.94}if actor=='resident-03'else set()
 if actor=='resident-06':
  a=mesh.attributes['UniformPart'].data
  legs={i for i in range(len(mesh.vertices))if a[i].value==1}
  skirt={i for i in range(len(mesh.vertices))if a[i].value in (2,3)and mesh.vertices[i].co.z<1.06}
 selected=sorted(skirt|apron);lookup={i:j for j,i in enumerate(selected)};assert selected
 static=[]
 # The diagnosed apron flaw is its free lower edge, not a shared waist seam.
 for i in sorted(apron):
  v=mesh.vertices[i];x,y,z=v.co;amount=.007*math.exp(-.5*((x+.160)/.045)**2-.5*((z-.336)/.036)**2)
  if amount>1e-5:
   before=list(v.co);v.co.y-=amount;static.append({'index':i,'before':before,'after':list(v.co)})
 mesh.update();base=np.array([list(v.co)for v in mesh.vertices],dtype=np.float64)
 inside=[t for t in tris if all(i in legs for i in t)]
 sign=np.array([-1. if base[i,1]<.006 else 1. for i in selected]);pad=np.array([.024 if i in apron else .014 for i in selected])
 skirt_faces=[t for t in tris if all(i in skirt for i in t)];apron_local=np.array([lookup[i]for i in sorted(apron)],dtype=int)
 # Spread the envelope over the existing cloth connectivity. The pointwise
 # lower bound is kept, so smoothing cannot reintroduce the original defect.
 edges=set()
 for t in tris:
  for a,b in zip(t,(t[1],t[2],t[0])):
   if a in lookup and b in lookup and sign[lookup[a]]==sign[lookup[b]]:
    edges.add((lookup[a],lookup[b]));edges.add((lookup[b],lookup[a]))
 ea=np.array([a for a,b in edges],dtype=int);eb=np.array([b for a,b in edges],dtype=int);degree=np.bincount(ea,minlength=len(selected));degree=np.maximum(degree,1)
 bone_names=[b.name for b in rig.data.bones];bone_ids={n:i for i,n in enumerate(bone_names)};rest_inverse=np.array([rig.data.bones[n].matrix_local.inverted()for n in bone_names])
 weight_ids=np.zeros((len(selected),4),dtype=int);weight_values=np.zeros((len(selected),4))
 for j,i in enumerate(selected):
  assert len(weights[i])<=4
  for k,(name,value)in enumerate(weights[i].items()):weight_ids[j,k]=bone_ids[name];weight_values[j,k]=value
 datasets=[];sample_map={};peak=0.;prediction_error=0.
 def correction():
  global peak,prediction_error
  e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=np.array([list(v.co)for v in m.vertices]);e.to_mesh_clear()
  tree=BVHTree.FromPolygons([Vector(v)for v in points],inside,all_triangles=True);need=np.zeros(len(selected))
  for j,i in enumerate(selected):
   x,y,z=points[i];values=[]
   # A small support stencil catches triangle interiors between ring vertices.
   for dx,dz in ((0,0),(-.016,0),(.016,0),(0,-.016),(0,.016),(-.012,-.012),(-.012,.012),(.012,-.012),(.012,.012)):
    hit=tree.ray_cast(Vector((x+dx,sign[j]*2,z+dz)),Vector((0,-sign[j],0)),4)[0]
    if hit is not None:values.append(sign[j]*(hit.y-y)+pad[j])
   if values:need[j]=max(0,max(values))
  for _ in range(10):
   mean=np.bincount(ea,weights=need[eb],minlength=len(selected))/degree
   need=np.maximum(need,mean*.985)
  if apron:
   # The outer layer follows the already displaced skirt. Fitting both layers
   # independently to a leg envelope lets the expanding skirt overtake it.
   posed=points.copy();posed[selected,1]+=need*sign
   skirt_tree=BVHTree.FromPolygons([Vector(v)for v in posed],skirt_faces,all_triangles=True)
   for j in apron_local:
    x,y,z=points[selected[j]];required=[]
    for dx,dz in ((0,0),(-.016,0),(.016,0),(0,-.016),(0,.016)):
     hit=skirt_tree.ray_cast(Vector((x+dx,sign[j]*2,z+dz)),Vector((0,-sign[j],0)),4)[0]
     if hit is not None:required.append(sign[j]*(hit.y-y)+.014)
    if required:need[j]=max(need[j],max(required))
   for _ in range(8):
    mean=np.bincount(ea,weights=need[eb],minlength=len(selected))/degree
    need[apron_local]=np.maximum(need[apron_local],mean[apron_local]*.985)
  # Pin the waist/upper jacket. All diagnosed defects are below this band.
  upper=1.06 if actor=='resident-06'else .94;lower=1.00 if actor=='resident-06'else .87
  taper=np.clip((upper-base[selected,2])/(upper-lower),0,1);taper=taper*taper*(3-2*taper);need*=taper
  peak=max(peak,float(need.max()))
  if need.max()>=.18:
   j=int(np.argmax(need));detail={'actor':actor,'clip':clip,'frame':f,'vertex':selected[j],'rest':base[selected[j]].tolist(),'posed':points[selected[j]].tolist(),'isApron':selected[j]in apron,'displacement':float(need[j])}
   write(out/'failed-fit.json',detail);raise AssertionError(detail)
  pose=np.array([rig.pose.bones[n].matrix for n in bone_names]);skin=np.einsum('bij,bjk->bik',pose,rest_inverse)
  body_to_rig=np.array(rig.matrix_world.inverted()@body.matrix_world);rig_to_body=np.linalg.inv(body_to_rig)
  skin=np.einsum('ij,bjk,kl->bil',rig_to_body,skin,body_to_rig)
  blended=np.einsum('vk,vkij->vij',weight_values,skin[weight_ids])
  predicted=np.einsum('vij,vj->vi',blended,np.c_[base[selected],np.ones(len(selected))])[:,:3]
  error=float(np.max(np.linalg.norm(predicted-points[selected],axis=1)));prediction_error=max(prediction_error,error);assert error<2e-5,('Skin inversion disagrees with Blender',error)
  delta=np.zeros((len(selected),3));delta[:,1]=need*sign
  return np.linalg.solve(blended[:,:3,:3],delta[...,None])[...,0].astype(np.float32).reshape(-1)
 work=manifest['workAction']['clip'];work_count=round(manifest['workAction']['durationSeconds']*30)
 clips=[('BackAway',60,.5),('TurnLeft',48,.5),('Walk',24,.5),('Idle',90,3),(work,work_count,5)]
 for clip,count,step in clips:
  bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions.get(clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0)
  frames=sorted(set([1+i*step for i in range(math.floor(count/step)+1)]+[count+1]));sample_map[clip]=[]
  for f in frames:
   frame(f);sample_map[clip].append((f,len(datasets)));datasets.append(correction())
  print(json.dumps({'actor':actor,'clip':clip,'samples':len(frames),'peakCorrection':peak}),flush=True)
 sample_map['ApproachWork']=[(62-f,i)for f,i in reversed(sample_map['BackAway'])]
 data=np.stack(datasets);gram=(data.astype(np.float64)@data.astype(np.float64).T);eigenvalues,u=np.linalg.eigh(gram);order=np.argsort(eigenvalues)[::-1];eigenvalues=eigenvalues[order];u=u[:,order]
 valid=eigenvalues>1e-12;u=u[:,valid];singular=np.sqrt(eigenvalues[valid]);basis=(u.T@data)/singular[:,None];coefficients=u*singular
 rank=0;max_residual=0
 for rank in range(1,min(32,len(singular))+1):
  residual=(data-coefficients[:,:rank]@basis[:rank]).reshape(len(data),len(selected),3)
  max_residual=float(np.max(np.linalg.norm(residual,axis=2)))
  # The fitting envelope leaves 14 mm of slack before reduced-basis error.
  # A <= 3 mm bounded reduction error retains at least 11 mm of that slack;
  # saved-source collision checks still require zero intersecting triangles.
  if max_residual<.003:break
 assert max_residual<.003,('Correctives exceed bounded morph budget',rank,max_residual)
 scales=np.max(np.abs(coefficients[:,:rank]),axis=0);modes=basis[:rank]*scales[:,None];values=coefficients[:,:rank]/scales
 body.shape_key_add(name='Basis',from_mix=False);properties=[]
 for mode in range(rank):
  name=f'GarmentClearance_{mode+1:02d}';key=body.shape_key_add(name=name,from_mix=False);key.slider_min=-1;key.slider_max=1;positions=base.copy();positions[selected]+=modes[mode].reshape(-1,3);key.data.foreach_set('co',positions.astype(np.float32).reshape(-1))
  prop=f'cloth_fit_{mode+1:02d}';rig[prop]=0.;driver=key.driver_add('value').driver;driver.type='AVERAGE';variable=driver.variables.new();variable.name='fit';variable.type='SINGLE_PROP';variable.targets[0].id=rig;variable.targets[0].data_path='["'+prop+'"]';properties.append(prop)
 for clip,samples in sample_map.items():
  bind(rig,bpy.data.actions[clip])
  for f,index in samples:
   for mode,prop in enumerate(properties):rig[prop]=float(values[index,mode]);rig.keyframe_insert(data_path='["'+prop+'"]',frame=f,group='Garment pose correctives')
  linear(bpy.data.actions[clip],'["cloth_fit_')
 bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);bind(rig,bpy.data.actions['Idle']);frame(1)
 bpy.context.preferences.filepaths.save_version=0;target=out/'resident.blend';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
 report={'schema':'classic-garment-correctives.v1','actorId':actor,'inputSourceSha256':sha(source),'sourceSha256':sha(target),'builderSha256':sha(Path(__file__)),'selectedVertices':len(selected),'staticPatch':static,
  'morphCount':rank,'fittingSlackLocalMeters':.014,'maximumFittingDisplacementLocalMeters':peak,'maximumReducedBasisErrorLocalMeters':max_residual,'maximumInverseSkinPredictionError':prediction_error,
  'morphProperties':properties,'sampleFrames':{k:[f for f,i in v]for k,v in sample_map.items()},'topologyChanged':False,'weightsChanged':False,'declaredChangedRetainedBoneChannels':{'Walk':changed_walk_bones}if changed_walk_bones else {},'status':'unreviewed-corrective-candidate','humanApproved':False,'exported':False,
  'scope':'Pose-dependent expanded leg envelope, smoothed on authored cloth topology and reduced to morph targets. Not physical cloth dynamics; requires saved-source collision, visual, export and runtime verification.'}
 write(out/'garment-correctives.json',report)
 waist=source.parent/'waist-fit.json'
 if waist.exists():
  patch=read(waist);patch['fittingOriginSourceSha256']=patch['sourceSha256'];patch['sourceSha256']=sha(target);write(out/'waist-fit.json',patch)
 meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveBuilderSha256']=sha(Path(__file__));meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['status']='unreviewed-garment-candidate';write(out/'authoring-review.json',meta)
 (out.parent/'garment-builder.py').write_bytes(Path(__file__).read_bytes())
 print(json.dumps({'actor':actor,'saved':True,'morphs':rank,'residual':max_residual,'sourceSha256':sha(target)}),flush=True)
