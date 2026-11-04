"""Read-only inspection of selected CC0 suit attachments and components."""
from pathlib import Path
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
anatomy=module('uniform_anatomy',ROOT/'scripts/classic-resident-anatomy.py')
assets=module('uniform_assets',ROOT/'scripts/classic-resident-portrait-assets.py')
profile=next(p for p in json.loads((ROOT/'docs/3d-town/classic-residents-v1/profiles.json').read_text(encoding='utf-8'))['profiles'] if p['actorId']=='resident-06')
base,_,joint=anatomy.read_source(profile)
data=ROOT/'docs/3d-town/classic-residents-v5/licensed/mrt-suit'
points,uvs,faces,uvfaces=assets.fitted_proxy(data/'toigo_male_double-breasted_suit.mhclo',base)
neighbors=[set() for _ in points]
for face in faces:
    for i in face:neighbors[i].update(face)
remaining=set(range(len(points)));components=[]
while remaining:
    pending=[remaining.pop()];indices=set(pending)
    while pending:
        for i in neighbors[pending.pop()] & remaining:
            remaining.remove(i);indices.add(i);pending.append(i)
    components.append({'vertices':len(indices),'minIndex':min(indices),'maxIndex':max(indices),
        'bounds':[[min(points[i][k] for i in indices),max(points[i][k] for i in indices)] for k in range(3)]})
groups=json.loads((anatomy.DATA/'mesh_metadata/basemesh_vertex_groups.json').read_text())
names=[n[6:] for n in groups if n.startswith('joint-') and any(s in n for s in ['pelvis','neck','shoulder','elbow','hand','knee','ankle','upperleg','hip'])]
result={'vertices':len(points),'triangles':sum(len(f)-2 for f in faces),'components':sorted(components,key=lambda x:-x['vertices']),
        'joints':{name:list(joint(name)) for name in names}}
out=ROOT/'output/character-source-audit/uniform-source-inspection.json'
out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result),flush=True)
