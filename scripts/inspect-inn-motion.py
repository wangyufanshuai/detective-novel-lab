"""Diagnostic surface sampling for the in-progress inn action, not acceptance."""
from pathlib import Path
import argparse,importlib.util,json,math,sys
import bpy
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
p=argparse.ArgumentParser();p.add_argument('--pilot',default='gesture-03');p.add_argument('--step',type=float,default=5);p.add_argument('--formal',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=w.PACKAGE/'resident-08'/args.pilot;source=P/'occupation.blend'
if args.formal:
    args.step=.5
    fn=w.read(P/'function-review.json');render=w.read(P/'render-review.json')
    assert fn['passed'] and fn['sourceSha256']==w.sha(source)==render['sourceSha256'] and render['complete']
    assert fn['renderReviewSha256']==w.sha(P/'render-review.json')
    for item in render['renders']:assert w.sha(P/item['path'])==item['sha256']
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
body=bpy.data.objects['rb-lin-ali_skin'];rig=bpy.data.objects['rb-lin-ali_rig'];pen=bpy.data.objects['occupation_pen_anchor'];workplace=bpy.data.objects['occupation_workplace']
w.hands.bind_action(rig,bpy.data.actions['ReconcileRegister']);pen.animation_data.action=bpy.data.actions['WriteRegister_Prop']
labels=body.data.attributes['AnatomicalFinger'].data;cloth=body.data.attributes['ArtClothLayer'].data
body.data.calc_loop_triangles();triangles=[tuple(t.vertices) for t in body.data.loop_triangles]
skin={i for p in body.data.polygons if 'skin' in body.data.materials[p.material_index].name for i in p.vertices}
groups={g.index for g in body.vertex_groups if g.name.startswith(('hand_','finger_'))}
hand_ids={v.index for v in body.data.vertices if v.index in skin and sum(g.weight for g in v.groups if g.group in groups)>.5}
hand_faces=[t for t in triangles if all(i in hand_ids for i in t)];garment_faces=[t for t in triangles if not any(i in hand_ids for i in t)]
triangle_material={tuple(t.vertices):body.data.materials[body.data.polygons[t.polygon_index].material_index].name for t in body.data.loop_triangles}
digits={f:[t for t in triangles if all(labels[i].value==f for i in t)] for f in (*range(-5,0),*range(1,6))}
layers={f:[t for t in triangles if all(cloth[i].value==f for i in t)] for f in (1,2)}
edges=[(a,b,(body.data.vertices[a].co-body.data.vertices[b].co).length) for edge in body.data.edges for a,b in [tuple(edge.vertices)] if cloth[a].value==cloth[b].value==1 and (body.data.vertices[a].co-body.data.vertices[b].co).length>1e-5]
def geometry(objects):
    v=[];f=[];owners=[]
    for o in objects:
        if o.type!='MESH':continue
        e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();offset=len(v)
        v.extend(e.matrix_world@x.co for x in m.vertices);f.extend(tuple(offset+i for i in t.vertices) for t in m.loop_triangles);owners.extend(o.name for t in m.loop_triangles);e.to_mesh_clear()
    return BVHTree.FromPolygons(v,f,all_triangles=True),owners
static=[o for o in workplace.children_recursive if o not in pen.children_recursive]
st,owners=geometry(static);rows=[];first=None;last=None
count=round(300/args.step)
for i in range(count+1):
    frame=1+i*300/count;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
    pt,_=geometry(pen.children_recursive)
    e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();v=[body.matrix_world@p.co for p in m.vertices]
    hand=BVHTree.FromPolygons(v,hand_faces,all_triangles=True);garment=BVHTree.FromPolygons(v,garment_faces,all_triangles=True)
    trees={f:BVHTree.FromPolygons(v,faces,all_triangles=True) for f,faces in digits.items()}
    ct={f:BVHTree.FromPolygons(v,faces,all_triangles=True) for f,faces in layers.items()}
    hp=hand.overlap(st);fp={str(f):len(t.overlap(pt)) for f,t in trees.items()}
    row={'frame':frame,'time':(frame-1)/30,'handPenPairs':len(hand.overlap(pt)),'handStaticPropPairs':len(hp),
        'handStaticOwners':sorted({owners[b] for a,b in hp}),'fingerPenPairs':fp,
        'fingerGarmentPairs':sum(len(t.overlap(garment)) for t in trees.values()),
        'fingerSelfPairs':sum(len(trees[s*a].overlap(trees[s*b])) for s in (-1,1) for a in range(1,6) for b in range(a+1,6)),
        'capeBlousePairs':len(ct[1].overlap(ct[2])),
        'blouseStretchMaximum':max((m.vertices[a].co-m.vertices[b].co).length/l for a,b,l in edges)}
    row['fingerGarmentByDigit']={str(f):len(t.overlap(garment)) for f,t in trees.items()}
    row['fingerGarmentMaterials']=dict(Counter(triangle_material[garment_faces[b]] for tree in trees.values() for a,b in tree.overlap(garment)))
    if 2<=row['time']<=8.25:
        row['tripodGapsMeters']={str(f):min(pt.find_nearest(v[j])[3] for j in range(len(v)) if labels[j].value==f) for f in (1,2,3)}
        if 'eye_L' in rig.pose.bones:
            target=Vector((.01,-.42,1.103));row['gazeErrorsDegrees']={}
            for side in ('L','R'):
                name='eye_'+side;b=rig.pose.bones[name];rest=rig.data.bones[name]
                aim=b.matrix.to_3x3()@(rest.matrix_local.to_3x3().inverted()@Vector((0,-1,0)))
                row['gazeErrorsDegrees'][side]=math.degrees(aim.angle(target-b.head))
    touching={j for a,b in ct[1].overlap(ct[2]) for j in layers[2][b]}
    row['capeContactRestBounds']=[[min(body.data.vertices[j].co[a] for j in touching),max(body.data.vertices[j].co[a] for j in touching)] for a in range(3)] if touching else None
    if i==0:first={b.name:[v for r in b.matrix for v in r] for b in rig.pose.bones}
    if i==count:last=max(abs(v-first[b.name][j]) for b in rig.pose.bones for j,v in enumerate(v for r in b.matrix for v in r))
    e.to_mesh_clear();rows.append(row)
    if i%30==0:print(json.dumps({'sample':i,'of':count+1,'contacts':{k:v for k,v in row.items() if k.endswith('Pairs') and not isinstance(v,dict)}}),flush=True)
keys=('handPenPairs','handStaticPropPairs','fingerGarmentPairs','fingerSelfPairs','capeBlousePairs','blouseStretchMaximum')
report={'schema':'inn-motion-diagnostic.v1','sourceSha256':w.sha(source),'inspectorSha256':w.sha(Path(__file__)),
        'sampleHz':30/args.step,'rows':rows,'maxima':{k:max(r[k] for r in rows) for k in keys},'loopMatrixDifference':last,'accepted':False}
if args.formal:
    locomotion=[]
    for clip,total in [('Idle',90),('Walk',24)]:
        w.hands.bind_action(rig,bpy.data.actions[clip])
        for frame in range(1,total+2):
            scene.frame_set(frame);bpy.context.view_layer.update();e=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();v=[body.matrix_world@p.co for p in m.vertices]
            garment=BVHTree.FromPolygons(v,garment_faces,all_triangles=True);trees={f:BVHTree.FromPolygons(v,faces,all_triangles=True) for f,faces in digits.items()}
            ct={f:BVHTree.FromPolygons(v,faces,all_triangles=True) for f,faces in layers.items()}
            locomotion.append({'clip':clip,'frame':frame,'capeBlousePairs':len(ct[1].overlap(ct[2])),
                'fingerGarmentPairs':sum(len(t.overlap(garment)) for t in trees.values()),
                'fingerSelfPairs':sum(len(trees[s*a].overlap(trees[s*b])) for s in (-1,1) for a in range(1,6) for b in range(a+1,6))});e.to_mesh_clear()
    report.update(schema='inn-occupation-form.v1',functionReviewSha256=w.sha(P/'function-review.json'),renderReviewSha256=w.sha(P/'render-review.json'),
                  locomotion=locomotion,humanArtApproved=False,
                  limitations=['Surface intersections sampled at 60 Hz for work and authored keyframes for Idle/Walk; no continuous collision proof or human anatomy certification.',
                               'Authored skeletal and prop motion; no runtime cloth or fluid simulation. Register markings remain decorative.'])
    report['passed']=all(report['maxima'][k]==0 for k in keys if k!='blouseStretchMaximum') and report['maxima']['blouseStretchMaximum']<2 and last<1e-6 and all(r[k]==0 for r in locomotion for k in ('capeBlousePairs','fingerGarmentPairs','fingerSelfPairs'))
    report['tripodGapMaximumMeters']=max(v for row in rows for v in row.get('tripodGapsMeters',{}).values())
    gaze=[v for row in rows for v in row.get('gazeErrorsDegrees',{}).values()]
    report['gazeMaximumErrorDegrees']=max(gaze,default=None)
    report['passed']=report['passed'] and report['tripodGapMaximumMeters']<.004 and len(gaze)>0 and max(gaze)<2
    w.write(P/'form-review.json',report)
else:w.write(P/'diagnostic-motion.json',report)
(P/'motion-inspector.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'maxima':report['maxima'],'loopMatrixDifference':last,'passed':report.get('passed')}),flush=True)
