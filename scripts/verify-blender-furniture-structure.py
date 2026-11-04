"""Independent measurements of the saved v10 table and drawer clearances."""
from pathlib import Path
import hashlib,json
import bpy,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v10'
source=OUT/'fog-lamp-evidence-room.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));deps=bpy.context.evaluated_depsgraph_get()

def bounds(obj):
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
    points=[obj.matrix_world@v.co for v in mesh.vertices];evaluated.to_mesh_clear()
    return [min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)]

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
objects=[o for o in bpy.context.scene.objects if o.get('furniture_v10')]
closed=[];degenerate=[]
for obj in objects:
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
    zero=[t.index for t in mesh.loop_triangles if t.area<1e-16]
    if zero:degenerate.append({'object':obj.name,'triangles':zero})
    bm=bmesh.new();bm.from_mesh(mesh)
    if not all(e.is_manifold for e in bm.edges) or bm.calc_volume(signed=True)<=0:closed.append(obj.name)
    bm.free();evaluated.to_mesh_clear()
pad=bpy.data.objects['hero-evidence-table-01__tray-felt'];low,high=bounds(pad)
leather={'thicknessMeters':high[2]-low[2],'topMeters':high[2],'passed':abs(high[2]-low[2]-.003)<1e-6 and abs(high[2]-.9635)<1e-6}
boards=[]
for i in range(5):
    obj=bpy.data.objects[f'furniture_top_board_{i}'];a,b=bounds(obj)
    boards.append({'object':obj.name,'thicknessMeters':b[2]-a[2],'topMeters':b[2],
                   'passed':abs(b[2]-a[2]-.048)<1e-6 and abs(b[2]-low[2])<1e-6})
contacts=[]
for obj in [o for o in objects if o.name.startswith('furniture_tapered_leg_')]:
    a,b=bounds(obj);x=(a[0]+b[0])/2;y=(a[1]+b[1])/2
    soles=[o for o in objects if o.name.startswith('furniture_foot_sole_') and abs(o.location.x-x)<1e-5 and abs(o.location.y-y)<1e-5]
    if len(soles)!=1:raise RuntimeError('A table leg must have exactly one matching sole')
    c,d=bounds(soles[0]);bottom_gap=a[2]-d[2];upper_gap=min(bounds(bpy.data.objects[f'furniture_top_board_{i}'])[0][2] for i in range(5))-b[2]
    contacts.append({'leg':obj.name,'sole':soles[0].name,'legToSoleGapMeters':bottom_gap,'soleToFloorGapMeters':c[2],
                     'legToTopGapMeters':upper_gap,'passed':abs(bottom_gap)<1e-5 and abs(c[2])<1e-6 and abs(upper_gap)<1e-5})
front_bounds=[bounds(bpy.data.objects[f'furniture_drawer_face_{i}']) for i in range(3)]
opening=(front_bounds[0][0][1]+front_bounds[2][0][1])/2-front_bounds[1][0][1]
gaps=[front_bounds[1][0][0]-front_bounds[0][1][0],front_bounds[2][0][0]-front_bounds[1][1][0]]
runners=[]
for i in range(3):
    a,b=bounds(bpy.data.objects[f'furniture_drawer_bottom_{i}'])
    for side in (-1,1):
        runner=bpy.data.objects[f'furniture_drawer_runner_{i}_{side}'];c,d=bounds(runner)
        overlap=min(b[1],d[1])-max(a[1],c[1]);gap=a[2]-d[2]
        runners.append({'drawer':i,'side':side,'bearingOverlapMeters':overlap,'verticalGapMeters':gap,'passed':overlap>.15 and abs(gap)<1e-5})
positions=[];triangles=[]
for obj in objects:
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();start=len(positions)
    positions.extend(obj.matrix_world@v.co for v in mesh.vertices)
    triangles.extend(tuple(start+j for j in t.vertices) for t in mesh.loop_triangles);evaluated.to_mesh_clear()
tree=BVHTree.FromPolygons(positions,triangles,all_triangles=True)
# This segment is above the open drawer lip and below the desk underside.
hit=tree.ray_cast(Vector((0,-.32,.900)),Vector((0,1,0)),.21)
drawer={'openingMeters':opening,'frontSideGapsMeters':gaps,'runners':runners,'airSegmentClear':hit[0] is None,
        'passed':abs(opening-.14)<1e-6 and min(gaps)>.004 and all(r['passed'] for r in runners) and hit[0] is None,
        'scope':'Static fit and support; no animation, collision response or load certification.'}
passed=not closed and not degenerate and leather['passed'] and len(contacts)==4 and all(c['passed'] for c in contacts) and all(b['passed'] for b in boards) and drawer['passed']
report={'schema':'game-room.furniture-structure-review.v1','sourceBlendSha256':sha(source),'verifierSha256':sha(Path(__file__)),
    'checkedMeshes':len(objects),'nonClosedOrInwardMeshes':closed,'degenerateTriangles':degenerate,'leather':leather,
    'boards':boards,'legContacts':contacts,'drawer':drawer,'passed':passed,'humanApproval':False,'runtimeInteractionVerified':False}
(OUT/'furniture-structure-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('FURNITURE_STRUCTURE='+json.dumps(report),flush=True)
if not passed:raise RuntimeError('Furniture structure review failed')
