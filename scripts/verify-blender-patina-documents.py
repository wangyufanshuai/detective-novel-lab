"""Measure saved document surfaces and actual edge cuts independently of authoring."""
from pathlib import Path
import sys,json,hashlib,math
import bpy,bmesh
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/('outputs/blender-v11-draft' if '--draft' in sys.argv else 'docs/3d-rooms/candidates/blender-v11')
source=OUT/'fog-lamp-evidence-room.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
deps=bpy.context.evaluated_depsgraph_get()
def geometry(obj):
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
    points=[obj.matrix_world@v.co for v in mesh.vertices];triangles=[tuple(t.vertices) for t in mesh.loop_triangles]
    bm=bmesh.new();bm.from_mesh(mesh)
    quality={'closed':all(e.is_manifold for e in bm.edges),'volumeMeters3':bm.calc_volume(signed=True)*obj.matrix_world.to_3x3().determinant(),
             'degenerateTriangles':[t.index for t in mesh.loop_triangles if t.area<1e-16]}
    bm.free();evaluated.to_mesh_clear()
    return points,BVHTree.FromPolygons(points,triangles,all_triangles=True),quality
def at(tree,x,y,from_top):
    hit=tree.ray_cast(Vector((x,y,1.1 if from_top else .9)),Vector((0,0,-1 if from_top else 1)),.25)
    return hit[0].z if hit[0] else None
center=Vector((-.16,.33,0));rot=Matrix.Rotation(.07,3,'Z')
points=[center+rot@Vector((x,y,0)) for x in [-.24,-.18,-.12,-.06,0,.06,.12,.18,.24] for y in [-.135,-.09,-.045,0,.045,.09,.135]]
records=[];trees=[];surfaces=[]
for index in range(4):
    obj=bpy.data.objects[f'folio_paper_{index}'];vertices,tree,quality=geometry(obj);trees.append(tree)
    heights=[(at(tree,p.x,p.y,False),at(tree,p.x,p.y,True)) for p in points]
    if any(a is None or b is None for a,b in heights):raise RuntimeError('A declared common page sample misses geometry')
    thickness=[b-a for a,b in heights];surfaces.append(heights)
    record={'object':obj.name,**quality,'sampleCount':len(points),'minimumThicknessMeters':min(thickness),'maximumThicknessMeters':max(thickness),
            'surfaceRiseMeters':max(v.z for v in vertices)-min(v.z for v in vertices)-.0003}
    record['passed']=quality['closed'] and quality['volumeMeters3']>0 and not quality['degenerateTriangles'] and max(abs(v-.0003) for v in thickness)<1e-6 and .003<record['surfaceRiseMeters']<.015
    records.append(record)
gaps=[]
for index in range(1,4):
    values=[surfaces[index][j][0]-surfaces[index-1][j][1] for j in range(len(points))]
    gaps.append({'lowerLayer':index-1,'upperLayer':index,'minimumGapMeters':min(values),'maximumGapMeters':max(values),'passed':min(values)>.000035 and max(values)<.001})
cover_vertices,cover_tree,cover_quality=geometry(bpy.data.objects['folio_cover'])
cover_thickness=max(v.z for v in cover_vertices)-min(v.z for v in cover_vertices)
cover_gap=min(surfaces[0][j][0]-at(cover_tree,p.x,p.y,True) for j,p in enumerate(points))
ink=[]
for obj in bpy.context.scene.objects:
    if not obj.name.startswith(('folio_heading','folio_ink_rule','folio_margin')):continue
    vertices,_,quality=geometry(obj);distances=[trees[-1].find_nearest(v)[3] for v in vertices]
    ink.append({'object':obj.name,'maximumDistanceToPaperMeters':max(distances),'passed':max(distances)<.00015,**quality})
_,wood_tree,wood_quality=geometry(bpy.data.objects['furniture_top_board_0'])
def front(x):
    hit=wood_tree.ray_cast(Vector((x,-.17,.9596)),Vector((0,1,0)),.05)
    if hit[0] is None:raise RuntimeError('Missing front board surface')
    return hit[0].y
control=front(-.60);cuts=[{'xMeters':x,'recessDepthRelativeToUncutMeters':front(x)-control} for x in (-.94,.18,.83)]
for cut in cuts:cut['passed']=.0007<cut['recessDepthRelativeToUncutMeters']<.004
wire_points,_,wire_quality=geometry(bpy.data.objects['folio_clip_wire'])
_,clip_tree,_=geometry(bpy.data.objects['folio_clip_base'])
local=[rot.transposed()@(p-center) for p in wire_points]
top_paper=surfaces[-1][0][1]
seats=[center+rot@Vector((x,.153,top_paper+.0087)) for x in (-.154,-.106)]
wire={'widthMeters':max(p.x for p in local)-min(p.x for p in local),'heightMeters':max(p.z for p in local)-min(p.z for p in local),
      'endToBodyDistancesMeters':[clip_tree.find_nearest(p)[3] for p in seats],**wire_quality}
wire['passed']=.048<wire['widthMeters']<.055 and .012<wire['heightMeters']<.016 and max(wire['endToBodyDistancesMeters'])<.001 and wire_quality['closed'] and not wire_quality['degenerateTriangles']
passed=all(r['passed'] for r in records+gaps+ink+cuts+[wire]) and cover_quality['closed'] and abs(cover_thickness-.0008)<1e-6 and .00003<cover_gap<.00008 and wood_quality['closed'] and not wood_quality['degenerateTriangles']
report={'schema':'game-room.document-geometry-review.v1','sourceBlendSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'verifierSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'leaves':records,'interleafSamples':gaps,'print':ink,
        'cardThicknessMeters':cover_thickness,'cardToPaperMinimumGapMeters':cover_gap,'edgeCutSamples':cuts,'frontBoard':wood_quality,'clipHandle':wire,
        'passed':passed,'humanApproval':False,'scope':'63 shared XY samples per leaf; printed-vertex nearest distance; three cut rays and one uncut control. Not an exhaustive self-intersection proof.'}
(OUT/'document-geometry-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('DOCUMENT_GEOMETRY='+json.dumps(report),flush=True)
if not passed:raise RuntimeError('Document or edge-cut geometry did not pass')
