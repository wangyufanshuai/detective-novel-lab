"""Review the v2 room after its full source-bound camera set is rendered."""
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-railway-v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    helper=ROOT/'scripts/review-blender-classic-railway.py'
    spec=importlib.util.spec_from_file_location('base_review',helper);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base);base.PACKAGE=PACKAGE;base.main()
    report=read(PACKAGE/'function-review.json');scene=read(PACKAGE/'scene-contract.json')
    dg=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
    bounds={}
    for obj in bpy.context.scene.objects:
        if obj.type not in ('MESH','FONT','CURVE') or obj.get('layer')=='actor':continue
        ev=obj.evaluated_get(dg);mesh=ev.to_mesh();points=[ev.matrix_world@v.co for v in mesh.vertices]
        if points:bounds[obj.name]=(min(v.z for v in points),max(v.z for v in points))
        mesh.calc_loop_triangles();offset=len(verts);verts.extend(points);faces.extend(tuple(offset+i for i in t.vertices) for t in mesh.loop_triangles);ev.to_mesh_clear()
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
    route_points={tuple(p) for route in report['routes'] for p in route['path']}
    failures=[];minimum=1000;count=0
    for x,y in sorted(route_points):
        for z in (.40,.94,1.62):
            point=Vector((x,y,scene['floor']+z));hit=tree.find_nearest(point,2)
            count+=1
            if hit[0] is None:continue
            minimum=min(minimum,hit[3])
            if hit[3]<scene['player']['radius']-.008:
                failures.append({'position':list(point),'distance':hit[3],'nearestSurface':list(hit[0])})
    support=[]
    pairs=[('console_lamp_base','side-console_top'),('reading_lamp_base',None)]
    pairs.extend((o.name,'mantel_profile') for o in bpy.data.objects if o.name.startswith(('mantel_book','mantel_candlestick_foot')))
    for name,parent in pairs:
        assert name in bounds and (parent is None or parent in bounds),(name,parent)
        target=bounds[parent][1] if parent else scene['floor'];gap=bounds[name][0]-target
        support.append({'object':name,'support':parent or 'floor','verticalGapMeters':gap,'passed':abs(gap)<.003})
    fonts=[{'object':o.name,'font':o.data.font.name,'body':o.data.body} for o in bpy.data.objects if o.type=='FONT']
    font_ok=all(f['font']=='Railway Serif Study Regular' for f in fonts)
    report.update(schema='classic-function-review.v2',reviewerScriptSha256=sha(Path(__file__)),baseReviewerSha256=sha(helper),
        scope='Source aperture/manifold tests, authored capsule BFS, static mesh BVH sphere clearance sampled at three body heights along grid routes, and measured vertical support. Sampled clearance does not prove continuous arbitrary player motion or all furniture intersections.',
        meshRouteClearance={'sampleCount':count,'uniqueRoutePoints':len(route_points),'bodyHeightsMeters':[.40,.94,1.62],'minimumDistanceMeters':minimum,'requiredRadiusMeters':scene['player']['radius'],'toleranceMeters':.008,'failures':failures,'passed':not failures},
        measuredSupports=support,fontObjects=fonts,fontDependency={'name':'Railway Serif Study','license':'SIL-OFL-1.1','provenance':'licensed/provenance.json','licensePath':'licensed/font-OFL.txt','allSignFontsVerified':font_ok},
        actorScope='The v1 static actor remains a source scale reference. The playable route independently loads classic-investigator/v1 with skin and Idle/Walk clips; that companion has its own source/runtime review.',
        humanFunctionApproved=False)
    report['triangleBudgetPassed']=report['evaluatedTriangles']<=read(PACKAGE/'room-brief.json')['performanceBudget']['maxSceneTriangles']
    report['passed']=report['passed'] and not failures and all(p['passed'] for p in support) and font_ok and report['triangleBudgetPassed']
    write(PACKAGE/'function-review.json',report)
    print(json.dumps({'passed':report['passed'],'triangles':report['evaluatedTriangles'],'supports':support,'routeSamples':count,'minimumDistance':minimum,'meshFailures':failures[:8]},ensure_ascii=False),flush=True)
    assert report['passed'],'V2 measured Function checks failed'


if __name__=='__main__':main()
