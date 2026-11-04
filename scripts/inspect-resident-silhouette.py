"""Read the retained station character before changing its tailoring."""
from pathlib import Path
import json
import bpy

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-town/classic-residents-v7/diagnostics'
OUT.mkdir(parents=True,exist_ok=True)
body=bpy.data.objects['rb-gu-yuanshan_skin']
labels=body.data.attributes['UniformPart'].data
names={g.index:g.name for g in body.vertex_groups}
parts={key:[v for v in body.data.vertices if labels[v.index].value==key] for key in (1,3,6)}
rows=[]
for low,high in [(0,.06),(.06,.10),(.10,.14),(.14,.18),(.18,.22),(.22,.26),(.26,.30)]:
    points=[v.co for v in parts[3] if low<=abs(v.co.x)<high and v.co.z>1.32]
    rows.append({'absX':[low,high],'vertices':len(points),'highestZ':max((p.z for p in points),default=None)})
hem=[v for v in parts[3] if v.co.z<1.01 and abs(v.co.x)<.16]
report={'source':bpy.data.filepath,'space':'unscaled armature rest space in metres',
    'shoulderBands':rows,
    'jacketHem':{'vertices':len(hem),'lowestZ':min(v.co.z for v in hem),
        'groupWeightMeans':{name:sum(g.weight for v in hem for g in v.groups if names[g.group]==name)/len(hem) for name in names.values() if name.startswith('tail') or name=='pelvis'}},
    'highCollar':[{'vertex':v.index,'position':list(v.co),'weights':{names[g.group]:g.weight for g in v.groups}} for v in parts[6] if v.co.z>1.53]}
(OUT/'v6-silhouette.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ('shoulderBands','jacketHem')}) )
