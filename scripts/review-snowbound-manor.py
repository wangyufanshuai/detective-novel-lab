"""Measure actual source geometry and navigation; never issue human art approval."""
from pathlib import Path
from mathutils import Vector
import bpy,bmesh,json,math,hashlib,heapq

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/snowbound-manor-v1'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,data):(P/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    source=P/'snowbound-manor.blend';bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get();shell=[];triangles=0;source_bounds={}
    for obj in bpy.context.scene.objects:
        if obj.type not in ['MESH','CURVE','FONT']:continue
        ev=obj.evaluated_get(dg);data=ev.to_mesh();data.calc_loop_triangles();triangles+=len(data.loop_triangles)
        if obj.get('structuralShell'):
            bm=bmesh.new();bm.from_mesh(data)
            shell.append({'id':obj.name,'vertices':len(data.vertices),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'unappliedBooleans':sum(m.type=='BOOLEAN' for m in obj.modifiers)})
            bm.free()
        if obj.get('instance'):
            box=source_bounds.setdefault(obj['instance'],[[float('inf')]*3,[-float('inf')]*3])
            for v in data.vertices:
                p=ev.matrix_world@v.co
                for i in range(3):box[0][i]=min(box[0][i],p[i]);box[1][i]=max(box[1][i],p[i])
        ev.to_mesh_clear()
    apertures=[]
    for o in read(P/'openings.json')['openings']:
        wall=bpy.data.objects[o['wall']];axis=1 if o['axis']=='y' else 0
        center=Vector(o['center']);direction=Vector((0,1,0)) if axis==1 else Vector((1,0,0))
        hits=0
        for a in [-.4,0,.4]:
            for b in [-.4,0,.4]:
                origin=center-direction*1.2;origin[1-axis]+=a*o['clearWidth'];origin.z+=b*o['clearHeight']
                inv=wall.matrix_world.inverted();hit,*_=wall.ray_cast(inv@origin,(inv.to_3x3()@direction).normalized(),distance=2.4)
                hits+=int(hit)
        apertures.append({'id':o['id'],'wall':o['wall'],'rays':9,'blockedRays':hits,'clearWidth':o['clearWidth'],'clearHeight':o['clearHeight']})
    nav=read(P/'scene-contract.json');r=nav['player']['radius']
    def valid(p):
        x,y=p;b=nav['bounds']
        if x<b[0]+r or x>b[1]-r or y<b[2]+r or y>b[3]-r:return False
        for o in nav['colliders']:
            dx=x-o['center'][0];dy=y-o['center'][1];c=math.cos(o['angle']);s=math.sin(o['angle'])
            xx=c*dx+s*dy;yy=-s*dx+c*dy
            gapx=max(0,abs(xx)-o['size'][0]/2);gapy=max(0,abs(yy)-o['size'][1]/2)
            if math.hypot(gapx,gapy)<r+.012:return False
        return True
    step=.10;origin=(-5.6,-3.0)
    def cell(p):return(round((p[0]-origin[0])/step),round((p[1]-origin[1])/step))
    def point(p):return(origin[0]+p[0]*step,origin[1]+p[1]*step)
    def path(start,end):
        a,b=cell(start),cell(end);queue=[(0,a)];cost={a:0};parents={a:None}
        while queue:
            _,p=heapq.heappop(queue)
            if p==b:
                route=[]
                while p is not None:route.append(point(p));p=parents[p]
                return list(reversed(route))
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                q=(p[0]+dx,p[1]+dy);pt=point(q)
                if not valid(pt):continue
                if not valid(((point(p)[0]+pt[0])/2,(point(p)[1]+pt[1])/2)):continue
                new=cost[p]+math.hypot(dx,dy)
                if new<cost.get(q,float('inf')):
                    cost[q]=new;parents[q]=p;heapq.heappush(queue,(new+math.dist(q,b),q))
        return None
    routes=[]
    targets=[{'id':'main-arrival','position':[0,-2.6]}]+nav['interactions']
    for target in targets:
        route=path(nav['player']['spawn'],target['position'])
        routes.append({'id':target['id'],'reachable':route is not None,'samples':len(route) if route else 0,'path':route})
    failures=[]
    if any(o['nonManifoldEdges'] for o in shell):failures.append('structural shell non-manifold edges')
    if any(o['blockedRays'] for o in apertures):failures.append('blocked declared aperture')
    if any(not p['reachable'] for p in routes):failures.append('unreachable destination')
    report={'schema':'snowbound-function-review.v1','sourceSha256':sha(source),'sceneContractSha256':sha(P/'scene-contract.json'),
            'sourceTriangles':triangles,'structuralShells':shell,'apertureChecks':apertures,'routes':routes,
            'evaluatedInstanceBounds':source_bounds,'failures':failures,'passedAutomatedSubset':not failures,
            'humanApproved':False,'scope':'source shell/apertures and 2D navigation only; no visual, live runtime, device or Agent acceptance'}
    write('function-review.json',report)
    print(json.dumps({'triangles':triangles,'shells':len(shell),'apertures':len(apertures),'routes':[(r['id'],r['reachable']) for r in routes],'failures':failures}),flush=True)

if __name__=='__main__':main()
