"""Independently compare retained mesh data, actions and old world-space poses."""
from pathlib import Path
import bpy,argparse,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-04');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else [])
P=BASE/args.pilot
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def matrix(m):return [float(v)for row in m for v in row]
def action_fingerprint(action,excluded=()):
 curves=[]
 for layer in action.layers:
  for strip in layer.strips:
   for slot in action.slots:
    bag=strip.channelbag(slot)
    if bag:
     for curve in bag.fcurves:
      if any(curve.data_path==path or(path.endswith('.')and curve.data_path.startswith(path))for path in excluded):continue
      curves.append((curve.data_path,curve.array_index,[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation,k.easing)for k in curve.keyframe_points]))
 return digest(sorted(curves,key=lambda r:(r[0],r[1])))
def capture(source,manifest,clips,exclusions):
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];mesh=body.data
 result={'positions':[list(v.co)for v in mesh.vertices],
  'topology':digest([[list(p.vertices),p.material_index,p.use_smooth]for p in mesh.polygons]),
  'uv':digest({layer.name:[list(d.uv)for d in layer.data]for layer in mesh.uv_layers}),
  'weights':digest([[(body.vertex_groups[g.group].name,g.weight)for g in v.groups]for v in mesh.vertices]),
  'restBones':digest({b.name:{'matrix':matrix(b.matrix_local),'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None}for b in rig.data.bones}),
  'materials':digest([m.name for m in mesh.materials]),
  'artLabels':digest({name:[d.value for d in mesh.attributes[name].data]for name in ('AnatomicalFinger','ArtClothLayer','UniformPart')if name in mesh.attributes}),
  'packedImages':digest({im.name:hashlib.sha256(bytes(im.packed_file.data)).hexdigest()for im in bpy.data.images if im.packed_file}),
  'actions':{a.name:action_fingerprint(a,exclusions.get(a.name,()))for a in bpy.data.actions},'rawActions':{a.name:action_fingerprint(a)for a in bpy.data.actions},'poses':{}}
 for clip,count in clips:
  rig.animation_data.action=bpy.data.actions[clip];rig.animation_data.action_slot=bpy.data.actions[clip].slots[0]
  for frame in sorted({1,1+count//4,1+count//2,1+count*3//4,1+count}):
   bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();result['poses'][clip+':'+str(frame)]={b.name:matrix(rig.matrix_world@b.matrix)for b in rig.pose.bones}
 return result
sources={'resident-03':ROOT/'docs/3d-town/classic-residents-v10/resident-03/rb-xu-zhiwei.blend','resident-06':ROOT/'docs/3d-town/classic-occupations-v1/resident-06/gesture-09/occupation.blend','resident-08':ROOT/'docs/3d-town/classic-occupations-v1/resident-08/gesture-14/occupation.blend'}
rows=[]
for entry in read(BASE/'layout-01/cast-candidate.json')['entries']:
 actor=entry['actorId'];manifest=read(ROOT/('public'+entry['manifestUrl']));original=sources[actor];candidate=P/actor/'resident.blend';assert sha(original)==manifest['sourceSha256'];assert sha(candidate)==read(candidate.parent/'authoring-review.json')['sourceSha256']
 clips=[('Idle',90),('Walk',24),(manifest['workAction']['clip'],round(manifest['workAction']['durationSeconds']*30))]
 correction=read(candidate.parent/'garment-correctives.json')if(candidate.parent/'garment-correctives.json').exists()else None
 exclusions={};declared_bones={}
 if correction:
  assert correction['sourceSha256']==sha(candidate)
  declared_bones=correction.get('declaredChangedRetainedBoneChannels',{})
  assert all(c=='Walk'and all(n.startswith('tail_')for n in bones)for c,bones in declared_bones.items())
  exclusions={c:['["'+n+'"]'for n in correction['morphProperties']]+['pose.bones["'+n+'"].'for n in declared_bones.get(c,[])]for c in correction['sampleFrames']}
 before=capture(original,manifest,clips,exclusions);after=capture(candidate,manifest,clips,exclusions)
 same={key:before[key]==after[key]for key in ('topology','uv','weights','restBones','materials','artLabels','packedImages')}
 assert len(before['positions'])==len(after['positions'])
 changes={i:max(abs(a-b)for a,b in zip(old,new))for i,(old,new)in enumerate(zip(before['positions'],after['positions']))if old!=new}
 tailoring=candidate.parent/'waist-fit.json';allowed={r['index']:r for r in read(tailoring)['movedVertices']}if tailoring.exists()else{}
 if correction:
  for patch in correction['staticPatch']:
   assert patch['index']not in allowed
   allowed[patch['index']]=patch
 exact_patch=set(changes)==set(allowed)and all(after['positions'][i]==allowed[i]['after']and before['positions'][i]==allowed[i]['before']for i in changes)
 action_changes=[name for name,value in before['actions'].items()if after['actions'].get(name)!=value]
 raw_changes=[name for name,value in before['rawActions'].items()if after['rawActions'].get(name)!=value]
 pose_error=max(abs(a-b)for key,pose in before['poses'].items()for bone,values in pose.items()if bone not in declared_bones.get(key.split(':')[0],[])for a,b in zip(values,after['poses'][key][bone]))
 row={'actorId':actor,'retainedSourceSha256':sha(original),'sourceSha256':sha(candidate),'identical':same,'changedVertices':len(changes),'maximumMeshChangeLocalMeters':max(changes.values(),default=0),'onlyDeclaredGeometryPatchesChanged':exact_patch,'changedRetainedActions':raw_changes,'undeclaredActionChanges':action_changes,'declaredChangedRetainedBoneChannels':declared_bones,'retainedPoseSamples':len(before['poses']),'maximumUnchangedWorldBoneMatrixDifference':pose_error,
  'passed':all(same.values())and exact_patch and not action_changes and pose_error<1e-6}
 rows.append(row);print(json.dumps(row),flush=True)
report={'schema':'classic-egress-retention.v2','inspectorSha256':sha(Path(__file__)),'rows':rows,'passed':all(r['passed']for r in rows),'scope':'Exact retained topology, UVs, weights, rest bones, art labels and packed texture bytes. Mesh changes must match declared waist/apron vertices; old action curves must match except declared cloth properties and Walk tail bones. All other old bone poses are independently sampled. Not a new Form acceptance.','humanApproved':False}
(P/'retention-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(P/'retention-inspector.py').write_bytes(Path(__file__).read_bytes())
