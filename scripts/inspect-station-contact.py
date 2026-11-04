from pathlib import Path
import importlib.util,json
import bpy
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupations',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
P=w.PACKAGE/'resident-06/gesture-06'
bpy.ops.wm.open_mainfile(filepath=str(P/'occupation.blend'))
body=bpy.data.objects['rb-gu-yuanshan_skin'];rig=bpy.data.objects['rb-gu-yuanshan_rig']
w.hands.bind_action(rig,bpy.data.actions['VerifyTimetable']);body.data.calc_loop_triangles()
labels=body.data.attributes['AnatomicalFinger'].data;uniform=body.data.attributes['UniformPart'].data
fingers=[t for t in body.data.loop_triangles if all(labels[i].value!=0 for i in t.vertices)]
garment=[t for t in body.data.loop_triangles if all(labels[i].value==0 for i in t.vertices)]
edges=[(a,b,(body.data.vertices[a].co-body.data.vertices[b].co).length) for e in body.data.edges for a,b in [tuple(e.vertices)] if uniform[a].value==3 and uniform[b].value==3 and (body.data.vertices[a].co-body.data.vertices[b].co).length>.0001]
rows=[]
for frame in (1,16,28,38.5,181,277.5):
    bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()
    ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();points=[body.matrix_world@v.co for v in m.vertices]
    ft=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in fingers],all_triangles=True)
    gt=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in garment],all_triangles=True)
    parts={}
    for a,b in ft.overlap(gt):
        key=str(labels[fingers[a].vertices[0]].value)+':'+body.data.materials[garment[b].material_index].name
        parts[key]=parts.get(key,0)+1
    ranked=sorted(edges,key=lambda e:(m.vertices[e[0]].co-m.vertices[e[1]].co).length/e[2],reverse=True)[:3]
    stretch=[{'edge':[a,b],'restPosition':list(body.data.vertices[a].co),'posedPosition':list(m.vertices[a].co),'restLength':d,'ratio':(m.vertices[a].co-m.vertices[b].co).length/d,
              'weights':[(body.vertex_groups[g.group].name,g.weight) for g in body.data.vertices[a].groups]} for a,b,d in ranked]
    rows.append({'frame':frame,'pairsByFingerMaterial':parts,'stretch':stretch});ev.to_mesh_clear()
    if frame in (1,28,38.5):
        bpy.context.scene.camera=bpy.data.objects['occupation-side'];bpy.context.scene.render.filepath=str(P/f'diagnostic-frame-{frame}.png');bpy.ops.render.render(write_still=True)
w.write(P/'contact-diagnosis.json',rows);print(json.dumps(rows),flush=True)
