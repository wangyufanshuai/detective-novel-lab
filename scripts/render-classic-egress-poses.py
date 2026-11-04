"""Render saved authored movement candidates in the revised rooms."""
from pathlib import Path
import bpy,argparse,hashlib,importlib.util,json,math,sys
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-03');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
P=BASE/args.pilot;OUT=P/'renders';OUT.mkdir(exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
layout=BASE/'layout-01';cast=read(layout/'cast-candidate.json')['entries'];catalog=[]
for entry in cast:
 source=P/entry['actorId']/'resident.blend';meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256']
 manifest=read(ROOT/('public'+entry['manifestUrl']));bpy.ops.wm.open_mainfile(filepath=str(source))
 rig=bpy.data.objects[manifest['id']+'_rig'];work=bpy.data.objects['restorer_workstation'if entry['actorId']=='resident-03'else'occupation_workplace']
 names={rig.name,manifest['id']+'_skin','movement_actor',work.name,*[o.name for o in work.children_recursive]}
 parent=rig.parent
 while parent:names.add(parent.name);parent=parent.parent
 catalog.append((entry,manifest,meta,source,sorted(names),work.name))
bpy.ops.wm.open_mainfile(filepath=str(layout/'room.blend'));scene=bpy.context.scene
for obj in scene.objects:
 if obj.get('runtimeExcluded')or obj.get('layer')in ('actor','review_resident'):obj.hide_render=True
actors=[]
for entry,manifest,meta,source,names,workname in catalog:
 action_names=['Idle','Walk','BackAway','BackAway_Origin','ApproachWork','ApproachWork_Origin','TurnLeft','TurnLeft_Origin']
 with bpy.data.libraries.load(str(source),link=False)as (available,loaded):loaded.objects=list(names);loaded.actions=list(action_names)
 for action in loaded.actions:
  if action:action.use_fake_user=True
 objects=dict(zip(names,loaded.objects));actions=dict(zip(action_names,loaded.actions))
 for obj in loaded.objects:
  if obj and not obj.users_collection:scene.collection.objects.link(obj)
 rig=objects[manifest['id']+'_rig'];root=objects['movement_actor'];work=objects[workname]
 bind(rig,actions['Idle']);scene.frame_set(1);bpy.context.view_layer.update()
 origin=root.matrix_world.translation.copy();work_transform=Matrix.Translation(-origin)@work.matrix_world.copy()
 # Work props are returned to the same rest state as runtime departure.
 for obj in [work,*work.children_recursive]:
  transform=obj.matrix_basis.copy()
  if obj.animation_data:obj.animation_data_clear();obj.matrix_basis=transform
 home=bpy.data.objects.new(entry['actorId']+'_home',None);scene.collection.objects.link(home);home.location=(*entry['position'],.18)
 phase=bpy.data.objects.new(entry['actorId']+'_phase',None);scene.collection.objects.link(phase);phase.parent=home
 root.parent=phase;root.matrix_parent_inverse=Matrix.Identity(4);root.matrix_basis=Matrix.Identity(4)
 work.parent=home;work.matrix_parent_inverse=Matrix.Identity(4);work.matrix_basis=work_transform
 for obj in [rig,*rig.children_recursive,work,*work.children_recursive]:obj.hide_render=False
 actors.append({'entry':entry,'rig':rig,'root':root,'phase':phase,'actions':actions,'meta':meta})
spec=importlib.util.spec_from_file_location('room',ROOT/'scripts/build-blender-classic-railway.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room)
devices=room.configure(40,1200);scene.render.resolution_y=1000
camera_data=bpy.data.cameras.new('egress-pose');camera=bpy.data.objects.new('egress-pose',camera_data);scene.collection.objects.link(camera);camera_data.type='ORTHO';camera_data.ortho_scale=3.25
scene.camera=camera;scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0
source=OUT/'composed.blend';assert not source.exists(),'Use a new candidate instead of overwriting a reviewed composition.'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
report={'schema':'classic-egress-pose-renders.v1','complete':False,'sourceSha256':sha(source),'rendererSha256':sha(Path(__file__)),'devices':devices,
 'retainedSources':{str(s.relative_to(ROOT)):sha(s)for s in [layout/'room.blend',*[c[3]for c in catalog]]},'renders':[],
 'scope':'Actual authored source poses in revised rooms with stationary work props. Diagnostic views; not runtime blending, Function/Form or human acceptance.','humanApproved':False}
for actor in actors:
 entry=actor['entry'];home=Vector((*entry['position'],.18));nav=read(layout/'navigation-candidate.json');room_data=next(r for r in nav['interiors']if r['id']==entry['roomId'])
 for obj in scene.objects:
  if obj.type in ('MESH','CURVE','FONT'):obj.visible_camera=obj.get('layer')not in room_data['cutawayLayers']
 for label,clip,progress,offset,yaw in [('ready','BackAway',0,0,0),('retreat-first','BackAway',1/3,0,0),('retreat-second','BackAway',2/3,0,0),('turn','TurnLeft',.5,entry['retreatMeters'],0),('turned','TurnLeft',1,entry['retreatMeters'],0),('approach','ApproachWork',.5,entry['retreatMeters'],0),('walk-first','Walk',.25,entry['retreatMeters'],0),('walk-second','Walk',.75,entry['retreatMeters'],0),('walk-stride-first','Walk',0,entry['retreatMeters'],0),('walk-stride-second','Walk',.5,entry['retreatMeters'],0)]:
  count=24 if clip=='Walk'else next(c for c in actor['meta']['clips']if c['clip']==clip)['frames']-1
  frame=1+round(progress*count)
  for other in actors:
   other['root'].animation_data.action=None;other['root'].location=(0,0,0);other['root'].rotation_euler=(0,0,0);other['phase'].location=(0,0,0);other['phase'].rotation_euler=(0,0,0);bind(other['rig'],other['actions']['Idle'])
  actor['phase'].location.y=offset;actor['phase'].location.x=-.55 if clip=='Walk'else 0;actor['phase'].rotation_euler.z=yaw;bind(actor['rig'],actor['actions'][clip]);bind(actor['root'],actor['actions'].get(clip+'_Origin'));scene.frame_set(frame);bpy.context.view_layer.update()
  target=home+Vector((0,entry['retreatMeters']/2,.95))
  view_offset=(3.0,-1.1,1.35)if entry['actorId']=='resident-08'else(-3.0,.25,1.05)if entry['actorId']=='resident-06'else(-3.0,-1.1,1.35)
  camera.location=target+Vector(view_offset);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
  name=entry['actorId']+'-'+label;file=OUT/(name+'.png');scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
  report['renders'].append({'actorId':entry['actorId'],'phase':label,'clip':clip,'frame':frame,'path':file.name,'sha256':sha(file),'camera':list(camera.location),'target':list(target)})
  write(OUT/'render-review.json',report)
report['complete']=True;write(OUT/'render-review.json',report);(OUT/'renderer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'renders':len(report['renders'])}),flush=True)
