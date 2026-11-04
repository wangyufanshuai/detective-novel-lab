"""Move observation anchors out of their furniture clearance envelopes."""
from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1]/'docs/3d-town/snowbound-manor-v1'
path=P/'scene-contract.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
before=sha(path);data=json.loads(path.read_text(encoding='utf-8'))
changes=[]
for item in data['interactions']:
    if item['id']=='hearth':old=[0,8.65];new=[0,8.50]
    elif item['id']=='luggage':old=[3.2,1.2];new=[3.1,1.2]
    else:continue
    assert item['position'] in [old,new],item
    if item['position']!=new:changes.append({'id':item['id'],'before':old,'after':new,'reason':'Observation point must remain outside the 0.27 m character radius plus 0.012 m navigation margin.'})
    item['position']=new
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if changes:(P/'navigation-adjustments.json').write_text(json.dumps({'inputSha256':before,'outputSha256':sha(path),'sourceSha256':data['sourceSha256'],'geometryChanged':False,'changes':changes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'changes':changes,'contractSha256':sha(path)},ensure_ascii=False))
