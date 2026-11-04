"""Minimal, nonnegative corrective sculpts for the station jacket front panels."""
from pathlib import Path
import argparse,bpy,hashlib,json,math,sys
import numpy as np
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-10');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bind(o,a):
 o.animation_data_create();o.animation_data.action=a
 if a and a.slots:o.animation_data.action_slot=a.slots[0]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
source=BASE/'step-06-rig/resident-06/resident.blend';meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256'];out=BASE/args.pilot/'resident-06';out.mkdir(parents=True,exist_ok=True);target=out/'resident.blend';assert not target.exists()
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-gu-yuanshan_skin'];rig=bpy.data.objects['rb-gu-yuanshan_rig'];root=bpy.data.objects['movement_actor'];mesh=body.data;assert not mesh.shape_keys
mesh.calc_loop_triangles();triangles=[tuple(t.vertices)for t in mesh.loop_triangles];labels=mesh.attributes['UniformPart'].data;groups={part:[t for t in triangles if all(labels[i].value==part for i in t)]for part in (1,3)}
triangle_sides=[0 if sum(mesh.vertices[i].co.x for i in t)<0 else 1 for t in groups[3]]
body.shape_key_add(name='Basis',from_mix=False);keys=[];properties=['cloth_fit_left','cloth_fit_right']
for side in (-1,1):
 key=body.shape_key_add(name='JacketFront_'+('L'if side<0 else'R'),from_mix=False);key.value=0.;keys.append(key)
 for v in mesh.vertices:
  if labels[v.index].value not in (2,3):continue
  x,y,z=v.co;amount=.035*smooth((.995-z)/.13)*smooth((-y-.018)/.075)*smooth(.5+side*x/.11)
  key.data[v.index].co.y-=amount
 key.slider_min=0;key.slider_max=1
def collisions(values):
 for key,value in zip(keys,values):key.value=float(value)
 bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=[v.co.copy()for v in m.vertices];e.to_mesh_clear()
 hits=BVHTree.FromPolygons(points,groups[1],all_triangles=True).overlap(BVHTree.FromPolygons(points,groups[3],all_triangles=True))
 return [triangle_sides[b]for a,b in hits]
sample_map={};old_max=0;fits={};clips=[('BackAway',60,.5),('TurnLeft',48,1),('Idle',90,3),('Walk',24,1),('VerifyTimetable',300,5)]
for clip,count,step in clips:
 bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions.get(clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0);rows=[];original_max=0
 for n in range(round(count/step)+1):
  f=1+n*step;bpy.context.scene.frame_set(int(f),subframe=f%1);values=[0.,0.];hits=collisions(values);original_max=max(original_max,len(hits))
  for side in (0,1):
   if side not in hits:continue
   lo=0.;hi=1.;values[side]=hi;assert side not in collisions(values),('Sculpt does not clear contact',clip,f,side)
   for _ in range(9):
    mid=(lo+hi)/2;values[side]=mid
    if side in collisions(values):lo=mid
    else:hi=mid
   values[side]=min(1,hi+.12);hits=collisions(values)
  assert not collisions(values),(clip,f,values)
  rows.append((f,values.copy()))
 values=np.array([r[1]for r in rows]);required=values.copy()
 if len(rows)>2:
  radius=4;expanded=np.array([np.max(values[max(0,i-radius):min(len(values),i+radius+1)],axis=0)for i in range(len(values))]);kernel=np.exp(-np.arange(-3,4)**2/3);kernel/=kernel.sum()
  for side in (0,1):values[:,side]=np.convolve(np.pad(expanded[:,side],3,mode='edge'),kernel,mode='valid')
  values=np.maximum(required,values)
  # Endpoint identity is required for transitions to the unmodified Idle.
  assert np.max(values[[0,-1]])<1e-8,(clip,'correction reaches transition endpoint')
 sample_map[clip]=[(f,values[i].tolist())for i,(f,_)in enumerate(rows)];fits[clip]={'sampledOriginalContactPairs':original_max,'maximumWeight':float(values.max()),'samples':len(rows)}
 print(json.dumps({'clip':clip,**fits[clip]}),flush=True)
sample_map['ApproachWork']=[(62-f,v)for f,v in reversed(sample_map['BackAway'])]
for prop,key in zip(properties,keys):
 rig[prop]=0.;driver=key.driver_add('value').driver;driver.type='AVERAGE';variable=driver.variables.new();variable.name='fit';variable.type='SINGLE_PROP';variable.targets[0].id=rig;variable.targets[0].data_path='["'+prop+'"]'
for clip,rows in sample_map.items():
 action=bpy.data.actions[clip];bind(rig,action)
 for f,values in rows:
  for prop,value in zip(properties,values):rig[prop]=value;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f,group='Jacket front clearance')
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for c in bag.fcurves:
      if c.data_path.startswith('["cloth_fit_'):
       for k in c.keyframe_points:k.interpolation='LINEAR'
bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);bind(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
assert all(abs(k.value)<1e-8 for k in keys)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
report={'schema':'classic-garment-correctives.v2','actorId':'resident-06','inputSourceSha256':sha(source),'sourceSha256':sha(target),'builderSha256':sha(Path(__file__)),'staticPatch':[],'morphCount':2,'morphProperties':properties,'morphEncoding':{'range':'0..1'},'sampleFrames':{c:[f for f,v in rows]for c,rows in sample_map.items()},'declaredChangedRetainedBoneChannels':{},'sculptAmplitudeLocalMeters':.035,'fits':fits,'maximumAppliedSculptBoundLocalMeters':.035*max(v['maximumWeight']for v in fits.values()),'idleExactlyRetained':True,'topologyChanged':False,'weightsChanged':False,'status':'unreviewed-local-jacket-candidate','humanApproved':False,'exported':False}
write(out/'garment-correctives.json',report);meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveBuilderSha256']=sha(Path(__file__));meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['status']='unreviewed-local-jacket-candidate';write(out/'authoring-review.json',meta);(out/'garment-builder.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'saved':True,'sha256':sha(target),'maximumSculptBound':report['maximumAppliedSculptBoundLocalMeters']}),flush=True)
