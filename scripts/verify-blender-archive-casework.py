"""Independently measure saved archive geometry, support and adjacent clearances."""
from pathlib import Path
import argparse,hashlib,json,sys
import bpy,bmesh
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--draft',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=ROOT/('outputs/blender-v12-draft' if args.draft else 'docs/3d-rooms/candidates/blender-v12')
source=OUT/'fog-lamp-evidence-room.blend';bpy.ops.wm.open_mainfile(filepath=str(source));deps=bpy.context.evaluated_depsgraph_get()
authored=json.loads((OUT/'archive-audit.json').read_text(encoding='utf-8'))
cache={};issues=[]
for obj in [o for o in bpy.context.scene.objects if o.get('archive_v12')]:
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
    points=[obj.matrix_world@v.co for v in mesh.vertices];faces=[tuple(t.vertices) for t in mesh.loop_triangles]
    bm=bmesh.new();bm.from_mesh(mesh);closed=all(e.is_manifold for e in bm.edges);volume=bm.calc_volume(signed=True);bm.free()
    zero=[t.index for t in mesh.loop_triangles if t.area<1e-16]
    if not closed or volume<=0 or zero:issues.append({'object':obj.name,'closed':closed,'signedVolume':volume,'degenerate':zero})
    cache[obj.name]=(points,faces);evaluated.to_mesh_clear()


def points(name):
    if name in cache:return cache[name][0]
    obj=bpy.data.objects[name];ev=obj.evaluated_get(deps);mesh=ev.to_mesh();values=[obj.matrix_world@v.co for v in mesh.vertices];ev.to_mesh_clear();return values


def bounds(names,transform=None):
    coords=[v for name in names for v in points(name)]
    if transform is not None:coords=[transform@p for p in coords]
    return [min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]


volume_checks=[];spines=[];lids=[]
for entry in authored['volumes']:
    low,high=bounds(entry['members'])
    shelf_names=[o.name for o in bpy.context.scene.objects if o.get('review_group')==entry['group'] and '_shelf_' in o.name and '_shelf_lip' not in o.name]
    shelves=[bounds([name]) for name in shelf_names]
    floor=min((b[2] for a,b in shelves),key=lambda z:abs(z-low[2]))
    ceiling=min(a[2] for a,b in shelves if a[2]>high[2])
    check={'id':entry['id'],'group':entry['group'],'bounds':[low,high],'floorGapMeters':low[2]-floor,'ceilingGapMeters':ceiling-high[2],
           'passed':abs(low[2]-floor)<.00002 and ceiling-high[2]>=.009}
    volume_checks.append(check)
    if entry['kind']=='quarter-bound-register':
        pts,faces=cache[entry['spine']];tree=BVHTree.FromPolygons(pts,faces,all_triangles=True)
        a,b=bounds([entry['spine']]);cx=(a[0]+b[0])/2;z=(a[2]+b[2])/2
        hits=[tree.ray_cast(Vector((xx,a[1]-.01,z)),Vector((0,1,0)),.04)[0] for xx in (cx,a[0]+.0005,b[0]-.0005)]
        rise=min(p.y for p in hits[1:])-hits[0].y if all(p is not None for p in hits) else None
        covers=[bounds([name]) for name in entry['members'] if '_cover_' in name]
        thicknesses=[b[0]-a[0] for a,b in covers]
        spines.append({'id':entry['id'],'frontCurvatureMeters':rise,'measuredBoardThicknessMeters':thicknesses,
                       'passed':rise is not None and .003<rise<.0036 and len(thicknesses)==2 and all(abs(t-.0035)<1e-6 for t in thicknesses)})
    else:
        lid=next(n for n in entry['members'] if n.endswith('_lid'));a,b=bounds([lid])
        lips=[n for n in entry['members'] if '_lid_seat' in n]
        gaps=[a[2]-bounds([name])[1][2] for name in lips]
        lids.append({'id':entry['id'],'lidThicknessMeters':b[2]-a[2],'supportGapsMeters':gaps,
                     'passed':len(lips)==4 and all(abs(g)<1e-6 for g in gaps) and abs(b[2]-a[2]-.007)<1e-6})

adjacent=[]
for group in sorted(set(v['group'] for v in volume_checks)):
    rows={}
    for v in volume_checks:
        if v['group']==group:rows.setdefault(round(v['bounds'][0][2],3),[]).append(v)
    for row,entries in rows.items():
        ordered=sorted(entries,key=lambda v:v['bounds'][0][0])
        for left,right in zip(ordered,ordered[1:]):
            gap=right['bounds'][0][0]-left['bounds'][1][0]
            adjacent.append({'left':left['id'],'right':right['id'],'gapMeters':gap,'passed':gap>.005})

cabinet_checks=[]
for cabinet in authored['cabinets']:
    group=cabinet['group'];inverse=Matrix(cabinet['localToWorld']).inverted()
    local=lambda name:bounds([name],inverse)
    objects=[n for n in cache if n.startswith(group+'_')]
    top=local(group+'_top');sides=[local(n) for n in objects if n.startswith(group+'_side')]
    feet=[local(n) for n in objects if n.startswith(group+'_plinth_foot')]
    top_gaps=[top[0][2]-b[2] for a,b in sides]
    drawers=[]
    for drawer in cabinet['drawers']:
        prefix=drawer['face'].removesuffix('_face');bottom=local(drawer['bottom']);face=local(drawer['face'])
        runners=[local(n) for n in objects if n.startswith(prefix+'_runner')]
        bearing=[]
        for a,b in runners:
            bearing.append({'lateralOverlapMeters':min(b[0],bottom[1][0])-max(a[0],bottom[0][0]),
                            'lengthOverlapMeters':min(b[1],bottom[1][1])-max(a[1],bottom[0][1]),'gapMeters':bottom[0][2]-b[2]})
        back=local(prefix+'_label_back');label=local(drawer['label'])
        label_gap=face[0][1]-back[1][1];paper_gap=back[0][1]-label[1][1]
        seats=[local(n) for n in objects if n.startswith(prefix+'_handle_seat')]
        seat_gaps=[face[0][1]-b[1] for a,b in seats]
        passed=len(bearing)==2 and all(v['lateralOverlapMeters']>.008 and v['lengthOverlapMeters']>.60 and abs(v['gapMeters'])<1e-6 for v in bearing)
        passed=passed and abs(label_gap)<1e-6 and abs(paper_gap)<1e-6 and len(seat_gaps)==2 and all(abs(g)<1e-6 for g in seat_gaps)
        drawers.append({'face':drawer['face'],'bearing':bearing,'labelBackToFaceGapMeters':label_gap,'paperToBackGapMeters':paper_gap,'handleSeatToFaceGapsMeters':seat_gaps,'passed':passed})
    cabinet_checks.append({'group':group,'topThicknessMeters':top[1][2]-top[0][2],'topToSideGapsMeters':top_gaps,
                           'feetFloorGapsMeters':[a[2] for a,b in feet],'drawers':drawers,
                           'passed':len(sides)==2 and len(feet)==2 and all(abs(v)<1e-6 for v in top_gaps) and all(abs(a[2])<1e-6 for a,b in feet) and len(drawers)==8 and all(d['passed'] for d in drawers)})

passed=not issues and all(r['passed'] for r in volume_checks+spines+lids+adjacent+cabinet_checks)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'schema':'game-room.archive-casework-review.v1','sourceBlendSha256':sha(source),'authoringAuditSha256':sha(OUT/'archive-audit.json'),'verifierSha256':sha(Path(__file__)),
        'meshCount':len(cache),'meshIssues':issues,'volumes':volume_checks,'roundedSpines':spines,'supportedLids':lids,'adjacentVolumeGaps':adjacent,'cabinets':cabinet_checks,
        'passed':passed,'humanApproval':False,'runtimeInteractionVerified':False,
        'scope':'Evaluated mesh closure and triangles, actual shelf bounds, spine rays, cabinet contacts and bounded support checks; not load testing or exhaustive self-intersection proof.'}
(OUT/'archive-geometry-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('ARCHIVE_GEOMETRY='+json.dumps({'passed':passed,'meshes':len(cache),'volumes':len(volume_checks),'registers':len(spines),'boxes':len(lids),'cabinets':len(cabinet_checks),'meshIssues':issues[:5]}),flush=True)
if not passed:raise RuntimeError('Saved archive geometry failed its independent checks')
