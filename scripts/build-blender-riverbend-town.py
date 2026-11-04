"""Original Riverbend geometry and ordered Blender view suite. Run in background."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import random
import sys
import time

import bpy
import bmesh
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/3d-town/riverbend-v1"
RNG = random.Random(71103)
MATS = {}
LIB = {}
GROUPS = {}
OPENINGS = []
CUBE = [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),
        (-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
FACES = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def srgb(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def material(name, color, rough=.7, metal=0):
    rgb = [srgb(int(color[i:i+2], 16) / 255) for i in (0,2,4)]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    MATS[name] = m
    return m


def mesh(name, vertices, faces, mat, group="town", smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATS[mat])
    obj["origin"] = "project-local-original"
    obj["semantic_group"] = group
    GROUPS.setdefault(group, []).append(obj.name)
    if smooth:
        for face in data.polygons:
            face.use_smooth = True
    return obj


def box(name, loc, size, mat, group="town", rotation=None):
    key = "cube:" + mat
    if key not in LIB:
        obj = mesh(name, CUBE, FACES, mat, group)
        LIB[key] = obj.data
    else:
        obj = bpy.data.objects.new(name, LIB[key])
        bpy.context.collection.objects.link(obj)
        obj["origin"] = "project-local-original"
        obj["semantic_group"] = group
        GROUPS.setdefault(group, []).append(name)
    obj.location = loc
    obj.scale = size
    if rotation:
        obj.rotation_euler = rotation
    return obj


def batch_boxes(name, entries, mat, group="town"):
    verts, faces = [], []
    for loc, size, angle in entries:
        rot = Matrix.Rotation(angle, 3, "Y")
        offset = len(verts)
        verts.extend(tuple(Vector(loc) + rot @ Vector((x*size[0], y*size[1], z*size[2])))
                     for x,y,z in CUBE)
        faces.extend(tuple(offset+i for i in f) for f in FACES)
    return mesh(name, verts, faces, mat, group) if entries else None


def cylinder(name, loc, radius, height, mat, group="town", sides=12, radius_top=None):
    r2 = radius if radius_top is None else radius_top
    verts = [(math.cos(i*math.tau/sides)*r, math.sin(i*math.tau/sides)*r, z)
             for r,z in ((radius,-height/2),(r2,height/2)) for i in range(sides)]
    faces = [tuple(reversed(range(sides))), tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    obj = mesh(name, verts, faces, mat, group, smooth=True)
    obj.location = loc
    return obj


def sphere(name, loc, scale, mat, group="town"):
    key = "ico:" + mat
    if key not in LIB:
        data = bpy.data.meshes.new(key)
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1)
        bm.to_mesh(data)
        bm.free()
        data.materials.append(MATS[mat])
        for f in data.polygons:
            f.use_smooth = True
        LIB[key] = data
    obj = bpy.data.objects.new(name, LIB[key])
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.scale = scale
    obj["origin"] = "project-local-original"
    obj["semantic_group"] = group
    GROUPS.setdefault(group, []).append(name)
    return obj


def rod(name, a, b, radius, mat, group="town", sides=10):
    a,b = Vector(a),Vector(b)
    obj = cylinder(name, (a+b)/2, radius, (b-a).length, mat, group, sides)
    obj.rotation_euler = (b-a).to_track_quat("Z","Y").to_euler()
    return obj


def label(name, body, position, size, mat, group):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = .006
    curve.resolution_u = 4
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler.x = math.pi/2
    curve.materials.append(MATS[mat])
    obj["origin"] = "project-local-original"
    obj["semantic_group"] = group
    GROUPS.setdefault(group, []).append(name)
    return obj


def boolean_front(name, x, y, width, height, apertures, mat, group):
    # Wall data is single-user because the evaluated Exact boolean changes it.
    wall = box(name, (x,y,height/2+.16), (width,.32,height), mat, group)
    wall.data = wall.data.copy()
    bpy.context.view_layer.objects.active = wall
    wall.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    wall.select_set(False)
    entries = [((cx,y,cz),(w,1.0,h),0) for cx,cz,w,h in apertures]
    cutter = batch_boxes(name+"_cutters", entries, "clay", "cutters")
    bpy.context.view_layer.objects.active = wall
    mod = wall.modifiers.new("scheduled_real_apertures","BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    wall["scheduled_apertures"] = len(apertures)
    return wall


def window(name, x, y, z, w, h, group):
    # Glass is recessed behind the real wall opening, with a sill and backing interior.
    # Overlap the cutout perimeter inside the reveal to avoid daylight slits.
    box(name+"_glass",(x,y+.12,z),(w+.06,.035,h+.06),"glass",group)
    for dx in (-w/2-.045,w/2+.045):
        box(name+"_jamb"+str(dx),(x+dx,y-.045,z),(.09,.25,h+.2),"trim",group)
    for dz in (-h/2-.045,h/2+.045):
        box(name+"_rail"+str(dz),(x,y-.05,z+dz),(w+.18,.26,.09),"trim",group)
    box(name+"_sill",(x,y-.16,z-h/2-.08),(w+.34,.55,.13),"stone",group)
    box(name+"_mullion",(x,y+.055,z),(.045,.08,h),"wood",group)
    box(name+"_crossbar",(x,y+.055,z),(w,.08,.05),"wood",group)
    for side in (-1,1):
        shutter_x=x+side*(w*.5+.25)
        box(name+"_shutter"+str(side),(shutter_x,y-.14,z),(.29,.13,h),"shutters",group)
        for dz in (-.3,0,.3):
            box(name+"_shutter_slat"+str(side)+str(dz),(shutter_x,y-.22,z+dz),(.24,.035,.025),"trim",group)


def awning(group, x, y, width, z, mat="canvas"):
    slope=.19
    sections=max(4,int(width/.52))
    for n in range(sections):
        sx=x-width/2+(n+.5)*width/sections
        box(group+"_awning"+str(n),(sx,y-.9,z),(width/sections-.006,1.8,.09),
            mat if n%2 else "cream",group,(slope,0,0))
        box(group+"_valance"+str(n),(sx,y-1.78,z-.30),(width/sections-.006,.07,.3),
            mat if n%2 else "cream",group)
    for dx in (-width/2+.12,width/2-.12):
        rod(group+"_awning_brace"+str(dx),(x+dx,y,z-.7),(x+dx,y-1.65,z-.22),.025,"iron",group)


def side_apertures(b, side, wall):
    group=b["id"]; x,y=b["center"]; w,d,h=b["size"]
    holes=[(dy,z,1.05,1.35) for dy in (-d*.25,d*.25) for z in ((1.75,4.6) if h>5 else (1.75,))]
    wall.data=wall.data.copy()
    bpy.context.view_layer.objects.active=wall
    wall.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    wall.select_set(False)
    cuts=[((x+side*w/2,y+dy,z),(.95,ww,hh),0) for dy,z,ww,hh in holes]
    cutter=batch_boxes(group+"_side_cutter"+str(side),cuts,"clay","cutters")
    mod=wall.modifiers.new("side-window-apertures","BOOLEAN")
    mod.operation="DIFFERENCE";mod.solver="EXACT";mod.object=cutter
    bpy.context.view_layer.objects.active=wall
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    rot=Matrix.Rotation(side*math.pi/2,4,"Z")
    shift=Vector((x+side*w/2,y,0))
    for i,(dy,z,ww,hh) in enumerate(holes):
        start=len(GROUPS[group])
        window(group+"_side_window"+str(side)+"_"+str(i),side*dy,0,z,ww,hh,group)
        for name in GROUPS[group][start:]:
            obj=bpy.data.objects[name]
            obj.location=shift+rot.to_3x3() @ obj.location.copy()
            obj.rotation_euler=(rot.to_quaternion() @ obj.rotation_euler.to_quaternion()).to_euler()
        OPENINGS.append({"id":group+":side"+str(side)+":"+str(i),"building":group,
                         "kind":"window","center":[x+side*w/2,y+dy,z],"size":[.32,ww,hh],
                         "destination":"exterior","method":"evaluated-Exact-Boolean"})


def building(b):
    group=b["id"]
    x,y=b["center"]
    w,d,h=b["size"]
    front=y-d/2
    box(group+"_foundation",(x,y,.02),(w+.36,d+.36,.28),"stone",group)
    box(group+"_floor",(x,y,.16),(w-.36,d-.36,.1),"floor",group)
    box(group+"_back",(x,y+d/2,h/2+.16),(w,.32,h),b["palette"],group)
    for side in (-1,1):
        wall=box(group+"_side"+str(side),(x+side*w/2,y,h/2+.16),(.32,d,h),b["palette"],group)
        side_apertures(b,side,wall)
    apertures=[(x,1.51,1.5,2.7)]
    for dx in (-w*.31,w*.31):
        apertures.append((x+dx,1.77,1.62,1.6))
    if h>5:
        for dx in (-w*.31,0,w*.31):
            apertures.append((x+dx,4.62,1.12,1.5))
    boolean_front(group+"_front_wall",x,front,w,h,apertures,b["palette"],group)
    for i,(cx,cz,cw,ch) in enumerate(apertures):
        OPENINGS.append({"id":group+":"+str(i),"building":group,
                         "kind":"door" if i==0 else "window",
                         "center":[cx,front,cz],"size":[cw,.32,ch],
                         "destination":group+"-ground-floor" if i==0 else "exterior",
                         "method":"evaluated-Exact-Boolean"})
        if i:
            window(group+"_window"+str(i),cx,front,cz,cw,ch,group)
    # Closed door, grounded jambs, transom and a threshold: no false painted entrance.
    box(group+"_door",(x,front+.075,1.51),(1.41,.10,2.6),"door",group)
    for side in (-1,1):
        box(group+"_door_jamb"+str(side),(x+side*.82,front-.09,1.52),(.15,.40,2.88),"trim",group)
        for dz in (.62,1.22):
            box(group+"_door_panel"+str(side)+str(dz),(x+side*.34,front+.014,dz),(.57,.038,.45),"wood",group)
    box(group+"_door_lintel",(x,front-.09,2.99),(1.78,.40,.16),"trim",group)
    box(group+"_door_glass",(x,front+.013,2.1),(1.15,.022,.73),"glass",group)
    sphere(group+"_handle",(x+.51,front-.07,1.28),(.045,.07,.045),"brass",group)
    box(group+"_threshold",(x,front-.32,.10),(1.80,.80,.18),"stone",group)
    for z in (.45,3.3,h+.17):
        box(group+"_string_course"+str(z),(x,front-.12,z),(w+.20,.35,.14),"trim",group)
    for dx in (-w/2+.18,w/2-.18):
        for z in (.8,1.65,2.50,3.7,4.55,5.4):
            if z<h:
                box(group+"_quoin"+str(dx)+str(z),(x+dx,front-.085,z),(.42,.30,.32),"trim",group)
    roof_z=h+.3
    pitch=w*.30
    # Gable triangles are structural plaster; separate roof slabs and slate tiles cover them.
    verts=[(x-w/2,y-d/2,roof_z),(x+w/2,y-d/2,roof_z),(x,y-d/2,roof_z+pitch),
           (x-w/2,y+d/2,roof_z),(x+w/2,y+d/2,roof_z),(x,y+d/2,roof_z+pitch)]
    mesh(group+"_gable",verts,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],b["palette"],group)
    half=w/2+.4
    for side in (-1,1):
        rverts=[(x+side*half,y-d/2-.45,roof_z-.1),(x,y-d/2-.45,roof_z+pitch),
                (x,y+d/2+.45,roof_z+pitch),(x+side*half,y+d/2+.45,roof_z-.1)]
        rverts += [(a,b,c-.15) for a,b,c in rverts]
        roof_faces=[tuple(reversed(f)) for f in FACES] if side==-1 else FACES
        mesh(group+"_roof_slab"+str(side),rverts,roof_faces,b["roof"],group)
    tiles=[[],[],[]]
    rows=10
    cols=max(8,round((d+.8)/.48))
    angle=math.atan2(pitch+.1,half)
    for side in (-1,1):
        for row in range(rows):
            off=(row+.5)*half/rows
            z=roof_z+pitch-(pitch+.1)*off/half+.055
            for col in range(cols):
                yy=y-d/2-.4+(col+.5)*(d+.8)/cols
                tiles[RNG.choice((0,1,1,1,2))].append(((x+side*off,yy,z),(half/rows/math.cos(angle)+.03,(d+.8)/cols-.012,.07),side*angle))
    for i,batch in enumerate(tiles):
        batch_boxes(group+"_roof_tiles"+str(i),batch,b["roof"]+str(i),group)
    rod(group+"_ridge",(x,y-d/2-.5,roof_z+pitch+.08),(x,y+d/2+.5,roof_z+pitch+.08),.11,b["roof"],group)
    for side in (-1,1):
        rod(group+"_gutter"+str(side),(x+side*half,y-d/2-.5,roof_z-.08),(x+side*half,y+d/2+.5,roof_z-.08),.075,"iron",group)
    chimney=(x-w*.28,y+d*.2,roof_z+pitch*.6+.5)
    box(group+"_chimney",chimney,(.75,.82,1.7),"brick",group)
    box(group+"_chimney_cap",(chimney[0],chimney[1],chimney[2]+.86),(.95,1.02,.15),"stone",group)
    for dx in (-.2,.2):
        cylinder(group+"_chimney_pot"+str(dx),(chimney[0]+dx,chimney[1],chimney[2]+1.08),.14,.4,"terracotta",group)
    if b["sign"]:
        box(group+"_sign",(x,front-.29,3.58),(min(w-1,len(b["sign"])*.39+.65),.14,.63),"shutters",group)
        label(group+"_lettering",b["sign"],(x,front-.38,3.58),.39,"cream",group)
    if group=="cafe":
        awning(group,x,front-.2,w-1.4,3.12)
    elif group=="books":
        awning(group,x,front-.2,w-1.1,3.12,"rust")
    elif group=="station":
        box(group+"_porch_roof",(x,front-1.4,3.27),(w+.4,2.8,.20),"slate",group,(.04,0,0))
        for dx in (-w*.43,-w*.20,w*.20,w*.43):
            box(group+"_porch_column"+str(dx),(x+dx,front-2.45,1.66),(.12,.12,3.18),"wood",group)
    elif group=="inn":
        box(group+"_balcony_deck",(x,front-.65,3.40),(w*.7,1.35,.15),"wood",group)
        for i in range(13):
            xx=x-w*.35+i*w*.7/12
            rod(group+"_balcony_rail"+str(i),(xx,front-1.20,3.45),(xx,front-1.20,4.25),.023,"iron",group)
        rod(group+"_balcony_top",(x-w*.35,front-1.20,4.25),(x+w*.35,front-1.20,4.25),.035,"iron",group)
        for side in (-1,1):
            rod(group+"_balcony_brace"+str(side),(x+side*w*.28,front-.1,2.66),(x+side*w*.28,front-1.10,3.36),.05,"wood",group)
    if b["interior"]:
        interior(b,front)
    return {"id":group,"bounds":[x-w/2-.18,y-d/2-.18,x+w/2+.18,y+d/2+.18],
            "height":roof_z+pitch+.25,"entrance":b["entrance"]}


def chair(name,x,y,turn=0,group="furniture"):
    start=len(GROUPS.get(group,[]))
    obj=box(name+"_seat",(x,y,.51),(.49,.49,.10),"wood",group)
    for dx in (-.18,.18):
        for dy in (-.18,.18):
            box(name+"_leg"+str(dx)+str(dy),(x+dx,y+dy,.27),(.055,.055,.46),"wood",group)
    by=y+.21
    for dx in (-.18,.18):
        box(name+"_backpost"+str(dx),(x+dx,by,.79),(.05,.06,.5),"wood",group)
    box(name+"_backrest",(x,by,.92),(.47,.06,.18),"wood",group)
    rotation=Matrix.Rotation(turn,3,"Z")
    pivot=Vector((x,y,0))
    for part_name in GROUPS[group][start:]:
        part=bpy.data.objects[part_name]
        part.location=pivot+rotation @ (part.location-pivot)
        part.rotation_euler.z+=turn


def table(name,x,y,group="furniture"):
    cylinder(name+"_top",(x,y,.78),.55,.085,"wood",group,24)
    cylinder(name+"_stem",(x,y,.41),.055,.67,"iron",group)
    cylinder(name+"_base",(x,y,.07),.30,.06,"iron",group)
    cylinder(name+"_cup",(x+.12,y,.86),.065,.09,"cream",group,12)


def interior(b,front):
    x,y=b["center"]; w,d,h=b["size"]; group=b["id"]
    box(group+"_ceiling",(x,y,3.12),(w-.35,d-.35,.16),"cream",group)
    for dx in (-w*.29,0,w*.29):
        box(group+"_ceiling_beam"+str(dx),(x+dx,y,2.98),(.16,d-.36,.16),"wood",group)
    for dx in (-w*.22,w*.22):
        rod(group+"_pendant_wire"+str(dx),(x+dx,y,3.04),(x+dx,y,2.52),.012,"iron",group)
        cylinder(group+"_pendant_shade"+str(dx),(x+dx,y,2.47),.20,.16,"brass",group,16,.10)
        sphere(group+"_bulb"+str(dx),(x+dx,y,2.38),(.075,.075,.075),"lamp",group)
        light(group+"_interior_light"+str(dx),"POINT",(x+dx,y,2.35),None,110,(1,.85,.65),.6)
    if group=="cafe":
        box("cafe_counter",(x,y+d/2-.8,.69),(w-1.2,.75,1.1),"wood",group)
        box("cafe_countertop",(x,y+d/2-.8,1.27),(w-1,.91,.10),"stone",group)
        for i,dx in enumerate((-1.9,1.9)):
            furniture_start=len(GROUPS[group])
            table("cafe_inside"+str(i),x+dx,y,group)
            chair("cafe_inside_chair"+str(i),x+dx,y-.8,math.pi,group=group)
            for part in GROUPS[group][furniture_start:]:
                bpy.data.objects[part].location.z+=.17
        for i in range(7):
            cylinder("cafe_canister"+str(i),(x-2+i*.6,y+d/2-.8,1.48),.11,.28,"cream",group)
    elif group=="books":
        for side in (-1,1):
            sx=x+side*(w/2-.5)
            box(group+"_shelfback"+str(side),(sx,y,1.48),(.20,d-1,2.5),"wood",group)
            for z in (.35,.95,1.55,2.15,2.75):
                box(group+"_shelf"+str(side)+str(z),(sx-side*.18,y,z),(.60,d-1,.08),"wood",group)
                for k in range(12):
                    box(group+"_volume"+str(side)+str(z)+str(k),(sx-side*.2,y-(d-1)/2+.22+k*.4,z+.24),
                        (.32,.30,.38),("rust","navy","ochre")[k%3],group)
    else:
        box("police_desk",(x,y+.6,.74),(2.4,1.1,.12),"wood",group)
        for dx in (-1,1):
            for dy in (-.4,.4):
                box("police_desk_leg"+str(dx)+str(dy),(x+dx,y+.6+dy,.47),(.1,.1,.52),"wood",group)
        furniture_start=len(GROUPS[group])
        chair("police_desk_chair",x,y+1.6,group=group)
        for part in GROUPS[group][furniture_start:]:
            bpy.data.objects[part].location.z+=.17


def clocktower():
    start=set(bpy.data.objects.keys())
    x,y,z=12,12.0,9.35
    box("clock_tower",(x,y,z),(2.5,2.5,4.2),"stone","police")
    box("clock_tower_cornice",(x,y,11.42),(2.9,2.9,.25),"trim","police")
    dial=cylinder("clock_face",(x,y-1.31,10.1),.79,.08,"cream","police",48)
    dial.rotation_euler.x=math.pi/2
    for i in range(12):
        a=i*math.tau/12
        mark=box("clock_mark"+str(i),(x+math.sin(a)*.66,y-1.37,10.1+math.cos(a)*.66),(.05,.035,.13),"iron","police")
        mark.rotation_euler.y=a
    rod("clock_hour",(x,y-1.41,10.1),(x-.30,y-1.41,10.27),.03,"iron","police")
    rod("clock_minute",(x,y-1.42,10.1),(x+.46,y-1.42,10.35),.022,"iron","police")
    cylinder("clock_spire",(x,y,12.42),2.10,1.75,"slate","police",4,.10)
    rod("clock_finial",(x,y,13.20),(x,y,13.92),.045,"brass","police")
    for name in set(bpy.data.objects.keys())-start:
        bpy.data.objects[name].location.z+=1.85


def human(name,x,y,coat="navy",player=False):
    group=name
    # Segmented original mesh parts retain semantic names for later animation.
    for side in (-1,1):
        sphere(name+"_shoe"+str(side),(x+side*.13,y-.05,.095),(.10,.18,.095),"iron",group)
        rod(name+"_shin"+str(side),(x+side*.13,y,.18),(x+side*.14,y,.58),.075,"trousers",group)
        rod(name+"_thigh"+str(side),(x+side*.14,y,.58),(x+side*.11,y,.94),.105,"trousers",group)
    cylinder(name+"_coat",(x,y,1.09),.27,.57,coat,group,12,.225)
    sphere(name+"_shoulders",(x,y,1.36),(.27,.155,.15),coat,group)
    for side in (-1,1):
        rod(name+"_upperarm"+str(side),(x+side*.25,y,1.36),(x+side*.32,y,1.10),.085,coat,group)
        rod(name+"_forearm"+str(side),(x+side*.32,y,1.10),(x+side*.30,y-.05,.91),.069,coat,group)
        sphere(name+"_hand"+str(side),(x+side*.30,y-.05,.88),(.064,.065,.075),"skin",group)
    cylinder(name+"_neck",(x,y,1.47),.065,.12,"skin",group)
    sphere(name+"_head",(x,y,1.615),(.122,.113,.153),"skin",group)
    sphere(name+"_hair",(x,y+.025,1.682),(.126,.108,.085),"hair",group)
    sphere(name+"_nose",(x,y-.108,1.61),(.029,.035,.035),"skin",group)
    for side in (-1,1):
        sphere(name+"_eye"+str(side),(x+side*.048,y-.105,1.65),(.013,.013,.014),"iron",group)
    box(name+"_scarf",(x,y-.159,1.36),(.065,.025,.22),"cream",group)
    if player:
        cylinder(name+"_hat_brim",(x,y,1.764),.19,.035,"navy",group,24)
        cylinder(name+"_hat_crown",(x,y,1.835),.125,.13,"navy",group,20,.105)
        box(name+"_satchel",(x+.22,y+.075,1.00),(.17,.22,.28),"wood",group)
    for obj_name in GROUPS[group]:
        obj=bpy.data.objects[obj_name]
        obj["actor_id"]=name
        if player:
            obj.location.z*=1.72/1.90
            obj.scale.z*=1.72/1.90
        obj.location.z+=.04


def tree(name,x,y):
    group="vegetation"
    cylinder(name+"_soil",(x,y,.05),.9,.12,"soil",group,18)
    rod(name+"_trunk",(x,y,.02),(x+.1,y,3.4),.17,"bark",group)
    for i in range(6):
        a=i*math.tau/6
        target=(x+math.cos(a)*.8,y+math.sin(a)*.8,3.4+RNG.random())
        rod(name+"_branch"+str(i),(x,y,2.3),target,.065,"bark",group)
        sphere(name+"_canopy"+str(i),target,(1.05,1.1,.9+RNG.random()*.35),"leaf"+str(i%3),group)
    sphere(name+"_crown",(x+.05,y,4.2),(1.1,1.05,1.15),"leaf1",group)


def light(name,kind,pos,target,energy,color,size):
    data=bpy.data.lights.new(name,kind)
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location=pos
    data.energy=energy
    data.color=color
    if kind=="AREA": data.shape="DISK"; data.size=size
    if kind=="POINT": data.shadow_soft_size=size
    if kind=="SUN": data.angle=size
    if target: obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    return obj


def ground(layout):
    box("north_land",(0,8,-.42),(72,40,.80),"grass","ground")
    box("south_land",(0,-23.3,-.42),(72,7.6,.80),"ground","ground")
    box("river_water",(0,-15.75,-.50),(78,7.5,.15),"water","water")
    # Quay masonry; real gap at the bridge, edge rails outside pedestrian space.
    for y in (-12.04,-19.50):
        box("quay_wall"+str(y),(0,y,-.72),(72,.65,1.5),"stone","ground")
        box("quay_cap"+str(y),(0,y,.05),(72,.92,.17),"trim","ground")
    pavement=[[],[],[]]
    for row in range(54):
        y=-11.35+row*.71
        for col in range(89):
            x=-35.2+col*.80+(row%2)*.4
            inside=any(abs(x-b["center"][0])<b["size"][0]/2+.35 and abs(y-b["center"][1])<b["size"][1]/2+.35 for b in layout["buildings"])
            if inside: continue
            paved=(y<15.5 or abs(y-19.2)<1.5 or abs(x+19)<2 or abs(x-19)<2)
            if not paved:continue
            pavement[(row+col)%3].append(((x,y,.015),(.77,.68,.05),0))
    for i,items in enumerate(pavement):
        batch_boxes("pavement"+str(i),items,"paver"+str(i),"ground")
    bridge=layout["bridge"]; x=bridge["x"]; mid=(bridge["yMin"]+bridge["yMax"])/2
    box("bridge_deck",(x,mid,.00),(bridge["width"],bridge["yMax"]-bridge["yMin"],.32),"stone","bridge")
    for side in (-1,1):
        xx=x+side*(bridge["width"]/2-.10)
        for i in range(12):
            yy=bridge["yMin"]+.2+i*.78
            box("bridge_baluster"+str(side)+str(i),(xx,yy,.54),(.15,.15,1.05),"stone","bridge")
        box("bridge_rail"+str(side),(xx,mid,1.10),(.23,bridge["yMax"]-bridge["yMin"],.15),"trim","bridge")
        # Two piers visibly support the deck; the main span remains navigable water.
        for yy in (-18.4,-13.1):
            box("bridge_pier"+str(side)+str(yy),(xx,yy,-.73),(.68,.85,1.50),"stone","bridge")
    # Quay railings intentionally leave the bridge approach open.
    for y in (-11.78,-19.78):
        for x in range(-35,36,2):
            if -2<=x<=5: continue
            rod("quay_post"+str(x)+str(y),(x,y,.1),(x,y,1.03),.035,"iron","quay")
            end=min(x+1.9,36)
            if -2<end<5:continue
            for z in (.58,1.02):
                rod("quay_rail"+str(x)+str(y)+str(z),(x,y,z),(end,y,z),.024,"iron","quay")


def dressing(layout):
    group="square"
    # Fountain is an actual recessed stone basin with a water surface.
    cylinder("fountain_plinth",(6,.3,.12),1.65,.20,"stone",group,32)
    sides=48
    verts=[(6+math.cos(i*math.tau/sides)*r,.3+math.sin(i*math.tau/sides)*r,z)
           for r,z in ((1.58,.20),(1.58,.58),(1.33,.58),(1.33,.20)) for i in range(sides)]
    faces=[]
    for ring in range(4):
        for i in range(sides):
            a=ring*sides+i;b=ring*sides+(i+1)%sides
            c=((ring+1)%4)*sides+(i+1)%sides;d=((ring+1)%4)*sides+i
            faces.append((a,b,c,d))
    mesh("fountain_basin",verts,faces,"stone",group)
    cylinder("fountain_water",(6,.3,.45),1.32,.025,"water",group,48)
    cylinder("fountain_column",(6,.3,1.0),.19,1.30,"stone",group,20,.13)
    cylinder("fountain_bowl",(6,.3,1.58),.60,.14,"stone",group,32)
    sphere("fountain_finial",(6,.3,1.83),(.14,.14,.22),"stone",group)
    for i,(x,y) in enumerate(((-14,3),(-7.0,3.0))):
        table("terrace_table"+str(i),x,y,"terrace")
        chair("terrace_chair"+str(i),x,y-.85,math.pi,group="terrace")
        chair("terrace_chair_b"+str(i),x+.8,y,-math.pi/2,group="terrace")
    for i,(x,y) in enumerate(((-17,-5),(19,3),(-3,2),(7,-9))):
        box("bench_seat"+str(i),(x,y,.48),(1.7,.45,.12),"wood","furniture")
        box("bench_back"+str(i),(x,y+.20,.83),(1.7,.10,.40),"wood","furniture")
        for dx in (-.65,.65):
            box("bench_foot"+str(i)+str(dx),(x+dx,y,.24),(.08,.42,.45),"iron","furniture")
    x,y=14,-6.5
    box("market_counter",(x,y,.66),(4.0,1.30,.85),"wood","market")
    for dx in (-1.9,1.9):
        for dy in (-.7,.7):
            rod("market_post"+str(dx)+str(dy),(x+dx,y+dy,.05),(x+dx,y+dy,2.9),.055,"wood","market")
    awning("market",x,y+.8,4.2,2.84,"rust")
    for i in range(40):
        sphere("market_fruit"+str(i),(x-1.7+(i%10)*.37,y-.38+(i//10)*.25,1.14),(.105,.105,.09),
               "rust" if i%3 else "ochre","market")
    for i,(x,y) in enumerate(layout["trees"]):tree("tree"+str(i),x,y)
    # Garden borders define the back street without filling it with furniture.
    for i,(x,y,w) in enumerate(((-27,21,10),(-9,27,10),(9,27,12),(26,22,9))):
        for j in range(round(w/.6)):
            xx=x-w/2+j*.6
            sphere("hedge"+str(i)+"_"+str(j),(xx,y,.53),(.4,.43,.52),"leaf0","vegetation")
    for i,(x,y) in enumerate(((-17,2),(19,5),(-5,-8),(10,-9),(-27,8),(29,7))):
        cylinder("lamp_base"+str(i),(x,y,.13),.22,.26,"iron","streetlamps",16)
        rod("lamp_post"+str(i),(x,y,.12),(x,y,3.0),.05,"iron","streetlamps")
        box("lamp_lantern"+str(i),(x,y,3.10),(.34,.34,.45),"lamp","streetlamps")
        cylinder("lamp_cap"+str(i),(x,y,3.39),.32,.19,"iron","streetlamps",4,.08)
    # Flower planters and original bicycle geometry at the station.
    for i,(x,y) in enumerate(((-15,6),(-5.5,6),(-4.2,7),(4.8,7),(8,6),(16,6))):
        box("planter"+str(i),(x,y,.24),(.9,.55,.43),"wood","plants")
        box("planter_soil"+str(i),(x,y,.46),(.80,.45,.035),"soil","plants")
        for j in range(5):
            sphere("planter_leaf"+str(i)+str(j),(x-.3+j*.15,y,.60),(.18,.20,.18),"leaf1","plants")
            sphere("planter_flower"+str(i)+str(j),(x-.3+j*.15,y,.77),(.06,.06,.055),"rust","plants")
    for i,x in enumerate((-25.5,-24.4)):
        wheel=cylinder("bicycle_wheel"+str(i),(x,9.0,.40),.35,.07,"iron","station",24)
        wheel.rotation_euler.x=math.pi/2
        hub=cylinder("bicycle_hub"+str(i),(x,8.95,.40),.29,.076,"cream","station",24)
        hub.rotation_euler.x=math.pi/2
    for a,b in (((-25.5,9,.4),(-25,9,1.0)),((-25,9,1),(-24.4,9,.4)),((-25.5,9,.4),(-24.7,9,.45)),
                ((-24.7,9,.45),(-25,9,1)),((-25,9,1),(-24.5,9,1)),((-24.5,9,1),(-24.4,9,.4))):
        rod("bicycle_frame"+str(a)+str(b),a,b,.023,"rust","station")


def camera(name, data):
    cam=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,cam)
    bpy.context.collection.objects.link(obj)
    obj.location=data["position"]
    obj.rotation_euler=(Vector(data["target"])-obj.location).to_track_quat("-Z","Y").to_euler()
    cam.clip_start=data.get("clipStart",.04);cam.clip_end=500
    if "ortho" in data:cam.type="ORTHO";cam.ortho_scale=data["ortho"]
    else:cam.lens=data["lens"]
    return obj


def setup_materials():
    colors={"sage":"929D83","ivory":"D8CEB4","stone":"AFA997","ochre":"C6A572","brick":"A47763",
            "trim":"D5C9AE","cream":"EFE0BC","navy":"354B5A","rust":"975542","wood":"705039",
            "door":"3A594D","shutters":"496658","floor":"AC9476","glass":"345363","iron":"343D3D",
            "brass":"B49A60","skin":"CBA584","trousers":"53514A","hair":"453B31","slate":"52616A",
            "slate0":"65707A","slate1":"5A6872","slate2":"4A5964","terracotta":"A3654F",
            "terracotta0":"B77F63","terracotta1":"A66E53","terracotta2":"BE876B","ground":"9B9982",
            "paver0":"B8B29E","paver1":"AEA995","paver2":"C2BBA8","soil":"645744","bark":"71614B","grass":"98A273",
            "leaf0":"697C4B","leaf1":"84915A","leaf2":"97A268","water":"486F72","canvas":"6D8972",
            "lamp":"F3D395","clay":"B4B0A7"}
    for key,color in colors.items():
        material(key,color,.30 if key in ("glass","water") else .72,.55 if key in ("brass","iron") else 0)
    bsdf=MATS["lamp"].node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Color"].default_value=MATS["lamp"].diffuse_color
    bsdf.inputs["Emission Strength"].default_value=.65


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--views",default="production,overview")
    parser.add_argument("--width",type=int,default=1440)
    parser.add_argument("--samples",type=int,default=32)
    parser.add_argument("--render-existing",action="store_true")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    layout_path=PACKAGE/"town-layout.json"
    layout=json.loads(layout_path.read_text(encoding="utf-8-sig"))
    inputs=[{"path":str(p.relative_to(ROOT)).replace("\\","/"),"sha256":sha(p)}
            for p in (Path(__file__),layout_path)]
    source=PACKAGE/"riverbend-town.blend"
    if args.render_existing:
        receipt=json.loads((PACKAGE/"authoring-receipt.json").read_text(encoding="utf-8"))
        if receipt["inputs"]!=inputs:raise RuntimeError("Authoring inputs changed; rebuild the source first")
        if sha(source)!=receipt["source"]["sha256"]:raise RuntimeError("Blender source hash changed")
        bpy.ops.wm.open_mainfile(filepath=str(source))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_materials()
        ground(layout)
        bounds=[]
        for b in layout["buildings"]:
            bounds.append(building(b))
            print("TOWN_BUILDING="+b["id"],flush=True)
        clocktower()
        dressing(layout)
        for actor in layout["residents"]:
            human(actor["id"],*actor["position"],actor["coat"])
        human("player",*layout["player"]["spawn"],"navy",True)
        world=bpy.data.worlds.new("Riverbend daylight")
        world.use_nodes=True
        world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.56,.69,.83,1)
        world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.45
        bpy.context.scene.world=world
        light("sun","SUN",(-25,-35,40),(0,0,0),3.0,(1,.91,.75),.13)
        light("sky_fill","AREA",(12,-8,28),(0,8,0),5500,(.72,.84,1),40)
        for name,data in layout["cameras"].items():camera(name,data)
        camera("plan-overhead",{"position":[0,.5,100],"target":[0,.5,0],"ortho":105})
        camera("plan-lower",{"position":[0,.5,100],"target":[0,.5,0],"ortho":105,"clipStart":98.7})
        camera("cafe-reflected-ceiling",{"position":[-10,10,-100],"target":[-10,10,3.04],"ortho":13.5,"clipStart":102.25})
        camera("square-elevation",{"position":[1,-100,7],"target":[1,12,7],"ortho":75})
        bpy.context.scene.camera=bpy.data.objects["production"]
        bpy.context.scene.unit_settings.system="METRIC"
        bpy.context.scene.unit_settings.scale_length=1
        bpy.context.preferences.filepaths.save_version=0
        bpy.context.scene["candidate_scope"]="art candidate; unbound residents; not a playable case"
        write(PACKAGE/"geometry-layout.json",{"schema":"riverbend-authored-geometry.v1","buildings":bounds,
              "openings":OPENINGS,"groups":{k:[n for n in names if n in bpy.data.objects] for k,names in GROUPS.items()}})
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    prefs=bpy.context.preferences.addons["cycles"].preferences
    devices=[]
    try:
        prefs.compute_device_type="OPTIX";prefs.get_devices()
        for d in prefs.devices:
            d.use=d.type=="OPTIX"
            if d.use:devices.append(d.name)
        scene.cycles.device="GPU" if devices else "CPU"
    except Exception:
        scene.cycles.device="CPU"
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=6
    scene.render.resolution_x=args.width
    scene.render.resolution_y=round(args.width*9/16)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGB"
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene.view_settings.exposure=.5
    if not args.render_existing:
        bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
        write(PACKAGE/"authoring-receipt.json",{"schema":"riverbend-authoring.v1","inputs":inputs,
              "source":{"path":source.name,"sha256":sha(source),"bytes":source.stat().st_size},
              "blenderVersion":bpy.app.version_string,"buildings":len(layout["buildings"]),
              "residentModels":len(layout["residents"]),"playerModel":True,
              "worldBoundResidents":False,"caseIntegrated":False,"humanArtAccepted":False})
    plan_views=["plan-overhead","plan-lower","cafe-reflected-ceiling","square-elevation"]
    required_views=list(layout["cameras"])+plan_views
    views=required_views if args.views=="all" else args.views.split(",")
    renders=[]
    previous=PACKAGE/"render-receipt.json"
    if previous.exists():
        old=json.loads(previous.read_text(encoding="utf-8"))
        if old["inputs"]==inputs:
            renders=[v for v in old["renders"] if v["view"] not in views]
    for view in views:
        if view not in bpy.data.objects:raise ValueError("Unknown camera "+view)
        scene.camera=bpy.data.objects[view]
        if view in plan_views:
            scene.view_layers[0].material_override=bpy.data.materials["clay"]
        target=PACKAGE/"renders"/(view+".png")
        scene.render.filepath=str(target)
        start=time.perf_counter()
        bpy.ops.render.render(write_still=True)
        scene.view_layers[0].material_override=None
        entry={"view":view,"path":str(target.relative_to(PACKAGE)).replace("\\","/"),"sha256":sha(target),
               "seconds":round(time.perf_counter()-start,2),"size":[args.width,scene.render.resolution_y]}
        renders.append(entry)
        write(previous,{"schema":"riverbend-render-suite.v1","inputs":inputs,"sourceSha256":sha(source),
              "engine":"Cycles","device":scene.cycles.device,"devices":devices,"samples":args.samples,
              "renders":renders,"requiredViews":required_views,
              "complete":set(required_views) <= {x["view"] for x in renders}})
        print("TOWN_RENDER="+json.dumps(entry),flush=True)
    print("TOWN_AUTHORING_COMPLETE="+str(source),flush=True)


if __name__=="__main__":
    main()
