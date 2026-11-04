"""Fit bounded rest-shape ease over the cape's sampled animated underlayer."""
from pathlib import Path
import importlib.util,json,math
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
SOURCE=w.PACKAGE/'resident-08/gesture-06/occupation.blend';OUT=w.PACKAGE/'resident-08/gesture-07';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.preferences.filepaths.save_version=0
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];scene=bpy.context.scene;labels=body.data.attributes['ArtClothLayer'].data
body.data.calc_loop_triangles();triangles={f:[tuple(t.vertices) for t in body.data.loop_triangles if all(labels[i].value==f for i in t.vertices)] for f in (1,2)}
cape={v.index for v in body.data.vertices if labels[v.index].value==2}
trim={i for p in body.data.polygons if body.data.materials[p.material_index].name.split('.')[0]=='accent' for i in p.vertices if body.data.vertices[i].co.z>1.28}
all_ids=cape|trim;positions={i:body.data.vertices[i].co.copy() for i in all_ids}
weights={i:[(body.vertex_groups[g.group].name,g.weight) for g in body.data.vertices[i].groups if g.weight>1e-6] for i in all_ids}
graph={i:set() for i in all_ids}
for edge in body.data.edges:
    a,b=edge.vertices
    if a in all_ids and b in all_ids:graph[a].add(b);graph[b].add(a)
body_to_rig=rig.matrix_world.inverted()@body.matrix_world
rest_inverse={b.name:b.matrix_local.inverted() for b in rig.data.bones}
iterations=[]
for iteration in range(5):
    offsets={};max_pairs=0;inside=0
    for clip,count,step in [('Idle',90,15),('Walk',24,4),('ReconcileRegister',300,10)]:
        w.hands.bind_action(rig,bpy.data.actions[clip])
        for frame in range(1,count+2,step):
            scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();p=[v.co.copy() for v in m.vertices]
            tree=BVHTree.FromPolygons(p,triangles[1],all_triangles=True);ct=BVHTree.FromPolygons(p,triangles[2],all_triangles=True)
            pairs=ct.overlap(tree);max_pairs=max(max_pairs,len(pairs))
            contact_ids={i for a,b in pairs for i in triangles[2][a]}
            transforms={b.name:b.matrix@rest_inverse[b.name] for b in rig.pose.bones}
            for i in all_ids:
                point,normal,_,distance=tree.find_nearest(p[i],.055)
                if point is None:continue
                signed=(p[i]-point).dot(normal);clearance=.005 if i in contact_ids else .003
                if signed>=clearance:continue
                inside+=1;amount=min(.012,clearance-signed)
                skin=Matrix([[0.0]*4 for _ in range(4)])
                for n,value in weights[i]:skin+=transforms[n]*value
                matrix=(body_to_rig.inverted()@skin@body_to_rig).to_3x3()
                delta=matrix.inverted_safe()@(normal*amount)
                if i not in offsets or delta.length>offsets[i].length:offsets[i]=delta
            e.to_mesh_clear()
    if not offsets:
        iterations.append({'iteration':iteration,'maximumPairs':max_pairs,'correctedVertices':0});break
    # Spread small corrections over neighboring fabric; preserve existing folds
    # and keep the geometric correction bounded to 45 mm in the rest mesh.
    expanded=dict(offsets)
    for i,v in offsets.items():
        for j in graph[i]:
            candidate=v*.60
            if j not in expanded or candidate.length>expanded[j].length:expanded[j]=candidate
    for i,v in expanded.items():
        q=body.data.vertices[i].co+v
        if (q-positions[i]).length>.045:q=positions[i]+(q-positions[i]).normalized()*.045
        body.data.vertices[i].co=q
    body.data.update();iterations.append({'iteration':iteration,'maximumPairs':max_pairs,'correctedVertices':len(expanded),'insideSamples':inside,
                                         'maximumStepMeters':max(v.length for v in expanded.values())})
    print(json.dumps(iterations[-1]),flush=True)
w.hands.bind_action(rig,bpy.data.actions['ReconcileRegister']);scene.frame_set(151)
source=OUT/'occupation.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source));(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
w.write(OUT/'authoring-review.json',{'sourceSha256':w.sha(source),'sourceInputSha256':w.sha(SOURCE),'builderSha256':w.sha(Path(__file__)),
    'fitIterations':iterations,'maximumCapeRestAdjustmentMeters':max((body.data.vertices[i].co-positions[i]).length for i in all_ids),
    'humanArtApproved':False,'worldBound':False,'method':'Bounded rest-mesh cape corrections over sampled Idle, Walk and work poses. Authored skin deformation, not runtime cloth simulation.'})
for name,camera,frame in [('working','occupation-production',151),('hands','occupation-hands',151),('side','occupation-side',151),('approach','occupation-side',36),('rest','occupation-production',1)]:
    scene.frame_set(frame);scene.camera=bpy.data.objects[camera];scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'sourceSha256':w.sha(source),'complete':True}),flush=True)
