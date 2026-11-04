"""Independent reader for pinned CC0 mesh data; no upstream program logic."""
from pathlib import Path
import gzip
import json
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'docs/3d-town/classic-residents-v1/licensed/mpfb'


def read_source(profile):
    vertices=[]; faces=[]; group=''
    for line in (DATA/'3dobjs/base.obj').read_text().splitlines():
        if line.startswith('v '): vertices.append(Vector(tuple(map(float,line.split()[1:4]))))
        elif line.startswith('g '): group=line[2:].strip()
        elif line.startswith('f ') and group=='body':
            faces.append(tuple(int(x.split('/')[0])-1 for x in line.split()[1:]))
    groups=json.loads((DATA/'mesh_metadata/basemesh_vertex_groups.json').read_text())
    for heritage,hw in [('asian',profile.get('asian',.85)),('caucasian',1-profile.get('asian',.85))]:
        for age,aw in [('young',1-profile['ageBlend']),('old',profile['ageBlend'])]:
            weight=hw*aw
            if weight==0: continue
            source=DATA/f"targets/macrodetails/{heritage}-{profile['body']}-{age}.target.gz"
            for line in gzip.decompress(source.read_bytes()).decode().splitlines():
                if not line or line.startswith('#'):continue
                items=line.split(); idx=int(items[0]); vertices[idx]+=Vector(tuple(map(float,items[1:])))*weight
    def joint(name):
        ids=[i for a,b in groups['joint-'+name] for i in range(a,b+1)]
        return sum((vertices[i] for i in ids),Vector())/len(ids)
    return vertices,faces,joint


def subset_mesh(u,inv,name,points,faces,keep,transform,weights):
    selected=[face for face in faces if all(keep(points[i]) for i in face)]
    used=sorted({i for face in selected for i in face}); lookup={i:j for j,i in enumerate(used)}
    obj=u.mesh(name,[transform(points[i]) for i in used],[tuple(lookup[i] for i in f) for f in selected],'skin',True)
    obj['anatomicalSource']='MPFB core CC0 mesh; d0a32e57a7f915cb2f2b95410e2117648c7bbb7e'
    return inv.skin(obj,weights)


def skin_colors(obj):
    # Anatomical colour variation, stored as an exportable colour attribute.
    colors=obj.data.color_attributes.new(name='SkinTone',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(obj.data.vertices,colors.data):
        x,y,z=v.co
        lips=math.exp(-((z-1.624)/.006)**2-(x/.026)**4)*max(0,min(1,(-y-.065)/.025))
        cheeks=math.exp(-((abs(x)-.045)/.021)**2-((z-1.668)/.023)**2)*max(0,min(1,(-y-.04)/.025))
        c.color=(1-.03*cheeks-.18*lips,1-.13*cheeks-.43*lips,1-.12*cheeks-.35*lips,1)
    obj.data.color_attributes.active_color=colors
    obj.data.color_attributes.render_color_index=0


def anatomy(u,inv,profile):
    points,faces,joint=read_source(profile)
    neck=joint('neck'); body_ids={i for f in faces for i in f};head_top=max(points[i].y for i in body_ids)
    scale=.264/(head_top-neck.y)
    width=profile.get('faceWidth',1.)
    def to_head(p):
        z=1.538+(p.y-neck.y)*scale
        jaw=1+profile.get('jaw',0)*math.exp(-((z-1.62)/.055)**2)
        q=Vector((p.x*scale*width*jaw,-(p.z-.34)*scale+.012,z))
        # The extracted neck ends inside the collar, without source shoulder
        # flanges protruding above the garment's independent neckline.
        if z<1.564:
            radius=math.sqrt((q.x/.047)**2+((q.y-.009)/.048)**2)
            if radius>1:
                t=inv.smooth((1.564-z)/.025);factor=1-t+t/radius
                q.x*=factor;q.y=.009+(q.y-.009)*factor
        return q
    head=subset_mesh(u,inv,'anatomical_head',points,faces,lambda p:p.y>neck.y-.12,to_head,'head')
    skin_colors(head)
    # Separate globes sit behind the eyelids; iris is a shallow front dome.
    surface=BVHTree.FromPolygons([v.co for v in head.data.vertices],[p.vertices for p in head.data.polygons])
    for side in ('l','r'):
        center=to_head(joint(side+'-eye'))
        inv.sphere('eye_white',center,(.0120,.0118,.0114),'ivory','head')
        iris=center+Vector((0,-.0115,0))
        inv.sphere('iris',iris,(.0047,.0014,.0047),'iris','head')
        inv.sphere('pupil',iris+Vector((0,-.0013,0)),(.0021,.0005,.0021),'ink','head')
        s=1 if center.x>0 else -1
        brows=[]
        for x,z in [(center.x-s*.012,center.z+.015),(center.x,center.z+.017),(center.x+s*.014,center.z+.014)]:
            hit=surface.ray_cast(Vector((x,-.4,z)),Vector((0,1,0)))[0]
            if hit:brows.append(hit+Vector((0,-.0015,0)))
        if len(brows)==3:inv.tube('eyebrow',brows,.0017,'hair','head')
    # Hand topology is rotated from the source pose into the authored wrist pose.
    for s,label,src in [(-1,'L','r'),(1,'R','l')]:
        wrist=joint(src+'-hand'); tip=joint(src+'-finger-3-4')
        length=(tip-wrist).normalized()
        width_axis=joint(src+'-finger-5-1')-joint(src+'-finger-2-1')
        width_axis=(width_axis-length*width_axis.dot(length)).normalized()
        normal=width_axis.cross(length).normalized()
        origin=Vector((s*.278,-.025,.953))
        hand_scale=.166/(tip-wrist).length
        def convert(p):
            r=(p-wrist)*hand_scale
            q=origin+Vector((s*r.dot(width_axis),s*r.dot(normal),-r.dot(length)))
            curl=inv.clamp((.895-q.z)/.10)
            q.x=origin.x+(q.x-origin.x)*(1-.07*curl)
            q.y+=.015*curl*curl;q.z+=.008*curl*curl
            return q
        hand=subset_mesh(u,inv,'anatomical_hand_'+label,points,faces,
            lambda p:s*p.x>3.7 and (p-wrist).dot(length)>-.18,convert,'hand_'+label)
        skin_colors(hand)
    return head,to_head,joint


def garment(u,inv,profile,material,bottom):
    """Fit a continuous garment to the source shoulder and elbow topology.

    The transformation is authored here from anatomical joint landmarks. It
    aligns source A-pose arms to our existing animation skeleton before skinning.
    """
    points,faces,joint=read_source(profile)
    neck=joint('neck');pelvis=joint('pelvis')
    def axis(p):return Vector((p.x,-p.z,p.y))
    def body_point(p):
        height=.94+(p.y-pelvis.y)*(1.55-.94)/(neck.y-pelvis.y)
        return Vector((p.x*.109,-(p.z-.22)*.104,height))
    def limb(p,s):
        src='l' if s>0 else 'r'
        a,b,c=[axis(joint(src+'-'+n)) for n in ('shoulder','elbow','hand')]
        dest=[Vector((s*.223,.006,1.465)),Vector((s*.283,-.016,1.192)),Vector((s*.278,-.025,.953))]
        q=axis(p)
        def segment(a,b,aa,bb):
            d=b-a;t=(q-a).dot(d)/d.length_squared
            perpendicular=q-a-d*t
            rotation=d.rotation_difference(bb-aa)
            return aa+(bb-aa)*t+rotation@perpendicular*.105
        upper=segment(a,b,dest[0],dest[1]);lower=segment(b,c,dest[1],dest[2])
        t=inv.smooth(((q-b).dot((c-b).normalized())+.40)/.80)
        return upper*(1-t)+lower*t
    transformed=[];arm_flags=[]
    ease=[(bottom,.176 if profile['body']=='female' else .209,.136),
          (1.10,.177 if profile['body']=='female' else .199,.139),
          (1.26,.206 if profile['body']=='female' else .218,.148),
          (1.39,.218 if profile['body']=='female' else .231,.139),
          (1.47,.207,.108),(1.52,.149,.071),(1.55,.059,.057)]
    for p in points:
        q=body_point(p);s=1 if p.x>0 else -1
        # The hip can be as wide as the shoulder. Its vertices must never enter
        # an arm transform merely because their X coordinate is large.
        arm_edge=max(1.25,3.1-(p.y-1.7)*.8)
        blend=inv.smooth((abs(p.x)-arm_edge)/.70)
        if p.y>neck.y-.4:blend*=inv.clamp((neck.y+.05-p.y)/.45)
        q=q*(1-blend)+limb(p,s)*blend if blend>0 else q
        arm_flags.append(abs(p.x)>2.15 and p.y<4.8)
        # Loose fabric bridges the body landmarks rather than tracing skin.
        if bottom<=q.z<=1.55:
            i=next((j for j in range(len(ease)-1) if ease[j][0]<=q.z<=ease[j+1][0]),len(ease)-2)
            a,b=ease[i],ease[i+1];t=inv.clamp((q.z-a[0])/(b[0]-a[0]))
            rx=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t
            metric=math.sqrt((q.x/rx)**2+((q.y-.006)/ry)**2)
            amount=1-blend
            if metric>.001:
                goal=Vector((q.x/metric,(q.y-.006)/metric+.006,q.z))
                q=q*(1-amount)+goal*amount
        transformed.append(q)
    def inside(i):
        p=transformed[i];low=.946 if arm_flags[i] else bottom
        if arm_flags[i]:
            src='l' if points[i].x>0 else 'r'
            wrist=axis(joint(src+'-hand'));elbow=axis(joint(src+'-elbow'))
            if (axis(points[i])-wrist).dot((wrist-elbow).normalized())>-.10:return False
        return low<p.z<1.55
    selected=[f for f in faces if all(inside(i) for i in f)]
    used=sorted({i for f in selected for i in f});index={i:j for j,i in enumerate(used)}
    obj=u.mesh('anatomically_fitted_garment',[transformed[i] for i in used],
               [tuple(index[i] for i in f) for f in selected],material,True)
    # Fit clipped boundary loops to clean cuff/hem/neck planes.
    bm=bmesh.new();bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    interior=[v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)]
    for _ in range(3):bmesh.ops.smooth_vert(bm,verts=interior,factor=.4,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    for v in bm.verts:
        if any(e.is_boundary for e in v.link_edges):
            if v.co.z>1.48:
                a=math.atan2(v.co.x,-(v.co.y-.009));v.co=Vector((.059*math.sin(a),.009-.057*math.cos(a),1.548))
            elif arm_flags[used[v.index]]:
                s=1 if v.co.x>0 else -1;a=math.atan2(v.co.x-s*.278,-(v.co.y+.025))
                v.co=Vector((s*.278+.035*math.sin(a),-.025-.037*math.cos(a),.950))
            elif v.co.z<bottom+.12:
                a=math.atan2(v.co.x,-(v.co.y-.006));v.co=Vector((ease[0][1]*math.sin(a),.006-ease[0][2]*math.cos(a),bottom))
        else:
            # Small compression folds at the elbow, restrained at play distance.
            fold=math.exp(-((v.co.z-1.195)/.052)**2)*math.sin((v.co.z-1.17)*165)*.0022
            if arm_flags[used[v.index]]:v.co.y+=fold
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    assert max(abs(v.co.y) for v in obj.data.vertices)<.25, 'Garment contains an invalid limb projection'
    def weights(p):
        s='R' if p.x>0 else 'L'
        blend=inv.smooth((abs(p.x)-.165)/.07)
        body=inv.torso(p);arm=inv.arm_weight(s)(p);result={k:v*(1-blend) for k,v in body.items()}
        for k,v in arm.items():result[k]=result.get(k,0)+v*blend
        return result
    inv.skin(obj,weights)
    for s,side in [(-1,'L'),(1,'R')]:
        # 1 mm clearance avoids coplanar flecks at the knitted cuff seam.
        inv.loft('linen_cuff_'+side,[(.931,.030,.030,s*.278,-.025),(.955,.036,.038,s*.278,-.025)],'shirt','hand_'+side,24)
    return obj


def hair(u,inv,head,profile):
    style=profile['hair']; mesh=head.data
    if style=='bob':
        rings=[(1.602,.086,.099,0,.003),(1.65,.094,.111,0,.003),(1.71,.094,.114,0,.001),
               (1.745,.088,.113,0,-.002),(1.785,.069,.091,0,-.003),(1.818,.031,.049,0,-.005)]
        gaps=[.085,.086,.073,0,0,0];verts=[];faces=[];count=49
        for ri,(z,rx,ry,cx,cy) in enumerate(rings):
            gap=math.asin(min(.998,gaps[ri]/rx))
            for j in range(count):
                a=gap+(math.tau-2*gap)*j/(count-1)
                # A shallow side part and finger waves, continuous across the cap.
                zz=z+.002*math.sin(3*a+ri*.7)
                verts.append((cx+rx*math.sin(a),cy-ry*math.cos(a),zz))
        for i in range(len(rings)-1):
            for j in range(count-1):k=i*count+j;faces.append((k,k+1,k+count+1,k+count))
        faces.append(tuple((len(rings)-1)*count+j for j in range(count)))
        scalp=u.mesh('sculpted_finger_wave_bob',verts,faces,'hair',True)
        sub=scalp.modifiers.new('soft_bob_profile','SUBSURF');sub.levels=1
        bpy.context.view_layer.objects.active=scalp;bpy.ops.object.modifier_apply(modifier=sub.name)
        thick=scalp.modifiers.new('bob_edge_volume','SOLIDIFY');thick.thickness=.003
        bpy.ops.object.modifier_apply(modifier=thick.name);inv.skin(scalp,'head')
        for s in (-1,1):
            for i in range(7):
                angle=s*(1.00+i*.30)
                inv.tube('combed_bob_ridge',[(math.sin(angle)*rx,cy-math.cos(angle)*ry,z) for z,rx,ry,_,cy in rings[:4]],.0009,'hair','head')
        return
    # Preserve the actual skull topology. A local shell follows the scalp.
    selected=[]
    for polygon in mesh.polygons:
        c=polygon.center
        # Polygon centres/normals are made current by update below.
        p=sum((mesh.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
        front=max(0,min(1,(-p.y+.005)/.085))
        limit=1.652+.092*front
        if style=='receding':limit+=.020*front
        if style=='bob':limit=1.592+.149*front
        if p.z>limit and (p.z>1.73 or abs(p.x)>.046 or p.y>.04):selected.append(tuple(polygon.vertices))
    used=sorted({i for f in selected for i in f});index={v:i for i,v in enumerate(used)}
    vertices=[]
    for i in used:
        v=mesh.vertices[i];p=v.co.copy();n=v.normal.normalized()
        offset=.006 if style!='bob' else .011
        p+=n*offset
        if style=='bob' and p.z<1.74:
            p.x*=1.09;p.y+=.003
        vertices.append(p)
    scalp=u.mesh('fitted_'+style+'_hair',vertices,[tuple(index[i] for i in f) for f in selected],'hair',True)
    # Relax the coarse source selection boundary before adding hair thickness.
    smooth=scalp.modifiers.new('soft_hair_boundary','SMOOTH');smooth.factor=.65;smooth.iterations=4
    bpy.context.view_layer.objects.active=scalp;bpy.ops.object.modifier_apply(modifier=smooth.name)
    sub=scalp.modifiers.new('hair_silhouette','SUBSURF');sub.levels=1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    thick=scalp.modifiers.new('hair_edge_volume','SOLIDIFY');thick.thickness=.002
    bpy.context.view_layer.objects.active=scalp;bpy.ops.object.modifier_apply(modifier=thick.name)
    inv.skin(scalp,'head')
    if style in ('bun','silver-bun'):
        inv.sphere('coiled_hair_bun',(0,.118,1.707),(.045,.031,.039),'hair','head')
        for i in range(7):
            a=i*math.tau/7
            inv.tube('bun_coil',[(math.sin(t+a)*.042,.121+math.cos(t)*.024,1.707+math.cos(t+a)*.035) for t in [j*math.tau/28 for j in range(29)]],.0012,'hair_high','head')
    elif style=='bob':
        for s in (-1,1):
            for k in range(4):
                yy=-.038+k*.024
                inv.tube('bob_wave',[(s*.084,yy,1.730),(s*.088,yy-.004,1.695),(s*.086,yy+.002,1.653),(s*.080,yy+.009,1.614)],.0016,'hair_high','head')
    else:
        for i in range(8):
            x=-.062+i*.017
            top=1.802-.024*(abs(x)/.07)**1.5
            inv.tube('combed_sweep',[(x,-.036,top-.028),(x+.009,-.007,top),(x+.012,.040,top-.005),(x+.008,.067,top-.040)],.0024,'hair_high','head')
