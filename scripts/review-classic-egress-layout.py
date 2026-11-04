"""Independently compare the saved layout geometry, materials and transforms."""
from pathlib import Path
import bpy,hashlib,json,math
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v2/layout-01'
OLD=ROOT/'docs/3d-town/classic-bookshop-v2/classic-bookshop.blend';NEW=P/'room.blend'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def collect(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.scene.frame_set(1);bpy.context.view_layer.update();out={}
 for o in bpy.context.scene.objects:
  data=None
  if o.type=='MESH':data=[[[float(v)for v in p.co]for p in o.data.vertices],[list(p.vertices)for p in o.data.polygons]]
  out[o.name]={'matrix':[list(row)for row in o.matrix_world],'geometry':hashlib.sha256(json.dumps(data).encode()).hexdigest(),
   'materials':[m.name for m in o.data.materials]if o.type in ('MESH','CURVE','FONT')else [],'layer':o.get('layer')}
 return out
author=json.loads((P/'authoring-review.json').read_text(encoding='utf-8'));assert sha(OLD)==author['retainedSourceSha256']and sha(NEW)==author['sourceSha256']
old=collect(OLD);new=collect(NEW);changed={r['name']:r for r in author['changedObjects']};assert old.keys()<=new.keys()
transform=Matrix.Translation((*author['shelfCenter'],0))@Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Translation((-.65,-5.59,0))
rows=[];maximum=0
for name,before in old.items():
 after=new[name];assert before['geometry']==after['geometry']and before['materials']==after['materials']and before['layer']==after['layer'],name
 expected=Matrix(before['matrix'])
 if name in changed:expected=(transform if name.startswith('shop_')else Matrix.Translation((0,-.30,0)))@expected
 error=max(abs(a-b)for a,b in zip([v for row in expected for v in row],[v for row in after['matrix']for v in row]));maximum=max(maximum,error);assert error<2e-6,(name,error)
 if name in changed:rows.append({'name':name,'actualMatrix':after['matrix'],'maximumError':error})
report={'passed':True,'sourceSha256':sha(NEW),'retainedSourceSha256':sha(OLD),'reviewerSha256':sha(Path(__file__)),
 'originalObjectsVerified':len(old),'addedObjects':sorted(new.keys()-old.keys()),'maximumTransformError':maximum,'changedObjects':rows,
 'scope':'Saved geometry, material names, layer membership and object transforms. These actual evaluated transforms supersede cached after matrices in the initial authoring receipt. No navigation or animation Form approval.'}
(P/'layout-integrity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':True,'originalObjectsVerified':len(old),'addedObjects':report['addedObjects'],'maximumTransformError':maximum}),flush=True)
