from pathlib import Path
import argparse,bpy,json,math,hashlib,sys
ROOT=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-10');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else []);P=ROOT/'docs/3d-town/classic-motion-v2'/args.pilot;source=P/'resident-08/resident.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['rb-lin-ali_rig'];root=bpy.data.objects['movement_actor'];specs=json.loads((source.parent/'authoring-review.json').read_text(encoding='utf-8'))['clips']
rows=[];clips=[]
def frame(f):bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
for spec in specs:
 for o,name in [(rig,spec['clip']),(root,spec['originClip'])]:o.animation_data.action=bpy.data.actions[name];o.animation_data.action_slot=bpy.data.actions[name].slots[0]
 anchors={};previous_knees={};knee_step=0.;local=[]
 for n in range((spec['frames']-1)*8+1):
  f=1+n*.125;frame(f);index=min(spec['frames']-2,int(f-1))
  for side in ('L','R'):
   knee=rig.matrix_world@rig.pose.bones['shin_'+side].head
   if side in previous_knees:knee_step=max(knee_step,(knee-previous_knees[side]).length)
   previous_knees[side]=knee
   a=spec['rootMotion'][index]['feet'][side];b=spec['rootMotion'][index+1]['feet'][side]
   if not(a['planted']and b['planted']and abs(a['progress']-b['progress'])<1e-8):continue
   point=rig.matrix_world@rig.pose.bones['foot_'+side].head;key=(side,round(a['progress'],6))
   if key not in anchors:anchors[key]=point.copy()
   row={'clip':spec['clip'],'frame':f,'side':side,'error':(point-anchors[key]).length};rows.append(row);local.append(row)
 clips.append({'clip':spec['clip'],'maximumPlantedAnkleDrift':max(r['error']for r in local),'maximumKneeDeltaPerSample':knee_step,'samples':(spec['frames']-1)*8+1})
worst=sorted(rows,key=lambda r:-r['error'])[:5];details=[]
for row in worst[:2]:
 for o,name in [(rig,row['clip']),(root,row['clip']+'_Origin')]:o.animation_data.action=bpy.data.actions[name];o.animation_data.action_slot=bpy.data.actions[name].slots[0]
 case={'peak':row,'poses':[]}
 for f in [row['frame']-.125,row['frame'],row['frame']+.125]:
  frame(f);case['poses'].append({'frame':f,'bones':{n:{'euler':list(rig.pose.bones[n].rotation_euler),'quaternion':list(rig.pose.bones[n].matrix_basis.to_quaternion()),'head':list(rig.matrix_world@rig.pose.bones[n].head)}for n in ['thigh_'+row['side'],'shin_'+row['side'],'foot_'+row['side']]}})
 details.append(case)
report={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'inspectorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'stepFrames':.125,'clips':clips,'worst':worst,'details':details,'anklesPassed':all(c['maximumPlantedAnkleDrift']<.004 for c in clips),'scope':'Planted ankle and knee continuity diagnosis only. No floor, body/furniture, garment or runtime acceptance.'};(P/'foot-branch-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(P/'foot-branch-inspector.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'clips':clips,'anklesPassed':report['anklesPassed']}),flush=True)
