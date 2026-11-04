"""Re-encode signed corrective coefficients into portable 0..1 morph weights."""
from pathlib import Path
import argparse,bpy,hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--source-pilot',required=True);p.add_argument('--pilot',required=True);p.add_argument('--actor',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
entry=next(e for e in read(BASE/'layout-01/cast-candidate.json')['entries']if e['actorId']==args.actor);manifest=read(ROOT/('public'+entry['manifestUrl']));source=BASE/args.source_pilot/args.actor/'resident.blend';meta=read(source.parent/'authoring-review.json');assert sha(source)==meta['sourceSha256']
out=BASE/args.pilot/args.actor;out.mkdir(parents=True,exist_ok=True);target=out/'resident.blend';assert not target.exists()
bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects[manifest['id']+'_rig'];body=bpy.data.objects[manifest['id']+'_skin'];report=read(source.parent/'garment-correctives.json');props=report['morphProperties']
curves={prop:[]for prop in props}
for a in bpy.data.actions:
 for layer in a.layers:
  for strip in layer.strips:
   for slot in a.slots:
    bag=strip.channelbag(slot)
    if bag:
     for c in bag.fcurves:
      for prop in props:
       if c.data_path=='["'+prop+'"]':curves[prop].append(c)
base=np.array([list(v.co)for v in body.data.vertices]);offset=np.zeros_like(base);ranges={}
for prop,key in zip(props,list(body.data.shape_keys.key_blocks)[1:]):
 values=[float(k.co.y)for c in curves[prop]for k in c.keyframe_points];lo=min(values);hi=max(values);span=hi-lo;assert span>1e-9
 delta=np.array([list(v.co)for v in key.data])-base;offset+=lo*delta;key.data.foreach_set('co',(base+span*delta).astype(np.float32).reshape(-1));key.slider_min=0;key.slider_max=1
 for c in curves[prop]:
  for k in c.keyframe_points:
   co=k.co.copy();left=k.handle_left.copy();right=k.handle_right.copy();k.co.y=(co.y-lo)/span;k.handle_left.y=(left.y-lo)/span;k.handle_right.y=(right.y-lo)/span
  c.update()
 rig[prop]=(rig[prop]-lo)/span;ranges[prop]={'minimum':lo,'maximum':hi}
constant=body.shape_key_add(name='GarmentClearanceOffset',from_mix=False);constant.data.foreach_set('co',(base+offset).astype(np.float32).reshape(-1));constant.value=1
bpy.context.scene.frame_set(1);bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
report['signedSourceSha256']=sha(source);report['sourceSha256']=sha(target);report['signedMorphCount']=report['morphCount'];report['morphCount']+=1;report['morphEncoding']={'range':'0..1','constantTarget':constant.name,'sourceRanges':ranges,'encoderSha256':sha(Path(__file__))};write(out/'garment-correctives.json',report)
meta['inputSourceSha256']=sha(source);meta['sourceSha256']=sha(target);meta['correctiveReportSha256']=sha(out/'garment-correctives.json');meta['morphEncoderSha256']=sha(Path(__file__));write(out/'authoring-review.json',meta)
waist=source.parent/'waist-fit.json'
if waist.exists():
 patch=read(waist);patch['fittingOriginSourceSha256']=patch['sourceSha256'];patch['sourceSha256']=sha(target);write(out/'waist-fit.json',patch)
(out/'morph-encoder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'saved':True,'sourceSha256':sha(target),'morphs':report['morphCount']}),flush=True)
