"""Rebuild real circulation routes with the new inn desk and verify mesh clearance."""
from pathlib import Path
from collections import deque
import argparse,importlib.util,json,math,sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
p=argparse.ArgumentParser();p.add_argument('--pilot',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=w.PACKAGE/'resident-08'/args.pilot;source=P/'occupation.blend';identity=w.sha(source)
assert w.read(P/'authoring-review.json')['sourceSha256']==identity
render=w.read(P/'render-review.json');assert render['complete'] and render['sourceSha256']==identity
for item in render['renders']:assert w.sha(P/item['path'])==item['sha256']
bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.scene.frame_set(151);bpy.context.view_layer.update()
v=[];f=[];owners=[];bounds={};prop_points=[];workplace=bpy.data.objects['occupation_workplace'];prop_ids={o.name for o in workplace.children_recursive}
for o in bpy.context.scene.objects:
    if o.type not in ('MESH','CURVE','FONT'):continue
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();m.calc_loop_triangles();points=[e.matrix_world@x.co for x in m.vertices]
    if points:bounds[o.name]=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
    if o.name in prop_ids:prop_points.extend(points)
    if o.get('layer')!='actor' and (o.get('layer')!='review_resident' or o.name in ('restorer_book_stand','restorer_felt_cradle','restorer_bound_book')):
        offset=len(v);v.extend(points);f.extend(tuple(offset+i for i in t.vertices) for t in m.loop_triangles);owners.extend(o.name for t in m.loop_triangles)
    e.to_mesh_clear()
tree=BVHTree.FromPolygons(v,f,all_triangles=True)
contract_path=ROOT/'docs/3d-town/classic-bookshop-v2/scene-contract.json';scene=w.read(contract_path)
cast_path=ROOT/'public/assets/classic-occupations/v1/cast.json';cast=w.read(cast_path)
pb=[[min(p[a] for p in prop_points),max(p[a] for p in prop_points)] for a in range(3)]
for entry in cast['entries']:
    scene['colliders'].append({'id':'art_'+entry['actorId'],'center':entry['position'],'size':[.62,.44],'angle':-entry['yaw']})
    scene['interactions'].append({'id':'art_'+entry['actorId'],'position':entry['observationPosition']})
    manifest=w.read(ROOT/('public'+entry['manifestUrl']))
    if entry['actorId']=='resident-08':
        scene['colliders'].append({'id':'workplace_resident-08','center':[(pb[a][0]+pb[a][1])/2 for a in (0,1)],'size':[pb[a][1]-pb[a][0] for a in (0,1)],'angle':0})
    elif manifest.get('workAction'):
        c=manifest['workAction']['collider'];a=-entry['yaw'];scene['colliders'].append({'id':'workplace_'+entry['actorId'],'center':[entry['position'][0]+math.cos(a)*c['center'][0]-math.sin(a)*c['center'][1],entry['position'][1]+math.sin(a)*c['center'][0]+math.cos(a)*c['center'][1]],'size':c['size'],'angle':a})
r=scene['player']['radius'];step=.10
def valid(x,y):
    b=scene['bounds']
    if not(b[0]+r<=x<=b[1]-r and b[2]+r<=y<=b[3]-r):return False
    for c in scene['colliders']:
        dx=x-c['center'][0];dy=y-c['center'][1];a=c['angle'];xx=math.cos(a)*dx+math.sin(a)*dy;yy=-math.sin(a)*dx+math.cos(a)*dy
        if math.hypot(max(abs(xx)-c['size'][0]/2,0),max(abs(yy)-c['size'][1]/2,0))<=r+.012:return False
    return True
start=tuple(round(x/step) for x in scene['player']['spawn']);queue=deque([start]);parents={start:None}
while queue:
    x,y=queue.popleft()
    for q in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
        if q not in parents and valid(q[0]*step,q[1]*step):parents[q]=(x,y);queue.append(q)
targets=scene['interactions']+[{'id':'shop-staff-aisle','position':[.60,3.30]},{'id':'inn-back-aisle','position':[3.65,5.35]},{'id':'station-staff-aisle','position':[-10.44,5.40]}];routes=[]
for target in targets:
    q=min(parents,key=lambda p:math.hypot(p[0]*step-target['position'][0],p[1]*step-target['position'][1]));distance=math.hypot(q[0]*step-target['position'][0],q[1]*step-target['position'][1]);path=[]
    while q is not None:path.append([round(q[0]*step,4),round(q[1]*step,4)]);q=parents[q]
    routes.append({'id':target['id'],'reachable':distance<.16,'targetValid':valid(*target['position']),'endErrorMeters':distance,'path':path[::-1]})
positions={tuple(p) for route in routes for p in route['path']};failures=[];minimum=1000
for x,y in positions:
    for z in (.40,.94,1.62):
        h=tree.find_nearest(Vector((x,y,.18+z)),2)
        if h[0] is None:continue
        minimum=min(minimum,h[3])
        if h[3]<r-.008:failures.append({'point':[x,y,.18+z],'distance':h[3],'object':owners[h[2]]})
supports=[]
for name in bounds:
    if name.startswith('registration_turned_leg'):
        gap=bounds[name][2][0]-.18;supports.append({'object':name,'support':'floor','gapMeters':gap,'passed':abs(gap)<.002})
for name in ('register_bound_cover','pen_rest_base'):
    gap=bounds[name][2][0]-bounds['registration_desk_top'][2][1];supports.append({'object':name,'support':'registration_desk_top','gapMeters':gap,'passed':-.002<=gap<=.002})
passed=all(x['reachable'] and x['targetValid'] for x in routes) and not failures and len(supports)==6 and all(x['passed'] for x in supports)
report={'schema':'inn-occupation-function.v1','sourceSha256':identity,'reviewerSha256':w.sha(Path(__file__)),'renderReviewSha256':w.sha(P/'render-review.json'),
    'sceneContractSha256':w.sha(contract_path),'castSha256':w.sha(cast_path),'routes':routes,'sampledPositions':len(positions),'gridMeters':step,
    'heightsMeters':[.40,.94,1.62],'playerRadiusMeters':r,'minimumSampledClearanceMeters':minimum,'failures':failures,'supports':supports,'workplaceWorldBounds':pb,
    'passed':passed,'humanFunctionApproved':False,'scope':'Replanned authored routes checked against current room meshes at three body heights; not a continuous swept-volume proof.'}
w.write(P/'function-review.json',report);print(json.dumps({'passed':passed,'positions':len(positions),'failures':failures[:10],'supports':supports}),flush=True)
