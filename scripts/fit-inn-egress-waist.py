"""Fit the innkeeper's front waist against the actual desk, preserving actions."""
from pathlib import Path
import bpy,hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2';SOURCE=BASE/'step-03';OUT=BASE/'step-04'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
OUT.mkdir(exist_ok=True)
for actor in ('resident-03','resident-06','resident-08'):
 folder=OUT/actor;folder.mkdir(exist_ok=True);target=folder/'resident.blend';assert not target.exists(),'Retain existing candidates; use a new directory.'
 source=SOURCE/actor/'resident.blend';meta=json.loads((source.parent/'authoring-review.json').read_text(encoding='utf-8'));assert sha(source)==meta['sourceSha256']
 meta['previousCandidateSha256']=sha(source)
 if actor!='resident-08':
  shutil.copy2(source,target);meta['candidateChange']='Identical to step-03; no changes.'
 else:
  bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-lin-ali_skin'];coat={v for p in body.data.polygons if body.data.materials[p.material_index].name=='coat'for v in p.vertices}
  moved=[]
  for vertex in body.data.vertices:
   if vertex.index not in coat:continue
   x,y,z=vertex.co;amount=.018*smooth((z-.93)/.085)*(1-smooth((z-1.09)/.10))*smooth((-y-.05)/.075)*(1-smooth((abs(x)-.12)/.11))
   if amount>1e-8:
    before=list(vertex.co);vertex.co.y+=amount;moved.append({'index':vertex.index,'before':before,'after':list(vertex.co),'amountLocalMeters':amount})
  assert moved and max(r['amountLocalMeters']for r in moved)<=.01800001
  body.data.update();bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
  tailoring={'schema':'inn-waist-fit.v1','previousCandidateSha256':sha(source),'sourceSha256':sha(target),'scriptSha256':sha(Path(__file__)),
   'movedVertices':moved,'maximumLocalDisplacementMeters':max(r['amountLocalMeters']for r in moved),'scope':'Smooth front-waist fit only. Indices, topology, UVs, weights, rest bones, all actions and work props are retained. Motion and cloth review required.','humanApproved':False}
  write(folder/'waist-fit.json',tailoring);meta['candidateChange']='Front waist fitted by at most 18 mm in local coordinates; see waist-fit.json.';meta['tailoringSha256']=sha(folder/'waist-fit.json')
 meta['sourceSha256']=sha(target);meta['status']='unreviewed-motion-and-waist-candidate';write(folder/'authoring-review.json',meta)
 print(json.dumps({'actor':actor,'sourceSha256':meta['sourceSha256'],'change':meta['candidateChange']}),flush=True)
(OUT/'waist-fitter.py').write_bytes(Path(__file__).read_bytes());shutil.copy2(SOURCE/'builder.py',OUT/'builder.py')
