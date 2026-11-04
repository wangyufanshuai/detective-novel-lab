"""Snowbound manor: original architectural set with verified CC0 hero furniture.

Background Blender only. Metres, real Boolean apertures, retained source and
camera-specific review images. No generated concept image substitutes geometry.
"""
from pathlib import Path
from mathutils import Vector, Matrix
import bpy, math, json, hashlib, random, sys, argparse, importlib.util, struct, zlib
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/snowbound-manor-v1'
SPEC=importlib.util.spec_from_file_location('manor_base',ROOT/'scripts/build-blender-classic-railway.py')
u=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(u)
u.PACKAGE=P;u.F=.25
F=.25;H=4.25
R=random.Random(193402)
PLACEMENTS=[];LIGHTS=[];WINDOWS=[]
SOURCE=P/'snowbound-manor.blend'
TREE_MESHES=[]
GENERATOR_SHA=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

def layer(name):u.LAY=name
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,data):u.write(path,data)
def rgb(color):return tuple(u.linear(int(color[i:i+2],16)/255) for i in (0,2,4))

def pipe(name,points,r,mat):
    o=u.tube(name,points,r,mat);o.data.use_fill_caps=True;return o

def beam(name,a,b,r1,r2,mat,sides=10):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized()
    right=axis.cross(Vector((0,0,1)))
    if right.length<.01:right=Vector((1,0,0))
    right.normalize();up=axis.cross(right)
    verts=[tuple(c+rad*(math.cos(i*math.tau/sides)*right+math.sin(i*math.tau/sides)*up)) for c,rad in [(a,r1),(b,r2)] for i in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return u.mesh(name,verts,faces,mat,True)

def pbr(name,color,rough,paths,size=1,normal_strength=.5):
    m=u.material(name,color,rough);m['uvMeters']=size
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    for role,file in paths.items():
        im=bpy.data.images.load(str(file),check_existing=True)
        t=n.new('ShaderNodeTexImage');t.image=im
        if role=='color':l.new(t.outputs['Color'],p.inputs['Base Color'])
        elif role=='normal':
            im.colorspace_settings.name='Non-Color'
            normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=normal_strength
            l.new(t.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],p.inputs['Normal'])
        elif role=='roughness':
            im.colorspace_settings.name='Non-Color';l.new(t.outputs['Color'],p.inputs['Roughness'])
    return m

def pattern_textures():
    out=P/'textures';out.mkdir(exist_ok=True)
    n=2048;y,x=np.mgrid[0:n,0:n]/n
    noise=np.random.default_rng(42).normal(0,.012,(n,n,1))
    # Original woven carpet design: wine field, stepped borders, central medallion,
    # repeating foliate knots. No external image or image-generation source.
    a=(x-.5)*2;b=(y-.5)*2;edge=np.maximum(abs(a),abs(b));rr=np.sqrt((a*.8)**2+(b*.95)**2)
    carpet=np.broadcast_to(np.array([.245,.071,.061]),(n,n,3)).copy()
    border=(edge>.78)&(edge<.96);carpet[border]=[.085,.125,.145]
    for ee in [.775,.798,.925,.948,.973,.989]:carpet[abs(edge-ee)<.004]=[.48,.36,.23]
    # Dense palmettes and meandering stems replace the oversized geometric symbols.
    fx=(x*21)%1-.5;fy=(y*29)%1-.5
    rr2=np.sqrt((fx*.9)**2+fy**2);theta=np.arctan2(fy,fx)
    flower=.18+.065*np.cos(theta*6)
    petals=(abs(rr2-flower)<.031)&(edge<.77)
    carpet[petals]=[.49,.34,.22]
    centers=(rr2<.047)&(edge<.77);carpet[centers]=[.10,.17,.18]
    vine=(abs(fx-.20*np.sin(y*math.tau*29))<.014)&(edge<.77)
    carpet[vine]=[.40,.31,.19]
    br=(abs(rr2-(.23+.055*np.cos(theta*4)))<.038)&border
    carpet[br]=[.48,.35,.22]
    angle=np.arctan2(b,a);med=np.sqrt(a*a+(b*1.14)**2)
    for rad,col in [(.42,[.49,.34,.21]),(.385,[.09,.15,.16]),(.32,[.46,.31,.21]),(.285,[.26,.08,.065]),(.21,[.10,.15,.16]),(.16,[.44,.31,.21])]:
        shape=rad*(1+.09*np.cos(angle*12))
        carpet[med<shape]=col
    carpet[(abs(med-(.26+.018*np.cos(angle*16)))<.009)]=[.50,.38,.25]
    carpet[(med<.11)&(np.cos(angle*8)>.15)]=[.29,.09,.065]
    weave=(np.sin(x*math.tau*480)*np.cos(y*math.tau*510))[...,None]*.012
    wear=(.91+.06*np.sin(x*32+y*25)*np.sin(y*38-x*17))[...,None]
    u.png(out/'manor-rug.png',carpet*wear+noise*1.6+weave)
    # Low-contrast damask, with period-specific repeated leaf geometry.
    dx=(x*6)%1-.5;dy=(y*6)%1-.5
    leaf=(abs(dx)*1.1+abs(dy-.06*np.cos(dx*math.tau))*1.25)
    motif=(abs(leaf-.29)<.028)|(abs(abs(dx)-(.08+.065*np.cos(dy*math.tau*2)))<.014)
    damask=np.array([.235,.271,.225])+motif[...,None]*np.array([.025,.024,.013])+noise*.35
    u.png(out/'manor-damask.png',damask)
    # Original transparent flame texture with curling edges and a soft emissive core.
    nn=512;yy,xx=np.mgrid[0:nn,0:nn]/nn;v=1-yy
    alpha=np.zeros((nn,nn));heat=np.zeros((nn,nn))
    for center,phase,hh in [(.19,1,.66),(.38,4,.94),(.62,8,.76),(.81,2,.57)]:
        t=np.clip(v/hh,0,1);wave=(.017*np.sin(t*8+phase)+.006*np.sin(t*19+phase))*t
        radius=.09*(1-t)**.72+.002
        dist=abs(xx-center-wave)/radius
        mask=np.clip((1-dist)*4,0,1)*np.clip((hh-v)*25,0,1)*np.clip(v*30,0,1)
        alpha=np.maximum(alpha,mask);heat=np.maximum(heat,mask*(1-t))
    rgba=np.zeros((nn,nn,4));rgba[:,:,0]=1;rgba[:,:,1]=.15+.58*heat;rgba[:,:,2]=.005+.09*heat**3;rgba[:,:,3]=alpha*.68
    values=np.uint8(np.clip(rgba,0,1)*255)
    def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    scan=b''.join(b'\0'+row.tobytes() for row in values)
    (out/'flames.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',nn,nn,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,8))+chunk(b'IEND',b''))

def materials():
    pattern_textures()
    for name,col,rough,metal in [
        ('walnut','3d281d',.4,0),('dark_wood','261e19',.4,0),('edge_wood','694832',.42,0),
        ('panel','39423b',.73,0),('ivory','d7cbb6',.62,0),('plaster','c7bca6',.86,0),
        ('stone','968c79',.8,0),('sandstone','948b79',.8,0),('slate','34434b',.68,0),
        ('snow','dde8ed',.86,0),('snow_shadow','c3d1d8',.92,0),('iron','20292c',.36,.7),
        ('brass','ab8551',.3,.78),('black','121312',.96,0),('coal','29201a',.95,0),
        ('paper','cbb99b',.92,0),('ink','252b2b',.8,0),('porcelain','dfd9c9',.22,0),
        ('tea','48251a',.12,0),('curtain','583332',.95,0),('book_red','6a352f',.73,0),
        ('book_green','2d4340',.75,0),('book_blue','34404b',.75,0),('book_gold','8c6b45',.8,0),
        ('leather','594130',.5,0),('bark','39332b',.98,0),('needles','23382f',.95,0),
        ('lamp','fff0c4',.36,0),('fire','ff9b37',.6,0),('ember','eb5f21',.8,0),
        ('mirror','b7bbba',.16,.98),('glass','bbcdd2',.08,0),('warm_window','b59a67',.5,0)]:
        u.material(name,col,rough,metal)
    licensed=json.loads((P/'licensed/provenance.json').read_text(encoding='utf-8'))
    for a,name,meters in [(next(a for a in licensed['assets'] if a['id']=='old_stone_wall_02'),'masonry',3.2),
                          (next(a for a in licensed['assets'] if a['id']=='roof_slates_02'),'roof',2.4)]:
        pbr(name,'99958a',.85,{k:P/v for k,v in a['maps'].items()},meters,.7)
    wood=ROOT/'docs/3d-town/classic-railway-v2/licensed/wood_table_001'
    pbr('wood','553727',.5,{'color':wood/'color.jpg','normal':wood/'normal.png','roughness':wood/'roughness.jpg'},1.5,.2)
    # A bounded multiplicative tint, represented by Blender's glTF-supported Mix node.
    m=u.MATS['wood'];n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    link=p.inputs['Base Color'].links[0];out=link.from_socket;l.remove(link)
    mix=n.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    mix.inputs[7].default_value=(.42,.31,.25,1);l.new(out,mix.inputs[6]);l.new(mix.outputs[2],p.inputs['Base Color'])
    pbr('damask','45503f',.92,{'color':P/'textures/manor-damask.png'},1.8)
    pbr('rug','492823',.94,{'color':P/'textures/manor-rug.png'},1)
    for name,power,color in [('lamp',3.3,(1,.62,.23,1)),('fire',3,(1,.3,.035,1)),('ember',1.1,(1,.1,.005,1)),('warm_window',.4,(1,.63,.29,1))]:
        p=u.MATS[name].node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=color;p.inputs['Emission Strength'].default_value=power
    p=u.MATS['glass'].node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.94;p.inputs['IOR'].default_value=1.45
    m=u.material('falling_snow','e2ebf0',.95);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.55,.70,1,1);p.inputs['Emission Strength'].default_value=.12
    m=u.material('flame_sheet','ffffff',.9);m.surface_render_method='DITHERED';m.use_transparent_shadow=False
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(P/'textures/flames.png'),check_existing=True)
    l.new(t.outputs['Color'],p.inputs['Base Color']);l.new(t.outputs['Color'],p.inputs['Emission Color']);l.new(t.outputs['Alpha'],p.inputs['Alpha']);p.inputs['Emission Strength'].default_value=1.0

def light(name,kind,pos,energy,color,size=1,target=None,shape=None,size_y=None):
    d=bpy.data.lights.new(name,kind);d.energy=energy;d.color=color
    if kind=='AREA':
        d.shape=shape or 'DISK';d.size=size
        if size_y is not None:d.size_y=size_y
    else:d.shadow_soft_size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    if kind=='AREA':o.visible_camera=False;o.visible_glossy=False;o.visible_transmission=False
    o['layer']='lights'
    LIGHTS.append({'id':name,'type':kind,'position':list(pos),'sourceWatts':energy,'color':list(color),'size':size,'target':target})
    return o

def group_transform(objects,matrix):
    for o in objects:
        if o.parent not in objects:o.matrix_world=matrix@o.matrix_world

def asset(asset_id,name,pos,*,width=None,height=None,yaw=0):
    a=next(a for a in json.loads((P/'licensed/provenance.json').read_text(encoding='utf-8'))['assets'] if a['id']==asset_id)
    old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(P/a['gltf']))
    objects=list(set(bpy.data.objects)-old);bpy.context.view_layer.update()
    vertices=[o.matrix_world@v.co for o in objects if o.type=='MESH' for v in o.data.vertices]
    lo=Vector([min(v[i] for v in vertices) for i in range(3)]);hi=Vector([max(v[i] for v in vertices) for i in range(3)])
    factor=width/(hi.x-lo.x) if width else height/(hi.z-lo.z) if height else 1
    matrix=Matrix.Translation(Vector(pos))@Matrix.Rotation(yaw,4,'Z')@Matrix.Scale(factor,4)@Matrix.Translation(-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))
    group_transform(objects,matrix)
    for i,o in enumerate(objects):
        o.name=name+'_'+str(i);o['layer']=u.LAY;o['part']='static';o['sourceAsset']=asset_id;o['origin']='Poly Haven CC0-1.0';o['instance']=name
    bpy.context.view_layer.update()
    vertices=[o.matrix_world@v.co for o in objects if o.type=='MESH' for v in o.data.vertices]
    lo2=[min(v[i] for v in vertices) for i in range(3)];hi2=[max(v[i] for v in vertices) for i in range(3)]
    PLACEMENTS.append({'id':name,'asset':asset_id,'position':list(pos),'uniformScale':factor,'yaw':yaw,'evaluatedBounds':[lo2,hi2],'attachment':'bottom','layer':u.LAY})
    return objects

def frame(name,x,y,z,w,h,mat='wood',depth=.08):
    for sign in [-1,1]:u.box(name+'_side'+str(sign),(x+sign*w/2,y,z),(.075,depth,h),mat,.009)
    for sign in [-1,1]:u.box(name+'_rail'+str(sign),(x,y,z+sign*h/2),(w+.075,depth,.075),mat,.009)

def window(name,x,y,sill,w,h,*,upper=False,rotate=False):
    before=set(bpy.data.objects);z=F+sill+h/2
    for sign in [-1,1]:
        u.box(name+'_stone_jamb'+str(sign),(x+sign*(w/2+.075),y-.05,z),(.15,.36,h+.28),'sandstone',.016)
        u.box(name+'_frame'+str(sign),(x+sign*(w/2-.04),y-.05,z),(.085,.14,h),'dark_wood',.005)
    for dz in [-h/2,0,h/2]:u.box(name+'_rail'+str(dz),(x,y-.06,z+dz),(w,.14,.065),'dark_wood',.005)
    for dx in [-w/6,w/6]:u.box(name+'_mullion'+str(dx),(x+dx,y-.075,z),(.028,.08,h),'dark_wood',.003)
    u.box(name+'_lintel',(x,y-.09,z+h/2+.11),(w+.42,.43,.19),'stone',.014)
    u.box(name+'_sill',(x,y-.18,z-h/2-.045),(w+.42,.55,.12),'stone',.012)
    u.sphere(name+'_snow_sill',(x,y-.28,z-h/2+.035),(w*.57,.20,.065),'snow',24)
    # Window glass is real glazing; upper rooms have a recessed illuminated backing.
    u.box(name+'_glazing',(x,y+.025,z),(w-.12,.014,h-.1),'glass',0)
    if upper:
        u.box(name+'_room_backing',(x,y+.48,z),(w+.03,.03,h+.03),'warm_window',0)
        for s in [-1,1]:
            u.box(name+'_curtain'+str(s),(x+s*w*.35,y+.20,z),(w*.21,.045,h-.1),'curtain',.02)
    objects=list(set(bpy.data.objects)-before)
    if rotate:group_transform(objects,Matrix.Translation(Vector((x,y,0)))@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Translation(Vector((-x,-y,0))))
    WINDOWS.append({'id':name,'center':[x,y,z],'width':w,'height':h,'upper':upper,'axis':'x' if rotate else 'y'})

def wall_paneling(name,length,at,rotation=0,excluded=()):
    old=set(bpy.data.objects)
    x0=-length/2
    for i in range(round(length/.85)):
        x=x0+(i+.5)*length/round(length/.85)
        if any(abs(x-center)<width/2+.42 for center,width in excluded):continue
        w=length/round(length/.85)-.08
        u.box(name+'_field'+str(i),(x,0,F+.57),(w,.045,.91),'wood',.008)
        frame(name+'_mould'+str(i),x,-.035,F+.57,w-.10,.72,'edge_wood',.045)
    for z,height,depth in [(F+.08,.15,.10),(F+1.07,.075,.11),(F+1.13,.045,.14)]:
        # Split rails at actual openings instead of running trim across passages.
        cuts=sorted([(c-w/2-.03,c+w/2+.03) for c,w in excluded])
        start=x0
        for end,next_start in cuts+[(length/2,length/2)]:
            if end>start:u.box(name+'_rail'+str(z)+str(start),((start+end)/2,0,z),(end-start,depth,height),'wood',.008)
            start=next_start
    objects=list(set(bpy.data.objects)-old)
    group_transform(objects,Matrix.Translation(Vector((*at,0)))@Matrix.Rotation(rotation,4,'Z'))

def cornice(name,length,at,rotation=0):
    old=set(bpy.data.objects)
    for dz,d,h in [(0,.10,.11),(.10,.18,.08),(.17,.25,.08),(.24,.32,.09)]:
        u.box(name+str(dz),(0,-d/2,H-.34+dz),(length,d,h),'ivory',.009)
    group_transform(list(set(bpy.data.objects)-old),Matrix.Translation(Vector((*at,0)))@Matrix.Rotation(rotation,4,'Z'))

def door_leaf(name,width,height,pos,yaw,mat='wood'):
    old=set(bpy.data.objects)
    u.box(name+'_leaf',(width/2,0,F+height/2),(width,.09,height),mat,.012)
    for z,hh in [(F+.65,.78),(F+1.88,1.35)]:
        u.box(name+'_recess'+str(z),(width/2,-.051,z),(width-.23,.018,hh),'dark_wood',.006)
        frame(name+'_panel'+str(z),width/2,-.064,z,width-.23,hh,'edge_wood',.035)
    u.sphere(name+'_handle',(width-.13,-.10,F+1.1),(.035,.06,.035),'brass',16)
    for z in [F+.35,F+height-.35]:u.cylinder(name+'_hinge'+str(z),(0,0,z),.024,.15,'brass',12)
    group_transform(list(set(bpy.data.objects)-old),Matrix.Translation(Vector((*pos,0)))@Matrix.Rotation(yaw,4,'Z'))

def roof(name,x0,x1,y0,y1,eave,ridge,*,along_y=False):
    if along_y:
        mid=(x0+x1)/2
        verts=[(x0,y0,eave),(x1,y0,eave),(x1,y1,eave),(x0,y1,eave),(mid,y0,ridge),(mid,y1,ridge)]
        faces=[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2),(0,3,2,1)]
    else:
        mid=(y0+y1)/2
        verts=[(x0,y0,eave),(x1,y0,eave),(x1,y1,eave),(x0,y1,eave),(x0,mid,ridge),(x1,mid,ridge)]
        faces=[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(0,3,2,1)]
    roof_obj=u.mesh(name+'_substrate',verts,faces,'roof')
    roof_obj.data.materials.append(u.MATS['wood' if name=='porch_roof' else 'masonry'])
    for index in [2,3]:roof_obj.data.polygons[index].material_index=1
    # The drift has a sculpted thickness with a clean underside, not a white roof card.
    for side in [-1,1]:
        vertices=[];faces=[];nx=36;ny=18
        for j in range(ny+1):
            t=j/ny
            for i in range(nx+1):
                f=i/nx
                if along_y:xx=mid+side*(x1-x0)/2*(1-t);yy=y0+(y1-y0)*f
                else:xx=x0+(x1-x0)*f;yy=mid+side*(y1-y0)/2*(1-t)
                ripple=.035*math.sin(f*29+t*8)+.020*math.sin(f*47-t*16)
                depth=.15+.11*(1-t)**3+.06*(1+math.sin(f*5))
                vertices.append((xx,yy,eave+(ridge-eave)*t+depth+ripple))
        for j in range(ny):
            for i in range(nx):
                a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
        obj=u.mesh(name+'_snow'+str(side),vertices,faces,'snow',True)
        mod=obj.modifiers.new('snow thickness','SOLIDIFY');mod.thickness=.12
        if side==-1:mod.offset=0
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    for a,b in [(verts[0],verts[1]),(verts[1],verts[2]),(verts[2],verts[3]),(verts[3],verts[0])]:
        beam(name+'_fascia',a,b,.085,.085,'dark_wood',6)

def architecture():
    layer('hall_floor')
    u.box('hall_structural_floor',(0,5,F-.15),(12.4,10.4,.30),'dark_wood',.006)
    # Individually edged timber boards: fine-scale contact variation, continuous substrate.
    for j in range(32):
        y=.23+(j+.5)*9.54/32
        for i in range(7):
            x=-5.77+(i+.5)*11.54/7
            o=u.box('floorboard_'+str((i,j)),(x,y,F+.005),(11.54/7-.006,9.54/32-.006,.012),'wood',.002)
            uv=o.data.uv_layers.active
            for p in uv.data:p.uv.x+=R.random()*.001
    front=[u.opening('main-arrival',0,0,0,2.5,3.0,'door',destination='snow porch and main hall')]
    front += [u.opening('hall-front-window'+str(x),x,0,1.18,1.65,2.10) for x in [-3.8,3.8]]
    rear=[u.opening('fireplace-recess',0,10,0,2.08,1.64,'deep_alcove',destination='sealed firebox 0.72 metres deep')]
    sideholes=[u.opening('west-door',-6,3.0,0,1.65,2.8,'door','x','closed dining-room door'),u.opening('west-window',-6,7.3,1.13,1.75,2.15,'window','x')]
    east=[u.opening('east-door',6,3.0,0,1.65,2.8,'door','x','closed guest corridor door'),u.opening('east-window',6,7.3,1.13,1.75,2.15,'window','x')]
    for name,center,size,holes in [('front',(0,0,F+2),(12.4,.42,4),front),('back',(0,10,F+2),(12.4,.42,4),rear),('west',(-6,5,F+2),(.42,10,4),sideholes),('east',(6,5,F+2),(.42,10,4),east)]:
        layer('hall_'+name)
        u.wall(name+'_stone_shell',center,size,'masonry',holes)
        c=list(center);s=list(size)
        if name in ['front','back']:c[1]+=.225 if name=='front' else -.225;s[1]=.035
        else:c[0]+=.225 if name=='west' else -.225;s[0]=.035
        u.wall(name+'_plaster_lining',c,s,'damask',holes)
    layer('hall_front')
    for x in [-3.8,3.8]:window('hall_front_'+str(x),x,0,1.18,1.65,2.1)
    for sign in [-1,1]:
        u.box('entry_jamb'+str(sign),(sign*1.33,-.04,F+1.5),(.16,.5,3.05),'sandstone',.012)
        u.box('entry_mould'+str(sign),(sign*1.44,-.16,F+1.5),(.07,.58,3.15),'stone',.009)
    u.box('entry_lintel',(0,-.08,F+3.1),(3.02,.56,.21),'stone',.02)
    door_leaf('front_left',1.23,2.93,(-1.25,.06),math.pi/2)
    door_leaf('front_right',1.23,2.93,(1.25,.06),math.pi/2)
    # Leaves stand inside the jamb lines; exact passable envelope is measured later.
    wall_paneling('front_panel',11.55,(0,.27),math.pi,[(0,2.5)])
    cornice('front_cornice',11.55,(0,.26),math.pi)
    layer('hall_back')
    wall_paneling('back_panel',11.55,(0,9.74),0,[(0,2.85)])
    cornice('back_cornice',11.55,(0,9.74))
    for side,xx,rot in [('west',-5.74,math.pi/2),('east',5.74,-math.pi/2)]:
        layer('hall_'+side)
        wall_paneling(side+'_panel',9.5,(xx,5),rot,[(-2 if side=='west' else 2,1.65)])
        cornice(side+'_cornice',9.5,(xx,5),rot)
        window(side+'_sash',xx,7.3,1.13,1.75,2.15,rotate=True)
        # Side door trim and closed actual leaves have declared destinations.
        old=set(bpy.data.objects)
        for s in [-1,1]:u.box(side+'_door_jamb'+str(s),(s*.89,0,F+1.43),(.13,.12,2.9),'wood',.008)
        u.box(side+'_door_head',(0,0,F+2.87),(1.95,.15,.16),'wood',.008)
        door_leaf(side+'_closed_leaf',1.62,2.77,(-.81,.02),0)
        group_transform(list(set(bpy.data.objects)-old),Matrix.Translation(Vector((xx,3,0)))@Matrix.Rotation(rot,4,'Z'))
    layer('ceiling')
    u.box('continuous_ceiling',(0,5,H+.10),(12.4,10.4,.20),'plaster',.008)
    for x in [-3,0,3]:u.box('ceiling_cross_beam'+str(x),(x,5,H-.065),(.16,9.6,.15),'ivory',.018)
    for y in [3.3,6.6]:u.box('ceiling_beam'+str(y),(0,y,H-.065),(11.6,.16,.15),'ivory',.018)
    layer('upper')
    # The upper storey is architectural shell; its guest rooms are outside this sample.
    for yy in [0,10]:
        holes=[u.opening('upper_'+str(yy)+'_'+str(x),x,yy,4.6,1.55,1.65) for x in [-3.8,0,3.8]]
        u.wall('upper_wall_'+str(yy),(0,yy,5.82),(12.4,.42,3.15),'masonry',holes)
        for x in [-3.8,0,3.8]:window('upper_'+str(yy)+'_'+str(x),x,yy,4.6,1.55,1.65,upper=True)
    for x in [-6,6]:u.box('upper_side'+str(x),(x,5,5.82),(.42,10,3.15),'masonry',.01)
    for z in [F+.09,4.3,7.4]:
        for yy in [-.07,10.07]:u.box('stone_belt'+str((yy,z)),(0,yy,z),(12.65,.55,.15),'sandstone',.012)
    roof('main_roof',-6.5,6.5,-.5,10.5,7.50,10.0)
    # Lower side wings add a distinct silhouette and plausible rooms beyond closed doors.
    for sign in [-1,1]:
        cx=sign*8.5
        u.box('wing_floor'+str(sign),(cx,1.25,.07),(5.2,6.9,.3),'stone',.02)
        for yy in [-2,4.5]:
            holes=[]
            for xx in [cx-1.25,cx+1.25]:
                holes += [u.opening('wing'+str((sign,yy,xx,sill)),xx,yy,sill,1.20,hh) for sill,hh in [(1.15,1.95),(4.45,1.6)]]
            u.wall('wing_wall'+str((sign,yy)),(cx,yy,3.7),(5.3,.4,7.1),'masonry',holes)
            for xx in [cx-1.25,cx+1.25]:
                for sill,hh in [(1.15,1.95),(4.45,1.6)]:window('wing_sash'+str((sign,yy,xx,sill)),xx,yy,sill,1.2,hh,upper=True)
        u.box('wing_outer_side'+str(sign),(sign*11.15,1.25,3.7),(.4,6.9,7.1),'masonry',.01)
        u.box('wing_inner_return'+str(sign),(sign*6.0,-1.0,3.7),(.4,2.4,7.1),'masonry',.01)
        roof('wing_roof'+str(sign),cx-3,cx+3,-2.5,5,7.3,9.4,along_y=True)
        # Quoin stones, not freestanding columns pretending to be structure.
        for xx in [cx-2.64,cx+2.64]:
            for row in range(18):u.box('quoin'+str((xx,row)),(xx,-2.25,.3+row*.39),(.36 if row%2 else .50,.31,.34),'sandstone',.014)
    for x,y in [(-4.7,5.0),(4.7,7.5),(-9,6)]:
        u.box('chimney'+str(x),(x,y,9.0),(.95,.75,2.8),'masonry',.015)
        u.box('chimney_cap'+str(x),(x,y,10.43),(1.16,.93,.17),'stone',.02)
        u.sphere('chimney_snow'+str(x),(x,y,10.56),(.62,.49,.14),'snow',20)
        for dx in [-.24,.24]:u.cylinder('chimney_pot'+str((x,dx)),(x+dx,y,10.83),.13,.51,'coal',16)
    layer('porch')
    u.box('porch_substrate',(0,-1.3,F-.11),(4.0,2.7,.22),'stone',.02)
    for x in [-1.7,1.7]:
        u.box('porch_post'+str(x),(x,-2.2,1.65),(.24,.24,3.15),'wood',.025)
        u.box('porch_post_foot'+str(x),(x,-2.2,.44),(.35,.35,.4),'sandstone',.012)
        beam('porch_brace'+str(x),(x,-2.2,2.4),(x*.5,-2.2,3.16),.075,.075,'wood',8)
    roof('porch_roof',-2.1,2.1,-2.7,.05,3.35,4.1,along_y=True)
    u.box('porch_sign',(0,-2.735,3.30),(1.65,.08,.27),'wood',.018)
    t=u.text('manor_sign','CEDAR HOLLOW',(0,-2.79,3.3),.14,'ivory')
    t.data.font=bpy.data.fonts.load(str(ROOT/'docs/3d-town/classic-railway-v2/licensed/railway-serif-study.ttf'),check_existing=True)

def curtain(name,x,y,z,w,h,rotation=0):
    before=set(bpy.data.objects)
    pipe(name+'_rod',[(-w/2-.15,0,z+h/2+.13),(w/2+.15,0,z+h/2+.13)],.025,'brass')
    for s in [-1,1]:
        vertices=[];faces=[];cols=18;rows=20
        for j in range(rows+1):
            t=j/rows;spread=.35+.18*math.sin(t*math.pi)**2
            for i in range(cols+1):
                f=i/cols;xx=s*(w/2-.02-spread*f)
                yy=.055*math.sin(f*math.tau*5)+.035*math.cos(t*math.pi)
                vertices.append((xx,yy,z+h/2-h*t+.025*math.sin(f*math.pi*6)*(t**10)))
        for j in range(rows):
            for i in range(cols):
                a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
        o=u.mesh(name+'_cloth'+str(s),vertices,faces,'curtain',True)
        sol=o.modifiers.new('fabric thickness','SOLIDIFY');sol.thickness=.006
        for i in range(7):u.sphere(name+'_ring'+str((s,i)),(s*(w/2-.03-i*.05),0,z+h/2+.1),(.027,.015,.035),'brass',12)
    group_transform(list(set(bpy.data.objects)-before),Matrix.Translation(Vector((x,y,0)))@Matrix.Rotation(rotation,4,'Z'))

def lamp(name,x,y,z):
    u.cylinder(name+'_foot',(x,y,z+.025),.12,.05,'brass',24)
    u.cylinder(name+'_stem',(x,y,z+.22),.025,.4,'brass',16)
    # An open, slightly fluted lampshade with visible thickness, supported by the stem.
    verts=[];faces=[];n=64
    for zz,r in [(z+.32,.23),(z+.65,.135)]:
        for i in range(n):
            rr=r+(.008 if i%2 else -.008);a=i*math.tau/n;verts.append((x+rr*math.cos(a),y+rr*math.sin(a),zz))
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    o=u.mesh(name+'_shade',verts,faces,'ivory');s=o.modifiers.new('cloth shade','SOLIDIFY');s.thickness=.005
    u.sphere(name+'_bulb',(x,y,z+.46),(.06,.06,.10),'lamp',16)
    light(name+'_light','POINT',(x,y,z+.44),30,(1,.64,.31),.12)

def book(name,pos,size,mat='book_red',yaw=0):
    old=set(bpy.data.objects);w,d,h=size
    u.box(name+'_pages',(0,0,h/2),(w-.012,d-.016,h-.014),'paper',.003)
    for z in [.004,h-.004]:u.box(name+'_cover'+str(z),(0,0,z),(w,d,.008),mat,.003)
    u.box(name+'_spine',(-w/2,0,h/2),(.012,d,h),mat,.003)
    group_transform(list(set(bpy.data.objects)-old),Matrix.Translation(Vector(pos))@Matrix.Rotation(yaw,4,'Z'))

def cup(name,x,y,z):
    u.cylinder(name+'_saucer',(x,y,z+.01),.085,.018,'porcelain',24)
    # Double-wall cup via a radial profile, including its rolled lip.
    profile=[(.032,0),(.044,.018),(.05,.075),(.049,.082),(.044,.082),(.043,.072),(.038,.02)]
    verts=[(x+r*math.cos(i*math.tau/32),y+r*math.sin(i*math.tau/32),z+.02+zz) for r,zz in profile for i in range(32)]
    faces=[(j*32+i,j*32+(i+1)%32,(j+1)*32+(i+1)%32,(j+1)*32+i) for j in range(len(profile)-1) for i in range(32)]
    u.mesh(name,verts,faces,'porcelain',True)
    u.cylinder(name+'_tea',(x,y,z+.087),.042,.003,'tea',24)
    pipe(name+'_handle',[(x+.045,y,z+.085),(x+.074,y,z+.085),(x+.075,y,z+.047),(x+.043,y,z+.04)],.006,'porcelain')

def fireplace():
    layer('interior')
    u.box('firebox_back',(0,10.65,F+.80),(2.2,.20,1.8),'black',.02)
    for x in [-1.06,1.06]:u.box('firebox_side'+str(x),(x,10.1,F+.8),(.16,1.2,1.7),'coal',.01)
    u.box('firebox_lintel',(0,10.05,F+1.68),(2.2,1.3,.15),'coal',.012)
    u.box('firebox_floor',(0,10.1,F+.035),(2.2,1.3,.09),'coal',.008)
    u.box('hearth',(0,9.53,F+.04),(3.1,1.30,.08),'slate',.022)
    for s in [-1,1]:
        x=s*1.25
        u.box('mantel_pier'+str(s),(x,9.58,F+.93),(.36,.55,1.78),'stone',.016)
        for z,w,h in [(F+.15,.48,.18),(F+.32,.41,.11),(F+1.63,.47,.13)]:u.box('pier_profile'+str((s,z)),(x,9.55,z),(w,.63,h),'sandstone',.012)
        frame('pier_carving'+str(s),x,9.275,F+.95,.20,1.05,'sandstone',.018)
    for z,w,d,h in [(F+1.82,2.94,.65,.30),(F+2.02,3.14,.78,.11),(F+2.13,3.35,.85,.13)]:u.box('mantel_profile'+str(z),(0,9.54,z),(w,d,h),'stone',.014)
    for i in range(13):u.box('mantel_dentil'+str(i),(-1.39+i*.231,9.18,F+1.96),(.12,.13,.11),'sandstone',.005)
    u.box('mirror_back',(0,9.72,F+3.04),(1.92,.075,1.25),'dark_wood',.012)
    u.box('mirror',(0,9.67,F+3.04),(1.75,.015,1.08),'mirror',.005)
    frame('gilt_mirror',0,9.63,F+3.04,1.85,1.19,'brass',.07)
    asset('mantel_clock_01','mantel_clock',(0,9.43,F+2.195),width=.52)
    for x in [-1.12,1.12]:
        u.cylinder('candlestick_foot'+str(x),(x,9.5,F+2.23),.09,.035,'brass',20)
        u.cylinder('candlestick_stem'+str(x),(x,9.5,F+2.36),.025,.24,'brass',16)
        u.cylinder('mantel_candle'+str(x),(x,9.5,F+2.57),.028,.22,'ivory',16)
        u.sphere('candle_flame'+str(x),(x,9.5,F+2.72),(.016,.015,.045),'fire',12)
    for i in range(5):
        a=(-.75+i*.30,9.95,F+.18);b=(a[0]+.28,10.38,F+.26)
        beam('burning_log'+str(i),a,b,.095,.075,'coal',12)
        u.sphere('embers'+str(i),(a[0],10.05,F+.21),(.13,.11,.028),'ember',16)
    for i,(yy,w,h) in enumerate([(10.02,1.45,.48),(10.23,1.32,.39)]):
        o=u.mesh('fire_sheet'+str(i),[(-w/2,yy,F+.19),(w/2,yy,F+.19),(w/2,yy,F+.19+h),(-w/2,yy,F+.19+h)],[(0,1,2,3)],'flame_sheet')
        for li,uv in zip(o.data.polygons[0].loop_indices,[(0,0),(1,0),(1,1),(0,1)]):o.data.uv_layers.active.data[li].uv=uv
    for x in [-.85,.85]:
        beam('fire_dog'+str(x),(x,9.82,F+.1),(x,9.82,F+.4),.035,.024,'iron',10)
    for x in np.linspace(-.78,.78,8):
        beam('grate_bar',(float(x),9.88,F+.11),(float(x),9.88,F+.36),.016,.016,'iron',8)
    beam('grate_top',(-.83,9.88,F+.36),(.83,9.88,F+.36),.023,.023,'iron',10)
    light('hearth_fire','POINT',(0,9.48,F+.55),110,(1,.34,.08),.5)
    light('firebox_bounce','AREA',(0,9.5,F+.7),90,(1,.43,.16),1.6,(0,6.2,.5))

def furniture():
    fireplace();layer('interior')
    # Authored rug has explicit 0-1 UV coordinates, so its medallion is never repeated.
    o=u.box('conversation_carpet',(0,6.95,F+.016),(6.8,4.95,.028),'rug',.006)
    for face in o.data.polygons:
        for li in face.loop_indices:
            p=o.data.vertices[o.data.loops[li].vertex_index].co
            o.data.uv_layers.active.data[li].uv=((p.x+3.4)/6.8,(p.y-4.475)/4.95)
    for x in np.linspace(-3.35,3.35,110):
        for y in [4.43,9.46]:beam('rug_tassel',(float(x),float(y),F+.018),(float(x)+.015,float(y)+(.08 if y>5 else -.08),F+.013),.003,.002,'paper',4)
    asset('sofa_03','salon_sofa',(-1.70,6.85,F+.03),width=2.72,yaw=math.pi/2)
    asset('ArmChair_01','conversation_chair_A',(1.80,6.10,F+.03),height=1.08,yaw=-math.pi/2-.28)
    asset('ArmChair_01','conversation_chair_B',(1.70,7.85,F+.03),height=1.08,yaw=-math.pi/2+.25)
    asset('round_wooden_table_02','tea_table',(.20,6.90,F+.03),height=.68)
    cup('tea_cup_A',.04,6.72,F+.71);cup('tea_cup_B',.40,6.99,F+.71)
    book('open_case_book',(-.01,7.07,F+.715),(.20,.15,.025),'book_green',-.2)
    asset('round_wooden_table_02','side_table',(-2.37,4.85,F+.03),height=.70)
    lamp('reading_lamp',-2.37,4.85,F+.73)
    book('reading_book',(-2.15,4.75,F+.73),(.16,.22,.035),'book_red',.3)
    asset('ClassicConsole_01','arrival_console',(-4.55,1.45,F+.011),width=1.55,yaw=math.pi/2)
    lamp('arrival_lamp',-4.55,1.55,F+.965)
    book('guest_register',(-4.55,1.06,F+.965),(.24,.32,.035),'book_green',math.pi/2)
    # A coherent luggage group near arrival; no invented canonical clue status.
    for i,(x,y,z,w,d,h) in enumerate([(3.95,1.2,F+.011,.93,.5,.38),(3.92,1.2,F+.391,.76,.45,.25)]):
        u.box('travel_case'+str(i),(x,y,z+h/2),(w,d,h),'leather',.045)
        for sign in [-1,1]:u.box('case_strap'+str((i,sign)),(x+sign*w*.28,y,z+h/2),(.035,d+.008,h+.008),'dark_wood',.005)
        pipe('case_handle'+str(i),[(x-.10,y-d/2-.015,z+h*.53),(x-.1,y-d/2-.07,z+h*.65),(x+.1,y-d/2-.07,z+h*.65),(x+.1,y-d/2-.015,z+h*.53)],.014,'brass')
    # Library bookcases are deliberately subordinate to the fireplace, seated in alcove-like wall bays.
    for cx in [-4.2,4.2]:
        u.box('bookcase_back'+str(cx),(cx,9.65,F+1.28),(1.42,.08,2.55),'dark_wood',.01)
        for sx in [-.75,.75]:u.box('bookcase_side'+str((cx,sx)),(cx+sx,9.45,F+1.3),(.12,.52,2.6),'wood',.012)
        for k in range(5):
            z=F+.12+k*.50
            u.box('bookcase_shelf'+str((cx,k)),(cx,9.44,z),(1.52,.55,.065),'wood',.007)
            if k==4:continue
            for j in range(12):
                hh=R.uniform(.28,.4);w=R.uniform(.07,.095);xx=cx-.62+j*.108
                u.box('shelved_book'+str((cx,k,j)),(xx,9.4,z+.035+hh/2),(w,.26,hh),['book_red','book_green','book_blue','book_gold'][R.randrange(4)],.003)
                for dz in [.05,hh-.05]:u.box('spine_gilt'+str((cx,k,j,dz)),(xx,9.264,z+.035+dz),(w*.85,.003,.007),'brass',0)
        u.box('bookcase_crown'+str(cx),(cx,9.42,F+2.65),(1.72,.65,.15),'wood',.015)
    for side,xx,rot in [('west',-5.58,math.pi/2),('east',5.58,-math.pi/2)]:
        layer('hall_'+side);curtain(side+'_drapes',xx,7.3,F+2.24,1.95,2.20,rot)
    layer('hall_front')
    for xx in [-3.8,3.8]:curtain('front_drapes'+str(xx),xx,.32,F+2.23,1.92,2.20)
    layer('ceiling')
    for y in [3.25,7.10]:
        u.cylinder('ceiling_rose'+str(y),(0,y,H-.028),.25,.055,'ivory',48)
        asset('Chandelier_03','chandelier'+str(y),(0,y,H-1.31),height=1.28)
        light('chandelier'+str(y),'POINT',(0,y,H-1.08),64,(1,.72,.43),.55)
    layer('interior')
    # Corridor runner makes the arrival axis readable without cutting through seating.
    runner=u.box('entry_runner',(0,2.4,F+.018),(1.8,3.8,.025),'rug',.005)
    for face in runner.data.polygons:
        for li in face.loop_indices:
            v=runner.data.vertices[runner.data.loops[li].vertex_index].co
            runner.data.uv_layers.active.data[li].uv=((v.x+.9)/1.8,(v.y-.5)/3.8)

def pine(name,x,y,h):
    if TREE_MESHES:
        data=TREE_MESHES[int(R.random()*len(TREE_MESHES))]
        o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
        o.location=(x,y,.12);o.rotation_euler.z=R.random()*math.tau;o.scale=(h,h,h)
        o['layer']='landscape';o['origin']='Poly Haven CC0-1.0';o['sourceAsset']='fir_sapling';o['derivedLOD']=True
        return
    beam(name+'_trunk',(x,y,.05),(x+.12,y,h),h*.022,.015,'bark',10)
    verts=[];snowverts=[];faces=[];snowfaces=[]
    for tier in range(9):
        zz=.8+tier*(h-.9)/10;rad=h*.25*(1-tier/10)
        for branch in range(8):
            a=branch*math.tau/8+tier*.57+R.uniform(-.12,.12)
            tip=Vector((x+math.cos(a)*rad,y+math.sin(a)*rad,zz-.24*rad))
            base=Vector((x,y,zz));v=(tip-base).normalized();side=Vector((-v.y,v.x,0))*rad*.23
            up=Vector((0,0,.18*rad))
            start=len(verts)
            verts.extend([tuple(base),tuple(tip-side*.5),tuple(tip+side*.5),tuple(base+up),tuple(tip-side*.5),tuple(tip+side*.5)])
            faces.extend([(start,start+1,start+2),(start+3,start+5,start+4)])
            s=len(snowverts);snowverts.extend([tuple(base+up+Vector((0,0,.02))),tuple(tip-side*.45+Vector((0,0,.025))),tuple(tip+side*.45+Vector((0,0,.025)))])
            snowfaces.append((s,s+1,s+2))
    u.mesh(name+'_boughs',verts,faces,'needles');u.mesh(name+'_branch_snow',snowverts,snowfaces,'snow')

def bare_tree(name,x,y,h):
    points=[(x,y,0),(x-.13,y+.04,h*.28),(x+.1,y,h*.6),(x-.22,y+.25,h)]
    for i in range(3):beam(name+'_trunk'+str(i),points[i],points[i+1],.19*(1-i*.27),.15*(1-i*.3),'bark',12)
    for i in range(9):
        z=h*(.3+i*.06);a=i*2.3;start=Vector((x,y,z));length=h*(.39-i*.023)
        end=start+Vector((math.cos(a)*length,math.sin(a)*length,length*.65))
        beam(name+'_limb'+str(i),start,end,.07,.018,'bark',8)
        for j in range(3):
            t=.45+j*.22;mid=start.lerp(end,t)
            tip=mid+Vector((math.cos(a+1.1)*length*.35,math.sin(a+1.1)*length*.35,.5))
            beam(name+'_twig'+str((i,j)),mid,tip,.018,.003,'bark',6)
        beam(name+'_snow'+str(i),start+Vector((0,0,.055)),end+Vector((0,0,.02)),.042,.012,'snow',8)

def landscape():
    layer('landscape')
    # Derive bounded, linked tree variants from the licensed meshes, retaining UVs.
    a=next(a for a in json.loads((P/'licensed/provenance.json').read_text(encoding='utf-8'))['assets'] if a['id']=='fir_sapling')
    old=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(P/a['gltf']))
    imported=list(set(bpy.data.objects)-old)
    for o in imported:
        if o.type!='MESH':continue
        bpy.context.view_layer.objects.active=o
        dec=o.modifiers.new('background tree derivative 18 percent','DECIMATE');dec.ratio=.18
        bpy.ops.object.modifier_apply(modifier=dec.name)
        vertices=[o.matrix_world@v.co for v in o.data.vertices]
        lo=Vector([min(v[i] for v in vertices) for i in range(3)]);hi=Vector([max(v[i] for v in vertices) for i in range(3)])
        center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        o.data.transform(Matrix.Scale(1/(hi.z-lo.z),4)@Matrix.Translation(-center)@o.matrix_world)
        TREE_MESHES.append(o.data)
    for o in imported:bpy.data.objects.remove(o,do_unlink=True)
    verts=[];faces=[];n=72
    for j in range(n+1):
        y=-32+j*75/n
        for i in range(n+1):
            x=-42+i*84/n
            hill=max(0,abs(x)-13)*.07+max(0,y-15)*.10
            z=.09+hill+.10*math.sin(x*.6)*math.cos(y*.7)+.04*math.sin(x*1.7+y*1.2)
            if abs(x)<12 and -3<y<11:z=.12
            verts.append((x,y,z))
    for j in range(n):
        for i in range(n):
            a=j*(n+1)+i;faces.append((a,a+1,a+n+2,a+n+1))
    u.mesh('snow_ground',verts,faces,'snow',True)
    # A shoveled approach keeps the playable apron at the same level as the hall.
    for j in range(18):
        y=-10+j*.43
        for i in range(7):
            x=-1.43+i*.47
            u.box('approach_paving'+str((i,j)),(x,y,F-.035),(.46,.42,.075),'slate',.012)
    for s in [-1,1]:
        for j in range(12):
            y=-10+j*.65
            u.sphere('path_drift'+str((s,j)),(s*1.83,y,.13),(.46,.62,.19+R.random()*.07),'snow',16)
    for i,(x,y,h) in enumerate([(-15,3,6),(-18,11,8),(-13,16,8),(15,6,6),(17,14,9),(12,19,8),(-5,20,9),(4,24,10),(-21,-2,7),(22,0,8),(-12,-9,4.7),(17,-8,5.5)]):pine('fir_'+str(i),x,y,h)
    for i in range(17):
        x=R.uniform(-35,35);y=R.uniform(22,40);pine('forest_'+str(i),x,y,R.uniform(7,10))
    # Two grounded lamps frame arrival, with real hanging brackets.
    for x in [-1.72,1.72]:
        u.box('porch_lantern_mount'+str(x),(x,-2.30,2.55),(.13,.12,.25),'iron',.01)
        pipe('lantern_bracket'+str(x),[(x,-2.3,2.65),(x,-2.64,2.75),(x,-2.72,2.55)],.016,'iron')
        u.box('porch_lamp_glass'+str(x),(x,-2.72,2.34),(.20,.20,.33),'lamp',.01)
        for z in [2.16,2.52]:u.box('porch_lamp_cap'+str((x,z)),(x,-2.72,z),(.27,.27,.055),'iron',.015)
        for dx in [-.11,.11]:
            for dy in [-.11,.11]:beam('porch_lamp_cage',(x+dx,-2.72+dy,2.17),(x+dx,-2.72+dy,2.50),.012,.012,'iron',6)
        light('porch_lantern'+str(x),'POINT',(x,-2.79,2.35),42,(1,.62,.28),.16)
    # Snow streaks exist outside only, never intersecting the interior scene.
    layer('weather')
    vertices=[];faces=[]
    for i in range(4500):
        x=R.uniform(-29,29);y=R.uniform(-23,25);z=R.uniform(.4,18)
        if abs(x)<12 and -.5<y<11 and z<11:continue
        length=R.uniform(.06,.20);width=R.uniform(.004,.013);v=len(vertices)
        vertices.extend([(x-width,y,z),(x+width,y,z),(x+length*.8,y+.03,z-length),(x+length*.8-width,y+.03,z-length)])
        faces.append((v,v+1,v+2,v+3))
    u.mesh('windblown_snow',vertices,faces,'falling_snow')
    layer('atmosphere')
    m=bpy.data.materials.new('outdoor snowfall haze');m.use_nodes=True
    nodes=m.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');vol=nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value=.002;vol.inputs['Color'].default_value=(.64,.74,.85,1);vol.inputs['Anisotropy'].default_value=.2;m.node_tree.links.new(vol.outputs['Volume'],out.inputs['Volume']);u.MATS['haze']=m
    u.box('continuous_atmospheric_haze',(0,20,25),(220,220,65),'haze',0)

def lighting_and_cameras():
    world=bpy.data.worlds.new('blue_hour_snowstorm');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.46,.63,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.32;bpy.context.scene.world=world
    light('storm_sky','AREA',(-9,-8,22),1800,(.52,.68,1),30,(0,3,0))
    light('back_snow_sky','AREA',(7,16,19),1100,(.48,.62,.85),20,(0,4,2))
    # Every interior fill is attached to a visible window or the open arrival.
    for x in [-3.8,3.8]:light('front_window_'+str(x),'AREA',(x,.13,2.45),55,(.55,.72,1),1.5,(x,4,1),shape='RECTANGLE',size_y=2)
    for x in [-5.65,5.65]:light('side_window_'+str(x),'AREA',(x,7.3,2.45),58,(.56,.72,1),1.6,(0,6,1),shape='RECTANGLE',size_y=2)
    light('arrival_ambient','AREA',(0,-.18,2.05),70,(.56,.72,1),2.0,(0,4,1.2))
    for name,pos,target,lens in [
        ('exterior',(25,-33,10.7),(0,3.3,4.4),43),
        ('hall',(5.15,1.05,2.05),(-.35,7.20,1.8),25),
        ('hearth-detail',(-4.6,4.1,1.72),(.5,8.55,1.65),30),
        ('arrival',(0,-4.2,1.72),(0,7,1.8),27),
        ('corner-sw',(-5.55,.57,1.85),(0,5.5,1.8),10.3923),
        ('corner-se',(5.55,.57,1.85),(0,5.5,1.8),10.3923),
        ('corner-ne',(5.55,9.45,1.85),(0,4.5,1.8),10.3923),
        ('corner-nw',(-5.55,9.45,1.85),(0,4.5,1.8),10.3923),
        ('low-entry',(0,1.15,1.1),(0,7.1,1.6),22),
        ('ceiling-up',(0,5,1.40),(0,5,H),9),
        ('ceiling-oblique-a',(-4.9,1.3,1.2),(2.1,7.5,H-.3),15),
        ('ceiling-oblique-b',(4.9,8.6,1.2),(-2,3,H-.3),15)]:u.camera(name,pos,target,lens=lens)
    u.camera('plan-floor',(0,3.8,24),(0,3.8,0),scale=19)
    u.camera('plan-ceiling',(0,5,.5),(0,5,H),scale=14)

def save_contracts():
    colliders=[]
    def rect(id,x,y,w,d,angle=0):colliders.append({'id':id,'center':[x,y],'size':[w,d],'angle':angle})
    rect('west-wall',-5.85,5,.32,10);rect('east-wall',5.85,5,.32,10)
    rect('rear-wall',0,9.85,12,.32)
    rect('front-left',-3.65,0,4.7,.42);rect('front-right',3.65,0,4.7,.42)
    rect('front-leaf-left',-1.25,.69,.12,1.26);rect('front-leaf-right',1.25,.69,.12,1.26)
    rect('sofa',-1.7,6.85,.96,2.72)
    for x,y,angle in [(1.8,6.1,-math.pi/2-.28),(1.7,7.85,-math.pi/2+.25)]:rect('chair-'+str(y),x,y,.86,.79,angle)
    rect('tea-table',.2,6.9,.74,.74);rect('side-table',-2.37,4.85,.76,.76)
    rect('arrival-console',-4.55,1.45,.61,1.57)
    rect('luggage',3.95,1.2,.96,.54)
    rect('hearth',0,9.4,3.35,1.05)
    for x in [-4.2,4.2]:rect('bookcase'+str(x),x,9.44,1.73,.66)
    contract={'schema':'snowbound-manor-scene.v1','units':'metres','coordinateSystem':'Blender Z-up; glTF maps (x,y,z) to (x,z,-y)',
        'floor':F+.014,'bounds':[-5.7,5.7,-9.5,9.65],
        'player':{'spawn':[0,1.7],'radius':.27,'height':1.79,'speed':1.85},'colliders':colliders,
        'interior':{'bounds':[-5.74,5.74,.16,9.74],'door':[0,0],'cutawayLayers':['ceiling','upper','hall_front','hall_east']},
        'interactions':[{'id':'hearth','label':'壁炉与座钟','position':[0,8.65],'description':'火还在燃烧，座钟与会客区构成大厅中心。本版为美术陈设，未绑定案件。'},
            {'id':'register','label':'来客登记簿','position':[-3.8,1.45],'description':'入口的来客登记簿。未来接入住客身份与到访时间，本版没有生成证词。'},
            {'id':'tea','label':'会客茶桌','position':[.2,6.05],'description':'座椅朝向同一交谈区域，两侧留有通行空间。'},
            {'id':'luggage','label':'旅行箱','position':[3.2,1.2],'description':'住客抵达后的行李陈设，未关联任何案件证据。'},
            {'id':'dining','label':'餐厅入口','position':[-5.0,3.0],'description':'通向山庄西翼餐厅；本次样板只开放大厅。'},
            {'id':'guest','label':'客房廊道入口','position':[5.0,3.0],'description':'通向客房廊道；房间与住客行动将在后续接入。'}],
        'binding':'art-sample-only','sourceSha256':sha(SOURCE),'assetSha256':None}
    write(P/'scene-contract.json',contract)
    write(P/'openings.json',{'schema':'snowbound-openings.v1','openings':u.OPENINGS,'windows':WINDOWS,'primaryArrivalClearWidth':2.5,'closedDestinations':['west dining wing','east guest corridor']})
    write(P/'lighting.json',{'schema':'snowbound-fixtures.v1','fixtures':LIGHTS,'baked':False,'runtimeParity':'not yet measured'})
    write(P/'placements.json',{'schema':'snowbound-placements.v1','instances':PLACEMENTS,'seatingFocus':[.2,6.9],'sourceSha256':sha(SOURCE)})
    write(P/'authoring-receipt.json',{'schema':'snowbound-authoring.v1','source':{'path':SOURCE.relative_to(P).as_posix(),'sha256':sha(SOURCE)},
          'generatorSha256':GENERATOR_SHA,'licensedProvenanceSha256':sha(P/'licensed/provenance.json'),
          'sharedInputs':[{'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)} for p in [ROOT/'scripts/build-blender-classic-railway.py',ROOT/'docs/3d-town/classic-railway-v2/licensed/provenance.json',ROOT/'docs/3d-town/classic-railway-v2/licensed/railway-serif-study.ttf']],
          'originalGeometry':['architecture','snow terrain','fireplace','drapery','books','luggage','lamps','rug pattern','weather'],
          'derivedGeometry':[{'asset':'fir_sapling','operation':'18 percent decimation of the three source variants; linked instances, normalized height and authored placement','license':'CC0-1.0'}],
          'thirdPartyAssets':[a['id'] for a in json.loads((P/'licensed/provenance.json').read_text(encoding='utf-8'))['assets']],
          'humanArtApproved':False,'agentWorldBound':False,'status':'first-candidate-awaiting-render-review'})

def render_views(names,width,samples,out_folder):
    out=P/out_folder;out.mkdir(exist_ok=True)
    u.configure(samples,width);bpy.context.scene.view_settings.exposure=.4
    rendered=[]
    for name in names:
        camera=bpy.data.objects[name];assert camera.type=='CAMERA',name;bpy.context.scene.camera=camera
        bpy.context.scene.render.filepath=str(out/(name+'.png'))
        if name.startswith('plan-'):
            for o in bpy.data.objects:
                if o.get('layer') in ['upper','ceiling','weather'] or o.type=='LIGHT':o.hide_render=True
        bpy.ops.render.render(write_still=True)
        rendered.append({'camera':name,'path':(out/(name+'.png')).relative_to(P).as_posix(),'sha256':sha(out/(name+'.png'))})
    write(out/'render-receipt.json',{'sourceSha256':sha(SOURCE),'width':width,'samples':samples,'renders':rendered,'cameraPositions':{n:list(bpy.data.objects[n].location) for n in names}})

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--views',default='exterior,hall');ap.add_argument('--width',type=int,default=1600);ap.add_argument('--samples',type=int,default=48);ap.add_argument('--render-only',action='store_true');ap.add_argument('--out',default='renders')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.render_only:bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True);materials();architecture();furniture();landscape();lighting_and_cameras()
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene['sample']='Cedar Hollow / snowbound manor art candidate; not an accepted final game'
        bpy.context.scene.camera=bpy.data.objects['hall'];u.configure(args.samples,args.width)
        assert GENERATOR_SHA==sha(Path(__file__)),'Generator changed during construction'
        used_fonts={o.data.font for o in bpy.data.objects if o.type=='FONT'}
        for font in list(bpy.data.fonts):
            if font not in used_fonts and font.filepath and 'windows' in font.filepath.lower():bpy.data.fonts.remove(font)
        bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE));save_contracts()
    if args.views:render_views(args.views.split(','),args.width,args.samples,args.out)
    print('SNOWBOUND MANOR COMPLETE',flush=True)

if __name__=='__main__':main()
