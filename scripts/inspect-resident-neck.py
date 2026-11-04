"""Inspect actual saved neck topology without changing the v5 source."""
from pathlib import Path
import bpy
import bmesh
import json
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-town/classic-residents-v6/diagnostics';OUT.mkdir(parents=True,exist_ok=True)
body=bpy.data.objects['rb-gu-yuanshan_skin'];data=body.data
skin_ids={i for i,m in enumerate(data.materials) if m.name.startswith('skin')}
faces=[tuple(p.vertices) for p in data.polygons if p.material_index in skin_ids and all(data.vertices[i].co.z>1.43 for i in p.vertices)]
used=sorted({v for f in faces for v in f});lookup={v:i for i,v in enumerate(used)}
mesh=bpy.data.meshes.new('neck_diagnostic');mesh.from_pydata([data.vertices[i].co for i in used],[],[tuple(lookup[i] for i in f) for f in faces]);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh)
edges=[e for e in bm.edges if e.is_boundary]
rows=[{'a':list(e.verts[0].co),'b':list(e.verts[1].co)} for e in edges]
remaining=set(bm.verts);components=[]
while remaining:
    pending=[remaining.pop()];found=set(pending)
    while pending:
        vertex=pending.pop()
        for edge in vertex.link_edges:
            other=edge.other_vert(vertex)
            if other in remaining:remaining.remove(other);found.add(other);pending.append(other)
    components.append({'vertices':len(found),'bounds':[[min(v.co[k] for v in found),max(v.co[k] for v in found)] for k in range(3)]})
result={'boundaryEdges':len(edges),'components':components,'edgesBelowJaw':[r for r in rows if min(r['a'][2],r['b'][2])<1.62]}
(OUT/'v5-neck-topology.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'boundaryEdges':len(edges),'components':components,'edgesBelowJaw':len(result['edgesBelowJaw'])}),flush=True)
mat=bpy.data.materials.new('boundary_red');mat.diffuse_color=(.9,.01,.01,1);mat.use_nodes=True
bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Base Color'].default_value=(.9,.01,.01,1);bsdf.inputs['Roughness'].default_value=.5
for row in result['edgesBelowJaw']:
    curve=bpy.data.curves.new('neck_boundary','CURVE');curve.dimensions='3D';curve.bevel_depth=.0008;curve.bevel_resolution=0
    line=curve.splines.new('POLY');line.points.add(1)
    for p,q in zip(line.points,[row['a'],row['b']]):p.co=(*q,1)
    ob=bpy.data.objects.new('neck_boundary',curve);bpy.context.collection.objects.link(ob);ob.parent=body.parent;curve.materials.append(mat)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scale=1.76/1.802
camera=bpy.data.objects['portrait'];camera.location=(1.4,-2,1.66*scale)
camera.rotation_euler=(Vector((0,0,1.565*scale))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.32*scale
scene.camera=camera;scene.render.filepath=str(OUT/'v5-neck-boundaries.png');bpy.ops.render.render(write_still=True)
bm.free()
