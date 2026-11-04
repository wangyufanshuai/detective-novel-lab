"""Non-promoted GLB round trip of one corrected clip with an explicit clock.

The source is never saved. All action key/handle times are rescaled together
in this temporary Blender process; existing work durations remain unchanged.
"""
from pathlib import Path
import argparse,bpy,hashlib,json,struct,sys
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',required=True);p.add_argument('--actor',required=True);p.add_argument('--clip',default='BackAway');p.add_argument('--tag',default='gltf-probe');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bind(obj,action):
 obj.animation_data_create();obj.animation_data.action=action
 if action and action.slots:obj.animation_data.action_slot=action.slots[0]
def setframe(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
def points(objects):
 out=[]
 for obj in objects:
  e=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh();out.extend(e.matrix_world@v.co for v in mesh.vertices);e.to_mesh_clear()
 return out
entry=next(e for e in read(BASE/'layout-01/cast-candidate.json')['entries']if e['actorId']==args.actor)
manifest=read(ROOT/('public'+entry['manifestUrl']));P=BASE/args.pilot/args.actor;source=P/'resident.blend';identity=sha(source);meta=read(P/'authoring-review.json');assert identity==meta['sourceSha256']
out=P/args.tag;out.mkdir(exist_ok=True);glb=out/(args.clip+'.glb');assert not glb.exists(),'Use another diagnostic candidate.'
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;assert scene.render.fps==30 and scene.render.fps_base==1
rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];root=bpy.data.objects['movement_actor']
bind(rig,bpy.data.actions[args.clip]);bind(root,bpy.data.actions.get(args.clip+'_Origin'));root.location=(0,0,0);root.rotation_euler=(0,0,0)
end=float(bpy.data.actions[args.clip].frame_range[1]);count=end-1
frames=sorted(set([1+q*count for q in (0,.008333333333,.0708333333,.1416666667,.2083333333,.2875,.35,.475,.5625,.6916666667,.7020833333,.8083333333,.9041666667,.9916666667,1)]))
expected=[]
for f in frames:setframe(f);expected.append(points([body]))
durations={a.name:float(a.frame_range[1]-a.frame_range[0])/30 for a in bpy.data.actions}
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:
       left=key.handle_left.copy();right=key.handle_right.copy();co=key.co.copy()
       key.co.x=(co.x-1)*4+1;key.handle_left.x=(left.x-1)*4+1;key.handle_right.x=(right.x-1)*4+1
      curve.update()
scene.render.fps=120
after={a.name:float(a.frame_range[1]-a.frame_range[0])/120 for a in bpy.data.actions};duration_error=max(abs(durations[n]-after[n])for n in durations);assert duration_error<1e-6
setframe(1);bpy.ops.object.select_all(action='DESELECT')
selected={rig,body};parent=rig.parent
while parent:selected.add(parent);parent=parent.parent
for obj in selected:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_step=1,
 export_anim_slide_to_zero=True,export_skins=True,export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_morph=True,export_morph_animation=True)
raw=glb.read_bytes();length,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a;gltf=json.loads(raw[20:20+length]);animations=gltf.get('animations',[])
weight_channels=sum(c['target']['path']=='weights'for a in animations for c in a['channels']);assert weight_channels>0,'Export dropped garment animation.'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=120;bpy.ops.import_scene.gltf(filepath=str(glb))
# The importer creates an Icosphere as a bone display helper. It is not a
# glTF mesh or part of the character; compare imported skinned geometry.
imported=[o for o in bpy.context.scene.objects if o.type=='MESH'and any(m.type=='ARMATURE'for m in o.modifiers)];assert imported
helpers=[o.name for o in bpy.context.scene.objects if o.type=='MESH'and o not in imported]
rows=[]
for f,wanted in zip(frames,expected):
 t=(f-1)/30;setframe(t*120);actual=points(imported);tree=KDTree(len(actual))
 for i,v in enumerate(actual):tree.insert(v,i)
 tree.balance();maximum=max(tree.find(v)[2]for v in wanted)
 reverse=KDTree(len(wanted))
 for i,v in enumerate(wanted):reverse.insert(v,i)
 reverse.balance();maximum=max(maximum,max(reverse.find(v)[2]for v in actual));rows.append({'timeSeconds':t,'maximumSymmetricVertexDistance':maximum,'sourceVertices':len(wanted),'importedVertices':len(actual)})
passed=all(r['maximumSymmetricVertexDistance']<.001 for r in rows)and sha(source)==identity
report={'schema':'classic-corrective-gltf-probe.v1','purpose':'Diagnostic only; not a production export or browser acceptance.','sourceSha256':identity,'clip':args.clip,'glbSha256':sha(glb),'bytes':len(raw),'animations':len(animations),'animatedWeightChannels':weight_channels,
 'morphTargets':max(len(p.get('targets',[]))for m in gltf['meshes']for p in m['primitives']),'importerDisplayHelpersExcluded':helpers,'sourceFps':30,'temporaryExportFps':120,'maximumRetainedClipDurationErrorSeconds':duration_error,'samples':rows,'passed':passed,'sourceUnchanged':sha(source)==identity,'humanApproved':False,'probeSha256':sha(Path(__file__))}
(out/(args.clip+'-review.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(out/'probe.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'passed':passed,'maximumDistance':max(r['maximumSymmetricVertexDistance']for r in rows),'morphs':report['morphTargets'],'bytes':len(raw)}),flush=True)
