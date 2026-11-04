"""Evaluated mesh contacts and conservative furniture proxy coverage.

This checks the named primary fixtures. It is not an all-pairs intersection or
full 3D character-capsule simulation, and never records human art approval.
"""
from pathlib import Path
import bpy, json, hashlib, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v3'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=P/'snowbound-manor.blend';bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get();groups={};geometry={};dressing={}
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    ev=obj.evaluated_get(dg);mesh=ev.to_mesh()
    vertices=[ev.matrix_world@v.co for v in mesh.vertices]
    faces=[tuple(f.vertices) for f in mesh.polygons]
    geometry[obj.name]=(vertices,faces,obj)
    if obj.get('instance'):groups.setdefault(obj['instance'],[]).extend(vertices)
    if obj.get('dressingGroup'):
        group=dressing.setdefault(obj['dressingGroup'],{'vertices':[],'support':obj.get('supportObject')})
        assert group['support']==obj.get('supportObject')
        group['vertices'].extend(vertices)
    ev.to_mesh_clear()

def tree(names):
    vertices=[];faces=[]
    for name in names:
        vv,ff,_=geometry[name];offset=len(vertices);vertices+=vv;faces.extend(tuple(i+offset for i in f) for f in ff)
    return BVHTree.FromPolygons(vertices,faces)

supports=tree([name for name,(_,_,o) in geometry.items() if o.get('layer')=='hall_floor' or name=='conversation_carpet'])
contacts=[]
for group,vertices in groups.items():
    if group.startswith('chandelier'):
        surface=tree([name for name in geometry if name=='ceiling_rose'+group.removeprefix('chandelier')])
        z=max(p.z for p in vertices);candidates=[p for p in vertices if p.z>z-.0005];direction=Vector((0,0,1))
    elif group=='mantel_clock':
        surface=tree([name for name in geometry if name.startswith('mantel_profile')])
        z=min(p.z for p in vertices);candidates=[p for p in vertices if p.z<z+.0005];direction=Vector((0,0,-1))
    elif group.startswith('fir_'):continue
    else:
        surface=supports;z=min(p.z for p in vertices);candidates=[p for p in vertices if p.z<z+.0005];direction=Vector((0,0,-1))
    probes=[]
    for point in candidates:
        if all(math.hypot(point.x-q.x,point.y-q.y)>.04 for q in probes):probes.append(point)
    samples=[]
    for point in probes:
        hit,normal,face,distance=surface.ray_cast(point-direction*.08,direction,.16)
        # Positive clearance is a gap, negative clearance is mounting inset.
        gap=(hit-point).dot(direction) if hit is not None else None
        samples.append({'point':list(point),'gapMetres':gap})
    valid=bool(samples) and all(s['gapMetres'] is not None and -.0055<=s['gapMetres']<=.0055 for s in samples)
    contacts.append({'id':group,'probes':samples,'within5mmTolerance':valid})

nav=json.loads((P/'scene-contract.json').read_text(encoding='utf-8'));colliders={o['id']:o for o in nav['colliders']}
mapping={'salon_sofa':'sofa','conversation_chair_A':'chair-6.1','conversation_chair_B':'chair-7.85',
         'tea_table':'tea-table','side_table':'side-table','arrival_console':'arrival-console'}
coverage=[]
for instance,collider in mapping.items():
    o=colliders[collider];c=math.cos(o['angle']);s=math.sin(o['angle']);excess=0
    local=[]
    for p in groups[instance]:
        dx,dy=p.x-o['center'][0],p.y-o['center'][1];xx=c*dx+s*dy;yy=-s*dx+c*dy
        local.append((xx,yy));excess=max(excess,abs(xx)-o['size'][0]/2,abs(yy)-o['size'][1]/2)
    coverage.append({'instance':instance,'collider':collider,'maxProtrusionMetres':excess,'conservative':excess<=.001,
                     'requiredCenteredSize':[2*max(abs(p[i]) for p in local) for i in range(2)]})
dressing_contacts=[]
for group,entry in dressing.items():
    vertices=entry['vertices'];support=entry['support'];z=min(p.z for p in vertices)
    names=[name for name,(_,_,o) in geometry.items() if name==support or o.get('instance')==support]
    assert names, (group,support)
    surface=tree(names);samples=[]
    for p in [v for v in vertices if v.z<=z+.0005]:
        if any(math.dist(list(p),s['point'])<.025 for s in samples):continue
        hit,_,_,_=surface.ray_cast(p+Vector((0,0,.08)),Vector((0,0,-1)),.16)
        samples.append({'point':list(p),'gapMetres':p.z-hit.z if hit is not None else None})
    passed=bool(samples) and all(s['gapMetres'] is not None and -.0055<=s['gapMetres']<=.0055 for s in samples)
    dressing_contacts.append({'id':group,'support':support,'probes':samples,'within5mmTolerance':passed})
report={'schema':'manor-primary-and-dressing-contacts.v3','sourceSha256':sha(source),'navigationSha256':sha(P/'scene-contract.json'),
        'scope':'named imported primary furniture and chandelier mounting only; evaluated mesh bottom/top probes and 2D footprint coverage',
        'contacts':contacts,'dressingContacts':dressing_contacts,'colliderCoverage':coverage,
        'passed':all(x['within5mmTolerance'] for x in contacts+dressing_contacts) and all(x['conservative'] for x in coverage),
        'humanArtApproved':False,'allPairsIntersectionChecked':False,'fullCapsuleCollisionChecked':False}
(P/'contact-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'contacts':[(x['id'],x['within5mmTolerance'],[round(s['gapMetres'],5) if s['gapMetres'] is not None else None for s in x['probes']]) for x in contacts],
                  'dressingGroups':len(dressing_contacts),'dressingFailures':[x for x in dressing_contacts if not x['within5mmTolerance']],
                  'coverage':coverage}),flush=True)
