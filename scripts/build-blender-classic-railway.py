"""Original classical-detection art study. Background Blender; no external assets.

Source is retained independently from the existing Riverbend town. Textures are
deterministic authored mathematical surfaces, not downloaded or generated images.
The GLB is exported later, after ordered geometry and visual candidate reviews.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import random
import struct
import sys
import time
import zlib

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/3d-town/classic-railway-v1"
SOURCE = PACKAGE / "classic-railway.blend"
F = .18
RNG = random.Random(193407)
MATS = {}
LAY = "street"
PART = "static"
OPENINGS = []
COLLIDERS = []
FIXTURES = []
CONTACTS = []
CUBE = [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
FACES = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


def png(path, values):
    values = np.uint8(np.clip(values, 0, 1)*255)
    h,w,_ = values.shape
    def chunk(t,d):
        return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    scan = b"".join(b"\0"+r.tobytes() for r in values)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">2I5B",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(scan,8))+chunk(b"IEND",b""))


def textures():
    folder=PACKAGE/"textures";folder.mkdir(exist_ok=True)
    n=768; y,x=np.mgrid[0:n,0:n].astype(float)/n
    rng=np.random.default_rng(1934)
    fine=rng.random((n,n))-.5
    cloud=(np.sin(x*math.tau*4+np.cos(y*math.tau*3))*.45+np.cos(y*math.tau*5-x*math.tau*2)*.3)
    for kind in ("brick","stone","paving","timber","slate","plaster","leather","wool"):
        if kind=="brick":
            row=np.floor(y*28);u=(x*8+(row%2)*.5)%1;v=(y*28)%1
            edge=np.minimum(np.minimum(u,1-u)*.27,np.minimum(v,1-v)*.078)
            blend=np.clip((edge-.0025)/.004,0,1)
            cell=(np.sin(np.floor(x*8+(row%2)*.5)*17+row*7)*.5+.5)
            b=np.array([.49,.325,.245])[None,None,:]*(.80+cell[...,None]*.35)+cloud[...,None]*.022+fine[...,None]*.045
            color=b*blend[...,None]+np.array([.50,.48,.43])*(1-blend[...,None])
            height=blend*.0045+fine*.0008
        elif kind=="timber":
            waves=np.sin(x*math.tau*27+np.sin(y*math.tau*2)*.9+np.sin(x*math.tau*5)*.8)
            grain=(waves*.5+.5)**7
            color=np.array([.245,.145,.084])*(1+cloud[...,None]*.12)+grain[...,None]*np.array([.07,.045,.020])+fine[...,None]*.013
            height=grain*.0007+fine*.0002
        elif kind=="stone":
            color=np.array([.65,.605,.505])*(1+cloud[...,None]*.045)+fine[...,None]*.048
            height=cloud*.0008+fine*.0006
        elif kind=="slate":
            color=np.array([.22,.265,.28])*(1+cloud[...,None]*.025)+fine[...,None]*.025
            height=cloud*.0002+fine*.0006
        elif kind=="paving":
            color=np.array([.36,.37,.35])*(1+cloud[...,None]*.035)+fine[...,None]*.055
            height=cloud*.0005+fine*.0007
        elif kind=="plaster":
            color=np.array([.63,.625,.51])*(1+cloud[...,None]*.008)+fine[...,None]*.012
            height=fine*.0005
        elif kind=="leather":
            pores=(np.sin(x*math.tau*137)*np.sin(y*math.tau*121))
            color=np.array([.23,.11,.075])*(1+cloud[...,None]*.16)+pores[...,None]*.012
            height=pores*.00022
        else:
            weave=np.sin(x*math.tau*192)*np.cos(y*math.tau*192)
            color=np.array([.19,.23,.255])*(1+cloud[...,None]*.07)+weave[...,None]*.025
            height=weave*.00015
        dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*n/4
        dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*n/4
        normal=np.stack((-dx,-dy,np.ones_like(dx)),axis=-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
        png(folder/(kind+"-color.png"),color)
        png(folder/(kind+"-normal.png"),normal*.5+.5)


def linear(v):
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4


def material(name, color, rough=.7, metal=0, texture=None, size=1):
    m=bpy.data.materials.new(name);m.use_nodes=True
    rgb=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    m.diffuse_color=(*rgb,1);m["uvMeters"]=size
    p=m.node_tree.nodes.get("Principled BSDF");p.inputs["Base Color"].default_value=(*rgb,1);p.inputs["Roughness"].default_value=rough;p.inputs["Metallic"].default_value=metal
    if texture:
        for suffix,input_name in (("color","Base Color"),("normal",None)):
            im=bpy.data.images.load(str(PACKAGE/"textures"/(texture+"-"+suffix+".png")),check_existing=True)
            tex=m.node_tree.nodes.new("ShaderNodeTexImage");tex.image=im;tex.extension="REPEAT"
            if input_name:m.node_tree.links.new(tex.outputs["Color"],p.inputs[input_name])
            else:
                im.colorspace_settings.name="Non-Color";norm=m.node_tree.nodes.new("ShaderNodeNormalMap");norm.inputs["Strength"].default_value=.65
                m.node_tree.links.new(tex.outputs["Color"],norm.inputs["Color"]);m.node_tree.links.new(norm.outputs["Normal"],p.inputs["Normal"])
    MATS[name]=m;return m


def tag(obj, support=None):
    obj["layer"]=LAY;obj["part"]=PART;obj["origin"]="project-local-original"
    if support:obj["support"]=support;CONTACTS.append({"object":obj.name,"support":support})
    return obj


def uv(obj, scale=None):
    data=obj.data
    if not data.polygons:return
    size=scale or (data.materials[0].get("uvMeters",1) if data.materials else 1)
    layer=data.uv_layers.active or data.uv_layers.new(name="UVMap")
    for face in data.polygons:
        axis=max(range(3),key=lambda a:abs(face.normal[a]))
        for li in face.loop_indices:
            p=obj.matrix_world @ data.vertices[data.loops[li].vertex_index].co
            coords=(p.y,p.z) if axis==0 else (p.x,p.z) if axis==1 else (p.x,p.y)
            layer.data[li].uv=(coords[0]/size,coords[1]/size)


def mesh(name, verts, faces, mat, smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(MATS[mat]);tag(obj)
    for face in data.polygons:face.use_smooth=smooth
    uv(obj);return obj


def bevel(obj, amount=.015, segments=2):
    mod=obj.modifiers.new("authored_edge_profile","BEVEL");mod.width=amount;mod.segments=segments
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    uv(obj);return obj


def box(name, loc, size, mat, edge=.006, support=None):
    verts=[(loc[0]+x*size[0],loc[1]+y*size[1],loc[2]+z*size[2]) for x,y,z in CUBE]
    obj=mesh(name,verts,FACES,mat)
    if edge:bevel(obj,min(edge,min(size)*.2),2)
    if support:obj["support"]=support;CONTACTS.append({"object":name,"support":support})
    return obj


def cylinder(name, loc, r, h, mat, sides=24, top=None):
    rt=r if top is None else top
    verts=[(loc[0]+math.cos(i*math.tau/sides)*rad,loc[1]+math.sin(i*math.tau/sides)*rad,loc[2]+z) for rad,z in ((r,-h/2),(rt,h/2)) for i in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    obj=mesh(name,verts,faces,mat)
    for p in obj.data.polygons:p.use_smooth=len(p.vertices)==4
    return obj


def batch_boxes(name, entries, mat, edge=.004):
    vertices=[];faces=[]
    for pos,size,tilt in entries:
        rotation=Matrix.Rotation(tilt,3,"X");base=len(vertices)
        vertices.extend(tuple(Vector(pos)+rotation@Vector((x*size[0],y*size[1],z*size[2]))) for x,y,z in CUBE)
        faces.extend(tuple(base+i for i in face) for face in FACES)
    if not vertices:return None
    obj=mesh(name,vertices,faces,mat)
    if edge:bevel(obj,edge,1)
    return obj


def roof_courses(name,x0,x1,y0,y1,eave,ridge,hip=0):
    mid=(y0+y1)/2;slope=(ridge-eave)/(mid-y0);angle=math.atan(slope)
    entries=[]
    for back in (False,True):
        for row in range(math.ceil((mid-y0)/.22)):
            t=(row+.5)*.22
            if t>mid-y0:continue
            y=y1-t if back else y0+t
            left=x0+hip*t/(mid-y0);right=x1-hip*t/(mid-y0)
            for col in range(math.ceil((x1-x0)/.36)):
                x=x0+.18+col*.36+(.18 if row%2 else 0)
                if left+.16<x<right-.16:entries.append(((x,y,eave+slope*t+.027),(.352,.252/math.cos(angle),.027),-angle if back else angle))
    batch_boxes(name,entries,"slate",.003)


def tube(name, points, radius, mat):
    curve=bpy.data.curves.new(name,"CURVE");curve.dimensions="3D";curve.bevel_depth=radius;curve.bevel_resolution=1;curve.resolution_u=6
    line=curve.splines.new("BEZIER");line.bezier_points.add(len(points)-1)
    for b,p in zip(line.bezier_points,points):b.co=p;b.handle_left_type="AUTO";b.handle_right_type="AUTO"
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);curve.materials.append(MATS[mat]);tag(obj);return obj


def sphere(name, loc, scale, mat, segments=24):
    bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=segments,v_segments=12,radius=1)
    data=bpy.data.meshes.new(name);bm.to_mesh(data);bm.free()
    for v in data.vertices:v.co=Vector(loc)+Vector((v.co.x*scale[0],v.co.y*scale[1],v.co.z*scale[2]))
    data.materials.append(MATS[mat]);obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);tag(obj)
    for p in data.polygons:p.use_smooth=True
    uv(obj);return obj


def text(name, body, pos, size, mat, rot=(math.pi/2,0,0)):
    data=bpy.data.curves.new(name,"FONT");data.body=body;data.align_x="CENTER";data.align_y="CENTER";data.size=size;data.extrude=.0015;data.bevel_depth=.0007;data.bevel_resolution=0;data.resolution_u=4
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=rot;data.materials.append(MATS[mat]);tag(obj)
    for path in ("C:/Windows/Fonts/georgia.ttf","C:/Windows/Fonts/times.ttf"):
        if Path(path).exists():data.font=bpy.data.fonts.load(path,check_existing=True);break
    return obj


def rect(name,x,y,w,d,angle=0):
    COLLIDERS.append({"id":name,"center":[x,y],"size":[w,d],"angle":angle})


def wall(name, center, size, mat, holes):
    obj=box(name,center,size,mat,edge=0)
    for entry in holes:
        cut=box(entry["id"]+"_cutter",entry["center"],entry["size"],"stone",edge=0)
        mod=obj.modifiers.new(entry["id"],"BOOLEAN");mod.operation="DIFFERENCE";mod.solver="EXACT";mod.object=cut
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
        OPENINGS.append({**entry,"wall":name,"wallThickness":size[1] if size[1]<size[0] else size[0],"booleanApplied":True})
    bevel(obj,.008,2);obj["structuralShell"]=True;return obj


def opening(oid,x,y,sill,w,h,kind="window",axis="y",destination="exterior daylight"):
    return {"id":oid,"kind":kind,"center":[x,y,F+sill+h/2],"size":[w,1.1,h] if axis=="y" else [1.1,w,h],"clearWidth":w,"clearHeight":h,"sill":sill,"axis":axis,"destination":destination}


def sash(name,x,y,z,w,h,paint="ivory",surround=True):
    if surround:
        for sign in (-1,1):box(name+"_reveal"+str(sign),(x+sign*(w/2+.075),y-.09,z),(.15,.22,h+.22),"stone",.012)
        box(name+"_lintel",(x,y-.10,z+h/2+.10),(w+.32,.24,.20),"stone",.012)
        box(name+"_projecting_sill",(x,y-.16,z-h/2-.035),(w+.39,.39,.10),"stone",.008)
    for dx in (-w/2+.045,w/2-.045):box(name+"_jamb"+str(dx),(x+dx,y-.04,z),(.09,.095,h),paint,.006)
    for dz in (-h/2+.045,0,h/2-.045):box(name+"_sash_rail"+str(dz),(x,y-.052,z+dz),(w,.12,.065),paint,.004)
    box(name+"_mullion",(x,y-.048,z),(.045,.065,h-.10),paint,.004)
    box(name+"_glass",(x,y+.018,z),(w-.10,.018,h-.10),"glass",0)
    for dx in (-w*.31,w*.31):
        box(name+"_curtain"+str(dx),(x+dx,y+.15,z),(.17,.035,h-.13),"curtain",.01)


def profiles(name,x,y,z,w,mat="stone"):
    for i,(depth,height,extra) in enumerate(((.17,.10,0),(.24,.065,.06),(.30,.09,.13),(.20,.055,.06))):
        box(name+"_course"+str(i),(x,y-depth/2,z+i*.073),(w+extra,depth,height),mat,.008)


def lantern(name,x,y,z):
    box(name+"_mount",(x,y+.06,z+.25),(.11,.085,.33),"iron",.016)
    tube(name+"_curved_bracket",[(x,y,z+.35),(x,y-.28,z+.47),(x,y-.45,z+.36)],.019,"iron")
    c=y-.43
    box(name+"_base",(x,c,z-.16),(.26,.23,.055),"iron",.012)
    box(name+"_glass",(x,c,z),(.205,.19,.29),"lamp",.006)
    for dx in (-.11,.11):
        for dy in (-.10,.10):tube(name+"_frame"+str((dx,dy)),[(x+dx,c+dy,z-.17),(x+dx,c+dy,z+.17)],.012,"iron")
    cylinder(name+"_roof",(x,c,z+.19),.20,.095,"iron",4,top=.10)
    cylinder(name+"_finial",(x,c,z+.27),.018,.075,"brass",12)
    light=bpy.data.lights.new(name,"POINT");light.energy=17;light.color=(1,.73,.42);light.shadow_soft_size=.18
    obj=bpy.data.objects.new(name+"_light",light);obj.location=(x,c-.02,z);bpy.context.collection.objects.link(obj);tag(obj)
    FIXTURES.append({"id":name,"position":[x,c-.02,z],"color":"#ffd9a2","runtimeIntensity":13,"distance":3.6,"sourceWatts":17})


def architecture():
    global LAY
    LAY="street"
    box("continuous_street_base",(1,-1.7,-.16),(27,22,.30),"paving",.03)
    box("inn_floor",(6.4,3.4,F-.08),(8.8,6.8,.16),"timber",.008)
    box("pavement_substrate",(1,-1.05,F-.11),(25,2.6,.22),"stone",.008)
    for i in range(32):
        x=-11+i*.80
        box("kerb_"+str(i),(x,-2.34,.06),(.78,.24,.24),"stone",.014)
    # Deliberate low-relief setts at a believable human scale.
    setts={"paving":[],"slate":[]}
    for row in range(26):
        y=-8.8+row*.247
        for col in range(67):
            x=-11.2+col*.37+(row%2)*.185
            mat="paving" if RNG.random()<.88 else "slate"
            setts[mat].append(((x,y,.12+RNG.uniform(-.002,.002)),(.353,.228,.12),0))
    for mat,entries in setts.items():batch_boxes("street_setts_"+mat,entries,mat,.011)
    for row in range(3):
        for col in range(31):box("paving_slab_"+str((row,col)),(-11+col*.81,-2.0+row*.77,.155),(.80,.755,.044),"stone",.006)
    for x in (-8.5,.9,11.1):
        for i in range(9):box("gutter_grate_"+str((x,i)),(x-.20+i*.05,-2.53,.092),(.025,.38,.018),"iron",.002)
    LAY="inn_front"
    front=[opening("inn-entry",3.65,0,0,1.5,2.65,"door",destination="connected sitting room"),opening("inn-window-a",6.65,0,.57,1.65,2.05),opening("inn-window-b",9.15,0,.57,1.65,2.05)]
    wall("inn_front_wall",(6.4,0,F+1.65),(8.8,.34,3.30),"stone",front)
    for x in (6.65,9.15):sash("inn_ground_"+str(x),x,-.18,F+1.595,1.65,2.05,"timber")
    # Entrance jambs, visible reveal and an opened leaf fully outside the arrival lane.
    for x in (2.84,4.46):box("entry_pilaster_"+str(x),(x,-.245,F+1.38),(.18,.32,2.76),"stone",.009)
    profiles("entry_head",3.65,-.20,F+2.66,1.86)
    box("entry_transom",(3.65,-.04,F+2.46),(1.40,.07,.10),"timber",.003)
    box("entry_transom_glass",(3.65,.015,F+2.565),(1.38,.012,.13),"glass",0)
    leaf=box("inward_open_door",(2.945,.68,F+1.15),(.09,1.28,2.30),"timber",.014)
    for z in (.57,1.62):box("door_raised_panel"+str(z),(3.001,.68,F+z),(.022,.91,.70),"walnut",.008)
    sphere("door_brass_knob",(3.05,1.09,F+1.08),(.027,.04,.027),"brass",16)
    rect("open-door-leaf",2.945,.68,.12,1.28)
    # Horizontal bands are restrained; irregular ground-floor bay use breaks repetition.
    profiles("inn_fascia_cornice",6.4,-.20,F+3.10,8.95)
    box("inn_main_sign",(6.4,-.51,F+2.94),(4.65,.075,.38),"green",.02)
    text("inn_sign_letters","THE RAILWAY INN",(6.4,-.554,F+2.94),.26,"brass")
    for x in (2.4,4.90,10.38):lantern("inn_lantern_"+str(x),x,-.20,F+2.02)
    for x in (2.2,10.6):
        for i in range(9):box("inn_corner_quoin"+str((x,i)),(x,-.235,F+.17+i*.345),(.39,.19,.315),"stone",.007)
    LAY="inn_shell"
    wall("inn_left_wall",(2,3.4,F+1.65),(.34,6.8,3.30),"plaster",[])
    wall("inn_rear_wall",(6.4,6.8,F+1.65),(8.8,.34,3.30),"plaster",[])
    LAY="inn_side_cutaway"
    wall("inn_right_wall",(10.8,3.4,F+1.65),(.34,6.8,3.30),"plaster",[opening("inn-side-"+str(y),10.8,y,1.20,1.4,1.65,axis="x") for y in (2.0,4.80)])
    for y in (2.0,4.80):
        before=set(bpy.data.objects.keys());sash("inn-side-sash"+str(y),0,0,F+2.025,1.4,1.65)
        for o in bpy.data.objects:
            if o.name not in before:o.matrix_world=Matrix.Translation(Vector((10.99,y,0))) @ Matrix.Rotation(math.pi/2,4,"Z") @ o.matrix_world
    LAY="inn_shell"
    rect("inn-left",2,3.4,.34,6.8);rect("inn-back",6.4,6.8,8.8,.34);rect("inn-right",10.8,3.4,.34,6.8)
    rect("inn-front-left",2.45,0,.9,.34);rect("inn-front-right",7.6,0,6.4,.34)
    LAY="inn_upper"
    upper=[opening("inn-upper-"+str(i),x,0,4.10,1.30,1.86) for i,x in enumerate((3.38,5.44,7.50,9.56))]
    wall("inn_upper_front",(6.4,0,F+5.04),(8.8,.36,3.48),"brick",upper)
    for x in (3.38,5.44,7.50,9.56):sash("inn_upper_sash"+str(x),x,-.19,F+5.03,1.30,1.86)
    box("inn_upper_back",(6.4,6.8,F+5.05),(8.8,.34,3.50),"brick",.007)
    box("inn_upper_side_left",(2,3.4,F+5.05),(.34,6.8,3.50),"brick",.006)
    wall("inn_upper_side_right",(10.8,3.4,F+5.05),(.34,6.8,3.50),"brick",[opening("inn-side-upper-"+str(y),10.8,y,4.10,1.3,1.86,axis="x") for y in (2.0,4.8)])
    for y in (2.0,4.8):
        before=set(bpy.data.objects.keys());sash("inn-side-upper-sash"+str(y),0,0,F+5.03,1.3,1.86)
        for o in bpy.data.objects:
            if o.name not in before:o.matrix_world=Matrix.Translation(Vector((10.99,y,0))) @ Matrix.Rotation(math.pi/2,4,"Z") @ o.matrix_world
    for z in (3.48,6.47,6.78):profiles("inn_string"+str(z),6.4,-.20,F+z,9.06)
    # Hip roof with distinct eaves, metal ridge, chimney pots and guttering.
    mesh("inn_hipped_roof",[(1.68,-.42,7.15),(11.12,-.42,7.15),(11.12,7.20,7.15),(1.68,7.20,7.15),(4.15,3.40,9.13),(8.65,3.40,9.13)],[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],"slate")
    tube("inn_ridge",[(4.08,3.4,9.14),(8.70,3.4,9.14)],.074,"slate")
    roof_courses("inn_authored_slate_courses",1.68,11.12,-.42,7.20,7.15,9.13,2.47)
    for y in (-.42,7.2):tube("inn_gutter"+str(y),[(1.70,y,7.08),(11.1,y,7.08)],.055,"iron")
    for x in (2.04,10.65):
        tube("inn_downpipe"+str(x),[(x,-.31,F+.07),(x,-.31,6.70),(x,-.44,7.08)],.043,"iron")
        for z in (1.1,2.9,4.8,6.6):box("downpipe_strap"+str((x,z)),(x,-.32,z),(.13,.12,.055),"iron",.003)
    for x in (3.2,9.5):
        box("inn_chimney"+str(x),(x,4.8,8.15),(.73,.83,1.45),"brick",.01)
        box("inn_chimney_cap"+str(x),(x,4.8,8.91),(.86,.98,.12),"stone",.01)
        for dx in (-.20,.20):cylinder("chimney_pot"+str((x,dx)),(x+dx,4.8,9.20),.115,.50,"terracotta",20)
    LAY="bookshop"
    bookholes=[opening("book-display",-3.90,.30,.42,3.86,2.28),opening("book-door",-.72,.30,0,1.30,2.60,"door",destination="closed bookshop interior display")]
    wall("bookshop_ground_wall",(-2.60,.30,F+1.54),(7.65,.32,3.08),"green",bookholes)
    for x in (-6.37,-1.64,.98):
        box("bookshop_pilaster"+str(x),(x,.055,F+1.40),(.20,.30,2.8),"green",.014)
        profiles("bookshop_cap"+str(x),x,-.11,F+2.65,.29,"green")
    sash("book_display",-3.90,.08,F+1.56,3.86,2.28,"green",False)
    for x in (-5.0,-3.92,-2.84):box("book_extra_mullion"+str(x),(x,-.005,F+1.55),(.055,.15,2.23),"green",.004)
    box("bookshop_interior_back",(-3.85,1.15,F+1.40),(4,.18,2.60),"timber",.006)
    for z in (.58,1.18,1.80):
        box("display_shelf"+str(z),(-3.90,.52,F+z),(3.72,.78,.045),"timber",.004)
        for i in range(19):
            x=-5.55+i*.18;h=RNG.uniform(.19,.36)
            box("display_book"+str((z,i)),(x,.51,F+z+h/2+.026),(.12,.15,h),RNG.choice(("book_red","book_green","book_ochre")),.004)
            box("book_spine_band"+str((z,i)),(x,.428,F+z+h*.80),(.121,.005,.012),"brass",0)
    box("bookshop_closed_door",(-.72,.40,F+1.27),(1.26,.075,2.54),"green",.009)
    box("bookshop_door_glass",(-.72,.351,F+1.68),(.96,.012,1.06),"glass",0)
    box("bookshop_door_panel",(-.72,.348,F+.46),(.98,.034,.61),"green",.012)
    sphere("bookshop_knob",(-.27,.26,F+1.10),(.034,.04,.034),"brass",16)
    profiles("bookshop_fascia",-2.6,-.04,F+3.24,7.8,"green")
    box("bookshop_sign_panel",(-2.6,-.38,F+3.015),(6.55,.10,.45),"green",.012)
    text("bookshop_sign","GREYFORD BOOKS",(-2.6,-.443,F+3.015),.31,"ivory")
    upper=[opening("book-upper-"+str(i),x,.30,3.76,1.24,1.65) for i,x in enumerate((-5.10,-2.70,-.30))]
    wall("bookshop_upper_front",(-2.60,.3,F+4.46),(7.65,.34,2.73),"plaster",upper)
    for x in (-5.10,-2.70,-.30):sash("books_upper"+str(x),x,.105,F+4.585,1.24,1.65,"green")
    for x in (-6.43,1.23):box("bookshop_side"+str(x),(x,3.15,3.04),(.30,5.70,5.85),"plaster",.008)
    box("bookshop_rear",(-2.6,6,3.04),(7.65,.34,5.85),"plaster",.008)
    profiles("bookshop_eaves",-2.6,.07,5.99,7.97)
    mesh("bookshop_roof",[(-6.65,-.12,6.28),(1.48,-.12,6.28),(1.48,6.30,6.28),(-6.65,6.30,6.28),(-6.65,3.10,8.0),(1.48,3.10,8.0)],[(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)],"slate")
    tube("book_roof_ridge",[(-6.69,3.10,8.03),(1.52,3.10,8.03)],.065,"slate")
    roof_courses("bookshop_authored_slate_courses",-6.65,1.48,-.12,6.30,6.28,8.0)
    box("book_chimney",(-5.20,4.80,7.25),(.70,.72,1.46),"brick",.01)
    box("book_chimney_cap",(-5.20,4.80,8.0),(.86,.88,.12),"stone",.01)
    cylinder("book_pot",(-5.20,4.80,8.25),.14,.46,"terracotta",20)
    rect("bookshop",-2.60,3.15,7.65,6.02)
    LAY="street"
    # Small railway-platform edge; context, not a fake navigable station.
    for x in (-10.2,-8.7):
        cylinder("platform_iron_column"+str(x),(x,4.1,1.90),.072,3.45,"iron",20)
        cylinder("platform_foot"+str(x),(x,4.1,.32),.14,.32,"iron",20)
        tube("canopy_brace"+str(x),[(x,4.1,2.65),(x,3.65,3.25),(x,3.0,3.47)],.035,"iron")
    box("platform_roof",(-9.5,4.5,3.66),(3.8,5,.10),"slate",.009)
    for x in (-10.7,-8.4):tube("platform_roof_edge"+str(x),[(x,2,3.65),(x,7,3.65)],.045,"iron")
    for y in (3.0,5.2,7.3):
        box("railway_sleeper"+str(y),(-9.5,y,.02),(2.75,.20,.14),"timber",.01)
    for x in (-10.2,-8.85):tube("track"+str(x),[(x,2, .12),(x,8,.12)],.034,"iron")
    box("platform_boundary",(-7.8,4.7, .3),(.24,7,.60),"brick",.008);rect("platform-boundary",-8.6,4.7,3.5,7)


def furniture():
    global LAY
    LAY="interior"
    # Parquet is actual geometry, shared wood textures in runtime.
    for row in range(24):
        y=.30+row*.262
        for col in range(7):
            x=2.58+col*1.18+(row%2)*.30
            if x+.57<10.61:box("parquet"+str((row,col)),(x,y,F+.012),(1.15,.251,.026),"timber",.003)
    # Raised-panel wainscot and projecting dado on interior side walls.
    for y in [ .65+i*.81 for i in range(8) ]:
        for x in (2.205,10.595):
            box("side_wainscot"+str((x,y)),(x,y,F+.57),(.065,.79,1.10),"walnut",.004)
            box("side_panel_field"+str((x,y)),(x+(.04 if x<6 else -.04),y,F+.55),(.027,.60,.80),"timber",.01)
    for x in (2.25,10.55):
        box("side_dado"+str(x),(x,3.4,F+1.18),(.14,6.45,.09),"walnut",.01)
        box("side_skirt"+str(x),(x,3.4,F+.08),(.17,6.45,.16),"walnut",.008)
    for i in range(10):
        x=2.53+i*.82
        box("rear_panel"+str(i),(x,6.59,F+.56),(.80,.07,1.1),"walnut",.006)
        box("rear_panel_field"+str(i),(x,6.54,F+.55),(.61,.025,.80),"timber",.008)
    box("rear_dado",(6.4,6.52,F+1.18),(8.40,.15,.09),"walnut",.007)
    # A dark stone hearth has a real recessed combustion opening.
    wall("fireplace_surround",(8.05,6.24,F+.79),(1.98,.66,1.58),"marble",[opening("hearth-opening",8.05,6.24,.08,1.12,1.01,"deep_alcove",destination="backed unlit hearth")])
    box("fireplace_back",(8.05,6.47,F+.58),(1.13,.04,1.08),"iron",0)
    box("hearth_slab",(8.05,6.03,F+.038),(2.27,1.19,.075),"marble",.012)
    box("mantel_profile",(8.05,6.21,F+1.62),(2.24,.82,.13),"marble",.017)
    rect("fireplace",8.05,6.16,2.3,1.30)
    box("mirror_frame",(8.05,6.50,F+2.38),(1.51,.11,1.08),"brass",.015)
    box("mirror_surface",(8.05,6.435,F+2.38),(1.35,.012,.92),"mirror",.004)
    # Rug motifs are woven border geometry, no borrowed pattern.
    box("rug_ground",(7.64,3.39,F+.037),(4.30,3.94,.009),"rug",.001)
    for inset in (.12,.20,.28):
        w=4.3-inset*2;d=3.94-inset*2
        for y in (3.39-d/2,3.39+d/2):box("rug_border_y"+str((inset,y)),(7.64,y,F+.043),(w,.021,.002),"rug_line",0)
        for x in (7.64-w/2,7.64+w/2):box("rug_border_x"+str((inset,x)),(x,3.39,F+.043),(.021,d,.002),"rug_line",0)
    for i in range(9):
        x=6.02+i*.40
        mesh("rug_diamond"+str(i),[(x,1.82,F+.045),(x+.085,1.99,F+.045),(x,2.16,F+.045),(x-.085,1.99,F+.045)],[(0,1,2,3)],"rug_line")
    armchair("chair-west",6.25,3.22,(7.55,3.30))
    armchair("chair-east",9.15,3.65,(7.55,3.30))
    table("tea-table",7.66,3.34,.58)
    tea("tea-service",7.68,3.36,F+.81)
    # Writing table with turned legs; clear 1.4 m arrival aisle at x=3.65.
    desk("writing-desk",5.20,5.89,1.80,.82,.79)
    box("desk_blotter",(5.19,5.79,F+.85),(.77,.46,.012),"green",.008)
    paper("correspondence",5.17,5.75,F+.86,.40,.26)
    cylinder("ink_bottle",(5.69,5.91,F+.914),.047,.115,"glass_dark",18)
    tube("pen",[(5.52,5.61,F+.877),(5.76,5.73,F+.877)],.005,"brass")
    rect("writing-desk",5.20,5.89,1.82,.85)
    desk("side-console",2.77,3.97,.64,1.4,.85)
    suitcase("case-one",2.78,4.05,F+.91,.54,.38,.29)
    rect("side-console",2.77,3.97,.68,1.45)
    suitcase("floor-valise",9.98,5.65,F,.53,.38,.65)
    rect("valise",9.98,5.65,.58,.44)
    # Original travel notice; marks are decoration, never game evidence.
    box("timetable_frame",(2.255,2.0,F+1.83),(.12,.88,1.10),"timber",.01)
    box("timetable_paper",(2.322,2.0,F+1.83),(.01,.72,.93),"paper",0)
    for i in range(10):box("timetable_rule"+str(i),(2.33,2.0,F+1.45+i*.07),(.006,.58,.009),"ink",0)
    # A pair of narrow curtains flank each window without blocking the route.
    LAY="inn_front"
    for x in (6.65,9.15):
        tube("curtain_rail"+str(x),[(x-1,.25,F+2.82),(x+1,.25,F+2.82)],.024,"brass")
        for side in (-1,1):
            for fold in range(5):
                cx=x+side*.81+(fold-2)*.063
                verts=[]
                for z,wide in ((F+.19,1.13),(F+1.13,.77),(F+2.74,1)):
                    for t in range(7):verts.append((cx+(t-3)*.012*wide,.25+math.sin(t/6*math.tau)*.028,z))
                faces=[(r*7+i,r*7+i+1,(r+1)*7+i+1,(r+1)*7+i) for r in range(2) for i in range(6)]
                mesh("curtain_fold"+str((x,side,fold)),verts,faces,"curtain",True)
    LAY="ceiling"
    box("ceiling_substrate",(6.4,3.4,F+3.31),(8.82,6.84,.18),"ceiling",.008)
    for x in (2.34,6.40,10.46):box("ceiling_beam_x"+str(x),(x,3.4,F+3.17),(.15,6.48,.18),"walnut",.012)
    for y in (.35,3.4,6.45):box("ceiling_beam_y"+str(y),(6.4,y,F+3.17),(8.28,.15,.18),"walnut",.012)
    for x in (2.30,10.50):box("side_cornice"+str(x),(x,3.4,F+3.11),(.24,6.57,.14),"ivory",.012)
    for y in (.29,6.51):box("end_cornice"+str(y),(6.4,y,F+3.11),(8.40,.23,.14),"ivory",.012)
    cylinder("pendant_rose",(7.66,3.34,F+3.16),.20,.08,"brass",32)
    tube("pendant_suspension",[(7.66,3.34,F+3.15),(7.66,3.34,F+2.68)],.018,"brass")
    sphere("pendant_opal",(7.66,3.34,F+2.54),(.23,.23,.21),"lamp")
    cylinder("pendant_shade",(7.66,3.34,F+2.73),.29,.105,"brass",32,top=.07)
    light=bpy.data.lights.new("sitting_room_pendant","AREA");light.energy=160;light.color=(1,.79,.57);light.shape="DISK";light.size=1.7
    obj=bpy.data.objects.new("sitting_room_pendant_light",light);obj.location=(7.66,3.34,F+2.45);bpy.context.collection.objects.link(obj);tag(obj)
    FIXTURES.append({"id":"sitting-room-pendant","position":[7.66,3.34,F+2.45],"color":"#ffe3bb","sourceWatts":160,"runtimeIntensity":60,"distance":8})


def transform_group(before, center, angle):
    rot=Matrix.Translation(Vector(center)) @ Matrix.Rotation(angle,4,"Z") @ Matrix.Translation(-Vector(center))
    for o in bpy.data.objects:
        if o.name not in before:o.matrix_world=rot @ o.matrix_world


def armchair(name,x,y,focus):
    before=set(bpy.data.objects.keys())
    for dx in (-.34,.34):
        for dy in (-.32,.32):
            cylinder(name+"_foot"+str((dx,dy)),(x+dx,y+dy,F+.155),.052,.31,"timber",16,top=.035)
    box(name+"_base",(x,y,F+.37),(.83,.84,.20),"leather",.062)
    box(name+"_seat_cushion",(x,y-.06,F+.52),(.68,.72,.17),"leather",.065)
    box(name+"_back_cushion",(x,y+.32,F+.86),(.79,.21,.81),"leather",.07)
    for dx in (-.43,.43):
        box(name+"_arm_support"+str(dx),(x+dx,y+.03,F+.66),(.18,.70,.49),"leather",.07)
        tube(name+"_rolled_arm"+str(dx),[(x+dx,y-.34,F+.80),(x+dx,y+.25,F+.84)],.105,"leather")
        for i in range(10):sphere(name+"_brass_tack"+str((dx,i)),(x+dx,y-.398,F+.50+i*.036),(.008,.007,.008),"brass",12)
    for dx in (-.22,0,.22):
        for z in (.79,1.04):sphere(name+"_button"+str((dx,z)),(x+dx,y+.201,F+z),(.022,.009,.022),"walnut",12)
    angle=math.atan2(focus[0]-x,-(focus[1]-y));transform_group(before,(x,y,0),angle)
    rect(name,x,y,1.05,1.05,angle)


def desk(name,x,y,w,d,h):
    box(name+"_top",(x,y,F+h),(w,d,.085),"timber",.024)
    box(name+"_apron",(x,y,F+h-.13),(w-.12,d-.12,.19),"walnut",.01)
    for dx in (-w/2+.09,w/2-.09):
        for dy in (-d/2+.09,d/2-.09):
            cylinder(name+"_leg"+str((dx,dy)),(x+dx,y+dy,F+(h-.13)/2),.041,h-.13,"timber",16,top=.055)
            for z in (.11,h-.23):sphere(name+"_turned_collar"+str((dx,dy,z)),(x+dx,y+dy,F+z),(.051,.051,.041),"timber",16)


def table(name,x,y,r):
    cylinder(name+"_top",(x,y,F+.76),r,.09,"timber",48)
    cylinder(name+"_bead",(x,y,F+.712),r-.032,.033,"walnut",48)
    cylinder(name+"_turned_stem",(x,y,F+.40),.080,.62,"timber",24,top=.052)
    for z in (.19,.60):sphere(name+"_bulb"+str(z),(x,y,F+z),(.115,.115,.10),"timber")
    for i in range(3):
        a=i*math.tau/3
        tube(name+"_swept_leg"+str(i),[(x,y,F+.24),(x+math.cos(a)*.22,y+math.sin(a)*.22,F+.12),(x+math.cos(a)*.39,y+math.sin(a)*.39,F+.04)],.045,"timber")
    rect(name,x,y,r*2,r*2)


def tea(name,x,y,z):
    cylinder(name+"_tray",(x,y,z+.008),.31,.018,"brass",48)
    for dx,dy in ((-.16,-.03),(.13,.10)):
        cylinder(name+"_saucer"+str(dx),(x+dx,y+dy,z+.025),.083,.019,"porcelain",28)
        cylinder(name+"_cup"+str(dx),(x+dx,y+dy,z+.070),.048,.078,"porcelain",28,top=.057)
        cylinder(name+"_tea"+str(dx),(x+dx,y+dy,z+.111),.048,.003,"tea",24)
        tube(name+"_handle"+str(dx),[(x+dx+.048,y+dy,z+.095),(x+dx+.085,y+dy,z+.065),(x+dx+.048,y+dy,z+.038)],.008,"porcelain")
    sphere(name+"_teapot",(x+.05,y-.11,z+.105),(.088,.075,.09),"porcelain")
    tube(name+"_spout",[(x+.11,y-.11,z+.10),(x+.19,y-.11,z+.15)],.019,"porcelain")
    cylinder(name+"_lid",(x+.05,y-.11,z+.191),.052,.012,"porcelain",24)


def paper(name,x,y,z,w,d):
    box(name,(x,y,z+.002),(w,d,.003),"paper",0)
    for i in range(7):box(name+"_ink"+str(i),(x-.016,y-d*.32+i*d*.09,z+.004),(w*.64,.003,.0006),"ink",0)


def suitcase(name,x,y,z,w,d,h):
    box(name+"_leather",(x,y,z+h/2),(w,d,h),"leather",.024)
    for dx in (-w*.29,w*.29):
        box(name+"_strap_top"+str(dx),(x+dx,y,z+h+.004),(.035,d+.007,.009),"walnut",.002)
        box(name+"_strap_front"+str(dx),(x+dx,y-d/2-.004,z+h/2),(.035,.009,h),"walnut",.002)
        box(name+"_lock"+str(dx),(x+dx,y-d/2-.012,z+h*.74),(.044,.016,.044),"brass",.004)
    tube(name+"_handle",[(x-.09,y,z+h+.01),(x-.08,y,z+h+.09),(x+.08,y,z+h+.09),(x+.09,y,z+h+.01)],.015,"leather")


def street_props():
    global LAY
    LAY="street"
    # Tall period lamp with a visibly connected bracket and foot.
    cylinder("street_lamp_plinth",(11.65,-2.04,F+.16),.21,.32,"iron",24)
    cylinder("street_lamp_stem",(11.65,-2.04,F+1.8),.064,3.15,"iron",24,top=.045)
    for z in (.50,2.80,3.26):cylinder("street_lamp_collar"+str(z),(11.65,-2.04,F+z),.092,.07,"iron",24)
    lantern("street_lamp_head",11.65,-2.04,F+3.29)
    rect("street-lamp",11.65,-2.04,.44,.44)
    # Bookshop bench with bent iron supports and independent timber slats.
    for x in (-5.80,-4.38):
        tube("bench_iron_leg"+str(x),[(x,-.78,F),(x,-.68,F+.45),(x,-1.08,F+.45),(x,-1.21,F)],.029,"iron")
        tube("bench_back_support"+str(x),[(x,-.68,F+.42),(x,-.58,F+1.0)],.028,"iron")
    for j in range(4):box("bench_seat"+str(j),(-5.09,-1.08+j*.115,F+.46),(1.72,.10,.045),"timber",.008)
    for j in range(3):box("bench_back"+str(j),(-5.09,-.61,F+.66+j*.125),(1.72,.055,.104),"timber",.008)
    rect("bookshop-bench",-5.09,-.94,1.82,.70)
    suitcase("outside_case",4.95,-.64,F,.62,.39,.36)
    rect("outside-case",4.95,-.64,.67,.44)
    # Folded dispatch paper and parcel; decorative, no hidden case data.
    box("parcel",(5.02,-.62,F+.49),(.42,.31,.22),"paper",.012)
    for x in (4.95,5.09):box("parcel_string"+str(x),(x,-.62,F+.603),(.006,.315,.004),"twine",0)
    # Hand-authored tapered leaves, no spherical toy tree canopy.
    for px,py in ((10.26,-.65),(-6.65,-.54)):
        cylinder("planter"+str(px),(px,py,F+.23),.26,.46,"terracotta",32,top=.34)
        cylinder("planter_lip"+str(px),(px,py,F+.44),.355,.071,"terracotta",32)
        cylinder("soil"+str(px),(px,py,F+.475),.32,.015,"soil",24)
        for i in range(13):
            a=i*2.4;h=.40+(i%4)*.11
            tube("plant_stem"+str((px,i)),[(px,py,F+.45),(px+math.cos(a)*.14,py+math.sin(a)*.14,F+.65),(px+math.cos(a)*.31,py+math.sin(a)*.31,F+.45+h)],.006,"leaf")
            base=Vector((px+math.cos(a)*.14,py+math.sin(a)*.14,F+.59));tip=Vector((px+math.cos(a)*.48,py+math.sin(a)*.48,F+.43+h));side=Vector((-math.sin(a)*.080,math.cos(a)*.080,0))
            mid=base.lerp(tip,.52)+Vector((0,0,.07))
            mesh("leaf"+str((px,i)),[tuple(base),tuple(mid+side),tuple(tip),tuple(mid-side),tuple(mid+Vector((0,0,.015)))],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],"leaf",True)
        rect("planter"+str(px),px,py,.72,.72)


def loft(name, rings, mat, cx=0,cy=0,sides=24):
    verts=[(cx+math.sin(i*math.tau/sides)*rx,cy-math.cos(i*math.tau/sides)*ry+oy,z) for z,rx,ry,oy in rings for i in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple(range((len(rings)-1)*sides,len(rings)*sides))]
    for j in range(len(rings)-1):faces.extend((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i) for i in range(sides))
    return mesh(name,verts,faces,mat,True)


def actor():
    global LAY,PART
    LAY="actor";PART="body"
    # Adult 1.79 m figure, restrained face detail; a study, not a final skinned cast.
    loft("tailored_coat",[(.70,.24,.16,0),(.76,.25,.164,0),(1.05,.218,.15,0),(1.26,.217,.139,0),(1.44,.265,.145,0),(1.50,.24,.115,.006),(1.53,.095,.080,.006)],"wool")
    mesh("shirt_front",[(-.082,-.116,1.50),(.082,-.116,1.50),(.085,-.161,1.23),(-.085,-.161,1.23)],[(0,1,2,3)],"ivory")
    for s in (-1,1):
        mesh("coat_lapel"+str(s),[(s*.08,-.13,1.50),(s*.195,-.137,1.42),(s*.124,-.168,1.24),(s*.055,-.17,1.37)],[(0,1,2,3)],"coat_edge")
        box("coat_pocket"+str(s),(s*.153,-.16,1.04),(.117,.018,.029),"coat_edge",.004)
        tube("coat_seam"+str(s),[(s*.193,.103,.76),(s*.171,.099,1.22),(s*.224,.079,1.46)],.002,"coat_edge")
    for z in (1.12,1.25):sphere("coat_button"+str(z),(.047,-.161,z),(.012,.007,.012),"iron",12)
    mesh("tie",[(-.020,-.125,1.484),(.024,-.125,1.484),(.024,-.169,1.28),(0,-.174,1.25),(-.018,-.169,1.28)],[(0,1,2,3,4)],"book_red")
    cylinder("neck",(0,0,1.53),.054,.107,"skin",24)
    loft("head",[(1.555,.048,.054,-.01),(1.58,.071,.071,-.007),(1.625,.088,.078,0),(1.695,.089,.082,.003),(1.742,.077,.078,.010),(1.773,.045,.047,.013)],"skin",sides=32)
    sphere("nose",(0,-.083,1.653),(.018,.031,.024),"skin",16)
    for s in (-1,1):
        sphere("ear"+str(s),(s*.088,.004,1.65),(.012,.020,.030),"skin",16)
        sphere("eye"+str(s),(s*.034,-.076,1.680),(.009,.004,.005),"ink",12)
        tube("brow"+str(s),[(s*.019,-.077,1.695),(s*.046,-.072,1.696)],.003,"hair")
    tube("mouth",[(-.020,-.075,1.602),(0,-.081,1.600),(.020,-.075,1.602)],.002,"lip")
    loft("combed_hair",[(1.70,.089,.083,.014),(1.75,.082,.076,.014),(1.79,.043,.045,.014)],"hair",sides=32)
    # Four named rigid joints, intentionally separate from final rig/animation scope.
    for s,side in ((-1,"left"),(1,"right")):
        PART="leg_"+side
        loft("trouser_"+side,[(.13,.075,.075,0),(.19,.072,.071,0),(.42,.065,.069,0),(.70,.090,.091,0),(.91,.096,.105,0)],"trousers",cx=s*.115,sides=20)
        box("trouser_crease_"+side,(s*.115,-.072,.45),(.006,.007,.43),"coat_edge",.002)
        sphere("shoe_"+side,(s*.115,-.042,.086),(.086,.155,.073),"shoe",24)
        box("shoe_sole_"+side,(s*.115,-.038,.033),(.166,.28,.035),"iron",.006)
        PART="arm_"+side
        loft("sleeve_"+side,[(.94,.060,.062,-.012),(1.03,.061,.067,-.009),(1.23,.077,.075,0),(1.43,.090,.085,0),(1.48,.066,.066,0)],"wool",cx=s*.287,sides=20)
        cylinder("shirt_cuff_"+side,(s*.287,-.012,.953),.054,.026,"ivory",20)
        sphere("hand_"+side,(s*.29,-.019,.89),(.045,.031,.073),"skin",20)
        sphere("thumb_"+side,(s*.26,-.039,.90),(.020,.02,.041),"skin",16)
    PART="body"
    tube("satchel_strap",[(-.20,-.154,1.45),(.0,-.177,1.21),(.24,-.162,.95)],.017,"leather")
    box("investigator_satchel",(.29,.028,.91),(.13,.32,.25),"leather",.025)
    box("satchel_buckle",(.359,-.029,.96),(.012,.044,.055),"brass",.005)
    # Store actor geometry in local metres; one transformation applied to all parts.
    for obj in bpy.data.objects:
        if obj.get("layer")=="actor":obj.matrix_world=Matrix.Translation(Vector((4.2,-3.75,F-.0155))) @ obj.matrix_world
    PART="static"


def camera(name, pos,target,scale=None,lens=32):
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat("-Z","Y").to_euler()
    data.clip_start=.05;data.clip_end=140;data.lens=lens
    if scale:data.type="ORTHO";data.ortho_scale=scale
    obj["reviewCamera"]=True;return obj


def light_scene():
    global LAY
    LAY="lighting"
    world=bpy.data.worlds.new("soft_overcast_railway_day");world.use_nodes=True;world.node_tree.nodes["Background"].inputs[0].default_value=(.62,.72,.84,1);world.node_tree.nodes["Background"].inputs[1].default_value=.32;bpy.context.scene.world=world
    data=bpy.data.lights.new("broad_overcast_key","AREA");data.energy=2400;data.shape="DISK";data.size=16;data.color=(1,.90,.75)
    obj=bpy.data.objects.new("broad_overcast_key",data);bpy.context.collection.objects.link(obj);obj.location=(-4,-7,14);obj.rotation_euler=(Vector((2,1,0))-obj.location).to_track_quat("-Z","Y").to_euler()
    sun=bpy.data.lights.new("hazy_daylight","SUN");sun.energy=1.4;sun.angle=.34;sun.color=(1,.91,.78)
    obj=bpy.data.objects.new("hazy_daylight",sun);bpy.context.collection.objects.link(obj);obj.rotation_euler=(.50,-.46,-.40)
    # Room window fill is tied to visible front openings, not a hidden beauty spotlight.
    for x in (6.65,9.15):
        data=bpy.data.lights.new("window_fill_"+str(x),"AREA");data.energy=220;data.shape="RECTANGLE";data.size=1.45;data.size_y=1.75;data.color=(.73,.84,1)
        obj=bpy.data.objects.new("window_fill_"+str(x),data);bpy.context.collection.objects.link(obj);obj.location=(x,.22,1.76);obj.rotation_euler=(Vector((x,3.7,1.0))-obj.location).to_track_quat("-Z","Y").to_euler();obj["layer"]="window-light"


def cameras():
    camera("street-production",(17,-24,16),(1.1,.2,3.1),29.0)
    camera("street-exploration",(13.2,-17.75,13.18),(4.2,-2.75,1.0),16.8)
    camera("interior-production",(16,-12,13),(6.35,3.15,1.0),15.4)
    for name,x,y in (("sw",2.52,1.75),("se",10.23,.57),("ne",10.23,6.22),("nw",2.52,6.22)):
        camera("corner-"+name,(x,y,F+1.62),(6.4,3.4,F+1.42),lens=10.3923)
    camera("low-entry",(3.66,-.90,F+1.55),(3.80,3.4,F+1.38),lens=18)
    camera("ceiling-up",(6.4,3.4,F+1.50),(6.4,3.4,F+3.15),lens=5.2)
    camera("ceiling-oblique-a",(2.6,1.72,F+1.40),(8.30,4.6,F+2.91),lens=13)
    camera("ceiling-oblique-b",(10.1,6.0,F+1.03),(4.9,2.1,F+2.91),lens=13)
    camera("plan-floor",(6.4,2.8,24),(6.4,2.8,0),15.8)
    camera("plan-ceiling",(6.4,3.4,.02),(6.4,3.4,3.2),15.8)


def configure(samples,width):
    scene=bpy.context.scene;scene.render.engine="CYCLES";devices=[]
    try:
        prefs=bpy.context.preferences.addons["cycles"].preferences;prefs.compute_device_type="OPTIX";prefs.get_devices()
        for dev in prefs.devices:dev.use=dev.type=="OPTIX";devices.extend([dev.name] if dev.use else [])
        scene.cycles.device="GPU" if devices else "CPU"
    except Exception:scene.cycles.device="CPU"
    scene.cycles.samples=samples;scene.cycles.use_denoising=True;scene.cycles.max_bounces=8
    scene.render.resolution_x=width;scene.render.resolution_y=round(width*9/16);scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGB";scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX";scene.view_settings.look="AgX - Medium High Contrast";scene.view_settings.exposure=.35
    return devices


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True);textures()
    for name,color,rough,metal,tex,meters in (
        ("brick","7c5340",.86,0,"brick",2.2),("stone","b0a18b",.81,0,"stone",2.1),("timber","56321f",.42,0,"timber",.92),
        ("walnut","322116",.44,0,None,1),("slate","35434a",.59,0,"slate",1.5),("paving","666660",.72,0,"paving",1.1),
        ("plaster","b9b498",.90,0,"plaster",1.6),("leather","633522",.44,0,"leather",.85),("wool","303d48",.95,0,"wool",.45),
        ("green","203f36",.50,0,None,1),("ivory","c9c1aa",.62,0,None,1),("iron","263030",.37,.63,None,1),
        ("brass","a58147",.40,.78,None,1),("glass","80989b",.22,.08,None,1),("glass_dark","1c302e",.21,.15,None,1),
        ("lamp","f9dc99",.30,0,None,1),("curtain","592b28",.93,0,None,1),("book_red","713d32",.76,0,None,1),
        ("book_green","354742",.72,0,None,1),("book_ochre","93754c",.78,0,None,1),("paper","c6baa0",.96,0,None,1),
        ("ink","343334",.88,0,None,1),("porcelain","dedbca",.25,0,None,1),("tea","493321",.14,0,None,1),
        ("rug","493f35",.95,0,None,1),("rug_line","9b8764",.96,0,None,1),("marble","373e3c",.31,0,None,1),
        ("mirror","89928b",.20,.70,None,1),("ceiling","d2cbbb",.85,0,None,1),("terracotta","725444",.89,0,None,1),
        ("twine","968568",.96,0,None,1),("soil","24251e",1,0,None,1),("leaf","344737",.77,0,None,1),
        ("coat_edge","273640",.90,0,None,1),("trousers","383934",.91,0,None,1),("shoe","322a26",.37,0,None,1),
        ("skin","b18e78",.66,0,None,1),("hair","342d27",.91,0,None,1),("lip","85594c",.72,0,None,1),("clay","aaaaaa",.90,0,None,1)):
        material(name,color,rough,metal,tex,meters)
    p=MATS["lamp"].node_tree.nodes.get("Principled BSDF");p.inputs["Emission Color"].default_value=(1,.68,.28,1);p.inputs["Emission Strength"].default_value=.7
    # Alpha blending is compatible with GLB and permits seeing the modeled book display.
    p=MATS["glass"].node_tree.nodes.get("Principled BSDF");p.inputs["Alpha"].default_value=.25
    MATS["glass"].surface_render_method="DITHERED";MATS["glass"]["alphaMode"]="BLEND"
    architecture();furniture();street_props();actor();light_scene();cameras()
    bpy.context.scene.unit_settings.system="METRIC";bpy.context.scene["purpose"]="Original approved-direction art sample; not canonical town, case, final animation or human art acceptance"
    bpy.context.view_layer.update()
    write(PACKAGE/"openings.json",{"schema":"classic-openings.v1","openings":OPENINGS})
    write(PACKAGE/"lighting.json",{"schema":"classic-lights.v1","fixtures":FIXTURES,"runtimeCalibration":"Per-fixture runtime intensity is an artistic calibration, not Blender watt equivalence; no baked lightmap claim."})
    write(PACKAGE/"scene-contract.json",{"schema":"classic-art-scene.v1","floor":F,"bounds":[-10.8,12.3,-8.5,6.6],"player":{"spawn":[4.2,-3.75],"height":1.79,"radius":.26,"speed":2.25},"colliders":COLLIDERS,"interior":{"bounds":[2.18,10.62,.18,6.62],"door":[3.65,0],"cutawayLayers":["inn_upper","inn_front","ceiling","inn_side_cutaway"]},"interactions":[{"id":"arrival","label":"进入会客室","position":[3.65,-.48],"description":"门洞真实连通街道和旅馆；穿过门廊即可入内。"},{"id":"letters","label":"观察书桌","position":[4.78,5.16],"description":"信纸、墨水与旅行时刻表是本次美术样板的陈设，尚未绑定案件。"},{"id":"tea","label":"观察茶桌","position":[7.66,2.40],"description":"面对茶桌的两张皮椅构成会客区，入口动线沿房间左侧经过。"},{"id":"books","label":"查看书店橱窗","position":[-3.7,-.60],"description":"有进深的橱窗陈列。书店内部不在本次可进入范围。"}],"actorPivots":{"body":[0,0,0],"leg_left":[-.115,0,.9],"leg_right":[.115,0,.9],"arm_left":[-.287,0,1.45],"arm_right":[.287,0,1.45]},"binding":"art-sample-only"})
    write(PACKAGE/"placements.json",{"schema":"classic-placement.v1","supportRelations":CONTACTS,"seatingFocus":[7.66,3.34],"ceilingAttachment":"pendant rose flush to beam underside; suspension reaches opal fixture","manuallyAuthored":True})


def render_views(args,brief,inputs):
    devices=configure(args.samples,args.width);scene=bpy.context.scene
    receipt=PACKAGE/"render-receipt.json";entries=[];identity=sha(SOURCE)
    views=brief["requiredViews"] if args.views=="all" else args.views.split(",")
    if receipt.exists():
        old=json.loads(receipt.read_text(encoding="utf-8"))
        if old["sourceSha256"]==identity:entries=[e for e in old["renders"] if e["view"] not in views]
    folder=PACKAGE/"renders";folder.mkdir(exist_ok=True)
    for view in views:
        if view not in brief["requiredViews"]:raise ValueError("Unknown review view "+view)
        for obj in bpy.data.objects:
            obj.hide_render=False
            if hasattr(obj,"visible_camera"):obj.visible_camera=not(obj.type=="LIGHT" and obj.data.type=="AREA")
            lay=obj.get("layer")
            if view=="interior-production" and lay in ("ceiling","inn_upper","inn_front","inn_side_cutaway"):
                # Preserve shadows from the complete shell, remove only camera occlusion.
                obj.visible_camera=False
            if view.startswith("plan-"):
                obj.hide_render=(lay not in ("inn_shell","interior","inn_front","inn_side_cutaway")) if view=="plan-floor" else lay!="ceiling"
                if obj.type=="LIGHT":obj.hide_render=False
            if view not in ("street-production","street-exploration") and lay=="actor":obj.hide_render=True
        scene.view_layers[0].material_override=bpy.data.materials["clay"] if view.startswith("plan-") else None
        scene.camera=bpy.data.objects[view];output=folder/(view+".png");scene.render.filepath=str(output)
        started=time.perf_counter();bpy.ops.render.render(write_still=True)
        entry={"view":view,"path":"renders/"+output.name,"sha256":sha(output),"seconds":round(time.perf_counter()-started,2),"dimensions":[scene.render.resolution_x,scene.render.resolution_y],"sourceSha256":identity}
        entries.append(entry)
        write(receipt,{"schema":"classic-renders.v1","sourceSha256":identity,"inputs":inputs,"engine":"Cycles","device":scene.cycles.device,"devices":devices,"samples":args.samples,"renders":entries,"complete":set(brief["requiredViews"])<=set(e["view"] for e in entries)})
        print("CLASSIC_RENDER="+json.dumps(entry),flush=True)


def main():
    p=argparse.ArgumentParser();p.add_argument("--render-existing",action="store_true");p.add_argument("--views",default="street-production,interior-production");p.add_argument("--width",type=int,default=1600);p.add_argument("--samples",type=int,default=48)
    args=p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    brief=json.loads((PACKAGE/"room-brief.json").read_text(encoding="utf-8"))
    inputs=[{"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":sha(path)} for path in (Path(__file__),PACKAGE/"room-brief.json")]
    if args.render_existing:
        author=json.loads((PACKAGE/"authoring-receipt.json").read_text(encoding="utf-8"))
        if author["inputs"]!=inputs or author["source"]["sha256"]!=sha(SOURCE):raise RuntimeError("Source or authoring inputs changed; rebuild first")
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        build();configure(args.samples,args.width);bpy.context.scene.camera=bpy.data.objects["street-production"]
        bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        write(PACKAGE/"authoring-receipt.json",{"schema":"classic-authoring.v1","inputs":inputs,"source":{"path":SOURCE.name,"sha256":sha(SOURCE),"bytes":SOURCE.stat().st_size},"blenderVersion":bpy.app.version_string,"meshObjects":sum(o.type=="MESH" for o in bpy.data.objects),"originalTextures":[{"path":str(f.relative_to(PACKAGE)).replace("\\","/"),"sha256":sha(f)} for f in sorted((PACKAGE/"textures").glob("*.png"))],"thirdPartyAssets":[],"humanArtApproved":False})
    if args.views!="none":render_views(args,brief,inputs)
    print("CLASSIC_SOURCE="+str(SOURCE),flush=True)


if __name__=="__main__":main()
