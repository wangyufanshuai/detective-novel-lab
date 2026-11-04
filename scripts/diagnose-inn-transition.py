"""Localize transient finger-to-coat intersections to actual garment bones."""
from pathlib import Path
import importlib.util,json
from collections import Counter
import bpy
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
P=w.PACKAGE/'resident-08/gesture-09';bpy.ops.wm.open_mainfile(filepath=str(P/'occupation.blend'))
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];labels=body.data.attributes['AnatomicalFinger'].data
body.data.calc_loop_triangles();coat_ids={i for p in body.data.polygons if body.data.materials[p.material_index].name=='coat' for i in p.vertices}
coat_faces=[tuple(t.vertices) for t in body.data.loop_triangles if all(i in coat_ids for i in t.vertices)]
digits={f:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==f for i in t.vertices)] for f in (*range(-5,0),*range(1,6))};rows=[]
for frame in (31,36,271,276):
    bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();v=[p.co.copy() for p in m.vertices]
    coat=BVHTree.FromPolygons(v,coat_faces,all_triangles=True);touch={};bones={}
    for f,faces in digits.items():
        pairs=BVHTree.FromPolygons(v,faces,all_triangles=True).overlap(coat);ids={i for a,b in pairs for i in coat_faces[b]}
        if ids:
            names=Counter(body.vertex_groups[max(body.data.vertices[i].groups,key=lambda g:g.weight).group].name for i in ids)
            touch[str(f)]={'pairs':len(pairs),'garmentBones':dict(names),'garmentRestBounds':[[min(body.data.vertices[i].co[a] for i in ids),max(body.data.vertices[i].co[a] for i in ids)] for a in range(3)]}
    for n in ('upperarm_L','forearm_L','hand_L','upperarm_R','forearm_R','hand_R'):
        b=rig.pose.bones[n];bones[n]={'head':list(b.head),'tail':list(b.tail)}
    e.to_mesh_clear();rows.append({'frame':frame,'touch':touch,'bones':bones})
w.write(P/'transition-diagnosis.json',{'sourceSha256':w.sha(P/'occupation.blend'),'rows':rows})
for frame in (31,36):
    bpy.context.scene.frame_set(frame);bpy.context.scene.camera=bpy.data.objects['occupation-side'];bpy.context.scene.render.filepath=str(P/f'diagnostic-transition-{frame}.png');bpy.ops.render.render(write_still=True)
print(json.dumps(rows),flush=True)
