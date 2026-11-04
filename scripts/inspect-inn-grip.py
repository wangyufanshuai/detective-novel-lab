"""Report actual deformed contact locations before changing the writing grip."""
from pathlib import Path
import bpy,json,importlib.util
from collections import Counter
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/3d-town/classic-occupations-v1/resident-08/grip-study-04/grip.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];pen=bpy.data.objects['occupation_pen_anchor']
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
pv=[];pf=[]
for o in pen.children_recursive:
    if o.type!='MESH':continue
    e=o.evaluated_get(graph);m=e.to_mesh();m.calc_loop_triangles();offset=len(pv)
    pv.extend(e.matrix_world@v.co for v in m.vertices);pf.extend(tuple(offset+i for i in t.vertices) for t in m.loop_triangles);e.to_mesh_clear()
pt=BVHTree.FromPolygons(pv,pf,all_triangles=True)
body.data.calc_loop_triangles();e=body.evaluated_get(graph);m=e.to_mesh();v=[e.matrix_world@p.co for p in m.vertices]
attr=body.data.attributes['AnatomicalFinger'].data
out={'materials':[x.name for x in body.data.materials],'bones':{},'contacts':{}}
spec=importlib.util.spec_from_file_location('cloth_methods',ROOT/'scripts/build-restorer-deformation.py');cloth=importlib.util.module_from_spec(spec);spec.loader.exec_module(cloth)
out['clothComponents']={}
for mat in ('shirt.001','coat'):
    parts,_=cloth.component(body,mat)
    out['clothComponents'][mat]=[{'count':len(ids),'bounds':[[min(body.data.vertices[i].co[a] for i in ids),max(body.data.vertices[i].co[a] for i in ids)] for a in range(3)]} for ids in parts]
for b in rig.pose.bones:
    if b.name.startswith('finger_R') or b.name=='hand_R':out['bones'][b.name]={'head':list(b.head),'tail':list(b.tail),'quaternion':list(b.rotation_quaternion)}
for f in range(1,6):
    ids={p.index for p in body.data.vertices if attr[p.index].value==f};faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in ids for i in t.vertices)]
    pairs=BVHTree.FromPolygons(v,faces,all_triangles=True).overlap(pt);touch={i for a,b in pairs for i in faces[a]}
    weights=Counter()
    for i in touch:
        p=body.data.vertices[i];g=max(p.groups,key=lambda g:g.weight);weights[body.vertex_groups[g.group].name]+=1
    out['contacts'][str(f)]={'pairs':len(pairs),'dominantBones':dict(weights),'localContactPositions':[list(rig.matrix_world.inverted()@v[i]) for i in sorted(touch)[::max(1,len(touch)//5)]]}
e.to_mesh_clear()
p=ROOT/'output/classic-occupations-v1/inn-grip-inspect.json';p.write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out),flush=True)
