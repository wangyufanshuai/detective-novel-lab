"""Measured three-room circulation, openings, mesh distances and selected supports."""
from collections import deque
from pathlib import Path
import argparse,hashlib,json,math,sys,time
import bpy,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1];PACKAGE=ROOT/'docs/3d-town/classic-bookshop-v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preflight',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    source=PACKAGE/'classic-bookshop.blend';author=read(PACKAGE/'authoring-receipt.json');identity=sha(source);render=read(PACKAGE/'render-receipt.json');assert identity==author['source']['sha256']==render['sourceSha256']
    for item in author['inputs']:assert sha(ROOT/item['path'])==item['sha256'],item['path']
    for item in render['renders']:assert sha(PACKAGE/item['path'])==item['sha256']
    if not args.preflight:assert render['complete'],'Complete camera set before the Function review'
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update();scene=read(PACKAGE/'scene-contract.json');r=scene['player']['radius'];step=.10
    cast=read(ROOT/'public/assets/classic-residents/v10/cast.json')
    for e in cast['entries']:
        scene['colliders'].append({'id':'art_'+e['actorId'],'center':e['position'],'size':[.62,.44],'angle':-e['yaw']})
        scene['interactions'].append({'id':'art_'+e['actorId'],'position':e['observationPosition']})
        actor=read(ROOT/('public'+e['manifestUrl']))
        if actor.get('workAction'):
            c=actor['workAction']['collider'];a=-e['yaw']
            scene['colliders'].append({'id':'workplace_'+e['actorId'],'center':[e['position'][0]+math.cos(a)*c['center'][0]-math.sin(a)*c['center'][1],e['position'][1]+math.sin(a)*c['center'][0]+math.cos(a)*c['center'][1]],'size':c['size'],'angle':a})
    def valid(x,y):
        b=scene['bounds']
        if not(b[0]+r<=x<=b[1]-r and b[2]+r<=y<=b[3]-r):return False
        for c in scene['colliders']:
            dx=x-c['center'][0];dy=y-c['center'][1];a=c['angle'];xx=math.cos(a)*dx+math.sin(a)*dy;yy=-math.sin(a)*dx+math.cos(a)*dy
            if math.hypot(max(abs(xx)-c['size'][0]/2,0),max(abs(yy)-c['size'][1]/2,0))<=r+.012:return False
        return True
    start=tuple(round(v/step) for v in scene['player']['spawn']);queue=deque([start]);parents={start:None}
    while queue:
        x,y=queue.popleft()
        for q in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if q not in parents and valid(q[0]*step,q[1]*step):parents[q]=(x,y);queue.append(q)
    targets=scene['interactions']+[{'id':'shop-staff-aisle','position':[.60,3.30]},{'id':'inn-back-aisle','position':[3.65,5.35]},{'id':'station-staff-aisle','position':[-10.44,5.40]}];routes=[]
    for t in targets:
        q=min(parents,key=lambda p:math.hypot(p[0]*step-t['position'][0],p[1]*step-t['position'][1]));distance=math.hypot(q[0]*step-t['position'][0],q[1]*step-t['position'][1]);path=[]
        while q is not None:path.append([round(q[0]*step,4),round(q[1]*step,4)]);q=parents[q]
        routes.append({'id':t['id'],'targetValid':valid(*t['position']),'reachable':distance<.16,'endErrorMeters':distance,'path':path[::-1]})
    apertures=[];manifold=[]
    for item in read(PACKAGE/'openings.json')['openings']:
        wall=bpy.data.objects[item['wall']];p=Vector(item['center']);axis=Vector((0,1,0) if item['axis']=='y' else (1,0,0));apertures.append({'id':item['id'],'wall':wall.name,'clearCenterRay':not wall.ray_cast(p-axis*1.3,axis,distance=2.6)[0],'clearWidth':item['clearWidth'],'clearHeight':item['clearHeight'],'booleanApplied':item['booleanApplied']})
    for obj in bpy.data.objects:
        if obj.get('structuralShell'):
            bm=bmesh.new();bm.from_mesh(obj.data);bad=sum(not e.is_manifold for e in bm.edges);bm.free();manifold.append({'wall':obj.name,'nonManifoldEdges':bad})
    dg=bpy.context.evaluated_depsgraph_get();vertices=[];faces=[];owners=[];bounds={};triangles=0
    for obj in bpy.context.scene.objects:
        if obj.type not in ('MESH','CURVE','FONT'):continue
        ev=obj.evaluated_get(dg);mesh=ev.to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles) if obj.get('layer')!='review_resident' else 0;points=[ev.matrix_world@v.co for v in mesh.vertices]
        if points:bounds[obj.name]=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]
        if obj.get('layer')!='actor' and (obj.get('layer')!='review_resident' or obj.name in ('restorer_book_stand','restorer_felt_cradle','restorer_bound_book')):
            offset=len(vertices);vertices.extend(points);faces.extend(tuple(offset+i for i in t.vertices) for t in mesh.loop_triangles);owners.extend([obj.name]*len(mesh.loop_triangles))
        ev.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True);positions={tuple(p) for route in routes for p in route['path']};hits=[];minimum=1000
    for x,y in sorted(positions):
        for z in (.40,.94,1.62):
            hit=tree.find_nearest(Vector((x,y,scene['floor']+z)),2)
            if hit[0] is None:continue
            minimum=min(minimum,hit[3])
            if hit[3]<r-.008:hits.append({'position':[x,y,scene['floor']+z],'distance':hit[3],'object':owners[hit[2]]})
    supports=[]
    for name,parent in [('station_ticket_stack','station_counter_top'),('station_ticket_box','station_counter_top'),('station_staff_ledger_cover','station-ticket-desk_top'),('station_rack_case_leather','station_rack_slat'),('station_trolley_case_leather','station_trolley_bed'),('station_trolley_parcel','station_trolley_case_leather')]:
        gap=bounds[name][2][0]-bounds[parent][2][1];supports.append({'object':name,'support':parent,'gapMeters':gap,'passed':-.0055<=gap<=.003})
    for name in ('station-bench-front_foot','station-bench-rear_foot','station_counter_base','station_rack_foot','station_trolley_wheel'):
        gap=bounds[name][2][0]-scene['floor'];supports.append({'object':name,'support':'floor','gapMeters':gap,'passed':abs(gap)<.003})
    for name,wall,axis,positive in [('shop_v2_rear_backing','shop_ground_rear',1,True),('shop_v2_west_backing','shop_ground_side_-6.43',0,False),('shop_v2_east_backing','shop_ground_side_1.23',0,True),('shop_v2_sconce_plate','shop_ground_rear',1,True),('shop_v2_sconce_plate.001','shop_ground_rear',1,True)]:
        gap=bounds[wall][axis][0]-bounds[name][axis][1] if positive else bounds[name][axis][0]-bounds[wall][axis][1]
        supports.append({'object':name,'support':wall,'gapMeters':gap,'passed':-.0055<=gap<=.003})
    # Measured mesh bounds, including arms/feet, at the declared aisle sections.
    # These are local section widths, not an accessibility certification.
    def group_bounds(prefix):
        selected=[b for name,b in bounds.items() if name.startswith(prefix)]
        assert selected,prefix
        return [[min(b[a][0] for b in selected),max(b[a][1] for b in selected)] for a in range(3)]
    front=group_bounds('station-bench-front');rear=group_bounds('station-bench-rear')
    public_width=rear[1][0]-front[1][1]
    staff_width=bounds['station_rear_wall'][1][0]-bounds['station_counter_top'][1][1]
    aisle_sections=[{'id':'between-facing-benches','widthMeters':public_width,'targetMeters':1.2,'passed':public_width>=1.2},{'id':'rear-staff-aisle-west-of-desk','widthMeters':staff_width,'targetMeters':1.0,'passed':staff_width>=1.0}]
    fonts=[{'object':o.name,'font':o.data.font.name} for o in bpy.data.objects if o.type=='FONT'];font_ok=all(o['font']=='Railway Serif Study Regular' for o in fonts)
    cameras=[]
    for name in read(PACKAGE/'room-brief.json')['requiredViews']:
        if not name.startswith('shop-') or 'production' in name or 'plan-' in name:continue
        hit=tree.find_nearest(bpy.data.objects[name].location,1);dist=hit[3] if hit[0] is not None else None;cameras.append({'camera':name,'nearestSurface':owners[hit[2]] if hit[0] is not None else None,'distanceMeters':dist,'passed':dist is None or dist>.04})
    passed=valid(*scene['player']['spawn']) and all(t['targetValid'] and t['reachable'] for t in routes) and not hits and all(a['clearCenterRay'] and a['booleanApplied'] for a in apertures) and all(m['nonManifoldEdges']==0 for m in manifold) and all(s['passed'] for s in supports) and all(c['passed'] for c in cameras) and all(a['passed'] for a in aisle_sections) and font_ok and triangles<=read(PACKAGE/'room-brief.json')['performanceBudget']['maxSceneTriangles']
    report={'schema':'classic-bookshop-function.v2','stage':'construction-preflight' if args.preflight else 'function-candidate','createdAtUnix':time.time(),'passed':passed,'sourceSha256':identity,'sceneContractSha256':sha(PACKAGE/'scene-contract.json'),'renderReceiptSha256':sha(PACKAGE/'render-receipt.json'),'reviewerScriptSha256':sha(Path(__file__)),'evaluatedTriangles':triangles,'gridMeters':step,'routes':routes,'apertures':apertures,'wallManifoldChecks':manifold,'meshRouteClearance':{'points':len(positions),'heights':[.40,.94,1.62],'minimumDistanceMeters':minimum,'failures':hits,'passed':not hits},'measuredSupports':supports,'cameraClearance':cameras,'fontDependency':{'name':'Railway Serif Study','license':'SIL-OFL-1.1','allSignsVerified':font_ok},'humanFunctionApproved':False,'residentPositionsSourceSha256':sha(ROOT/'public/assets/classic-residents/v10/cast.json'),'scope':'Selected routes sampled on a 0.10 m grid against conservative envelopes and actual mesh BVH distances at three heights. Selected support contacts, structural manifoldness and center aperture rays. Not a proof of all continuous paths or all object intersections.'}
    report['measuredAisleSections']=aisle_sections
    write(PACKAGE/('construction-preflight.json' if args.preflight else 'function-review.json'),report)
    print(json.dumps({'passed':passed,'triangles':triangles,'badRoutes':[t['id'] for t in routes if not(t['targetValid'] and t['reachable'])],'meshHits':hits[:12],'minimumDistance':minimum,'supports':supports,'cameras':cameras},ensure_ascii=False),flush=True)
    assert passed,'Station geometry/circulation checks failed'

if __name__=='__main__':main()
