"""Author planted-foot retreat, turn and approach poses on the retained rigs."""
from pathlib import Path
import bpy,hashlib,json,math,argparse,sys,shutil
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='step-05');parser.add_argument('--source-pilot');parser.add_argument('--actor');parser.add_argument('--samples-per-frame',type=int,default=1);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
assert 1<=args.samples_per_frame<=8
P=ROOT/'docs/3d-town/classic-motion-v2'/args.pilot
SOURCES={'resident-03':ROOT/'docs/3d-town/classic-residents-v10/resident-03/rb-xu-zhiwei.blend',
 'resident-06':ROOT/'docs/3d-town/classic-occupations-v1/resident-06/gesture-09/occupation.blend',
 'resident-08':ROOT/'docs/3d-town/classic-occupations-v1/resident-08/gesture-14/occupation.blend'}
CAST=json.loads((ROOT/'docs/3d-town/classic-motion-v2/layout-01/cast-candidate.json').read_text(encoding='utf-8'))['entries']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)

def step_contact(q,side):
 windows=((.04,.24),(.53,.73))if side=='L'else((.27,.47),(.76,.96))
 progress=0;lift=0;planted=True
 for a,b in windows:
  u=smooth((q-a)/(b-a));progress+=u*.5
  if a<q<b:lift=.025*math.sin(math.pi*u);planted=False
 return progress,lift,planted
def bind(rig,action):
 rig.animation_data_create();rig.animation_data.action=action
 if action.slots:rig.animation_data.action_slot=action.slots[0]
def matrix_bone(rig,name,head,tail):
 initial=idle_bones[name];rotation=(initial['tail']-initial['head']).rotation_difference(tail-head).to_matrix()@initial['matrix'].to_3x3()
 result=rotation.to_4x4();result.translation=head;rig.pose.bones[name].matrix=result;bpy.context.view_layer.update()
def knee(hip,ankle,upper,lower,pole):
 vector=ankle-hip;length=vector.length;assert length<=upper+lower+1e-6,('unreachable contact',length,upper+lower)
 along=vector.normalized();dist=(upper*upper-lower*lower+length*length)/(2*length)
 across=(pole-along*pole.dot(along)).normalized()
 return hip+along*dist+across*math.sqrt(max(0,upper*upper-dist*dist))
def bone_keyframes(rig,frame):
 for bone in rig.pose.bones:
  # Blender Euler channels wrap at +/-pi unless made compatible. The wrap
  # gave false foot movement between otherwise correct 30 fps key poses.
  if bone.rotation_mode=='QUATERNION':
   if bone.name in previous_rotations and bone.rotation_quaternion.dot(previous_rotations[bone.name])<0:bone.rotation_quaternion.negate()
   previous_rotations[bone.name]=bone.rotation_quaternion.copy()
  else:
   if bone.name in previous_rotations:bone.rotation_euler.make_compatible(previous_rotations[bone.name])
   previous_rotations[bone.name]=bone.rotation_euler.copy()
  for path in ('location','rotation_quaternion' if bone.rotation_mode=='QUATERNION' else 'rotation_euler','scale'):bone.keyframe_insert(data_path=path,frame=frame,group=bone.name)
def linear(action):
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
P.mkdir(parents=True,exist_ok=True)
for entry in CAST:
 if args.actor and entry['actorId']!=args.actor:continue
 out=P/entry['actorId'];out.mkdir(exist_ok=True);assert not (out/'resident.blend').exists(),'Use a new step candidate.'
 manifest=json.loads((ROOT/('public'+entry['manifestUrl'])).read_text(encoding='utf-8'));source=SOURCES[entry['actorId']];assert sha(source)==manifest['sourceSha256']
 if args.source_pilot:
  source=P.parent/args.source_pilot/entry['actorId']/'resident.blend';assert sha(source)==json.loads((source.parent/'authoring-review.json').read_text(encoding='utf-8'))['sourceSha256']
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin']
 bind(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1)
 rest={b.name:b.matrix_basis.copy()for b in rig.pose.bones};original_modes={b.name:b.rotation_mode for b in rig.pose.bones}
 idle_bones={b.name:{'head':b.head.copy(),'tail':b.tail.copy(),'matrix':b.matrix.copy()}for b in rig.pose.bones}
 leg_poles={}
 for side in ('L','R'):
  thigh=idle_bones['thigh_'+side];axis=(idle_bones['foot_'+side]['head']-thigh['head']).normalized();bend=thigh['tail']-thigh['head']
  # Use the bend direction of the complete Idle leg. Projecting the mostly
  # vertical thigh vector directly against each moving leg axis can reverse
  # its sign: the knee then snaps backward between adjacent correct foot keys.
  leg_poles[side]=(bend-axis*bend.dot(axis)).normalized()
  assert leg_poles[side].length>.99
 parent=rig.parent;local=rig.matrix_basis.copy()
 if parent and parent.name=='movement_actor':
  old=parent;parent=old.parent;rig.parent=parent;bpy.data.objects.remove(old,do_unlink=True)
 for name in ('BackAway','BackAway_Origin','ApproachWork','ApproachWork_Origin','TurnLeft','TurnLeft_Origin'):
  old=bpy.data.actions.get(name)
  if old:bpy.data.actions.remove(old)
 root=bpy.data.objects.new('movement_actor',None);bpy.context.scene.collection.objects.link(root);root.parent=parent
 rig.parent=root;rig.matrix_parent_inverse=Matrix.Identity(4);rig.matrix_basis=local
 scale=rig.matrix_basis.to_3x3();inverse_scale=scale.inverted();scale_y=rig.matrix_basis[1][1];distance=entry['retreatMeters'];local_distance=distance/scale_y
 root['purpose']='Local motion origin; the work props remain attached to the stationary workplace.'
 clips=[]
 for clip,count in [('BackAway',60),('ApproachWork',60),('TurnLeft',48)]:
  action=bpy.data.actions.new(clip);action.use_fake_user=True;bind(rig,action)
  root_action=bpy.data.actions.new(clip+'_Origin');root_action.use_fake_user=True;bind(root,root_action)
  trajectories=[];previous_rotations={}
  for sample in range(count*args.samples_per_frame+1):
   frame=1+sample/args.samples_per_frame
   bpy.context.scene.frame_set(int(frame),subframe=frame%1)
   t=(frame-1)/count;q=1-t if clip=='ApproachWork' else t
   for name,matrix in rest.items():rig.pose.bones[name].matrix_basis=matrix
   progress={side:step_contact(q,side)for side in ('L','R')};body_progress=(progress['L'][0]+progress['R'][0])/2
   turn=-math.pi/2*body_progress if clip=='TurnLeft' else 0
   translation=0 if clip=='TurnLeft' else local_distance*body_progress
   root.location=(0,(translation-local_distance if clip=='ApproachWork' else translation)*scale_y,0);root.rotation_euler=(0,0,turn)
   rotation=Matrix.Rotation(-turn,3,'Z')
   targets={}
   for side in ('L','R'):
    foot=idle_bones['foot_'+side];start=foot['head'].copy();foot_direction=foot['tail']-foot['head']
    u,lift,_=progress[side]
    if clip=='TurnLeft':
     metric_start=scale@start;world=Matrix.Rotation(-math.pi/2*u,3,'Z')@metric_start;world.z+=lift*scale[2][2]
     ankle=inverse_scale@rotation@world;direction=inverse_scale@Matrix.Rotation(-math.pi/2*u-turn,3,'Z')@scale@foot_direction
    else:
     ankle=start+Vector((0,local_distance*u-translation,lift));direction=foot_direction
    targets[side]=(ankle,direction)
   bend=.010*math.sin(math.pi*q)**2
   for side,(ankle,_)in targets.items():
    thigh=rig.data.bones['thigh_'+side];shin=rig.data.bones['shin_'+side];hip=idle_bones[thigh.name]['head'];delta=ankle-hip
    reach=thigh.length+shin.length-.002*math.sin(math.pi*q)**2
    vertical=math.sqrt(max(0,reach*reach-delta.x*delta.x-delta.y*delta.y))
    bend=max(bend,hip.z-ankle.z-vertical)
   assert bend<.09,('Retreat requires an excessive crouch',entry['actorId'],clip,frame,bend)
   offset=Vector((0,0,-bend));rig.pose.bones['pelvis'].location+=rig.data.bones['pelvis'].matrix_local.to_3x3().inverted()@offset;bpy.context.view_layer.update()
   for side,(ankle,direction)in targets.items():
    thigh=rig.data.bones['thigh_'+side];shin=rig.data.bones['shin_'+side];initial=idle_bones[thigh.name];hip=initial['head']+offset
    try:joint=knee(hip,ankle,thigh.length,shin.length,leg_poles[side])
    except AssertionError as error:raise RuntimeError((entry['actorId'],clip,frame,side,list(hip),list(ankle),local_distance))from error
    matrix_bone(rig,'thigh_'+side,hip,joint);matrix_bone(rig,'shin_'+side,joint,ankle);matrix_bone(rig,'foot_'+side,ankle,ankle+direction)
    tail=rig.data.bones.get('tail_'+side)
    if tail:
     # The apron drapes from the pelvis during these short steps. Applying the
     # full knee flexion to its hem pushed the cloth through the book stand.
     initial_tail=idle_bones[tail.name]
     matrix_bone(rig,tail.name,initial_tail['head']+offset,initial_tail['tail']+offset)
   bone_keyframes(rig,frame)
   root.keyframe_insert(data_path='location',frame=frame);root.keyframe_insert(data_path='rotation_euler',frame=frame)
   if sample%args.samples_per_frame==0:
    trajectories.append({'t':t,'position':list(root.location),'yaw':turn,'feet':{side:{'progress':v[0],'liftLocalMeters':v[1],'planted':v[2]}for side,v in progress.items()}})
  linear(action);linear(root_action);clips.append({'clip':clip,'originClip':root_action.name,'frames':count+1,'durationSeconds':count/30,'bakedSamples':count*args.samples_per_frame+1,'bakedRateHz':30*args.samples_per_frame,'rootMotion':trajectories})
  rig.animation_data.action=None;root.animation_data.action=None
 assert all(b.rotation_mode==original_modes[b.name]for b in rig.pose.bones)
 root.location=(0,0,0);root.rotation_euler=(0,0,0);bind(rig,bpy.data.actions['Idle']);bpy.context.scene.frame_set(1)
 bpy.context.preferences.filepaths.save_version=0;file=out/'resident.blend';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(file),compress=True)
 waist=source.parent/'waist-fit.json'
 if waist.exists():
  patch=json.loads(waist.read_text(encoding='utf-8'));patch['fittingOriginSourceSha256']=patch['sourceSha256'];patch['sourceSha256']=sha(file);write(out/'waist-fit.json',patch)
 write(out/'authoring-review.json',{'schema':'classic-egress-actions.v2','sourceSha256':sha(file),'retainedSourceSha256':manifest['sourceSha256'],'inputSourceSha256':sha(source),'builderSha256':sha(Path(__file__)),
  'actorId':entry['actorId'],'retreatMeters':distance,'kneePoleMethod':'fixed Idle bend plane, projected onto the current leg axis','legPoles':{s:list(v)for s,v in leg_poles.items()},'clips':clips,'status':'unreviewed-motion-candidate','humanApproved':False,'exported':False})
 print(json.dumps({'actor':entry['actorId'],'sourceSha256':sha(file),'clips':[c['clip']for c in clips]}),flush=True)
(P/'builder.py').write_bytes(Path(__file__).read_bytes())
