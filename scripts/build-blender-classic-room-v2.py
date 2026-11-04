"""Refine the approved railway sitting room; preserve the v1 source unchanged."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import random
import sys
import time

import bpy
import numpy as np
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/3d-town/classic-railway-v1'
PACKAGE=ROOT/'docs/3d-town/classic-railway-v2'
SOURCE=PACKAGE/'classic-railway.blend'
spec=importlib.util.spec_from_file_location('railway_geometry',ROOT/'scripts/build-blender-classic-railway.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
u.PACKAGE=PACKAGE;u.SOURCE=SOURCE
F=.18
RNG=random.Random(193410)


def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def remove_prefix(*names):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(names):bpy.data.objects.remove(obj,do_unlink=True)


def pbr(name,asset,tint=(1,1,1),meters=1,rough_floor=.32):
    mat=u.material(name,'ffffff',.6,0,None,meters)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
    maps=next(a['maps'] for a in read(PACKAGE/'licensed/provenance.json')['assets'] if a['id']==asset)
    for role,target in [('color','Base Color'),('normal','Normal'),('roughness','Roughness')]:
        node=nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(PACKAGE/maps[role]['path']),check_existing=True);node.extension='REPEAT'
        if role!='color':node.image.colorspace_settings.name='Non-Color'
        if role=='roughness':
            # Keep a plain image-to-Principled connection for identical GLB PBR.
            # Derive the finish from the scan in linear data space, preserving
            # the untouched downloaded scan and its license/checksum ledger.
            key=asset+'_roughness_'+str(rough_floor)
            derived=bpy.data.images.get(key)
            if derived is None:
                original=node.image;pixels=np.empty(len(original.pixels),dtype=np.float32);original.pixels.foreach_get(pixels)
                pixels=pixels.reshape((-1,4));pixels[:,:3]=rough_floor+(1-rough_floor)*pixels[:,:3]
                derived=bpy.data.images.new(key,width=original.size[0],height=original.size[1],alpha=False)
                derived.colorspace_settings.name='Non-Color';derived.pixels.foreach_set(pixels.ravel());derived.pack()
            node.image=derived
        if role=='normal':
            norm=nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.40;links.new(node.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],shader.inputs[target])
        elif role=='color' and tint!=(1,1,1):
            # Blender 5.2's glTF exporter recognizes the modern RGBA Mix node,
            # but silently drops a legacy MixRGB constant from baseColorFactor.
            mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
            mix.inputs[7].default_value=(*tint,1);links.new(node.outputs['Color'],mix.inputs[6]);links.new(mix.outputs[2],shader.inputs[target])
        else:links.new(node.outputs['Color'],shader.inputs[target])
    return mat


def uvgrain(obj,angle=0,offset=(0,0),meters=1):
    layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a]))
        for li in poly.loop_indices:
            p=obj.data.vertices[obj.data.loops[li].vertex_index].co
            x,y=(p.x,p.y) if axis==2 else ((p.y,p.z) if axis==0 else (p.x,p.z))
            layer.data[li].uv=((math.cos(angle)*x+math.sin(angle)*y)/meters+offset[0],(-math.sin(angle)*x+math.cos(angle)*y)/meters+offset[1])


def materials():
    # The unused v1 clay can be purged when loading the saved source.
    u.material('clay','aaaaaa',.90,0)
    pbr('aged_walnut','wood_table_001',(.66,.67,.61),1.8)
    pbr('polished_walnut','wood_table_001',(.82,.78,.65),1.6)
    pbr('oxblood_leather','leather_red_02',(.46,.25,.20),.56)
    for i in range(5):pbr('parquet_oak_'+str(i),'wood_table_001',(.80+i*.045,.665+i*.04,.50+i*.035),1.6,.52)
    for old,new in [('timber','aged_walnut'),('walnut','aged_walnut'),('leather','oxblood_leather')]:
        for obj in bpy.data.objects:
            if obj.type not in ('MESH','CURVE','FONT'):continue
            for slot in obj.material_slots:
                if slot.material and slot.material.name==old:slot.material=u.MATS[new]
    for name,color,rough,metal in [('lining','4c3430',.8,0),('lampshade','d4b98a',.85,0),('warm_bulb','f5d391',.4,0),('worn_bronze','886637',.45,.72),('embroidered_trim','a99874',.89,0),('dark_emerald','263b30',.45,0),('board_letters','c7ad76',.74,0),('charcoal','22211e',.94,0),('embers','a84919',.8,0)]:u.material(name,color,rough,metal)
    for name,strength,color in [('warm_bulb',2.0,(1,.63,.27,1)),('embers',1.3,(1,.10,.016,1))]:
        p=u.MATS[name].node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=color;p.inputs['Emission Strength'].default_value=strength
    # The carpet is a new mathematical weave, independent of the licensed scans.
    folder=PACKAGE/'textures';folder.mkdir(exist_ok=True)
    n=1024;y,x=np.mgrid[0:n,0:n]/(n-1);d=np.minimum.reduce([x,y,1-x,1-y])
    color=np.zeros((n,n,3))+np.array([.24,.095,.075])
    for lo,hi,rgb in [(0,.016,[.24,.18,.115]),(.018,.031,[.56,.43,.26]),(.034,.058,[.12,.18,.19]),(.061,.093,[.50,.35,.21]),(.096,.113,[.12,.18,.19])]:color[(d>=lo)&(d<hi)]=rgb
    diamond=np.abs(x-.5)*1.35+np.abs(y-.5)
    color[diamond<.27]=[.17,.23,.23];color[diamond<.244]=[.53,.38,.23];color[diamond<.22]=[.31,.12,.09]
    for yy in np.linspace(.18,.82,8):
        for xx in np.linspace(.18,.82,7):
            if abs(xx-.5)*1.35+abs(yy-.5)<.27:continue
            dx=(x-xx);dy=(y-yy);r=np.sqrt(dx*dx+dy*dy);a=np.arctan2(dy,dx)
            mask=r<(.010+.004*np.cos(a*6));color[mask]=[.57,.40,.22]
    # Repeated woven rosettes and a subdued, uneven pile soften the graphic grid.
    for yy in np.linspace(.041,.959,27):
        for xx in (.077,.923):
            dx=x-xx;dy=y-yy;r=np.sqrt(dx*dx+dy*dy);a=np.arctan2(dy,dx)
            color[r<(.013+.005*np.cos(a*4))]=[.31,.23,.15]
    pile=.88+.05*np.sin(x*29+y*17)+.035*np.cos(x*51-y*33)
    weave=(np.sin(x*math.tau*420)*np.cos(y*math.tau*390))*.016
    color=color*pile[...,None]+weave[...,None];color=color*.79+np.array([.18,.13,.09])*.21
    u.png(folder/'original-carpet.png',color)
    carpet=u.material('woven_carpet','ffffff',.96);tex=carpet.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(folder/'original-carpet.png'))
    carpet.node_tree.links.new(tex.outputs['Color'],carpet.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def clip(poly,axis,bound,greater):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ina=a[axis]>=bound if greater else a[axis]<=bound;inb=b[axis]>=bound if greater else b[axis]<=bound
        if ina:out.append(a)
        if ina!=inb:
            t=(bound-a[axis])/(b[axis]-a[axis]);out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return out


def parquet():
    remove_prefix('parquet','rug_')
    # Lower only the solid substrate, so the new finish is flush with F.
    bpy.data.objects['inn_floor'].location.z-=.026
    u.LAY='interior'
    batches=[{'v':[],'f':[],'uv':[]} for _ in range(5)]
    length=.66;width=.11;rot=math.pi/4;count=0
    for i in range(-14,15):
        for j in range(-90,91):
            xx=i*length+j*width;yy=i*length-j*width
            for ox,oy,w,h,grain in [(xx,yy,length,width,0),(xx+length,yy,width,length,math.pi/2)]:
                poly=[(x*math.cos(rot)-y*math.sin(rot)+6.4,x*math.sin(rot)+y*math.cos(rot)+3.4) for x,y in [(ox+.001,oy+.001),(ox+w-.001,oy+.001),(ox+w-.001,oy+h-.001),(ox+.001,oy+h-.001)]]
                if max(p[0] for p in poly)<2.20 or min(p[0] for p in poly)>10.60 or max(p[1] for p in poly)<.20 or min(p[1] for p in poly)>6.59:continue
                for axis,bound,greater in [(0,2.20,True),(0,10.60,False),(1,.20,True),(1,6.59,False)]:
                    poly=clip(poly,axis,bound,greater)
                    if not poly:break
                if len(poly)<3:continue
                area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))/2
                if area<.00015:continue
                count+=1;b=batches[RNG.randrange(5)];base=len(b['v']);n=len(poly);cx=sum(p[0] for p in poly)/n;cy=sum(p[1] for p in poly)/n
                verts=[(x,y,F-.026) for x,y in poly]+[(x,y,F-.002) for x,y in poly]+[(x+(cx-x)*.010,y+(cy-y)*.004,F) for x,y in poly]
                faces=[tuple(reversed(range(n))),tuple(2*n+k for k in range(n))]
                for layer in range(2):
                    faces.extend((layer*n+k,layer*n+(k+1)%n,(layer+1)*n+(k+1)%n,(layer+1)*n+k) for k in range(n))
                b['v'].extend(verts);b['f'].extend(tuple(base+k for k in f) for f in faces)
                angle=rot+grain;offset=RNG.random()*2
                for f in faces:
                    for vi in f:
                        x,y,z=verts[vi];b['uv'].append(((math.cos(angle)*x+math.sin(angle)*y)/1.6+offset,(-math.sin(angle)*x+math.cos(angle)*y)/1.6))
    for index,b in enumerate(batches):
        obj=u.mesh('herringbone_'+str(index),b['v'],b['f'],'parquet_oak_'+str(index));layer=obj.data.uv_layers.active
        for loop,uv in zip(layer.data,b['uv']):loop.uv=uv
        obj['floorFinishTop']=F
    rug=u.box('woven_conversation_rug',(7.64,3.39,F+.003),(4.3,3.94,.006),'woven_carpet',.001)
    for poly in rug.data.polygons:
        for li in poly.loop_indices:
            p=rug.data.vertices[rug.data.loops[li].vertex_index].co;rug.data.uv_layers.active.data[li].uv=((p.x-5.49)/4.3,(p.y-1.42)/3.94)
    for side in (-1,1):
        for k in range(92):
            x=5.56+k*.045;y=3.39+side*1.977
            u.tube('carpet_fringe',[(x,y,F+.004),(x+.009,y+side*.052,F+.003)],.0018,'embroidered_trim')
    return count


def pillow(name,center,size,mat,tuft=False):
    # A closed curved cushion with a continuous grid surface, not buttons on a box.
    x,y,z=center;w,d,h=size;nu=28;nv=28;verts=[]
    for back in (False,True):
        for j in range(nv+1):
            v=j/nv*2-1
            for i in range(nu+1):
                t=i/nu*2-1
                xx=x+t*w/2;zz=z+v*h/2
                bulge=.034*(1-t*t)*(1-v*v)
                dents=0
                if tuft:
                    for bx in (-.64,0,.64):
                        for bz in (-.5,.4):dents+=.036*math.exp(-((t-bx)**2/.009+(v-bz)**2/.012))
                yy=y+d/2 if back else y-d/2-bulge+dents
                verts.append((xx,yy,zz))
    row=nu+1;plane=row*(nv+1);faces=[]
    for back in range(2):
        off=back*plane
        for j in range(nv):
            for i in range(nu):
                f=(off+j*row+i,off+j*row+i+1,off+(j+1)*row+i+1,off+(j+1)*row+i);faces.append(tuple(reversed(f)) if back else f)
    edge=list(range(row))+[j*row+nu for j in range(1,nv+1)]+[nv*row+i for i in range(nu-1,-1,-1)]+[j*row for j in range(nv-1,0,-1)]
    faces.extend((a,b,b+plane,a+plane) for a,b in zip(edge,edge[1:]+edge[:1]))
    obj=u.mesh(name,verts,faces,mat,True);uvgrain(obj,0,meters=.60)
    return obj


def chair(name,x,y,focus):
    remove_prefix(name+'_')
    before=set(bpy.data.objects.keys());u.LAY='interior'
    for dx in (-.34,.34):
        for dy in (-.32,.32):
            u.cylinder(name+'_turned_foot',(x+dx,y+dy,F+.135),.045,.27,'aged_walnut',20,top=.057)
            u.sphere(name+'_foot_collar',(x+dx,y+dy,F+.23),(.061,.061,.039),'aged_walnut',20)
    base=u.box(name+'_base',(x,y,F+.335),(.88,.87,.20),'oxblood_leather',0);u.bevel(base,.067,4)
    cushion=u.box(name+'_seat',(x,y-.035,F+.49),(.71,.72,.19),'oxblood_leather',0);u.bevel(cushion,.074,5)
    for poly in cushion.data.polygons:poly.use_smooth=True
    pillow(name+'_tufted_back',(x,y+.34,F+.835),(.81,.16,.74),'oxblood_leather',True)
    for dx in (-.259,0,.259):
        for zz in (.65,.983):u.sphere(name+'_covered_button',(x+dx,y+.267,F+zz),(.013,.008,.013),'lining',16)
    for dx in (-.438,.438):
        u.box(name+'_arm_base',(x+dx,y+.035,F+.63),(.145,.76,.45),'oxblood_leather',.050)
        u.tube(name+'_rolled_arm',[(x+dx,y-.35,F+.77),(x+dx,y-.28,F+.83),(x+dx,y+.27,F+.84)],.105,'oxblood_leather')
        u.tube(name+'_arm_piping',[(x+dx+.10,y-.31,F+.78),(x+dx+.09,y+.26,F+.86)],.003,'lining')
        for k in range(10):u.sphere(name+'_nail',(x+dx,y-.387,F+.45+k*.035),(.006,.005,.006),'worn_bronze',12)
    u.tube(name+'_seat_piping',[(x-.34,y-.38,F+.495),(x+.34,y-.38,F+.495)],.0035,'lining')
    angle=math.atan2(focus[0]-x,-(focus[1]-y));u.transform_group(before,(x,y,0),angle)
    for collider in u.COLLIDERS:
        if collider['id']==name:collider.update(size=[1.15,1.05],angle=angle)


def local_light(name,pos,watts,runtime,distance,color=(1,.73,.44)):
    data=bpy.data.lights.new(name,'POINT');data.energy=watts;data.color=color;data.shadow_soft_size=.12
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos;u.tag(obj)
    u.FIXTURES.append({'id':name,'position':list(pos),'color':'#ffd39a','sourceWatts':watts,'runtimeIntensity':runtime,'distance':distance})


def shade(name,x,y,z,r=.20,h=.30):
    verts=[];faces=[];n=96
    for row,zz,rad in [(0,z,r),(1,z+h,r*.57)]:
        for i in range(n):
            a=i*math.tau/n;rr=rad+(.006 if i%2 else -.006);verts.append((x+math.cos(a)*rr,y+math.sin(a)*rr,zz))
    faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=u.mesh(name+'_pleated_shade',verts,faces,'lampshade',True)
    mod=obj.modifiers.new('fabric_thickness','SOLIDIFY');mod.thickness=.002;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    for zz,rad in [(z,r),(z+h,r*.57)]:u.tube(name+'_shade_trim',[(x+math.cos(a)*rad,y+math.sin(a)*rad,zz) for a in np.linspace(0,math.tau,49)],.005,'embroidered_trim')
    u.sphere(name+'_bulb',(x,y,z+h*.46),(.035,.035,.05),'warm_bulb',16)


def lamps():
    u.LAY='interior'
    # Supported console lamp; its base meets the existing top slab.
    x,y,z=2.78,3.53,F+.8925
    u.cylinder('console_lamp_base',(x,y,z+.022),.125,.045,'worn_bronze',32)
    u.tube('console_lamp_stem',[(x,y,z+.04),(x,y,z+.33)],.019,'worn_bronze')
    shade('console_lamp',x,y,z+.31,.20,.27);local_light('console-lamp-light',(x,y,z+.43),28,12,3.1)
    # A floor reading lamp sits behind the east chair, outside the walking aisle.
    x,y=9.99,4.76
    u.cylinder('reading_lamp_base',(x,y,F+.028),.23,.056,'worn_bronze',40)
    u.tube('reading_lamp_stem',[(x,y,F+.05),(x,y,F+1.48)],.020,'worn_bronze')
    for z in (.16,1.17):u.sphere('reading_lamp_collar',(x,y,F+z),(.05,.05,.055),'worn_bronze',20)
    shade('reading_lamp',x,y,F+1.46,.255,.36);local_light('reading-lamp-light',(x,y,F+1.62),40,19,3.5)
    u.rect('reading-lamp',x,y,.55,.55)
    # Bracketed wall sconces give the mantel a visible practical light source.
    for x in (6.76,9.37):
        u.box('sconce_wall_plate',(x,6.575,F+2.24),(.08,.036,.22),'worn_bronze',.019)
        u.tube('sconce_bracket',[(x,6.555,F+2.2),(x,6.36,F+2.12),(x,6.25,F+2.29)],.017,'worn_bronze')
        shade('mantel_sconce',x,6.25,F+2.28,.10,.18);local_light('wall-sconce-'+str(x),(x,6.25,F+2.34),13,7.0,2.5)


def hearth_and_board():
    u.LAY='interior';remove_prefix('mirror_frame','mirror_surface')
    # Original departure board replaces a blank reflective rectangle.
    u.box('departure_board_back',(8.05,6.55,F+2.47),(1.73,.12,.98),'aged_walnut',.015)
    u.box('departure_board_face',(8.05,6.479,F+2.47),(1.59,.02,.84),'dark_emerald',.006)
    u.text('board_heading','DEPARTURES',(8.05,6.459,F+2.79),.092,'board_letters')
    for i,(time_,place) in enumerate([('09:20','NORTHBRIDGE'),('11:40','ALDERFORD'),('16:15','LAKEVALE')]):
        z=F+2.56-i*.18;u.text('departure_time',time_,(7.51,6.458,z),.071,'board_letters');u.text('departure_place',place,(8.30,6.458,z),.071,'board_letters')
    for z in (2.68,2.06):u.box('board_gold_rule',(8.05,6.457,F+z),(1.42,.006,.004),'worn_bronze',0)
    # Recessed firebox remains backed, with an iron grate and charred logs.
    for x in np.linspace(7.65,8.45,8):u.tube('fire_grate_bar',[(x,5.995,F+.13),(x,5.995,F+.38)],.009,'iron')
    u.tube('fire_grate_rail',[(7.64,5.995,F+.39),(8.46,5.995,F+.39)],.012,'iron')
    for x,z in [(7.87,.17),(8.15,.16),(8.02,.27)]:
        u.tube('charred_log',[(x-.15,6.18,F+z),(x+.17,6.22,F+z+.02)],.055,'charcoal')
    for k in range(15):
        u.sphere('warm_ember',(7.77+RNG.random()*.52,6.10+RNG.random()*.12,F+.095),(.025,.024,.013),'embers',12)
    local_light('hearth-embers',(8.05,6.12,F+.29),9,4,1.4,(1,.26,.08))
    # Mantel mouldings make the stone construction readable at close range.
    for x in (7.22,8.88):
        u.box('hearth_pilaster',(x,5.89,F+.78),(.145,.065,1.39),'marble',.014)
        for dx in (-.045,0,.045):u.box('hearth_fluting',(x+dx,5.848,F+.78),(.008,.008,1.15),'walnut',.002)
    u.box('hearth_frieze',(8.05,5.83,F+1.445),(1.96,.09,.14),'marble',.015)
    # Books and correspondence are decoration, deliberately not canonical clues.
    for i in range(4):u.box('mantel_book',(7.30+i*.055,6.23,F+1.685+(.21+i*.007)/2),(.050,.23,.21+i*.007),'book_green' if i%2 else 'book_red',.004)
    for x in (7.64,8.50):u.cylinder('mantel_candlestick_foot',(x,6.19,F+1.703),.065,.036,'worn_bronze',24);u.cylinder('mantel_candlestick',(x,6.19,F+1.815),.018,.19,'worn_bronze',20);u.cylinder('mantel_candle',(x,6.19,F+1.98),.022,.15,'ivory',20)


def curtains():
    remove_prefix('curtain_fold','curtain_rail');u.LAY='inn_front'
    # The fabric and tiebacks protrude farther than the masonry. Reserve the
    # shallow window-side strip so movement cannot pass through the drapes.
    u.rect('window-drapery',7.57,.30,6.10,.56)
    for x in (6.65,9.15):
        u.tube('curtain_pole',[(x-1.04,.30,F+2.86),(x+1.04,.30,F+2.86)],.019,'worn_bronze')
        for side in (-1,1):
            verts=[];faces=[];n=32;m=24
            for j in range(m+1):
                t=j/m;z=F+.13+t*2.67;pull=math.exp(-((t-.43)/.17)**2)
                for i in range(n+1):
                    s=i/n;cx=x+side*(.77+.15*pull)+(s-.5)*(.49-.14*pull)
                    yy=.34+math.cos(s*math.tau*5)*(.035+.010*(1-t))+.05*pull
                    verts.append((cx,yy,z+.012*math.cos(s*math.tau*5)*(1-t)))
            for j in range(m):
                for i in range(n):a=j*(n+1)+i;faces.append((a,a+1,a+n+2,a+n+1))
            obj=u.mesh('velvet_drape',verts,faces,'curtain',True);mod=obj.modifiers.new('fabric_back','SOLIDIFY');mod.thickness=.004;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
            for i in range(7):u.tube('curtain_ring',[(x+side*.77+(i-3)*.065,.30+math.cos(a)*.032,F+2.80+math.sin(a)*.047) for a in np.linspace(0,math.tau,17)],.004,'worn_bronze')
            u.tube('curtain_tieback',[(x+side*.64,.38,F+1.29),(x+side*.96,.42,F+1.20),(x+side*1.04,.32,F+1.32)],.012,'embroidered_trim')


def details():
    u.LAY='interior'
    # Desk drawers and handles support its writing function.
    for x in (4.71,5.68):
        u.box('writing_drawer',(x,5.424,F+.68),(.78,.030,.14),'polished_walnut',.006)
        for xx in (x-.18,x+.18):u.sphere('drawer_escutcheon',(xx,5.402,F+.68),(.020,.008,.020),'worn_bronze',16)
        u.tube('drawer_pull',[(x-.18,5.39,F+.68),(x-.14,5.35,F+.64),(x+.14,5.35,F+.64),(x+.18,5.39,F+.68)],.007,'worn_bronze')
    # Add a small original wall map to the bare wall above the luggage console.
    u.box('route_map_frame',(2.263,4.55,F+2.17),(.11,1.08,.75),'aged_walnut',.012)
    u.box('route_map_paper',(2.326,4.55,F+2.17),(.014,.95,.62),'paper',.001)
    u.tube('route_map_river',[(2.338,4.18,F+1.91),(2.338,4.36,F+2.14),(2.338,4.69,F+2.17),(2.338,4.84,F+2.43)],.006,'green')
    for z,y in [(1.99,4.38),(2.28,4.75),(2.15,4.31)]:u.sphere('map_town',(2.341,y,F+z),(.003,.020,.020),'ink',12)
    u.text('map_heading','RAILWAY DISTRICT',(2.342,4.55,F+2.43),.051,'ink',rot=(math.pi/2,0,math.pi/2))
    # Cornice profiles are attached to the visible ceiling perimeter.
    u.LAY='ceiling'
    for z,w in [(3.005,.17),(3.062,.24),(3.117,.28)]:
        for y in (.33,6.47):u.box('cornice_rear_front',(6.4,y,F+z),(8.27,w,.037),'ivory',.009)
        for x in (2.32,10.48):u.box('cornice_sides',(x,3.4,F+z),(w,6.27,.037),'ivory',.009)


def fonts():
    font=bpy.data.fonts.load(str(PACKAGE/'licensed/railway-serif-study.ttf'),check_existing=True)
    def width(obj):
        bpy.context.view_layer.update();ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
        result=max(v.co.x for v in mesh.vertices)-min(v.co.x for v in mesh.vertices);ev.to_mesh_clear();return result
    for obj in bpy.data.objects:
        if obj.type=='FONT':
            original=width(obj);obj.data.font=font;obj.data.update_tag()
            target=1.02 if obj.name=='board_heading' else .23 if obj.name.startswith('departure_time') else .72 if obj.name.startswith('departure_place') else original
            obj.data.size*=target/width(obj);obj.data.bevel_depth=0;obj.data.resolution_u=2;obj.data.update_tag()
    for old in list(bpy.data.fonts):
        if old!=font and old.users==0:bpy.data.fonts.remove(old)


def build():
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'classic-railway.blend'))
    u.MATS={m.name:m for m in bpy.data.materials};u.LAY='interior';u.PART='static'
    u.OPENINGS=read(BASE/'openings.json')['openings'];u.COLLIDERS=read(BASE/'scene-contract.json')['colliders'];u.FIXTURES=read(BASE/'lighting.json')['fixtures'];u.CONTACTS=read(BASE/'placements.json')['supportRelations']
    materials();board_count=parquet();chair('chair-west',6.25,3.22,(7.55,3.30));chair('chair-east',9.15,3.65,(7.55,3.30))
    lamps();hearth_and_board();curtains();details();fonts()
    # Circle control points already describe the silhouettes. Avoid six extra
    # subdivisions per tiny curtain ring or shade rim in the runtime mesh.
    for obj in bpy.data.objects:
        if obj.type=='CURVE' and (obj.name.startswith('curtain_ring') or '_shade_trim' in obj.name):obj.data.resolution_u=1
    # Retain authentic architecture and adjust UV orientation on vertical panels.
    for obj in bpy.data.objects:
        if obj.type=='MESH' and obj.name.startswith(('rear_panel','side_panel_field','side_wainscot')):uvgrain(obj,0,meters=1.8)
    data=read(BASE/'scene-contract.json');data['colliders']=u.COLLIDERS;data['player']['speed']=1.55
    data['interactions'][1]['description']='桌面的信纸、墨水与抽屉体现旅馆的书信往来。本样板尚未将它们绑定为案件线索。'
    data['interactions'][2]['description']='两张皮椅围着茶桌，背后的壁灯与阅读灯形成会客照明。列车时刻牌属于本次美术陈设。'
    write(PACKAGE/'scene-contract.json',data);write(PACKAGE/'openings.json',read(BASE/'openings.json'))
    write(PACKAGE/'placements.json',{'schema':'classic-placement.v2','supportRelations':u.CONTACTS,'seatingFocus':[7.55,3.30],'parquetBoards':board_count,'newLightingSupports':['console tabletop','floor at F','rear wall plates'],'authoredCollisionAddition':'reading-lamp envelope outside rear/entry aisles'})
    write(PACKAGE/'lighting.json',{'schema':'classic-lights.v2','fixtures':u.FIXTURES,'runtimeCalibration':'Authored runtime lumen-like values, not Blender watt equivalence. No baked-lightmap claim.'})
    bpy.context.scene['purpose']='Classical detective sitting-room refinement; original geometry with documented CC0 textures and OFL sign font; not human-approved final town.'


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--views',default='all');parser.add_argument('--render-existing',action='store_true');parser.add_argument('--samples',type=int,default=48);parser.add_argument('--width',type=int,default=1440)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    PACKAGE.mkdir(parents=True,exist_ok=True)
    brief=read(PACKAGE/'room-brief.json')
    inputs=[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)} for p in [Path(__file__),ROOT/'scripts/build-blender-classic-railway.py',BASE/'classic-railway.blend',PACKAGE/'room-brief.json',PACKAGE/'licensed/provenance.json']]
    if args.render_existing:
        receipt=read(PACKAGE/'authoring-receipt.json');assert receipt['inputs']==inputs and receipt['source']['sha256']==sha(SOURCE)
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        build();u.configure(args.samples,args.width);bpy.context.scene.camera=bpy.data.objects['interior-production']
        bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        factors={m.name:list(n.inputs[7].default_value) for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='MIX' and n.data_type=='RGBA' and n.blend_type=='MULTIPLY'}
        write(PACKAGE/'authoring-receipt.json',{'schema':'classic-authoring.v2','inputs':inputs,'source':{'path':SOURCE.name,'sha256':sha(SOURCE),'bytes':SOURCE.stat().st_size},'blenderVersion':bpy.app.version_string,'thirdPartyAssets':read(PACKAGE/'licensed/provenance.json')['assets'],'baseColorFactors':factors,'originalPattern':'New mathematical woven carpet; architecture inherited from original project v1 source.','humanArtApproved':False})
    if args.views!='none':
        # Blender 5.2 can show a POINT emitter as a camera-visible disk. Hide the
        # analytic emitter, while retaining its illumination and modeled bulb.
        def hide_emitters(scene):
            for obj in scene.objects:
                if obj.type=='LIGHT':obj.visible_camera=False
        bpy.app.handlers.render_pre.append(hide_emitters)
        try:u.render_views(args,brief,inputs)
        finally:bpy.app.handlers.render_pre.remove(hide_emitters)
    print('CLASSIC_V2_SOURCE='+str(SOURCE),flush=True)


if __name__=='__main__':main()
