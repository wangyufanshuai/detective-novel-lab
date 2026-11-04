"""Formal retained-lighting furniture review from the saved layout source."""
from pathlib import Path
import bpy,hashlib,importlib.util,json,time
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v2/layout-01'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=P/'room.blend';review=json.loads((P/'layout-integrity.json').read_text(encoding='utf-8'));assert review['passed']and review['sourceSha256']==sha(source)
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
spec=importlib.util.spec_from_file_location('room',ROOT/'scripts/build-blender-classic-railway.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room)
devices=room.configure(32,1200)
nav=json.loads((P/'navigation-candidate.json').read_text(encoding='utf-8'))
for obj in scene.objects:
 if obj.get('runtimeExcluded')or obj.get('layer')in ('actor','review_resident'):obj.hide_render=True
report={'schema':'classic-egress-layout-renders.v1','sourceSha256':sha(source),'rendererSha256':sha(Path(__file__)),'complete':False,
 'devices':devices,'samples':32,'width':1200,'renders':[],'scope':'Actual furniture and architecture with retained lights. Residents are excluded from these layout views; pose/contact views are a separate required review.','humanApproved':False}
for prefix,room_id in [('shop','bookshop'),('station','station')]:
 cutaway=next(r for r in nav['interiors']if r['id']==room_id)['cutawayLayers']
 for suffix in ('production','corner-sw','corner-se','corner-nw','corner-ne','low-entry','ceiling-up','ceiling-oblique-a','ceiling-oblique-b','plan-floor'):
  view=prefix+'-'+suffix
  for obj in scene.objects:
   if obj.type not in ('MESH','CURVE','FONT'):continue
   obj.visible_camera=not(suffix in ('production','plan-floor')and obj.get('layer')in cutaway)
  scene.camera=bpy.data.objects[view];target=P/(view+'.png');scene.render.filepath=str(target);start=time.perf_counter();bpy.ops.render.render(write_still=True)
  report['renders'].append({'view':view,'path':target.name,'sha256':sha(target),'seconds':round(time.perf_counter()-start,3)})
  (P/'render-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report['complete']=True;(P/'render-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'complete':True,'renders':len(report['renders']),'sourceSha256':sha(source)}),flush=True)
