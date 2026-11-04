"""Fit four coherent, nonnegative skirt/apron sculpts without altering leg gait.

This is authored pose-space deformation, not a cloth simulation. The same
smooth field is applied to the inner skirt and outer apron, preserving folds.
"""
from pathlib import Path
import argparse, bpy, hashlib, json, math, shutil, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-12');p.add_argument('--actor',required=True,choices=['resident-03','resident-08']);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bind(o,a):
 o.animation_data_create();o.animation_data.action=a
 if a and a.slots:o.animation_data.action_slot=a.slots[0]
def frame(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
def curves(action):
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:yield bag
def smooth(t):t=max(0.,min(1.,t));return t*t*(3-2*t)
actor=args.actor;source=BASE/('step-10'if actor=='resident-03'else'step-11')/actor/'resident.blend';meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256']
out=BASE/args.pilot/actor;out.mkdir(parents=True,exist_ok=True);target=out/'resident.blend';assert not target.exists(),'Use a new candidate.'
entry=next(e for e in read(BASE/'layout-01/cast-candidate.json')['entries']if e['actorId']==actor);manifest=read(ROOT/('public'+entry['manifestUrl']))
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects[manifest['id']+'_skin'];rig=bpy.data.objects[manifest['id']+'_rig'];root=bpy.data.objects['movement_actor'];mesh=body.data;assert not mesh.shape_keys
# A long skirt follows the pelvis, rather than each independent thigh. Only
# the retained Walk's garment bones are deliberately changed.
bind(rig,bpy.data.actions['Idle']);bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);frame(1)
idle_tails={b.name:b.matrix.copy()for b in rig.pose.bones if b.name.startswith('tail_')};idle_pelvis=rig.pose.bones['pelvis'].matrix.copy();walk=bpy.data.actions['Walk'];paths=tuple('pose.bones["'+n+'"].'for n in idle_tails)
for bag in curves(walk):
 for c in list(bag.fcurves):
  if c.data_path.startswith(paths):bag.fcurves.remove(c)
bind(rig,walk);previous={}
for n in range(97):
 f=1+n*.25;frame(f);transform=rig.pose.bones['pelvis'].matrix@idle_pelvis.inverted()
 for name,matrix in idle_tails.items():
  bone=rig.pose.bones[name];bone.matrix=transform@matrix;bpy.context.view_layer.update();rotation='rotation_quaternion'if bone.rotation_mode=='QUATERNION'else'rotation_euler'
  if name in previous:
   if rotation=='rotation_euler':bone.rotation_euler.make_compatible(previous[name])
   elif bone.rotation_quaternion.dot(previous[name])<0:bone.rotation_quaternion.negate()
  previous[name]=getattr(bone,rotation).copy()
  for prop in ('location',rotation,'scale'):bone.keyframe_insert(data_path=prop,frame=f,group=name)
for bag in curves(walk):
 for c in bag.fcurves:
  if c.data_path.startswith(paths):
   for k in c.keyframe_points:k.interpolation='LINEAR'
mesh.calc_loop_triangles();triangles=[tuple(t.vertices)for t in mesh.loop_triangles];materials=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles]
weights={v.index:{body.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.vertices}
tails={i for i,w in weights.items()if sum(value for name,value in w.items()if name.startswith('tail_'))>.4};legs={i for i,w in weights.items()if sum(value for name,value in w.items()if name.startswith(('thigh_','shin_')))>.5}
skirt={i for t,m in zip(triangles,materials)if m.startswith('trousers')for i in t if i in tails};apron={i for t,m in zip(triangles,materials)if m.startswith('accent')for i in t if i in tails}if actor=='resident-03'else set()
static=[]
for i in sorted(apron):
 v=mesh.vertices[i];x,y,z=v.co;amount=.007*math.exp(-.5*((x+.160)/.045)**2-.5*((z-.336)/.036)**2)
 if amount>1e-5:
  before=list(v.co);v.co.y-=amount;static.append({'index':i,'before':before,'after':list(v.co)})
tools={i for t,m in zip(triangles,materials)if m.startswith('leather')for i in t if i in tails and .7<mesh.vertices[i].co.z<1.02}if actor=='resident-03'else set()
tool_shifts={}
if tools:
 # The support surface includes the apron above the tail-weight cutoff;
 # otherwise brush tips near the waist fall outside the truncated triangles.
 surface=BVHTree.FromPolygons([v.co.copy()for v in mesh.vertices],[t for t,m in zip(triangles,materials)if m.startswith('accent')],all_triangles=True)
 for name,indices in [(n,[i for i in tools if test(mesh.vertices[i].co.x)])for n,test in [('left_brush',lambda x:x<0),('right_brush',lambda x:0<x<.08),('book_spine',lambda x:x>.08)]]:
  allowances=[]
  for i in indices:
   v=mesh.vertices[i].co;hit=surface.ray_cast(Vector((v.x,-1,v.z)),Vector((0,1,0)),2)[0];assert hit is not None;allowances.append(hit.y-v.y-.004)
  shift=min(allowances);assert 0<shift<.08;tool_shifts[name]=shift
  for i in indices:
   before=list(mesh.vertices[i].co);mesh.vertices[i].co.y+=shift;static.append({'index':i,'before':before,'after':list(mesh.vertices[i].co)})
mesh.update();groups={'legs':[t for t in triangles if all(i in legs for i in t)],'skirt':[t for t in triangles if all(i in skirt and .15<mesh.vertices[i].co.z<.94 for i in t)],'apron':[t for t in triangles if all(i in apron and .15<mesh.vertices[i].co.z<.94 for i in t)]}
quadrants=[]
for t in groups['skirt']:
 x,y,z=(sum(mesh.vertices[i].co[j]for i in t)/3 for j in range(3));quadrants.append((0 if y<0 else 2)+(0 if x<0 else 1))
basis=body.shape_key_add(name='Basis',from_mix=False);keys=[];properties=[];amplitude=.22;selected=skirt|apron|tools
for yside,label in [(-1,'Front'),(1,'Back')]:
 for side,suffix in [(-1,'L'),(1,'R')]:
  key=body.shape_key_add(name='Skirt_'+label+'_'+suffix,from_mix=False);key.value=0.;keys.append(key);properties.append('cloth_fit_'+label.lower()+'_'+suffix.lower());key.slider_min=0;key.slider_max=1
  for i in selected:
   x,y,z=mesh.vertices[i].co;amount=amplitude*smooth((1.01-z)/.36)*smooth(.5+yside*y/.12)*smooth(.5+side*x/.18)
   key.data[i].co=basis.data[i].co+Vector((0,yside*amount,0))
actual_morph_bounds={k.name:max((a.co-b.co).length for a,b in zip(k.data,basis.data))for k in keys};assert max(actual_morph_bounds.values())<=amplitude+1e-6,actual_morph_bounds
def collisions(values,details=False):
 for key,value in zip(keys,values):key.value=float(value)
 bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices];e.to_mesh_clear()
 trees={name:BVHTree.FromPolygons(points,faces,all_triangles=True)for name,faces in groups.items()if faces};hits=trees['legs'].overlap(trees['skirt']);outer=trees['apron'].overlap(trees['skirt'])if apron else []
 if details:return {'quadrants':[quadrants[b]for a,b in hits],'apronPairs':len(outer),'legPairs':len(hits),'contactTriangles':[{'rest':[list(mesh.vertices[i].co)for i in groups['skirt'][b]],'posed':[list(points[i])for i in groups['skirt'][b]]}for a,b in hits[:4]]}
 return [quadrants[b]for a,b in hits],len(outer)
clips=[('BackAway',60,.5),('TurnLeft',48,.5),('Walk',24,.5),('Idle',90,3),(manifest['workAction']['clip'],round(manifest['workAction']['durationSeconds']*30),3)]
sample_map={};fits={}
for clip,count,step in clips:
 bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions.get(clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0);rows=[];original_max=0;outer_max=0
 for n in range(round(count/step)+1):
  f=1+n*step;frame(f);values=[0.]*4;hits,outer=collisions(values);original_max=max(original_max,len(hits));outer_max=max(outer_max,outer)
  for iteration in range(4):
   for quadrant in (0,1,2,3):
    if quadrant not in hits:continue
    lo=values[quadrant];hi=1.;values[quadrant]=hi
    if quadrant in collisions(values)[0]:
     write(out/'failed-fit.json',{'clip':clip,'frame':f,'weights':values,'quadrant':quadrant,**collisions(values,True)});raise AssertionError(('Sculpt does not clear leg',clip,f,quadrant))
    for _ in range(9):
     mid=(lo+hi)/2;values[quadrant]=mid
     if quadrant in collisions(values)[0]:lo=mid
     else:hi=mid
    values[quadrant]=min(1,hi+.035);hits,outer=collisions(values)
   if not hits:break
  hits,outer=collisions(values)
  if hits or outer:
   write(out/'failed-fit.json',{'clip':clip,'frame':f,'weights':values,**collisions(values,True)});raise AssertionError(('Unresolved layer contact',clip,f,len(hits),outer))
  rows.append((f,values.copy()))
 values=np.array([r[1]for r in rows]);required=values.copy()
 if len(rows)>2:
  radius=2;expanded=np.array([np.max(values[max(0,i-radius):min(len(values),i+radius+1)],axis=0)for i in range(len(values))]);kernel=np.exp(-np.arange(-2,3)**2/2);kernel/=kernel.sum()
  for j in range(4):values[:,j]=np.convolve(np.pad(expanded[:,j],2,mode='edge'),kernel,mode='valid')
  values=np.maximum(required,values)
 if clip=='Walk':
  # The same looping source pose requires exactly equal endpoint weights.
  values[0]=values[-1]=np.maximum(values[0],values[-1])
 else:assert np.max(values[[0,-1]])<1e-8,(clip,'correction reaches transition endpoint')
 sample_map[clip]=[(f,values[i].tolist())for i,(f,_)in enumerate(rows)];fits[clip]={'samples':len(rows),'maximumWeight':float(values.max()),'maximumSculptBoundLocalMeters':amplitude*float(values.max()),'sampledOriginalLegContactPairs':original_max,'sampledOriginalApronContactPairs':outer_max}
 print(json.dumps({'actor':actor,'clip':clip,**fits[clip]}),flush=True)
sample_map['ApproachWork']=[(62-f,v)for f,v in reversed(sample_map['BackAway'])]
for prop,key in zip(properties,keys):
 rig[prop]=0.;driver=key.driver_add('value').driver;driver.type='AVERAGE';variable=driver.variables.new();variable.name='fit';variable.type='SINGLE_PROP';variable.targets[0].id=rig;variable.targets[0].data_path='["'+prop+'"]'
for clip,rows in sample_map.items():
 action=bpy.data.actions[clip];bind(rig,action)
 for f,values in rows:
  for prop,value in zip(properties,values):rig[prop]=value;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f,group='Coherent skirt layers')
 for bag in curves(action):
  for c in bag.fcurves:
   if c.data_path.startswith('["cloth_fit_'):
    for k in c.keyframe_points:k.interpolation='LINEAR'
bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);bind(rig,bpy.data.actions['Idle']);frame(1);assert all(abs(k.value)<1e-8 for k in keys)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
report={'schema':'classic-garment-correctives.v2','actorId':actor,'inputSourceSha256':sha(source),'sourceSha256':sha(target),'builderSha256':sha(Path(__file__)),'staticPatch':static,'morphCount':4,'morphProperties':properties,'morphEncoding':{'range':'0..1','basisCreation':'explicit from_mix=False','actualUnweightedMaximumDeltaLocalMeters':actual_morph_bounds},'sampleFrames':{c:[f for f,v in rows]for c,rows in sample_map.items()},'declaredChangedRetainedBoneChannels':{'Walk':list(idle_tails)},'sculptAmplitudeLocalMeters':amplitude,'fits':fits,'selectedVertices':len(selected),'accessoryFit':{'vertices':len(tools),'staticYShifts':tool_shifts,'minimumRestVertexGapMeters':.004},'idleMorphWeightsZero':True,'topologyChanged':False,'weightsChanged':False,'status':'unreviewed-layered-skirt-candidate','humanApproved':False,'exported':False}
write(out/'garment-correctives.json',report);meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveBuilderSha256']=sha(Path(__file__));meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['status']=report['status'];write(out/'authoring-review.json',meta);(out/'garment-builder.py').write_bytes(Path(__file__).read_bytes())
if(source.parent/'waist-fit.json').exists():shutil.copy2(source.parent/'waist-fit.json',out/'waist-fit.json')
print(json.dumps({'saved':True,'actor':actor,'sha256':sha(target),'morphs':len(keys)}),flush=True)
