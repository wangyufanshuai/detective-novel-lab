"""Keep worn tools outside the actual posed apron with small exportable offsets."""
from pathlib import Path
import bpy,hashlib,json,math,sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2';source=BASE/'step-13/resident-03/resident.blend';out=BASE/'step-14/resident-03';out.mkdir(parents=True,exist_ok=True);target=out/'resident.blend';assert not target.exists()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bind(o,a):
 o.animation_data_create();o.animation_data.action=a
 if a and a.slots:o.animation_data.action_slot=a.slots[0]
def frame(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
meta=read(source.parent/'authoring-review.json');correction=read(source.parent/'garment-correctives.json');assert sha(source)==meta['sourceSha256']==correction['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-xu-zhiwei_skin'];rig=bpy.data.objects['rb-xu-zhiwei_rig'];root=bpy.data.objects['movement_actor'];mesh=body.data;mesh.calc_loop_triangles();tris=[tuple(t.vertices)for t in mesh.loop_triangles];mats=[mesh.materials[mesh.polygons[t.polygon_index].material_index].name for t in mesh.loop_triangles];tails={v.index for v in mesh.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith('tail_'))>.05}
surfaces=[t for t,m in zip(tris,mats)if m.startswith(('accent','trousers'))and all(i in tails for i in t)];tools={i for t,m in zip(tris,mats)if m.startswith('leather')for i in t if i in tails and .7<mesh.vertices[i].co.z<1.02};assert len(tools)==88
groups={name:sorted(i for i in tools if test(mesh.vertices[i].co.x))for name,test in [('left_brush',lambda x:x<0),('right_brush',lambda x:0<x<.08),('book_spine',lambda x:x>.08)]};keys=[];properties=[];amplitude=.12
# Vertex-only rest fitting missed less than 0.6 mm at triangle interiors.
# Add 2 mm of real geometric allowance, including the existing morph bases,
# so dynamic offsets can return to zero at the unchanged Idle transitions.
patch_by_id={p['index']:p for p in correction['staticPatch']}
for i in tools:
 old={k.name:k.data[i].co.copy()for k in mesh.shape_keys.key_blocks};position=mesh.vertices[i].co.copy();position.y-=.002;mesh.vertices[i].co=position
 for key in mesh.shape_keys.key_blocks:key.data[i].co=old[key.name]+Vector((0,-.002,0))
 patch_by_id[i]['after']=list(position)
mesh.update()
for name,indices in groups.items():
 key=body.shape_key_add(name='ToolSurface_'+name,from_mix=False);key.slider_min=0;key.slider_max=1;keys.append(key);properties.append('cloth_fit_tool_'+name)
 for i in indices:key.data[i].co.y-=amplitude
def evaluated(values):
 for k,v in zip(keys,values):k.value=float(v)
 bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();points=np.array([list(v.co)for v in m.vertices]);e.to_mesh_clear();return points
lookups=[];tool_faces=[];samples=[]
for indices in groups.values():
 lookup={i:j for j,i in enumerate(indices)};faces=[tuple(lookup[i]for i in t)for t in tris if all(i in lookup for i in t)];weights=[[(j,1.)]for j in range(len(indices))]
 for a,b,c in faces:weights.extend([[(a,1/3),(b,1/3),(c,1/3)],[(a,.5),(b,.5)],[(b,.5),(c,.5)],[(c,.5),(a,.5)]])
 lookups.append(indices);tool_faces.append(faces);samples.append(weights)
fits={};sample_map={}
clips=[('BackAway',60,.5),('TurnLeft',48,.5),('Walk',24,.5),('Idle',90,3),('InspectBook',240,3)]
if '--diagnose-walk'in sys.argv:clips=[('Walk',0,.5)]
for clip,count,step in clips:
 bind(rig,bpy.data.actions[clip]);bind(root,bpy.data.actions.get(clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0);rows=[]
 for n in range(round(count/step)+1):
  f=1+n*step;frame(f);original=evaluated([0,0,0]);delta=evaluated([1,1,1])-original;tree=BVHTree.FromPolygons([Vector(v)for v in original],surfaces,all_triangles=True);values=[]
  for g,indices in enumerate(lookups):
   base=original[indices];change=delta[indices]
   def valid(v):
    points=base+v*change
    if tree.overlap(BVHTree.FromPolygons([Vector(p)for p in points],tool_faces[g],all_triangles=True)):return False
    for weights in samples[g]:
     pt=sum((points[i]*w for i,w in weights),np.zeros(3));hit=tree.ray_cast(Vector((pt[0],-2,pt[2])),Vector((0,1,0)),4)[0]
     if hit is not None and pt[1]>hit.y-.0015:return False
    return True
   if valid(0):values.append(0.);continue
   if not valid(1):
    points=base+change;hits=tree.overlap(BVHTree.FromPolygons([Vector(p)for p in points],tool_faces[g],all_triangles=True));bad=[]
    for weights in samples[g]:
     pt=sum((points[i]*w for i,w in weights),np.zeros(3));hit=tree.ray_cast(Vector((pt[0],-2,pt[2])),Vector((0,1,0)),4)[0]
     if hit is not None and pt[1]>hit.y-.0015:bad.append({'point':pt.tolist(),'surface':list(hit)})
    write(out/'failed-surface.json',{'clip':clip,'frame':f,'tool':list(groups)[g],'base':base.tolist(),'delta':change.tolist(),'hits':[{'surface':original[list(surfaces[a])].tolist(),'tool':points[list(tool_faces[g][b])].tolist()}for a,b in hits[:3]],'behindSamples':bad[:3]});raise AssertionError((clip,f,list(groups)[g],'Offset cannot clear the surface'))
   lo=0.;hi=1.
   for _ in range(10):
    mid=(lo+hi)/2
    if valid(mid):hi=mid
    else:lo=mid
   values.append(min(1,hi+.008))
  rows.append((f,values))
 values=np.array([v for f,v in rows]);required=values.copy();expanded=np.array([np.max(values[max(0,i-2):min(len(values),i+3)],axis=0)for i in range(len(values))]);kernel=np.exp(-np.arange(-2,3)**2/2);kernel/=kernel.sum()
 for g in range(3):values[:,g]=np.convolve(np.pad(expanded[:,g],2,mode='edge'),kernel,mode='valid')
 values=np.maximum(values,required)
 if clip=='Walk':values[0]=values[-1]=np.maximum(values[0],values[-1])
 elif np.max(values[[0,-1]])>=1e-8:
  write(out/'failed-transition.json',{'clip':clip,'requiredEndpoints':required[[0,-1]].tolist(),'smoothedEndpoints':values[[0,-1]].tolist(),'firstRows':[(f,v)for f,v in rows[:8]],'lastRows':[(f,v)for f,v in rows[-8:]]});raise AssertionError((clip,'Tool offset reaches transition endpoint'))
 sample_map[clip]=[(f,values[i].tolist())for i,(f,v)in enumerate(rows)];fits[clip]={'samples':len(rows),'maximumLocalOffsetMeters':float(values.max())*amplitude,'maximumWeight':float(values.max())};print(json.dumps({'clip':clip,**fits[clip]}),flush=True)
if '--diagnose-walk'in sys.argv:raise SystemExit('Diagnostic only; no source saved.')
sample_map['ApproachWork']=[(62-f,v)for f,v in reversed(sample_map['BackAway'])]
for prop,key in zip(properties,keys):
 rig[prop]=0.;driver=key.driver_add('value').driver;driver.type='AVERAGE';var=driver.variables.new();var.name='fit';var.type='SINGLE_PROP';var.targets[0].id=rig;var.targets[0].data_path='["'+prop+'"]'
for clip,rows in sample_map.items():
 action=bpy.data.actions[clip];bind(rig,action)
 for f,values in rows:
  for prop,value in zip(properties,values):rig[prop]=value;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f,group='Tool apron attachment')
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for c in bag.fcurves:
      if c.data_path in ['["'+p+'"]'for p in properties]:
       for k in c.keyframe_points:k.interpolation='LINEAR'
bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0);bind(rig,bpy.data.actions['Idle']);frame(1);assert all(abs(k.value)<1e-8 for k in keys);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
correction['inputSourceSha256']=sha(source);correction['sourceSha256']=sha(target);correction['morphCount']+=3;correction['morphProperties']+=properties;correction['toolMotionFit']={'builderSha256':sha(Path(__file__)),'fits':fits,'additionalRestOutwardAllowanceMeters':.002,'marginLocalMeters':.0015,'method':'Actual posed front-surface rays at tool vertices, triangle centers and edge midpoints plus surface BVH intersections; nonnegative local outward offsets.','runtimeVerified':False};write(out/'garment-correctives.json',correction);meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['toolMotionBuilderSha256']=sha(Path(__file__));write(out/'authoring-review.json',meta)
for name in ['garment-builder.py','accessory-builder.py']:(out/name).write_bytes((source.parent/name).read_bytes())
(out/'tool-motion-builder.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'saved':True,'sha256':sha(target),'morphs':correction['morphCount']}),flush=True)
