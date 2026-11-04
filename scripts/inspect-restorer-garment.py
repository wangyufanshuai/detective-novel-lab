"""Read actual connected garment and eye topology from the delivered character."""
from pathlib import Path
import bpy,json,hashlib
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'docs/3d-town/classic-residents-v9/resident-03/rb-xu-zhiwei.blend'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='0aebca9f895973c532da379f21110f17adae84b7886fae39969c142fea7237f3'
bpy.ops.wm.open_mainfile(filepath=str(source));body=bpy.data.objects['rb-xu-zhiwei_skin'];mesh=body.data
rows=[]
for material in ('shirt','eye_detail'):
    polygons=[p for p in mesh.polygons if mesh.materials[p.material_index].name==material]
    graph={i:set() for p in polygons for i in p.vertices}
    for p in polygons:
        ids=list(p.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]):graph[a].add(b);graph[b].add(a)
    unseen=set(graph);components=[]
    while unseen:
        seed=unseen.pop();stack=[seed];ids=[seed]
        while stack:
            for n in graph[stack.pop()]:
                if n in unseen:unseen.remove(n);stack.append(n);ids.append(n)
        components.append(ids)
    for ids in sorted(components,key=len,reverse=True):
        points=[mesh.vertices[i].co for i in ids]
        mixed=[i for i in ids if any(body.vertex_groups[g.group].name in ('pelvis','chest') and g.weight>.03 for g in mesh.vertices[i].groups) and any(body.vertex_groups[g.group].name.startswith(('upperarm','forearm')) and g.weight>.03 for g in mesh.vertices[i].groups)]
        rows.append({'material':material,'vertices':len(ids),'ids':ids,'bounds':[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)],'mixedTorsoArmVertices':len(mixed),
            'mixedBelowElbow':sum(mesh.vertices[i].co.z<1.22 for i in mixed)})
out=ROOT/'output/character-source-audit/restorer-garment-parts.json';out.write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'components':rows},indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k!='ids'} for r in rows]))
