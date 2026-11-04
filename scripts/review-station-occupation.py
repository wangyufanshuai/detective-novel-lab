"""Independent, source-bound spatial and animation checks for the saved pilot."""
from pathlib import Path
import argparse, importlib.util, json, math, sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupations',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
P=w.PACKAGE/'resident-06/gesture-09';SOURCE=P/'occupation.blend'
parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['function','form'],required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source_hash=w.sha(SOURCE)
assert source_hash==w.read(P/'authoring-review.json')['sourceSha256']
render=w.read(P/'render-review-02.json')
assert render['complete'] and render['sourceSha256']==source_hash
for entry in render['renders']:assert w.sha(P/entry['path'])==entry['sha256']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['rb-gu-yuanshan_rig'];body=bpy.data.objects['rb-gu-yuanshan_skin']
w.hands.bind_action(rig,bpy.data.actions['VerifyTimetable'])
bpy.context.scene.frame_set(121);bpy.context.view_layer.update()

def geometry(objects):
    vertices=[];faces=[];owners=[];bounds={}
    dg=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type not in ('MESH','CURVE','FONT'):continue
        ev=obj.evaluated_get(dg);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        points=[ev.matrix_world@v.co for v in mesh.vertices]
        if points:bounds[obj.name]=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
        offset=len(vertices);vertices.extend(points)
        faces.extend(tuple(offset+i for i in t.vertices) for t in mesh.loop_triangles)
        owners.extend([obj.name]*len(mesh.loop_triangles));ev.to_mesh_clear()
    return BVHTree.FromPolygons(vertices,faces,all_triangles=True),owners,bounds

report={'schema':'station-occupation-'+args.stage+'.v1','sourceSha256':source_hash,
        'reviewerSha256':w.sha(Path(__file__)),'renderReceiptSha256':w.sha(P/'render-review-02.json'),'humanApproved':False}
if args.stage=='function':
    previous=ROOT/'docs/3d-town/classic-bookshop-v2/function-review.json'
    routes=w.read(previous)['routes']
    objects=[o for o in bpy.context.scene.objects if o.get('layer')!='actor' and
             (o.get('layer')!='review_resident' or o.name in ('restorer_book_stand','restorer_felt_cradle','restorer_bound_book'))]
    tree,owners,bounds=geometry(objects)
    positions=sorted({tuple(p) for route in routes for p in route['path']})
    failures=[];minimum=1000
    for x,y in positions:
        for z in (.40,.94,1.62):
            hit=tree.find_nearest(Vector((x,y,.18+z)),2)
            if hit[0] is None:continue
            minimum=min(minimum,hit[3])
            if hit[3]<.252:failures.append({'point':[x,y,.18+z],'distance':hit[3],'object':owners[hit[2]]})
    supports=[]
    for name in sorted(n for n in bounds if n.startswith('timetable_bracket_foot')):
        gap=bounds[name][2][0]-bounds['station_counter_top'][2][1]
        supports.append({'object':name,'support':'station_counter_top','gapMeters':gap,'passed':-.003<=gap<=.001})
    report.update(routeSourceSha256=w.sha(previous),routes=[{'id':r['id'],'points':len(r['path'])} for r in routes],
                  sampledPositions=len(positions),heightsMeters=[.40,.94,1.62],playerRadiusMeters=.26,
                  minimumSampledClearanceMeters=minimum,failures=failures,supports=supports,
                  passed=not failures and len(supports)==2 and all(s['passed'] for s in supports),
                  scope='Existing selected paths rechecked against current evaluated room, actor and new props; 0.1 m grid and three body heights, not a continuous sweep.')
else:
    fn=w.read(P/'function-review.json');assert fn['passed'] and fn['sourceSha256']==source_hash
    report['functionReviewSha256']=w.sha(P/'function-review.json')
    labels=body.data.attributes['AnatomicalFinger'].data
    body.data.calc_loop_triangles();triangles=[tuple(t.vertices) for t in body.data.loop_triangles]
    skin={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
    groups={g.index for g in body.vertex_groups if g.name.startswith(('hand_','finger_'))}
    hand_ids={v.index for v in body.data.vertices if v.index in skin and sum(g.weight for g in v.groups if g.group in groups)>.5}
    hand_faces=[t for t in triangles if all(i in hand_ids for i in t)]
    garment_faces=[t for t in triangles if not any(i in hand_ids for i in t)]
    uniform=body.data.attributes['UniformPart'].data
    jacket_edges=[(a,b,(body.data.vertices[a].co-body.data.vertices[b].co).length)
                  for edge in body.data.edges for a,b in [tuple(edge.vertices)]
                  if uniform[a].value==3 and uniform[b].value==3 and (body.data.vertices[a].co-body.data.vertices[b].co).length>.0001]
    digits={d:[t for t in triangles if all(labels[i].value==d for i in t)] for d in list(range(-5,0))+list(range(1,6))}
    workplace=bpy.data.objects['occupation_workplace']
    prop_tree,_,_=geometry(workplace.children_recursive)
    nearby=[o for o in bpy.context.scene.objects if o.name.startswith(('station_counter','station_ticket_box','station_ticket_crank','station_grille'))]
    room_tree,_,_=geometry(nearby)
    page=bpy.data.objects['occupation_document_anchor'];page_inverse=page.matrix_world.inverted()
    rows=[];first_matrices=None;loop_difference=0
    for sample in range(601):
        f=1+sample/2;bpy.context.scene.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        points=[body.matrix_world@v.co for v in mesh.vertices]
        hand=BVHTree.FromPolygons(points,hand_faces,all_triangles=True)
        garment=BVHTree.FromPolygons(points,garment_faces,all_triangles=True)
        finger_trees={d:BVHTree.FromPolygons(points,faces,all_triangles=True) for d,faces in digits.items()}
        self_pairs=sum(len(finger_trees[s*a].overlap(finger_trees[s*b])) for s in (-1,1) for a in range(1,6) for b in range(a+1,6))
        finger_garment=sum(len(tree.overlap(garment)) for tree in finger_trees.values())
        bounds=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
        row={'frame':f,'time':sample/60,'handPropPairs':len(hand.overlap(prop_tree)),
             'handNearbyRoomPairs':len(hand.overlap(room_tree)),'fingerGarmentPairs':finger_garment,
             'fingerSelfPairs':self_pairs,'bodyBounds':bounds,
             'jacketEdgeStretchMaximum':max((mesh.vertices[a].co-mesh.vertices[b].co).length/rest for a,b,rest in jacket_edges)}
        if 2<=sample/60<=8:
            above=[page_inverse@points[i] for i in hand_ids]
            above=[p.z-.0037 for p in above if abs(p.x)<.16 and abs(p.y)<.14]
            row['minimumOverPaperMeters']=min(above,default=None)
        rows.append(row);evaluated.to_mesh_clear()
        matrices={b.name:[float(v) for line in b.matrix for v in line] for b in rig.pose.bones}
        if sample==0:first_matrices=matrices
        if sample==600:loop_difference=max(abs(v-first_matrices[b][i]) for b,values in matrices.items() for i,v in enumerate(values))
        if sample%120==0:print(json.dumps({'stage':'form','sample':sample,'of':601}),flush=True)
    keys=('handPropPairs','handNearbyRoomPairs','fingerGarmentPairs','fingerSelfPairs')
    maxima={k:max(r[k] for r in rows) for k in keys}
    stretch=max(r['jacketEdgeStretchMaximum'] for r in rows)
    report.update(frames=rows,maxima=maxima,sampleHz=60,loopPoseMaximumDifference=loop_difference,jacketEdgeStretchMaximum=stretch,
                  passed=all(v==0 for v in maxima.values()) and loop_difference<1e-6 and stretch<2,
                  limitations=['Sampled surface intersections do not certify all volumes or anatomically correct joint motion.',
                               'Timetable pointing is a hovering gesture; index-to-paper contact is not claimed.',
                               'Human art review and browser acceptance remain separate.'])
w.write(P/(args.stage+'-review.json'),report)
(P/'reviewer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({k:v for k,v in report.items() if k not in ('frames','routes')}),flush=True)
assert report['passed'],args.stage+' check failed'
