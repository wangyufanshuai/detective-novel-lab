"""Original, metre-scale investigator study; background Blender, no acquired art.

Produces an independent skinned companion for classic-railway-v1. The historical
scene and its review renders stay intact. Front is -Y in Blender, +Z in glTF.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-investigator-v1'
PUBLIC = ROOT / 'public/assets/classic-investigator/v1'
HELPER = ROOT / 'scripts/build-blender-classic-railway.py'
spec = importlib.util.spec_from_file_location('railway_geometry', HELPER)
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)
u.PACKAGE = PACKAGE
u.LAY = 'investigator'
SKIN = []
BONES = {}
RIG = None


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def clamp(v, a=0., b=1.):
    return min(b, max(a, v))


def smooth(t):
    t = clamp(t)
    return t*t*(3-2*t)


def blend(a, b, t):
    t = smooth(t)
    return {a: 1-t, b: t}


def torso(p):
    return blend('pelvis', 'chest', (p.z-1.02)/.34)


def coat_weight(p):
    if p.z >= 1.03:
        return torso(p)
    part = 'tail_back' if p.y > .055 else ('tail_L' if p.x < 0 else 'tail_R')
    return blend(part, 'pelvis', (p.z-.88)/.15)


def leg_weight(side):
    def weights(p):
        if p.z < .16:
            return blend('foot_'+side, 'shin_'+side, (p.z-.11)/.05)
        return blend('shin_'+side, 'thigh_'+side, (p.z-.455)/.13)
    return weights


def arm_weight(side):
    def weights(p):
        if p.z < 1.0:
            return blend('hand_'+side, 'forearm_'+side, (p.z-.92)/.08)
        return blend('forearm_'+side, 'upperarm_'+side, (p.z-1.135)/.16)
    return weights


def skin(obj, weights):
    if obj.type != 'MESH':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    groups = {}
    for vertex in obj.data.vertices:
        values = {weights: 1.} if isinstance(weights, str) else weights(vertex.co)
        total = sum(v for v in values.values() if v > 1e-6)
        for name, value in values.items():
            if value <= 1e-6:
                continue
            if name not in groups:
                groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([vertex.index], value/total, 'REPLACE')
    SKIN.append(obj)
    return obj


def sphere(name, pos, size, mat, weights):
    return skin(u.sphere(name, pos, size, mat, 24), weights)


def box(name, pos, size, mat, weights, edge=.005):
    return skin(u.box(name, pos, size, mat, edge), weights)


def tube(name, points, radius, mat, weights):
    return skin(u.tube(name, points, radius, mat), weights)


def loft(name, rings, mat, weights, sides=40, gap=None, shape=None):
    # Rings are z, x-radius, y-radius, x-centre, y-centre. Open coats are
    # real shells with sewn edges; visible garments sit behind their opening.
    if gap:
        dense=[];densegap=[]
        for i in range(len(rings)-1):
            count=max(1,math.ceil((rings[i+1][0]-rings[i][0])/.018))
            for j in range(count):
                t=j/count
                dense.append(tuple(a*(1-t)+b*t for a,b in zip(rings[i],rings[i+1])))
                densegap.append(gap[i]*(1-t)+gap[i+1]*t)
        rings=dense+[rings[-1]];gap=densegap+[gap[-1]]
    verts = []
    count = sides+1 if gap else sides
    for ri, (z, rx, ry, cx, cy) in enumerate(rings):
        start = math.asin(clamp(gap[ri]/rx, 0, .99)) if gap else 0
        for j in range(count):
            angle = start + (math.tau-2*start)*j/sides
            point = [cx+rx*math.sin(angle), cy-ry*math.cos(angle), z]
            if shape:
                point = shape(point, angle, ri)
            verts.append(point)
    faces = []
    for i in range(len(rings)-1):
        for j in range(sides if gap else count):
            nxt = j+1 if gap else (j+1) % count
            faces.append((i*count+j, i*count+nxt, (i+1)*count+nxt, (i+1)*count+j))
    if not gap:
        faces += [tuple(reversed(range(count))), tuple((len(rings)-1)*count+j for j in range(count))]
    obj = u.mesh(name, verts, faces, mat, True)
    if gap:
        mod = obj.modifiers.new('cloth_thickness', 'SOLIDIFY')
        mod.thickness = .004
        mod.offset = -1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return skin(obj, weights)


COAT = [(.66,.269,.205,0,.015),(.76,.255,.188,0,.009),(.91,.234,.17,0,.003),
        (1.06,.204,.15,0,0),(1.20,.209,.152,0,0),(1.34,.239,.155,0,0),
        (1.44,.253,.14,0,.006),(1.50,.221,.117,0,.01),(1.55,.083,.084,0,.006)]


def front(x, z, extra=0):
    i = next((i for i in range(len(COAT)-1) if COAT[i][0] <= z <= COAT[i+1][0]), len(COAT)-2)
    a,b = COAT[i], COAT[i+1]
    t = clamp((z-a[0])/(b[0]-a[0]))
    rx = a[1]*(1-t)+b[1]*t
    ry = a[2]*(1-t)+b[2]*t
    cy = a[4]*(1-t)+b[4]*t
    return cy-ry*math.sqrt(max(.03,1-(x/rx)**2))-extra


def panel(name, xz, mat, weights, offset=.018):
    # A single nonplanar n-gon cuts through a curved chest when triangulated.
    # Tessellate in the garment plane and project every subdivision onto the coat.
    verts=[];faces=[]
    polygon=[Vector((x,z,0)) for x,z in xz]
    for tri in tessellate_polygon([polygon]):
        a,b,c=[polygon[p] if isinstance(p,int) else p for p in tri]
        ids={};n=12
        for i in range(n+1):
            for j in range(n+1-i):
                p=a*(1-(i+j)/n)+b*i/n+c*j/n
                ids[i,j]=len(verts);verts.append((p.x,front(p.x,p.y,offset),p.y))
        for i in range(n):
            for j in range(n-i):
                faces.append((ids[i,j],ids[i+1,j],ids[i,j+1]))
                if i+j<n-1:faces.append((ids[i+1,j],ids[i+1,j+1],ids[i,j+1]))
    obj = u.mesh(name,verts,faces,mat,True)
    mod = obj.modifiers.new('folded_cloth_edge','SOLIDIFY')
    mod.thickness=.003
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return skin(obj,weights)


def materials():
    folder=PACKAGE/'textures';folder.mkdir(parents=True,exist_ok=True)
    n=512;y,x=np.mgrid[0:n,0:n]/n
    # Fine wool twill; period tailoring should read through shape at play distance.
    stripe=np.floor(x*64)%2
    twill=np.sin((y*256+x*256*(stripe*2-1))*math.tau)
    grain=np.random.default_rng(193401).random((n,n))-.5
    color=np.array([.235,.256,.25])*(1+twill[...,None]*.055)+grain[...,None]*.015
    u.png(folder/'wool-color.png',color)
    h=twill*.000045+grain*.00002
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*n/2
    dy=(np.roll(h,-1,0)-np.roll(h,1,0))*n/2
    normals=np.stack((-dx,-dy,np.ones_like(dx)),axis=-1)
    normals/=np.linalg.norm(normals,axis=-1)[...,None]
    u.png(folder/'wool-normal.png',normals*.5+.5)
    for name,color,rough,metal in [
        ('coat','3c4240',.88,0),('fold','353c39',.87,0),('trousers','464440',.9,0),
        ('waistcoat','68574a',.84,0),('shirt','c9c4ac',.78,0),('tie','613f32',.72,0),
        ('skin','b4876a',.62,0),('lips','8c5c4c',.71,0),('hair','342d26',.84,0),
        ('eyes','6f725e',.42,0),('ink','20231f',.58,0),('felt','51453a',.96,0),
        ('leather','5a3926',.60,0),('brass','9d7a45',.42,.75),('shoe','292924',.43,0)]:
        u.material(name,color,rough,metal,'wool' if name=='coat' else None,size=.34)
    u.MATS['skin'].node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.055


def garments():
    loft('shirt_body',[(1.10,.15,.11,0,0),(1.35,.188,.123,0,.004),(1.48,.184,.10,0,0),(1.55,.06,.06,0,0)],'shirt',torso)
    loft('waistcoat',[(.94,.171,.128,0,0),(1.10,.176,.133,0,0),(1.26,.191,.139,0,0),(1.41,.188,.124,0,0),(1.50,.10,.088,0,0)],'waistcoat',torso,gap=[0,0,.02,.055,.051])
    for z in (1.02,1.09,1.16,1.23):
        sphere('waistcoat_button',(.01,-.141,z),(.008,.004,.008),'brass',torso)
    loft('tailored_overcoat',COAT,'coat',coat_weight,64,gap=[.08,.06,.025,0,.052,.101,.119,.09,.06])
    for s in (-1,1):
        panel('notched_lapel',[(s*.059,1.54),(s*.143,1.487),(s*.118,1.452),(s*.171,1.431),(s*.145,1.31),(s*.005,1.065)],'fold',torso)
        panel('slanted_welt_pocket',[(s*.116,1.034),(s*.211,1.083),(s*.215,1.057),(s*.119,1.009)],'fold',coat_weight)
        tube('pocket_stitch',[(s*x,front(s*x,z,.013),z) for x,z in ((.123,1.031),(.160,1.052),(.207,1.075))],.001,'waistcoat',coat_weight)
    for z in (.97,1.065):
        sphere('horn_coat_button',(.035,front(.035,z,.01),z),(.010,.005,.010),'ink',coat_weight)
    tube('back_centre_seam',[(0,.221,.67),(0,.178,.93),(0,.155,1.18),(0,.144,1.44)],.0015,'fold',coat_weight)
    box('back_martingale',(0,.169,1.063),(.27,.012,.029),'fold',torso)
    for s in (-1,1):sphere('belt_button',(s*.10,.179,1.063),(.009,.004,.009),'ink',torso)
    # Shirt and tie occupy the actual V opening, separate from the coat surface.
    skin(u.mesh('tie_blade',[(-.016,-.120,1.48),(.017,-.120,1.48),(.021,-.145,1.32),(0,-.147,1.292),(-.022,-.145,1.32)],[(0,1,2,3,4)],'tie'),torso)
    skin(u.mesh('tie_knot',[(-.017,-.124,1.495),(.017,-.124,1.495),(.012,-.135,1.472),(-.012,-.135,1.472),(0,-.143,1.481)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'tie',True),torso)
    for s in (-1,1):
        skin(u.mesh('shirt_collar',[(s*.012,-.076,1.54),(s*.057,-.067,1.53),(s*.041,-.115,1.454),(s*.019,-.121,1.491)],[(0,1,2,3)],'shirt'),torso)


def limbs():
    for s,side in ((-1,'L'),(1,'R')):
        x=s*.102
        loft('trousers_'+side,[(.095,.067,.064,x,-.004),(.16,.069,.067,x,-.002),(.30,.066,.067,x,-.012),(.46,.071,.068,x,-.025),(.515,.075,.079,x,-.03),(.59,.078,.083,x,-.023),(.73,.091,.096,x,-.008),(.89,.095,.105,x,0),(.96,.086,.09,x,0)],'trousers',leg_weight(side),32)
        tube('pressed_crease_'+side,[(x,-.074,.16),(x,-.081,.30),(x,-.096,.49),(x,-.098,.67)],.001,'waistcoat',leg_weight(side))
        # Long toe, defined welt and heel; sole sits at exactly Z=0.
        loft('oxford_'+side,[(.022,.078,.152,x,-.046),(.047,.080,.157,x,-.051),(.075,.075,.137,x,-.049),(.106,.063,.080,x,.002),(.129,.049,.050,x,.015)],'shoe','foot_'+side,40)
        loft('sole_'+side,[(0,.076,.152,x,-.051),(.010,.079,.157,x,-.051),(.026,.079,.157,x,-.051)],'ink','foot_'+side,40)
        box('heel_'+side,(x,.042,.011),(.124,.067,.022),'shoe','foot_'+side,.006)
        tube('toe_cap_'+side,[(x-.06,-.117,.072),(x,-.133,.083),(x+.06,-.117,.072)],.0012,'ink','foot_'+side)
        for i in range(4):
            yy=-.059+i*.015
            tube('lace_'+side,[(x-.022,yy,.105),(x+.021,yy+.006,.105)],.0015,'ink','foot_'+side)
        loft('sleeve_'+side,[(.946,.047,.052,s*.278,-.025),(1.00,.053,.058,s*.278,-.02),(1.105,.060,.067,s*.284,-.012),(1.18,.067,.073,s*.285,-.017),(1.25,.068,.075,s*.278,-.008),(1.37,.070,.077,s*.265,.002),(1.445,.069,.074,s*.237,.01),(1.486,.055,.057,s*.220,.006),(1.502,.024,.028,s*.206,.006)],'coat',arm_weight(side),32)
        loft('cuff_'+side,[(.934,.041,.047,s*.278,-.025),(.956,.044,.049,s*.278,-.025)],'shirt','hand_'+side,24)
        sphere('palm_'+side,(s*.280,-.027,.904),(.034,.024,.048),'skin','hand_'+side)
        for i in range(4):
            xx=s*(.256+i*.016)
            sphere('finger_'+side,(xx,-.030,.855+abs(i-1.4)*.005),(.009,.015,.034-abs(i-1.3)*.003),'skin','hand_'+side)
        sphere('thumb_'+side,(s*.248,-.047,.903),(.016,.016,.029),'skin','hand_'+side)
        for z in (.982,1.008):sphere('cuff_button_'+side,(s*.322,-.021,z),(.006,.005,.006),'ink','forearm_'+side)


def head():
    loft('neck',[(1.51,.045,.045,0,.006),(1.57,.050,.049,0,.003),(1.615,.046,.048,0,.006)],'skin','head',32)
    loft('sculpted_head',[(1.579,.032,.039,0,-.020),(1.596,.056,.059,0,-.013),(1.621,.068,.066,0,-.006),(1.654,.078,.069,0,.002),(1.682,.078,.070,0,.006),(1.709,.074,.072,0,.009),(1.75,.071,.069,0,.011),(1.785,.051,.053,0,.014),(1.799,.017,.021,0,.015)],'skin','head',48)
    # A wedge bridge and tip instead of a spherical nose.
    skin(u.mesh('nose_bridge',[(-.009,-.066,1.701),(.009,-.066,1.701),(-.014,-.083,1.654),(.014,-.083,1.654),(0,-.106,1.657),(0,-.083,1.641)],[(0,1,4),(1,3,4),(3,5,4),(5,2,4),(2,0,4),(0,2,5,3,1)],'skin',True),'head')
    for s in (-1,1):
        sphere('ear',(s*.078,.008,1.657),(.010,.016,.025),'skin','head')
        sphere('concha',(s*.085,.002,1.655),(.003,.009,.013),'lips','head')
        sphere('eye',(s*.030,-.060,1.686),(.010,.005,.0048),'eyes','head')
        sphere('iris',(s*.030,-.064,1.686),(.0032,.0018,.0032),'ink','head')
        tube('upper_lid',[(s*.018,-.062,1.688),(s*.031,-.065,1.691),(s*.043,-.058,1.689)],.0016,'skin','head')
        tube('brow',[(s*.017,-.064,1.702),(s*.030,-.065,1.704),(s*.046,-.057,1.699)],.0025,'hair','head')
        sphere('nostril',(s*.009,-.087,1.646),(.0035,.003,.002),'lips','head')
        tube('sideburn',[(s*.068,-.014,1.730),(s*.076,-.013,1.690),(s*.076,-.013,1.667)],.004,'hair','head')
    tube('upper_lip',[(-.018,-.069,1.624),(-.007,-.075,1.626),(0,-.076,1.624),(.007,-.075,1.626),(.018,-.069,1.624)],.0019,'lips','head')
    tube('lower_lip',[(-.016,-.069,1.621),(0,-.077,1.620),(.016,-.069,1.621)],.0017,'skin','head')
    # Hairline is under the hat, with tapered side hair rather than a helmet cap.
    loft('hair',[(1.718,.076,.070,0,.016),(1.752,.074,.071,0,.013),(1.787,.050,.053,0,.014),(1.804,.016,.020,0,.014)],'hair','head',40,gap=[.062,.041,0,0])
    rings=[(1.762,.152,.173,0,.003),(1.772,.151,.172,0,.003),(1.782,.102,.119,0,.003),(1.827,.097,.112,0,.007),(1.879,.084,.101,0,.012),(1.90,.070,.091,0,.011)]
    def hatshape(p,a,row):
        if row<2:p[2]+=.008*math.sin(a)**2-.008*math.cos(a)
        elif row>3:
            p[0]*=1-.13*max(0,math.cos(a))**8
            p[2]-=.018*max(0,math.cos(a))**4
        return p
    loft('felt_fedora',rings,'felt','head',64,shape=hatshape)
    loft('grosgrain_ribbon',[(1.783,.103,.119,0,.003),(1.812,.102,.117,0,.005)],'hair','head',64)
    box('hat_bow',(-.104,.008,1.8),(.009,.045,.023),'hair','head',.003)


def satchel():
    # The shoulder strap follows the actual curved coat with a visible clearance.
    points=[]
    for t in np.linspace(0,1,14):
        x=-.194+.485*t;z=1.468-.514*t
        points.append((x,front(x,z,.023),z))
    verts=[]
    for x,y,z in points:verts.extend([(x-.013,y,z-.013),(x+.013,y,z+.013)])
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)]
    skin(u.mesh('diagonal_strap',verts,faces,'leather',True),torso)
    tube('strap_over_shoulder',[(-.194,front(-.194,1.468,.025),1.468),(-.207,.001,1.505),(-.193,.146,1.43),(.09,.193,1.12),(.288,.164,.96)],.014,'leather',torso)
    box('satchel_body',(.316,.019,.929),(.125,.278,.252),'leather','bag',.018)
    box('satchel_flap',(.383,.014,.990),(.016,.269,.137),'leather','bag',.007)
    for y in (-.07,.10):
        box('satchel_tab',(.396,y,.932),(.009,.033,.135),'fold','bag',.003)
        box('satchel_clasp',(.403,y,.924),(.009,.044,.040),'brass','bag',.004)
    tube('satchel_handle',[(.325,-.058,1.064),(.326,-.034,1.11),(.326,.071,1.11),(.325,.096,1.064)],.006,'leather','bag')
    for a,b in [((.39,-.111,1.05),(.39,-.111,.827)),((.39,-.111,.827),(.39,.145,.827)),((.39,.145,.827),(.39,.145,1.05))]:
        tube('satchel_seam',[a,b],.001,'waistcoat','bag')
    for obj in SKIN:
        if obj.vertex_groups.get('bag'):
            for v in obj.data.vertices:v.co+=Vector((0,.16,-.105))
    tube('strap_to_satchel',[(.291,front(.291,.954,.025),.954),(.327,-.006,.945),(.34,.173,.964)],.013,'leather','bag')


def addbone(name, head, tail, parent=None):
    b=RIG.data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=RIG.data.edit_bones[parent]
    BONES[name]=(Vector(head),Vector(tail))


def rig():
    global RIG
    data=bpy.data.armatures.new('investigator_skeleton')
    RIG=bpy.data.objects.new('investigator_rig',data);bpy.context.collection.objects.link(RIG)
    bpy.context.view_layer.objects.active=RIG;RIG.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    addbone('root',(0,0,0),(0,0,.15))
    addbone('pelvis',(0,0,.94),(0,0,1.11),'root')
    addbone('chest',(0,0,1.11),(0,0,1.49),'pelvis')
    addbone('head',(0,0,1.49),(0,0,1.77),'chest')
    for s,side in ((-1,'L'),(1,'R')):
        addbone('thigh_'+side,(s*.102,0,.94),(s*.102,-.03,.515),'pelvis')
        addbone('shin_'+side,(s*.102,-.03,.515),(s*.102,0,.10),'thigh_'+side)
        addbone('foot_'+side,(s*.102,0,.10),(s*.102,-.16,.10),'shin_'+side)
        addbone('upperarm_'+side,(s*.223,.006,1.465),(s*.283,-.016,1.192),'chest')
        addbone('forearm_'+side,(s*.283,-.016,1.192),(s*.278,-.025,.953),'upperarm_'+side)
        addbone('hand_'+side,(s*.278,-.025,.953),(s*.280,-.029,.862),'forearm_'+side)
        addbone('tail_'+side,(s*.11,0,1.04),(s*.17,0,.69),'pelvis')
    addbone('tail_back',(0,.13,1.04),(0,.18,.69),'pelvis')
    addbone('bag',(.316,.019,1.045),(.316,.019,.87),'pelvis')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in SKIN:ob.select_set(True)
    bpy.context.view_layer.objects.active=SKIN[0]
    bpy.ops.object.join()
    body=bpy.context.object;body.name='investigator_skin'
    body.parent=RIG
    mod=body.modifiers.new('weighted_character_skin','ARMATURE');mod.object=RIG
    body['origin']='project-original-modeled-geometry'
    return body


def worldbone(name, head, tail):
    resthead,resttail=BONES[name]
    rotation=(resttail-resthead).rotation_difference(Vector(tail)-Vector(head)).to_matrix() @ RIG.data.bones[name].matrix_local.to_3x3()
    matrix=rotation.to_4x4();matrix.translation=head
    RIG.pose.bones[name].matrix=matrix
    bpy.context.view_layer.update()


def leg_ik(hip, ankle, upper, lower):
    vector=ankle-hip;d=vector.length
    if d>upper+lower+1e-6:raise ValueError('Unreachable authored foot contact')
    along=vector.normalized();dist=(upper*upper-lower*lower+d*d)/(2*d)
    pole=Vector((0,-1,0));across=(pole-along*pole.dot(along)).normalized()
    return hip+along*dist+across*math.sqrt(max(0,upper*upper-dist*dist))


def pose(kind, phase):
    for bone in RIG.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    if kind=='Idle':
        RIG.pose.bones['chest'].rotation_mode='XYZ'
        RIG.pose.bones['chest'].rotation_euler.x=math.sin(phase*math.tau)*.004
        return
    pelvisz=.918-.014*math.cos(phase*math.tau*2)
    offset=Vector((.006*math.sin(phase*math.tau),0,pelvisz-.94))
    RIG.pose.bones['pelvis'].location=RIG.data.bones['pelvis'].matrix_local.to_3x3().inverted()@offset
    bpy.context.view_layer.update()
    for s,side in ((-1,'L'),(1,'R')):
        t=(phase+(0 if side=='L' else .5))%1
        if t<.5:
            y=-.24+.96*t;lift=0
        else:
            q=(t-.5)*2;y=.24*math.cos(math.pi*q);lift=.10*math.sin(math.pi*q)**1.25
        hip=BONES['thigh_'+side][0]+offset
        ankle=Vector((s*.102,y,.10+lift))
        knee=leg_ik(hip,ankle,(BONES['thigh_'+side][1]-BONES['thigh_'+side][0]).length,(BONES['shin_'+side][1]-BONES['shin_'+side][0]).length)
        worldbone('thigh_'+side,hip,knee);worldbone('shin_'+side,knee,ankle)
        worldbone('foot_'+side,ankle,ankle+Vector((0,-.16,0)))
        swing=math.sin(t*math.tau)*.16
        shoulder=BONES['upperarm_'+side][0]+offset
        elbow=shoulder+Vector((s*.060,swing*.52-.023,-.272))
        hand=elbow+Vector((-s*.005,swing*.45-.018,-.237))
        worldbone('upperarm_'+side,shoulder,elbow);worldbone('forearm_'+side,elbow,hand)
        worldbone('hand_'+side,hand,hand+Vector((s*.002,-.004,-.091)))
        # Follow the forward thigh under the long coat. A tiny sine-only sway
        # leaves the bent knee protruding through the front skirt at passing.
        tailhead,tailend=BONES['tail_'+side]
        restthigh=BONES['thigh_'+side][1]-BONES['thigh_'+side][0]
        delta=restthigh.rotation_difference(knee-hip)
        direction=delta@(tailend-tailhead) if knee.y<hip.y else tailend-tailhead
        worldbone('tail_'+side,tailhead+offset,tailhead+offset+direction)
    RIG.pose.bones['bag'].rotation_mode='XYZ'
    RIG.pose.bones['bag'].rotation_euler.x=math.sin(phase*math.tau)*.025


def animate():
    scene=bpy.context.scene;scene.render.fps=30
    for bone in RIG.pose.bones:bone.rotation_mode='XYZ'
    specs=[('Idle',90),('Walk',24)]
    for name,count in specs:
        action=bpy.data.actions.new(name);action.use_fake_user=True
        RIG.animation_data_create();RIG.animation_data.action=action
        for frame in range(1,count+2):
            pose(name,(frame-1)/count)
            for bone in RIG.pose.bones:
                if bone.rotation_mode not in ('XYZ','QUATERNION'):bone.rotation_mode='QUATERNION'
                bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
                bone.keyframe_insert(data_path='rotation_euler' if bone.rotation_mode=='XYZ' else 'rotation_quaternion',frame=frame,group=bone.name)
        RIG.animation_data.action=None
    pose('Idle',0);scene.frame_set(1)
    return specs


def stage():
    u.material('stage','555d5b',.86)
    u.box('review_ground',(0,0,-.055),(200,200,.10),'stage',0)['reviewOnly']=True
    world=bpy.data.worlds.new('character_soft_day');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.66,.73,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.35;bpy.context.scene.world=world
    for name,pos,energy,color,size in [('key',(-3,-4,5),430,(1,.89,.76),4),('fill',(3,-1,3),180,(.76,.86,1),3),('rim',(-1,3,4),530,(1,.95,.84),3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler();obj.visible_camera=False
    u.camera('three-quarter',(3.2,-5.4,2.5),(0,0,1.02),2.46)
    u.camera('front',(0,-5,1.07),(0,0,1.07),2.35)
    u.camera('profile',(5,-.6,1.3),(0,0,1.0),2.40)
    u.camera('back',(-2.8,4.6,2.0),(0,0,1.02),2.45)
    u.camera('tailoring',(-2.0,-4,2.3),(0,-.02,1.36),1.18)


def review(body):
    scene=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get()
    frames=[]
    for kind,count in [('Idle',90),('Walk',24)]:
        for f in range(count+1):
            pose(kind,f/count);bpy.context.view_layer.update()
            ev=body.evaluated_get(dg);data=ev.to_mesh();coords=[v.co for v in data.vertices]
            bounds=[[min(v[i] for v in coords),max(v[i] for v in coords)] for i in range(3)]
            feet={}
            for side in ('L','R'):
                foot=RIG.pose.bones['foot_'+side]
                feet[side]={'ankle':list(foot.head),'soleZ':foot.head.z-.10}
            frames.append({'clip':kind,'frame':f,'bounds':bounds,'feet':feet})
            ev.to_mesh_clear()
    pose('Idle',0)
    body.data.calc_loop_triangles()
    invalid=[];blended=0
    for v in body.data.vertices:
        if not v.groups or abs(sum(g.weight for g in v.groups)-1)>1e-5 or len(v.groups)>4:invalid.append(v.index)
        if len(v.groups)>1:blended+=1
    assert not invalid
    assert min(f['bounds'][2][0] for f in frames)>-.012
    assert len(body.data.loop_triangles)<70000
    assert blended>100
    return {'schema':'classic-character-authoring.v1','triangles':len(body.data.loop_triangles),'vertices':len(body.data.vertices),'bones':len(RIG.data.bones),'materials':len(body.data.materials),'blendedWeightVertices':blended,'invalidWeightVertices':invalid,'animatedBounds':frames,'floorToleranceMeters':.012,'humanArtApproved':False}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--views',default='all');parser.add_argument('--width',type=int,default=1100);parser.add_argument('--samples',type=int,default=48)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    PACKAGE.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials();garments();limbs();head();satchel();body=rig();clips=animate()
    report=review(body);stage();devices=u.configure(args.samples,args.width)
    scene=bpy.context.scene;scene.render.resolution_y=args.width;scene.camera=bpy.data.objects['three-quarter'];scene.frame_start=1;scene.frame_end=25
    bpy.ops.file.pack_all()
    source=PACKAGE/'classic-investigator.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
    identity=sha(source)
    report.update({'sourceSha256':identity,'inputs':{'builder':sha(Path(__file__)),'geometryHelper':sha(HELPER)},'devices':devices,'clips':[{'name':name,'durationSeconds':count/30} for name,count in clips],'strideMeters':.96,'authoredWalkSpeed':1.2,'frontAxis':'Blender -Y, glTF +Z','units':'metres','rights':'Original procedural geometry and mathematical wool textures. No external meshes, images, fonts or character identities.'})
    write(PACKAGE/'authoring-review.json',report)
    if args.views!='none':
        entries=[]
        views=['three-quarter','front','profile','back','tailoring','walk-contact','walk-passing'] if args.views=='all' else args.views.split(',')
        (PACKAGE/'renders').mkdir(exist_ok=True)
        for view in views:
            scene.camera=bpy.data.objects['three-quarter' if view.startswith('walk') else view]
            pose('Walk' if view.startswith('walk') else 'Idle',.25 if view=='walk-passing' else 0)
            scene.render.filepath=str(PACKAGE/'renders'/f'{view}.png');bpy.ops.render.render(write_still=True)
            p=Path(scene.render.filepath);entries.append({'view':view,'sha256':sha(p),'path':str(p.relative_to(PACKAGE))})
        write(PACKAGE/'render-review.json',{'sourceSha256':identity,'samples':args.samples,'engine':'Cycles','renders':entries,'humanArtApproved':False})
    pose('Idle',0)
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);RIG.select_set(True)
    raw=PACKAGE/'investigator-raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
    write(PACKAGE/'raw-export.json',{'sourceSha256':identity,'rawSha256':sha(raw),'bytes':raw.stat().st_size})
    print(json.dumps({'sourceSha256':identity,'triangles':report['triangles'],'bones':report['bones'],'blendedVertices':report['blendedWeightVertices'],'rawBytes':raw.stat().st_size}),flush=True)


if __name__=='__main__':main()
