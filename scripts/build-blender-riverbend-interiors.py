"""Original Riverbend interiors. Background Blender; existing town files are read only."""
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
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "docs/3d-town/riverbend-interiors-v1"
SOURCE = PACKAGE / "riverbend-interiors.blend"
HELPER = ROOT / "scripts/build-blender-riverbend-town.py"
BRIEF = PACKAGE / "room-brief.json"
spec = importlib.util.spec_from_file_location("town_geometry", HELPER)
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)

F = .21
H = 3.04
current = None
layer = "furniture"
prop = ""
roots = {}
openings = []
fixtures = []
contacts = []
seats = []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def register(obj, collision=False, support=None):
    obj.parent = current
    obj["roomId"] = current["roomId"]
    obj["roomLayer"] = layer
    obj["propId"] = prop or obj.name
    obj["collision"] = collision
    obj["origin"] = "project-local-original"
    if support:
        obj["support"] = support
        contacts.append({"object": obj.name, "support": support})
    return obj


def box(name, pos, size, mat, collision=False, bevel=0, support=None):
    obj = register(geo.box(current["roomId"]+"_"+name, pos, size, mat, current["roomId"]), collision, support)
    if bevel:
        obj.data = obj.data.copy()
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.select_set(False)
        modifier = obj.modifiers.new("small_authored_edge", "BEVEL")
        modifier.width = min(bevel, min(size)*.18)
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def cylinder(name, pos, radius, height, mat, collision=False, sides=20, top=None, support=None):
    return register(geo.cylinder(current["roomId"]+"_"+name, pos, radius, height, mat, current["roomId"], sides, top), collision, support)


def rod(name, start, end, radius, mat, collision=False):
    return register(geo.rod(current["roomId"]+"_"+name, start, end, radius, mat, current["roomId"]), collision)


def sphere(name, pos, scale, mat, collision=False):
    return register(geo.sphere(current["roomId"]+"_"+name, pos, scale, mat, current["roomId"]), collision)


def start_prop(name):
    global prop
    prop = name


def blank_paper(name, x, y, z, width=.30, depth=.22):
    start_prop(name)
    box(name, (x,y,z+.002), (width,depth,.004), "paper")
    # Non-semantic printed strokes. Discoverable text is supplied by the game.
    for i in range(3):
        box(name+"_ink"+str(i), (x-.02,y-depth*.25+i*.055,z+.0043), (width*.62,.009,.0006), "ink")


def mug(name, x, y, z):
    cylinder(name+"_saucer", (x,y,z+.012), .093,.024,"porcelain",sides=20)
    cylinder(name+"_cup", (x,y,z+.068), .062,.09,"porcelain",sides=20,top=.075)
    cylinder(name+"_coffee", (x,y,z+.114), .064,.003,"coffee",sides=20)
    bpy.ops.mesh.primitive_torus_add(major_radius=.037,minor_radius=.012,major_segments=12,minor_segments=6,location=(x+.080,y,z+.071),rotation=(math.pi/2,0,0))
    handle=bpy.context.object;handle.name=current["roomId"]+"_"+name+"_handle";handle.data.materials.append(geo.MATS["porcelain"]);register(handle)


def table(name, x, y, radius=.54):
    start_prop(name)
    cylinder(name+"_base",(x,y,F+.035),.28,.07,"iron",True,support="floor")
    cylinder(name+"_stem",(x,y,F+.40),.055,.70,"iron",True)
    cylinder(name+"_top",(x,y,F+.79),radius,.08,"wood",True,sides=32)
    cylinder(name+"_rim",(x,y,F+.832),radius+.007,.012,"wood-edge",True,sides=32)
    mug(name+"_service",x+.17,y-.10,F+.838)


def chair(name, x, y, focus):
    start_prop(name)
    before=set(bpy.data.objects.keys())
    box(name+"_seat",(x,y,F+.46),(.48,.47,.08),"wood",True,.02)
    for dx in (-.18,.18):
        for dy in (-.175,.175):
            box(name+"_leg"+str((dx,dy)),(x+dx,y+dy,F+.215),(.065,.065,.43),"wood",True,support="floor")
    for dx in (-.18,.18):
        box(name+"_back_post"+str(dx),(x+dx,y+.19,F+.72),(.06,.065,.54),"wood",True)
    for dz in (.73,.91):
        box(name+"_back_rail"+str(dz),(x,y+.19,F+dz),(.47,.065,.105),"wood",True,.01)
    angle=math.atan2(focus[0]-x, -(focus[1]-y))
    ca,sa=math.cos(angle),math.sin(angle)
    for obj in bpy.data.objects:
        if obj.name not in before:
            px,py=obj.location.x-x,obj.location.y-y
            obj.location.x=x+ca*px-sa*py;obj.location.y=y+sa*px+ca*py
            obj.rotation_euler.z+=angle
    seats.append({"roomId":current["roomId"],"propId":name,"center":[x,y],"front":[math.sin(angle),-math.cos(angle)],"focus":list(focus)})


def desk(name,x,y,width,depth,height=.82,mat="wood"):
    start_prop(name)
    box(name+"_top",(x,y,F+height),(width,depth,.10),mat,True,.025)
    for dx in (-width/2+.13,width/2-.13):
        for dy in (-depth/2+.11,depth/2-.11):
            box(name+"_leg"+str((dx,dy)),(x+dx,y+dy,F+(height-.05)/2),(.11,.11,height-.05),"wood",True,support="floor")
    box(name+"_apron",(x,y-depth/2+.065,F+height-.17),(width-.12,.09,.20),"wood-edge",True)
    return F+height+.05


def cabinet(name,x,y,width,depth,height,mat="wood",drawers=3):
    start_prop(name)
    box(name+"_base",(x,y,F+.065),(width-.08,depth-.04,.13),"wood-edge",True,support="floor")
    box(name+"_body",(x,y,F+height/2+.065),(width,depth,height-.13),mat,True,.012)
    box(name+"_top",(x,y,F+height-.02),(width+.035,depth+.03,.06),"wood-edge",True,.01)
    for i in range(drawers):
        z=F+.15+(i+.5)*(height-.21)/drawers
        box(name+"_drawer"+str(i),(x,y-depth/2-.009,z),(width-.12,.034,(height-.21)/drawers-.04),mat,True,.008)
        rod(name+"_pull"+str(i),(x-.08,y-depth/2-.046,z),(x+.08,y-depth/2-.046,z),.014,"brass")
    return F+height+.01


def framed_board(name,x,back_y,z,w,h,mat="ink"):
    start_prop(name)
    box(name+"_frame",(x,back_y-.045,z),(w,.09,h),"wood-edge",False,.015,support="back-wall")
    box(name+"_face",(x,back_y-.092,z),(w-.10,.008,h-.10),mat)
    return back_y-.099


def plant(name,x,y):
    start_prop(name)
    cylinder(name+"_pot",(x,y,F+.21),.22,.42,"terracotta",True,top=.29,support="floor")
    cylinder(name+"_soil",(x,y,F+.414),.263,.014,"coffee",True)
    for i in range(7):
        a=i*math.tau/7
        end=(x+math.cos(a)*.28,y+math.sin(a)*.28,F+.68+(i%3)*.12)
        rod(name+"_stem"+str(i),(x,y,F+.41),end,.012,"leaf")
        sphere(name+"_leaf"+str(i),end,(.14,.10,.18),"leaf",True)


def wall(name,pos,size,mat,cuts):
    obj=box(name,pos,size,mat,True)
    obj.data=obj.data.copy();bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.select_set(False)
    for opening in cuts:
        cutter=geo.box(name+"_cutter",opening["center"],opening["size"],"clay","cutters")
        cutter.data=cutter.data.copy();bpy.context.view_layer.objects.active=cutter
        cutter.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);cutter.select_set(False)
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new("opening_"+opening["id"],"BOOLEAN");mod.operation="DIFFERENCE";mod.solver="EXACT";mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        openings.append({**opening,"roomId":current["roomId"],"wallObject":obj.name,"method":"evaluated-Exact-Boolean"})
    obj["openingCount"]=len(cuts)
    return obj


def window_frame(name,center,width,height,axis="y"):
    x,y,z=center
    start_prop(name)
    before=set(bpy.data.objects.keys())
    for side in (-1,1):
        box(name+"_jamb"+str(side),(x+side*(width/2+.035),y,z),(.09,.41,height+.16),"trim")
    for side in (-1,1):
        box(name+"_rail"+str(side),(x,y,z+side*(height/2+.035)),(width+.18,.41,.09),"trim")
    box(name+"_mullion",(x,y-.018,z),(.045,.045,height),"trim")
    box(name+"_cross",(x,y-.018,z),(width,.045,.045),"trim")
    box(name+"_sill",(x,y,z-height/2-.05),(width+.22,.53,.07),"wood-edge")
    box(name+"_frosted_pane",(x,y+.035,z),(width-.01,.018,height-.01),"glass")
    if axis=="x":
        for obj in bpy.data.objects:
            if obj.name not in before:
                dx,dy=obj.location.x-x,obj.location.y-y
                obj.location.x=x-dy;obj.location.y=y+dx;obj.rotation_euler.z+=math.pi/2


def shell(room):
    global layer,prop
    rid=room["id"];w,d=room["size"];by=d/2-.16;fy=-d/2
    layer="floor";start_prop("floor")
    box("floor_substrate",(0,0,F-.101),(w+.32,d+.32,.20),"floor-base")
    box("entrance_apron",(0,fy-.52,F-.065),(2.15,1.2,.13),"stone")
    entries={mat:[] for mat in ("floor-light","floor-mid","floor-dark")}
    if room["floor"]=="tile":
        nx,ny=math.ceil((w-.32)/.48),math.ceil((d-.32)/.48)
        sx,sy=(w-.32)/nx,(d-.32)/ny
        for ix in range(nx):
            for iy in range(ny):
                mat="floor-dark" if ix%4==0 and iy%4==0 else "floor-mid" if (ix+iy)%2 else "floor-light"
                entries[mat].append(((-w/2+.16+(ix+.5)*sx,-d/2+.16+(iy+.5)*sy,F-.006),(sx-.007,sy-.007,.012),0))
    else:
        rng=random.Random(31 if rid=="books" else 41)
        nx,ny=math.ceil((w-.32)/.21),5;sx,sy=(w-.32)/nx,(d-.32)/ny
        for ix in range(nx):
            for iy in range(ny):
                entries[rng.choice(("floor-light","floor-mid","floor-mid","floor-dark"))].append(((-w/2+.16+(ix+.5)*sx,-d/2+.16+(iy+.5)*sy,F-.006),(sx-.006,sy-.008,.012),0))
    for mat,tiles in entries.items():
        obj=geo.batch_boxes(rid+"_"+mat,tiles,mat,rid);register(obj)
    layer="shell-south";start_prop("front-wall")
    front_cuts=[{"id":"door","kind":"door","center":[0,fy,1.51],"size":[1.5,.8,2.7],"destination":"street","thresholdZ":F}]
    front_cuts += [{"id":"front-window-"+str(s),"kind":"window","center":[s*w*.31,fy,1.77],"size":[1.62,.8,1.60],"destination":"daylight-glazing"} for s in (-1,1)]
    wall("wall_south",(0,fy,(H+F-.02)/2),(w,.32,H-F+.02),rid+"-plaster",front_cuts)
    for side in (-1,1):
        window_frame("front_window"+str(side),(side*w*.31,fy,1.77),1.62,1.6)
        bx=side*(w/4+.39)
        box("front_skirting"+str(side),(bx,fy+.177,F+.09),(w/2-.77,.065,.18),"wood-edge",True)
        box("door_jamb"+str(side),(side*.81,fy,F+1.32),(.12,.44,2.74),"trim",True)
    box("door_header",(0,fy,2.91),(1.8,.44,.13),"trim")
    layer="shell-west";start_prop("west-wall")
    west_cuts=[{"id":"west-window-"+str(s),"kind":"window","center":[-w/2,s*d*.25,1.8],"size":[.8,1.48,1.50],"destination":"daylight-glazing"} for s in (-1,1)]
    wall("wall_west",(-w/2,0,(H+F-.02)/2),(.32,d+.32,H-F+.02),rid+"-plaster",west_cuts)
    layer="shell-east";start_prop("east-wall")
    east_cuts=[{"id":"east-window-"+str(s),"kind":"window","center":[w/2,s*d*.25,1.8],"size":[.8,1.48,1.50],"destination":"daylight-glazing"} for s in (-1,1)]
    wall("wall_east",(w/2,0,(H+F-.02)/2),(.32,d+.32,H-F+.02),rid+"-plaster",east_cuts)
    for side in (-1,1):
        layer="shell-west" if side==-1 else "shell-east"
        for s in (-1,1):window_frame("side_window"+str((side,s)),(side*w/2,s*d*.25,1.8),1.48,1.50,"x")
        box("side_wainscot"+str(side),(side*(w/2-.18),0,F+.38),(.045,d-.25,.76),rid+"-paint",True)
        box("side_chair_rail"+str(side),(side*(w/2-.19),0,F+.79),(.07,d-.25,.08),"wood-edge",True)
        box("side_skirting"+str(side),(side*(w/2-.175),0,F+.085),(.09,d-.20,.17),"wood-edge",True)
    layer="shell-north";start_prop("back-wall")
    wall("wall_north",(0,d/2,(H+F-.02)/2),(w,.32,H-F+.02),rid+"-plaster",[])
    box("back_wainscot",(0,by-.02,F+.40),(w-.30,.045,.80),rid+"-paint",True)
    box("back_chair_rail",(0,by-.04,F+.82),(w-.26,.085,.08),"wood-edge",True)
    box("back_skirting",(0,by-.023,F+.085),(w-.26,.09,.17),"wood-edge",True)
    layer="ceiling";start_prop("ceiling")
    box("ceiling_slab",(0,0,H+.08),(w+.32,d+.32,.16),"ceiling")
    for x in (-w*.27,w*.27):
        box("ceiling_beam"+str(x),(x,0,H-.07),(.14,d-.30,.14),"wood-edge")
    for i,(x,y) in enumerate(((-w*.21,-.65),(w*.21,1.15))):
        start_prop("pendant-"+str(i))
        cylinder("pendant_rose"+str(i),(x,y,H-.024),.12,.048,"brass",support="ceiling")
        rod("pendant_wire"+str(i),(x,y,H-.024),(x,y,2.54),.009,"iron")
        cylinder("pendant_shade"+str(i),(x,y,2.47),.27,.18,"brass",top=.13)
        cylinder("pendant_diffuser"+str(i),(x,y,2.375),.22,.014,"lamp")
        fixture={"id":rid+"-pendant-"+str(i),"roomId":rid,"type":"POINT","position":[x,y,2.34],"color":[1,.83,.62],"blenderWatts":70,"runtimeCandela":55,"radius":.28}
        fixtures.append(fixture)
        light=bpy.data.lights.new(fixture["id"],"POINT");light.energy=fixture["blenderWatts"];light.color=fixture["color"];light.shadow_soft_size=fixture["radius"]
        obj=bpy.data.objects.new(fixture["id"],light);bpy.context.collection.objects.link(obj);obj.location=fixture["position"];register(obj)
    layer="furniture";start_prop("open-door")
    door_parts=[]
    door_parts.append(box("open_door_leaf",(.705,0,F+1.30),(1.41,.10,2.60),rid+"-paint",True,.012))
    for z in (F+.55,F+1.18):door_parts.append(box("open_door_panel"+str(z),(.705,-.056,z),(1.17,.025,.38),"wood-edge",True,.01))
    door_parts.append(sphere("open_door_handle",(1.20,-.085,F+1.10),(.045,.06,.045),"brass",True))
    a=math.radians(102)
    for obj in door_parts:
        x,y=obj.location.x,obj.location.y
        obj.location.x=-.705+math.cos(a)*x-math.sin(a)*y
        obj.location.y=fy+.01+math.sin(a)*x+math.cos(a)*y
        obj.rotation_euler.z+=a
    prop=""


def cafe(room):
    start_prop("service-counter")
    box("counter_base",(-.65,1.30,F+.48),(5.4,.90,.96),"cafe-paint",True,.018,support="floor")
    for i in range(6):
        box("counter_inset"+str(i),(-2.9+i*.90,.837,F+.52),(.73,.027,.67),"wood-edge",True,.008)
    box("countertop",(-.65,1.30,F+1.00),(5.56,1.04,.10),"stone",True,.022)
    for i,x in enumerate((-2.35,-1.58)):
        start_prop("coffee-urn-"+str(i))
        cylinder("urn_foot"+str(i),(x,1.39,F+1.12),.22,.13,"iron")
        cylinder("urn_body"+str(i),(x,1.39,F+1.43),.21,.48,"brass",sides=24)
        cylinder("urn_lid"+str(i),(x,1.39,F+1.69),.24,.065,"brass",sides=24,top=.11)
        sphere("urn_knob"+str(i),(x,1.39,F+1.755),(.045,.045,.035),"wood-edge")
        rod("urn_tap"+str(i),(x,1.16,F+1.29),(x,1.03,F+1.24),.025,"brass")
    for i,x in enumerate((-.2,.2,.6)):mug("counter_cup"+str(i),x,1.2,F+1.05)
    back=room["size"][1]/2-.16
    face=framed_board("menu_board",-.70,back,2.25,2.0,1.05)
    for i in range(4):
        box("menu_chalk"+str(i),(-.82,face-.002,2.56-i*.18),(.86-i*.07,.004,.018),"paper")
    for x in (-2.65,1.40):
        start_prop("wall-shelf-"+str(x))
        box("shelf"+str(x),(x,back-.20,2.13),(1.0,.40,.07),"wood",False,support="back-wall")
        for dx in (-.35,.35):rod("shelf_brace"+str((x,dx)),(x+dx,back-.02,1.88),(x+dx,back-.33,2.095),.02,"iron")
        for i in range(3):cylinder("canister"+str((x,i)),(x-.31+i*.31,back-.20,2.30),.095,.27,"porcelain")
    table("breakfast_table",-2.65,-1.02)
    chair("breakfast_chair_w",-3.43,-1.02,(-2.65,-1.02));chair("breakfast_chair_e",-1.87,-1.02,(-2.65,-1.02))
    blank_paper("breakfast_note",-2.87,-.96,F+.839)
    table("window_table",2.67,-.55)
    chair("window_chair_s",2.67,-1.34,(2.67,-.55));chair("window_chair_n",2.67,.24,(2.67,-.55))
    plant("entrance_plant",3.70,-2.84)


def books(room):
    rng=random.Random(214);back=room["size"][1]/2-.16
    start_prop("back-bookcase")
    box("bookcase_back",(0,back-.13,F+1.2),(5.9,.18,2.4),"wood",True,support="floor")
    for x in (-3,-1,1,3):box("bookcase_upright"+str(x),(x,back-.34,F+1.2),(.12,.56,2.4),"wood-edge",True,support="floor")
    for row in range(5):
        z=F+.12+row*.47
        box("bookcase_shelf"+str(row),(0,back-.33,z),(6.08,.59,.065),"wood",True)
        for i in range(31):
            x=-2.84+i*.184;height=rng.uniform(.23,.36);width=rng.uniform(.085,.145)
            box("book"+str((row,i)),(x,back-.31,z+.0325+height/2),(width,.26,height),rng.choice(("book-rust","book-sage","book-navy","paper")),True)
    cabinet("west_catalog",-2.92,1.10,.85,.65,.75,"wood",5)
    z=desk("repair_table",1.38,1.22,2.25,1.22,.81)
    start_prop("repair-mat");box("repair_mat",(1.38,1.22,z+.004),(1.45,.74,.008),"cloth")
    blank_paper("repair_sheet",1.27,1.15,z+.009,.48,.34)
    start_prop("binding-press")
    box("press_lower",(2.10,1.32,z+.055),(.57,.40,.10),"wood-edge")
    for x in (1.88,2.32):rod("press_screw"+str(x),(x,1.32,z+.09),(x,1.32,z+.46),.023,"iron")
    box("press_upper",(2.10,1.32,z+.32),(.63,.40,.09),"wood")
    rod("press_handle",(1.89,1.32,z+.49),(2.31,1.32,z+.49),.022,"wood-edge")
    start_prop("repair-tools")
    cylinder("brush_jar",(.55,1.55,z+.10),.075,.2,"porcelain")
    for i in range(3):rod("brush"+str(i),(.51+i*.035,1.55,z+.06),(.49+i*.046,1.55,z+.34),.009,"wood")
    chair("repair_chair",1.32,2.08,(1.32,1.22))
    start_prop("exhibition-case")
    box("exhibit_base",(-1.8,-.65,F+.35),(1.80,.98,.70),"wood",True,.018,support="floor")
    box("exhibit_lip",(-1.8,-.65,F+.73),(1.91,1.08,.08),"wood-edge",True,.015)
    box("exhibit_felt",(-1.8,-.65,F+.779),(1.74,.91,.016),"cloth",True)
    for x in (-2.65,-.95):
        for y in (-1.07,-.23):cylinder("map_weight"+str((x,y)),(x,y,F+.802),.036,.03,"brass")
    cabinet("document_box",-2.91,-2.70,.72,.55,.64,"book-rust",2)
    plant("bookshop_plant",2.90,-2.75)


def police(room):
    back=room["size"][1]/2-.16
    cabinet("archive_cabinet",-2.72,back-.38,2.08,.68,1.84,"police-paint",5)
    z=desk("reception_desk",-1.73,.03,2.20,1.15,.79)
    chair("desk_chair",-1.73,1.02,(-1.73,.03))
    start_prop("desk-set")
    box("desk_pad",(-1.77,.02,z+.004),(1.04,.65,.008),"cloth")
    blank_paper("visitor_register",-1.70,-.02,z+.009,.46,.32)
    start_prop("ink-set");cylinder("ink_bottle",(-2.43,.17,z+.07),.055,.14,"ink");rod("pen",(-2.43,.17,z+.13),(-2.40,.17,z+.36),.007,"wood")
    wz=desk("clock_bench",1.84,2.07,2.86,.95,.86)
    start_prop("clock-movement")
    box("clock_cradle",(1.33,2.03,wz+.08),(.90,.43,.16),"wood-edge")
    dial=cylinder("clock_dial",(1.33,2.16,wz+.53),.37,.07,"porcelain",sides=40);dial.rotation_euler.x=math.pi/2
    rim=cylinder("clock_backplate",(1.33,2.19,wz+.53),.405,.055,"brass",sides=40);rim.rotation_euler.x=math.pi/2
    for i in range(12):
        a=i*math.tau/12
        mark=box("clock_index"+str(i),(1.33+math.sin(a)*.292,2.115,wz+.53+math.cos(a)*.292),(.022,.01,.056),"ink");mark.rotation_euler.y=a
    # Detached hands communicate a stopped repair object, not the current time.
    rod("detached_hand_a",(2.18,1.92,wz+.016),(2.40,1.92,wz+.016),.012,"iron")
    rod("detached_hand_b",(2.18,2.02,wz+.016),(2.32,2.08,wz+.016),.012,"iron")
    blank_paper("inspection_record",2.66,2.02,wz,.38,.28)
    face=framed_board("notice_board",1.64,back,2.20,2.70,1.20,"cloth")
    for i,(x,z) in enumerate(((.83,2.40),(1.6,2.34),(2.35,2.36),(1.10,1.94),(2.09,1.96))):
        box("notice_sheet"+str(i),(x,face-.006,z),(.47,.012,.30),"paper")
        sphere("notice_pin"+str(i),(x,face-.019,z+.11),(.021,.012,.021),"brass")
    start_prop("visitor-bench")
    box("bench_seat",(-2.72,-2.0,F+.46),(2.00,.52,.10),"wood",True,.025)
    box("bench_back",(-2.72,-2.22,F+.80),(2.00,.075,.49),"wood",True,.012)
    for x in (-3.48,-1.96):box("bench_leg"+str(x),(x,-2.0,F+.215),(.10,.43,.43),"wood-edge",True,support="floor")
    plant("office_plant",3.50,-2.83)


def create_camera(name, pos, target, orthographic=None, lens=24):
    camera=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,camera);bpy.context.collection.objects.link(obj)
    obj.location=pos;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    if orthographic:camera.type="ORTHO";camera.ortho_scale=orthographic
    else:camera.lens=lens
    camera.clip_start=.03;camera.clip_end=250
    return obj


def cameras(room,offset):
    w,d=room["size"];rid=room["id"]
    def cam(key,pos,target,ortho=None,lens=24):
        p=Vector(pos)+offset;t=Vector(target)+offset
        obj=create_camera(rid+"-"+key,p,t,ortho,lens);obj["roomId"]=rid;obj["reviewView"]=key
    cam("production",(10,-15,18),(0,0,.8),max(w*1.48,d*2.0))
    for name,x,y in (("sw",-1,-1),("se",1,-1),("ne",1,1),("nw",-1,1)):
        cam("corner-"+name,(x*(w/2-.42),y*(d/2-.42),1.58),(-x*.4,-y*.4,1.50),lens=10.3923)
    cam("low-entry",(0,-d/2-.57,1.56),(0,1.05,1.42),lens=18)
    cam("ceiling-up",(0,0,.42),(0,0,H),lens=7.5)
    cam("ceiling-oblique-a",(-w/2+.50,-d/2+.50,1.18),(w*.22,d*.18,2.78),lens=13)
    cam("ceiling-oblique-b",(w/2-.50,d/2-.50,1.18),(-w*.22,-d*.18,2.78),lens=13)
    cam("plan-floor",(0,0,20),(0,0,0),max(w+1.1,(d+2.1)*16/9))
    cam("plan-ceiling",(0,0,20),(0,0,0),max(w+1.1,(d+2.1)*16/9))


def configure(samples,width):
    scene=bpy.context.scene;scene.render.engine="CYCLES";devices=[]
    try:
        prefs=bpy.context.preferences.addons["cycles"].preferences;prefs.compute_device_type="OPTIX";prefs.get_devices()
        for device in prefs.devices:device.use=device.type=="OPTIX";devices.extend([device.name] if device.use else [])
        scene.cycles.device="GPU" if devices else "CPU"
    except Exception:scene.cycles.device="CPU"
    scene.cycles.samples=samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=width;scene.render.resolution_y=round(width*9/16);scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGB"
    scene.view_settings.view_transform="AgX"
    return devices


def build(brief):
    global current,layer,prop
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name,color in {"wood":"A37B51","wood-edge":"705437","trim":"E5DCC9","stone":"B6AC93","brass":"B89352","iron":"3B4745","porcelain":"E9E1CB","paper":"EADDBB","ink":"3F4E49","coffee":"4A3C2F","leaf":"728560","terracotta":"A66E52","cloth":"7D8A73","book-rust":"A26C55","book-sage":"89916B","book-navy":"60757D","floor-base":"827964","floor-light":"CDBB95","floor-mid":"B6A078","floor-dark":"83907B","ceiling":"EBE2CD","lamp":"F1DCA4","glass":"C5D8CE","clay":"AAAAAA"}.items():
        geo.material(name,color,.65 if name not in ("brass","glass","porcelain") else .32, .65 if name=="brass" else .0)
    lamp=geo.MATS["lamp"].node_tree.nodes.get("Principled BSDF");lamp.inputs["Emission Color"].default_value=(1,.74,.35,1);lamp.inputs["Emission Strength"].default_value=.7
    glass=geo.MATS["glass"].node_tree.nodes.get("Principled BSDF");glass.inputs["Transmission Weight"].default_value=.68;glass.inputs["Roughness"].default_value=.35
    world=bpy.data.worlds.new("Riverbend daylight");world.use_nodes=True;world.node_tree.nodes["Background"].inputs[0].default_value=(.60,.69,.75,1);world.node_tree.nodes["Background"].inputs[1].default_value=.45;bpy.context.scene.world=world
    sun=bpy.data.lights.new("morning_daylight","SUN");sun.energy=1.7;sun.angle=.18
    sunlight=bpy.data.objects.new("morning_daylight",sun);bpy.context.collection.objects.link(sunlight);sunlight.rotation_euler=(math.radians(26),math.radians(-25),math.radians(-20))
    for index,room in enumerate(brief["rooms"]):
        rid=room["id"];geo.material(rid+"-plaster",room["wallColor"],.86);geo.material(rid+"-paint",room["wainscotColor"],.72)
        current=bpy.data.objects.new("interior_"+rid,None);bpy.context.collection.objects.link(current);current["roomId"]=rid;current["origin"]="project-local-original";roots[rid]=current
        shell(room);layer="furniture";prop=""
        {"cafe":cafe,"books":books,"police":police}[rid](room)
        current.location=(index*18,0,0)
        cameras(room,current.location.copy())
    bpy.context.scene.unit_settings.system="METRIC"
    bpy.context.scene["candidate_scope"]="Original interior art and collision geometry. Room placement is a review arrangement; no private case facts or resident schedules."
    bpy.context.view_layer.update()


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--render-existing",action="store_true");parser.add_argument("--rooms",default="all");parser.add_argument("--views",default="production");parser.add_argument("--samples",type=int,default=40);parser.add_argument("--width",type=int,default=1440)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    brief=json.loads(BRIEF.read_text(encoding="utf-8"));base=ROOT/"docs/3d-town/riverbend-v1/riverbend-town.blend"
    assert sha(base)==brief["baseTownSourceSha256"]
    inputs=[{"path":str(p.relative_to(ROOT)).replace("\\","/"),"sha256":sha(p)} for p in (Path(__file__),HELPER,BRIEF)]
    if args.render_existing:
        author=json.loads((PACKAGE/"authoring-receipt.json").read_text(encoding="utf-8"));assert author["inputs"]==inputs and sha(SOURCE)==author["source"]["sha256"]
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        build(brief);configure(args.samples,args.width);bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        write(PACKAGE/"openings.json",{"schema":"riverbend-interior-openings.v1","openings":openings})
        write(PACKAGE/"lighting.json",{"schema":"riverbend-interior-lighting.v1","units":"authoring watts and calibrated runtime candela recorded explicitly; no photometric equivalence claimed","fixtures":fixtures})
        write(PACKAGE/"placements.json",{"schema":"riverbend-interior-placements.v1","contacts":contacts,"seats":seats})
        meshes=[o for o in bpy.data.objects if o.type=="MESH"]
        write(PACKAGE/"authoring-receipt.json",{"schema":"riverbend-interior-authoring.v1","inputs":inputs,"source":{"path":SOURCE.name,"sha256":sha(SOURCE),"bytes":SOURCE.stat().st_size},"blenderVersion":bpy.app.version_string,"sourceMeshes":len(meshes),"baseUnchanged":sha(base)==brief["baseTownSourceSha256"],"humanArtAccepted":False,"outputs":{p:sha(PACKAGE/p) for p in ("openings.json","lighting.json","placements.json")}})
    devices=configure(args.samples,args.width)
    rooms=brief["rooms"] if args.rooms=="all" else [r for r in brief["rooms"] if r["id"] in args.rooms.split(",")]
    views=brief["requiredViews"] if args.views=="all" else args.views.split(",")
    receipt=PACKAGE/"render-receipt.json";renders=[]
    if receipt.exists():
        previous=json.loads(receipt.read_text(encoding="utf-8"))
        if previous["sourceSha256"]==sha(SOURCE) and previous["inputs"]==inputs:
            renders=[r for r in previous["renders"] if (r["roomId"],r["view"]) not in [(room["id"],view) for room in rooms for view in views]]
    (PACKAGE/"renders").mkdir(exist_ok=True)
    clay=geo.MATS.get("clay") or bpy.data.materials["clay"]
    for room in rooms:
        rid=room["id"]
        for view in views:
            assert view in brief["requiredViews"]
            for obj in bpy.data.objects:
                if "roomId" not in obj or obj.type=="CAMERA":continue
                obj.hide_render=obj["roomId"]!=rid
                if obj["roomId"]==rid:
                    lay=obj.get("roomLayer","")
                    obj.visible_camera=not(view=="production" and lay in brief["camera"]["cutawayLayers"])
                    if view=="plan-floor":obj.hide_render=lay=="ceiling"
                    if view=="plan-ceiling":obj.hide_render=lay!="ceiling" or "ceiling_slab" in obj.name
            scene=bpy.context.scene;scene.camera=bpy.data.objects[rid+"-"+view]
            scene.view_layers[0].material_override=clay if view.startswith("plan-") else None
            output=PACKAGE/"renders"/(rid+"-"+view+".png");scene.render.filepath=str(output);started=time.perf_counter();bpy.ops.render.render(write_still=True)
            entry={"roomId":rid,"view":view,"path":"renders/"+output.name,"sha256":sha(output),"size":[scene.render.resolution_x,scene.render.resolution_y],"seconds":round(time.perf_counter()-started,2),"shellMode":"camera-cutaway-shadow-preserved" if view=="production" else "orthographic-geometry-plan" if view.startswith("plan-") else "complete-shell"}
            renders.append(entry)
            required={(r["id"],v) for r in brief["rooms"] for v in brief["requiredViews"]}
            write(receipt,{"schema":"riverbend-interior-renders.v1","sourceSha256":sha(SOURCE),"inputs":inputs,"engine":"Cycles","samples":args.samples,"device":scene.cycles.device,"devices":devices,"renders":renders,"requiredViews":brief["requiredViews"],"complete":required<={(r["roomId"],r["view"]) for r in renders}})
            print("INTERIOR_RENDER="+json.dumps(entry),flush=True)
    print("INTERIOR_SOURCE="+str(SOURCE),flush=True)


if __name__=="__main__":main()
