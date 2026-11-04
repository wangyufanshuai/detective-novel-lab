"""Read saved hand geometry and its pinned CC0 landmarks without editing sources."""
from pathlib import Path
import importlib.util
import json
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('anatomical_data',ROOT/'scripts/classic-resident-anatomy.py')
anatomy=importlib.util.module_from_spec(spec);spec.loader.exec_module(anatomy)
profiles=json.loads((ROOT/'docs/3d-town/classic-residents-v1/profiles.json').read_text(encoding='utf-8'))['profiles']
rows=[]
for actor,version in [('resident-03',3),('resident-06',7),('resident-08',4)]:
    profile=next(p for p in profiles if p['actorId']==actor)
    path=ROOT/f'docs/3d-town/classic-residents-v{version}'/actor/(profile['id']+'.blend')
    bpy.ops.wm.open_mainfile(filepath=str(path))
    body=bpy.data.objects[profile['id']+'_skin'];rig=bpy.data.objects[profile['id']+'_rig']
    points,faces,joint=anatomy.read_source(profile)
    row={'actorId':actor,'materials':[m.name for m in body.data.materials],'hands':[]}
    print(json.dumps({'actorId':actor,'materials':row['materials'],'groups':[g.name for g in body.vertex_groups]}),flush=True)
    skin_vertices={i for f in body.data.polygons if 'skin' in body.data.materials[f.material_index].name for i in f.vertices}
    for sign,side,source in [(-1,'L','r'),(1,'R','l')]:
        wrist=joint(source+'-hand');tip=joint(source+'-finger-3-4')
        length=(tip-wrist).normalized()
        width=joint(source+'-finger-5-1')-joint(source+'-finger-2-1')
        width=(width-length*width.dot(length)).normalized();normal=width.cross(length).normalized()
        scale=.166/(tip-wrist).length;origin=Vector((sign*.278,-.025,.953))
        def raw(p):
            d=(p-wrist)*scale
            return origin+Vector((sign*d.dot(width),sign*d.dot(normal),-d.dot(length)))
        def convert(p):
            q=raw(p);curl=max(0,min(1,(.895-q.z)/.10))
            q.x=origin.x+(q.x-origin.x)*(1-.07*curl)
            q.y+=.015*curl*curl;q.z+=.008*curl*curl
            t=max(0,min(1,(.886-q.z)/.09));q.y+=.027*t*t;q.z+=.008*t*t
            return q
        group=body.vertex_groups['hand_'+side].index
        ids=[v.index for v in body.data.vertices if v.index in skin_vertices and any(g.group==group and g.weight>.999 for g in v.groups)]
        selected=[f for f in faces if all(sign*points[i].x>3.7 and (points[i]-wrist).dot(length)>-.18 for i in f)]
        used=sorted({i for f in selected for i in f});tree=KDTree(len(used))
        for i in used:tree.insert(convert(points[i]),i)
        tree.balance();distances=[tree.find(body.data.vertices[i].co)[2] for i in ids]
        row['hands'].append({'side':side,'meshVertices':len(ids),'sourceVertices':len(used),'maximumMatchDistance':max(distances),
            'landmarks':{str(f):[list(raw(joint(f'{source}-finger-{f}-{k}'))) for k in range(1,5)] for f in range(1,6)}})
    rows.append(row)
out=ROOT/'output/character-source-audit/hand-landmarks.json';out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print(json.dumps([{'actorId':r['actorId'],'hands':[{k:v for k,v in h.items() if k!='landmarks'} for h in r['hands']]} for r in rows]),flush=True)
