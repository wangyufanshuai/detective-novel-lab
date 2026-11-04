"""Original station waiting/booking hall added to the protected two-room source."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,math,random,sys,time
import bpy
from mathutils import Vector,Matrix

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-bookshop-v1';PACKAGE=ROOT/'docs/3d-town/classic-station-v1';SOURCE=PACKAGE/'classic-station.blend'
spec=importlib.util.spec_from_file_location('shop_geometry',ROOT/'scripts/build-blender-classic-bookshop.py');shop=importlib.util.module_from_spec(spec);spec.loader.exec_module(shop)
u=shop.u;room=shop.room;F=.18;RNG=random.Random(193412)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def arch_profile(x,bottom,width,height):
    radius=width/2;spring=bottom+height-radius
    return [(x-radius,bottom),(x+radius,bottom)]+[(x+radius*math.cos(a),spring+radius*math.sin(a)) for a in [i*math.pi/20 for i in range(21)]]

def extruded_profile(name,profile,y,depth,mat):
    n=len(profile);verts=[(x,yy,z) for yy in (y-depth/2,y+depth/2) for x,z in profile]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return u.mesh(name,verts,faces,mat)

def arch_openings():
    u.LAY='station_front';wall=u.box('station_front_wall',(-12.65,.30,F+1.85),(10.76,.36,3.70),'brick',0)
    for oid,x,sill,width,height in [('station-window-west',-15.95,.62,1.95,2.37),('station-window-middle',-12.95,.62,1.95,2.37),('station-entry',-9.05,0,1.60,3.01)]:
        cut=extruded_profile(oid+'_cutter',arch_profile(x,F+sill,width,height),.30,1.25,'stone')
        mod=wall.modifiers.new(oid,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut;bpy.context.view_layer.objects.active=wall;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
        entry=u.opening(oid,x,.30,sill,width,height,'door' if sill==0 else 'window',destination='Connected waiting hall' if sill==0 else 'Exterior daylight through an arched aperture')
        u.OPENINGS.append(dict(entry,wall=wall.name,wallThickness=.36,booleanApplied=True,profile='semicircular arch',walkableClearHeight=height-width/2 if sill==0 else None))
        radius=width/2;spring=F+sill+height-radius
        # Individual radial masonry pieces and vertical jamb stones express real depth.
        for k in range(17):
            a=k*math.pi/17+.008;b=(k+1)*math.pi/17-.008
            profile=[(x+r*math.cos(t),spring+r*math.sin(t)) for r,t in [(radius,a),(radius,b),(radius+.19,b),(radius+.19,a)]]
            stone=extruded_profile(oid+'_arch_stone',profile,.064,.21,'stone');u.bevel(stone,.006,1)
        for sign in (-1,1):
            h=spring-(F+sill)
            for k in range(5):u.box(oid+'_jamb',(x+sign*(radius+.095),.064,F+sill+(k+.5)*h/5),(.19,.22,h/5-.012),'stone',.005)
        if sill>0:
            u.box(oid+'_sill',(x,-.04,F+sill-.047),(width+.47,.38,.095),'stone',.006)
            glass=extruded_profile(oid+'_glass',arch_profile(x,F+sill+.035,width-.07,height-.055),.31,.018,'glass')
            for sign in (-1,1):u.box(oid+'_upright',(x+sign*(radius-.037),.268,(F+sill+spring)/2),(.065,.08,spring-F-sill),'station_paint',.004)
            arc=u.tube(oid+'_arched_sash',[(x+(radius-.037)*math.cos(k*math.pi/20),.268,spring+(radius-.037)*math.sin(k*math.pi/20)) for k in range(21)],.033,'station_paint');arc.data.resolution_u=2
            for z in (F+sill+.035,F+sill+.91,spring):u.box(oid+'_transom',(x,.268,z),(width-.08,.085,.057),'station_paint',.003)
            u.box(oid+'_mullion',(x,.268,F+sill+(height-.025)/2),(.055,.085,height-.055),'station_paint',.003)
    u.bevel(wall,.007,2);wall['structuralShell']=True
    # Door leaves are open against each jamb, with transom glazing above.
    for sign in (-1,1):
        x=-9.05+sign*.775
        u.box('station_door_bottom',(x,.86,F+.53),(.065,.98,1.06),'station_paint',.008)
        for y in (.415,1.305):u.box('station_door_stile',(x,y,F+1.59),(.065,.09,1.06),'station_paint',.005)
        for z in (1.105,2.095):u.box('station_door_rail',(x,.86,F+z),(.065,.80,.09),'station_paint',.005)
        u.box('station_door_field',(x-sign*.038,.86,F+.51),(.018,.74,.66),'dark_emerald',.005)
        u.box('station_door_glass',(x,.86,F+1.60),(.023,.80,.90),'glass',0)
        u.sphere('station_door_handle',(x-sign*.071,1.20,F+.99),(.020,.020,.035),'worn_bronze',16)
        # Include the inward handle, not just the timber leaf, in navigation.
        u.rect('station-door-leaf-'+str(sign),x,.86,.20,.98)
    transom=arch_profile(-9.05,F+2.18,1.53,.83)
    extruded_profile('station_door_transom',transom,.30,.018,'glass')
    u.box('station_name_board',(-12.67,.075,F+3.38),(5.4,.08,.38),'station_paint',.008)
    shop.label('station_name','RIVERBEND',(-12.67,.028,F+3.38),4.8,'board_letters')
    for x in (-17.36,-10.56,-7.77):u.lantern('station_facade_lamp_'+str(x),x,.08,F+2.02)
    u.rect('station-front-left',(-18.03-9.85)/2,.30,8.18,.36);u.rect('station-front-right',(-8.25-7.27)/2,.30,.98,.36)


def shell():
    arch_openings()
    for x in (-17.85,-7.45):
        u.LAY='station_shell' if x< -10 else 'station_side_cutaway'
        u.wall('station_side_'+str(x),(x,3.32,F+1.85),(.34,6.40,3.70),'plaster',[]);u.rect('station-side-'+str(x),x,3.32,.34,6.40)
        for z,h in ((.11,.22),(.99,.055)):u.box('station_side_trim',(x+(.18 if x< -10 else -.18),3.31,F+z),(.045,6.0,h),'station_paint',.005)
    u.LAY='station_shell';u.wall('station_rear_wall',(-12.65,6.34,F+1.85),(10.76,.34,3.70),'plaster',[]);u.rect('station-rear',-12.65,6.34,10.76,.34)
    u.box('station_rear_skirt',(-12.65,6.142,F+.11),(10.08,.055,.22),'station_paint',.006)
    u.LAY='station_interior';u.box('station_floor_substrate',(-12.65,3.33,F-.082),(10.40,6.08,.12),'station_tile_cream',0)
    buckets={'station_tile_cream':[],'station_tile_dark':[],'station_tile_border':[]}
    for i in range(28):
        x0=-17.68+i*(10.06/28)
        for j in range(16):
            y0=.48+j*(5.69/16);mat='station_tile_border' if i in (0,27) or j in (0,15) else ('station_tile_dark' if (i+j)%2 else 'station_tile_cream')
            buckets[mat].append((((x0+10.06/56),y0+5.69/32,F-.008),(10.06/28-.003,5.69/16-.003,.016),0))
    for mat,tiles in buckets.items():u.batch_boxes('station_floor_'+mat,tiles,mat,0)
    u.LAY='station_ceiling';u.box('station_ceiling',(-12.65,3.33,F+3.66),(10.72,6.37,.12),'ceiling',0)
    for y in (.56,6.08):u.box('station_long_cornice',(-12.65,y,F+3.535),(10.03,.12,.13),'ivory',.015)
    for x in (-17.57,-7.74):u.box('station_short_cornice',(x,3.32,F+3.535),(.12,5.55,.13),'ivory',.015)
    for x in (-15.25,-10.14):
        u.box('station_ceiling_beam',(x,3.32,F+3.50),(.14,5.6,.17),'aged_walnut',.008)
        for y in (.71,5.91):u.tube('station_beam_bracket',[(x,y,F+3.12),(x,y+(.4 if y<3 else -.4),F+3.50)],.033,'worn_bronze')
    u.LAY='station_roof'
    verts=[(-18.22,-.14,F+3.82),(-7.08,-.14,F+3.82),(-7.08,6.80,F+3.82),(-18.22,6.80,F+3.82),(-18.22,3.33,F+5.52),(-7.08,3.33,F+5.52)]
    u.mesh('station_gabled_roof',verts,[(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)],'slate')
    u.roof_courses('station_slate_courses',-18.22,-7.08,-.14,6.80,F+3.82,F+5.52)
    u.tube('station_ridge',[(-18.24,3.33,F+5.55),(-7.06,3.33,F+5.55)],.065,'slate')
    for y in (-.14,6.80):u.tube('station_gutter',[(-18.24,y,F+3.85),(-7.06,y,F+3.85)],.055,'iron')
    for x in (-18.12,-7.18):u.tube('station_drain',[(x,.02,F+.10),(x,.02,F+3.70),(x,-.14,F+3.85)],.033,'iron')
    u.box('station_chimney',(-16.73,4.42,F+4.93),(.62,.65,1.38),'brick',.012);u.box('station_chimney_cap',(-16.73,4.42,F+5.65),(.78,.81,.10),'stone',.010)
    u.cylinder('station_chimney_pot',(-16.73,4.42,F+5.91),.12,.43,'terracotta',20)


def extend_street():
    shop.remove('platform_','canopy_brace','railway_sleeper','track')
    u.COLLIDERS=[c for c in u.COLLIDERS if c['id']!='platform-boundary']
    u.LAY='street';u.box('station_street_extension',(-17.25,-1.7,-.16),(9.5,22,.30),'paving',.03)
    u.box('station_pavement_substrate',(-16.75,-1.05,F-.11),(10.5,2.6,.22),'stone',.006)
    for i in range(13):
        x=-21.4+i*.8;u.box('station_kerb',(x,-2.34,.06),(.78,.24,.24),'stone',.014)
        for j in range(3):u.box('station_paving_slab',(x,-2+j*.77,.155),(.788,.755,.044),'stone',.006)
    batches={'paving':[],'slate':[]}
    for row in range(26):
        for col in range(27):
            x=-21.19+col*.37+(row%2)*.185;y=-8.8+row*.247;mat='paving' if RNG.random()<.92 else 'slate';batches[mat].append(((x,y,.12),(.353,.228,.12),0))
    for mat,items in batches.items():u.batch_boxes('station_street_setts_'+mat,items,mat,.006)
    # Railway context stays outside the playable rear boundary.
    for x in [-21+i*.65 for i in range(21)]:u.box('station_track_sleeper',(x,8.20,.01),(.20,2.12,.14),'timber',.006)
    for y in (7.52,8.87):u.tube('station_rail',[(-21.5,y,.12),(-7.1,y,.12)],.044,'iron')
    u.rect('station-track-boundary',-14.25,8.13,14.8,2.4)


def bench(entry):
    x,y=entry['position'];w=entry['size'][0];name=entry['id'];before=set(bpy.data.objects.keys());u.LAY='station_interior'
    for dx in (-w/2+.18,0,w/2-.18):
        for dy in (-.22,.22):u.box(name+'_foot',(x+dx,y+dy,F+.018),(.16,.13,.036),'iron',.005)
        for dy in (-.22,.22):u.tube(name+'_cast_leg',[(x+dx,y+dy,F+.044),(x+dx,y+dy*.76,F+.22),(x+dx,y+dy*.65,F+.445)],.027,'iron')
        u.tube(name+'_back_support',[(x+dx,y+.18,F+.43),(x+dx,y+.30,F+.97)],.026,'iron')
        u.box(name+'_seat_bearer',(x+dx,y,F+.43),(.085,.61,.052),'iron',.006)
    for j in range(5):u.box(name+'_seat_slat',(x,y-.244+j*.12,F+.479),(w,.107,.046),'polished_walnut',.006)
    for j in range(4):u.box(name+'_back_slat',(x,y+.27+j*.010,F+.635+j*.108),(w,.048,.088),'polished_walnut',.008)
    for sign in (-1,1):
        xx=x+sign*(w/2-.08);u.tube(name+'_swept_arm',[(xx,y-.22,F+.52),(xx,y-.26,F+.72),(xx,y+.17,F+.72),(xx,y+.27,F+.88)],.023,'iron')
        u.box(name+'_arm_wood',(xx,y-.03,F+.745),(.085,.40,.045),'polished_walnut',.016)
    u.transform_group(before,(x,y,0),entry['angle']);u.rect(name,x,y,w+.13,.78,entry['angle'])


def ticket_counter(entry):
    x,y=entry['position'];w=entry['size'][0];u.LAY='station_interior'
    u.box('station_counter_base',(x,y,F+.472),(w-.10,.64,.944),'aged_walnut',.010)
    u.box('station_counter_top',(x,y,F+.989),(w,.74,.09),'polished_walnut',.016)
    for dx in (-1.42,0,1.42):
        u.box('station_counter_panel',(x+dx,y-.336,F+.48),(1.19,.036,.70),'station_paint',.008)
        for sx in (-.625,.625):u.box('station_counter_panel_stile',(x+dx+sx,y-.366,F+.48),(.045,.037,.78),'aged_walnut',.005)
    # Two arched booking windows with real openings through the brass grill.
    for dx in (-1.045,1.045):
        cx=x+dx;spring=F+1.96;r=.59;u.box('station_service_writing_pad',(cx,y-.19,F+1.041),(.64,.25,.012),'dark_emerald',.004)
        for sign in (-1,1):u.cylinder('station_booking_jamb',(cx+sign*r,y-.025,F+1.515),.025,.963,'worn_bronze',16)
        arc=u.tube('station_booking_arch',[(cx+r*math.cos(k*math.pi/18),y-.025,spring+r*math.sin(k*math.pi/18)) for k in range(19)],.025,'worn_bronze');arc.data.resolution_u=2
        shop.label('station_ticket_number','I' if dx<0 else 'II',(cx,y-.108,F+2.53),.10,'board_letters')
        # Narrow rods only flank the serving aperture; its center remains open.
        for sign in (-1,1):
            for j in range(3):u.cylinder('station_booking_rod',(cx+sign*(.67+j*.11),y-.025,F+1.752),.007,1.436,'worn_bronze',12)
    for dx in (-w/2+.04,0,w/2-.04):
        u.box('station_counter_upper_post',(x+dx,y-.025,F+1.775),(.075,.10,1.50),'aged_walnut',.007)
        u.sphere('station_counter_finial',(x+dx,y-.025,F+2.57),(.06,.06,.08),'worn_bronze',16)
    u.box('station_counter_transom',(x,y-.025,F+2.53),(w+.10,.14,.12),'aged_walnut',.012)
    u.rect('station-ticket-counter',x,y,w+.10,.80)
    z=F+1.034
    u.box('station_ticket_stack',(-11.49,y-.07,z+.018),(.18,.095,.035),'paper',.002)
    u.box('station_ticket_box',(-9.37,y+.06,z+.14),(.36,.24,.28),'station_paint',.015)
    u.cylinder('station_ticket_crank',(-9.37,y+.06,z+.321),.036,.08,'worn_bronze',20)
    u.box('station_ticket_slot',(-9.37,y-.067,z+.19),(.24,.012,.026),'iron',.002)
    u.paper('station_counter_receipt',-10.27,y+.08,z+.001,.34,.22)


def luggage_rack(entry):
    x,y=entry['position'];w=entry['size'][0];u.LAY='station_interior'
    for dx in (-w/2+.13,w/2-.13):
        for dy in (-.21,.21):
            u.box('station_rack_foot',(x+dx,y+dy,F+.016),(.11,.11,.032),'iron',.005)
            u.cylinder('station_rack_upright',(x+dx,y+dy,F+.67),.026,1.28,'iron',20)
        u.tube('station_rack_end',[(x+dx,y-.25,F+1.28),(x+dx,y-.25,F+1.48),(x+dx,y+.25,F+1.48),(x+dx,y+.25,F+1.28)],.022,'iron')
    for dy in (-.205,0,.205):u.box('station_rack_slat',(x,y+dy,F+1.32),(w,.16,.05),'polished_walnut',.006)
    for dx,width,height in [(-1.03,.76,.36),(.02,.83,.40),(1.11,.55,.30)]:u.suitcase('station_rack_case',x+dx,y,F+1.345,width,.39,height)
    u.rect('station-luggage-rack',x,y,w+.08,.64)


def trolley(entry):
    x,y=entry['position'];u.LAY='station_interior'
    for dx in (-.31,.31):
        for dy in (-.34,.34):
            before=set(bpy.data.objects.keys());u.cylinder('station_trolley_wheel',(0,0,0),.115,.055,'iron',24)
            for obj in bpy.data.objects:
                if obj.name not in before:obj.matrix_world=Matrix.Translation(Vector((x+dx,y+dy,F+.115)))@Matrix.Rotation(math.pi/2,4,'Y')@obj.matrix_world
    u.box('station_trolley_bed',(x,y,F+.25),(.64,.96,.065),'aged_walnut',.008)
    for dx in (-.28,.28):u.tube('station_trolley_handle_side',[(x+dx,y+.40,F+.20),(x+dx,y+.40,F+.82),(x+dx,y+.52,F+1.02)],.023,'iron')
    u.tube('station_trolley_handle',[(x-.28,y+.52,F+1.02),(x+.28,y+.52,F+1.02)],.030,'polished_walnut')
    u.suitcase('station_trolley_case',x,y-.06,F+.2825,.53,.62,.36)
    u.box('station_trolley_parcel',(x+.04,y-.10,F+.7325),(.40,.38,.18),'paper',.007)
    for dx in (-.11,.14):u.box('station_parcel_twine',(x+dx,y-.10,F+.825),(.006,.39,.005),'twine',.001)
    u.rect('station-luggage-trolley',x,y,.83,1.20)


def station_clock():
    u.LAY='station_shell';before=set(bpy.data.objects.keys())
    u.cylinder('station_clock_rim',(0,0,0),.355,.05,'aged_walnut',48)
    u.cylinder('station_clock_face',(0,0,.032),.316,.016,'ivory',48)
    for k in range(60):
        a=k*math.tau/60;small=k%5!=0;r=.284 if small else .258
        u.tube('station_clock_mark',[(math.sin(a)*r,math.cos(a)*r,.044),(math.sin(a)*.296,math.cos(a)*.296,.044)],.0025 if small else .0045,'ink')
    u.tube('station_clock_minute',[(0,0,.055),(.135,.173,.055)],.007,'ink');u.tube('station_clock_hour',[(0,0,.065),(-.15,.079,.065)],.010,'ink')
    for obj in bpy.data.objects:
        if obj.name not in before:obj.matrix_world=Matrix.Translation(Vector((-15.40,6.145,F+2.74)))@Matrix.Rotation(math.pi/2,4,'X')@obj.matrix_world


def dressing_and_lights():
    station_clock();u.LAY='station_shell'
    u.box('station_waiting_plaque',(-15.40,6.145,F+2.11),(2.65,.05,.27),'ivory',.006)
    shop.label('station_waiting_sign','WAITING ROOM',(-15.40,6.114,F+2.11),2.35,'ink')
    u.box('station_notice_frame',(-12.77,6.1225,F+2.51),(1.25,.095,1.08),'aged_walnut',.010)
    u.box('station_notice_paper',(-12.77,6.070,F+2.51),(1.10,.010,.92),'paper',0)
    shop.label('station_notice_heading','PASSENGER NOTICE',(-12.77,6.061,F+2.81),.88,'ink')
    for z in (2.57,2.46,2.35,2.24):u.box('station_notice_rule',(-12.77,6.060,F+z),(.86,.006,.008),'ink',0)
    u.box('station_booking_plaque',(-10.24,6.145,F+3.08),(2.60,.05,.29),'ivory',.006)
    shop.label('station_booking_sign','BOOKING OFFICE',(-10.24,6.114,F+3.08),2.25,'ink')
    u.LAY='station_ceiling'
    for x in (-15.25,-10.14):
        u.cylinder('station_pendant_rose',(x,3.25,F+3.595),.12,.010,'worn_bronze',24)
        u.cylinder('station_pendant_stem',(x,3.25,F+3.29),.016,.60,'worn_bronze',20)
        u.sphere('station_pendant_opal',(x,3.25,F+2.91),(.245,.245,.18),'lamp',24)
        u.cylinder('station_pendant_cap',(x,3.25,F+3.075),.172,.04,'worn_bronze',24)
        room.local_light('station-pendant-'+str(x),(x,3.25,F+2.69),160,18,5.6)
    u.LAY='station_daylight'
    for x in (-15.95,-12.95):
        light=bpy.data.lights.new('station_window_fill','AREA');light.energy=220;light.shape='RECTANGLE';light.size=1.70;light.size_y=2.03;light.color=(.75,.85,1)
        obj=bpy.data.objects.new('station_window_fill',light);bpy.context.collection.objects.link(obj);obj.location=(x,.57,F+1.75);obj.rotation_euler=(Vector((x,4.5,1.0))-obj.location).to_track_quat('-Z','Y').to_euler();u.tag(obj)
        u.FIXTURES.append({'id':'station-window-'+str(x),'position':list(obj.location),'color':'#bfdaff','sourceWatts':220,'sourceType':'AREA','runtimeIntensity':4.5,'distance':5.2,'note':'Runtime point approximation of the opening fill, not radiometric equivalence.'})


def staff_desk(entry):
    x,y=entry['position'];w,d,h=entry['size'];u.LAY='station_interior';before=set(bpy.data.objects.keys())
    u.desk(entry['id'],x,y,w,d,h)
    for obj in bpy.data.objects:
        if obj.name not in before and obj.type=='MESH':
            for slot in obj.material_slots:
                if slot.material and slot.material.name in ('timber','walnut'):slot.material=u.MATS['polished_walnut' if slot.material.name=='timber' else 'aged_walnut']
    u.rect(entry['id'],x,y,w+.04,d+.04)
    z=F+h+.0425
    u.box('station_staff_ledger_cover',(x-.04,y-.04,z+.005),(.45,.35,.010),'book_green',.003)
    u.paper('station_staff_ledger',x-.04,y-.04,z+.011,.41,.31)
    u.tube('station_staff_pen',[(x+.25,y-.16,z+.005),(x+.24,y+.07,z+.005)],.004,'iron')
    u.cylinder('station_staff_inkwell',(x+.23,y+.22,z+.035),.033,.07,'glass_dark',20)


def cameras():
    specs=[
        ('district-production',(14.5,-28.4,20.2),(-4.5,.6,2.8),47,None),
        ('station-production',(-3.4,-11.8,13.7),(-12.65,3.2,1.15),15,None),
        ('station-corner-sw',(-17.05,.99,F+1.65),(-12.65,3.2,F+1.4),None,10.3923),
        ('station-corner-se',(-8.05,1.6,F+1.65),(-12.65,3.2,F+1.4),None,10.3923),
        ('station-corner-nw',(-17.10,5.30,F+1.65),(-12.65,3.2,F+1.4),None,10.3923),
        ('station-corner-ne',(-8.06,5.70,F+1.65),(-12.65,3.2,F+1.4),None,10.3923),
        ('station-low-entry',(-9.05,-.85,F+1.55),(-11.4,3.3,F+1.2),None,18),
        ('station-ceiling-up',(-12.65,3.3,F+1.5),(-12.65,3.3,F+3.6),None,5.2),
        ('station-ceiling-oblique-a',(-17.0,1.04,F+1.48),(-9.0,5.5,F+3.4),None,13),
        ('station-ceiling-oblique-b',(-8.04,5.7,F+1.48),(-16.4,1.2,F+3.4),None,13),
        ('station-plan-floor',(-12.65,3.33,19),(-12.65,3.33,0),16,None),
        ('station-plan-ceiling',(-12.65,3.33,.02),(-12.65,3.33,4),16,None),
    ]
    for name,pos,target,scale,lens in specs:u.camera(name,pos,target,scale,lens or 32)


def build():
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'classic-bookshop.blend'))
    u.MATS={m.name:m for m in bpy.data.materials};u.PART='static';u.CONTACTS=[]
    # Archived helper names point to the reviewed PBR replacements; obsolete
    # unused datablocks are intentionally absent from the protected source.
    for old,new in [('timber','aged_walnut'),('walnut','aged_walnut'),('leather','oxblood_leather')]:u.MATS[old]=u.MATS[new]
    data=read(BASE/'scene-contract.json');u.COLLIDERS=data['colliders'];u.OPENINGS=read(BASE/'openings.json')['openings'];u.FIXTURES=read(BASE/'lighting.json')['fixtures']
    for name,color,rough in [('station_paint','344744',.64),('station_tile_cream','a69d86',.72),('station_tile_dark','55594f',.73),('station_tile_border','464b42',.75)]:u.material(name,color,rough,0)
    layout=read(PACKAGE/'room-layout.json')
    # Keep the neighbor's wall and wall-attached cases together when revealing
    # the station from the shared elevated camera; restore them in other views.
    for obj in bpy.data.objects:
        if obj.name in ('shop_ground_side_-6.43','shop_skirt_side','shop_dado_side'):obj['layer']='shop_neighbor_cutaway'
        elif obj.name.startswith(('shop-case-maps','shop-case-essays')):obj['layer']='shop_neighbor_furniture'
    extend_street();shell()
    constructors={'bench':bench,'ticket-counter':ticket_counter,'luggage-rack':luggage_rack,'staff-desk':staff_desk,'trolley':trolley}
    for item in layout['instances']:constructors[item['kind']](item)
    dressing_and_lights();cameras()
    for obj in bpy.data.objects:
        if obj.name.startswith(('station_rack_case','station_trolley_case')) and obj.type=='MESH':
            for slot in obj.material_slots:
                if slot.material and slot.material.name=='leather':slot.material=u.MATS['oxblood_leather']
        if obj.type=='LIGHT':obj.visible_camera=False
    data['bounds']=[-21.3,12.3,-8.5,6.6];data['colliders']=u.COLLIDERS
    cutaway=['station_front','station_side_cutaway','station_ceiling','station_roof','shop_neighbor_cutaway','shop_neighbor_furniture']+data['interiors'][1]['cutawayLayers']
    data['interiors'].append({'id':'station','label':'河湾车站候车室','bounds':layout['roomBounds'],'door':layout['entry'],'cutawayLayers':list(dict.fromkeys(cutaway))})
    data['camera']={'overview':{'sourceCoordinates':True,'target':[-4.5,.6,2.8],'offset':[19,-29,17.4],'verticalSize':24.6,'horizontalSize':47}}
    data['interactions'] += [
        {'id':'station-arrival','label':'进入河湾车站','position':[-9.05,-.20],'roomId':None,'description':'拱门后是候车长椅与售票处。沿敞开的双扇门走进去，可以查看候车区、票务柜台和行李架。'},
        {'id':'station-waiting','label':'观察候车区','position':[-15.45,2.86],'roomId':'station','description':'两排木长椅相向布置，背墙上挂着车站时钟。钟面属于当前场景陈设，尚未与世界时间和列车事件同步。'},
        {'id':'station-tickets','label':'查看售票窗口','position':[-10.44,3.75],'roomId':'station','description':'黄铜格栅留有两个递送窗口，台上摆着票盒与收据。陈设尚未构成案件证据；柜台西侧留有通往工作人员区域的通道。'},
        {'id':'station-luggage','label':'查看行李架','position':[-15.35,5.04],'roomId':'station','description':'皮箱放在有支脚的木条行李架上。此处先验证观察和行走，行李的归属与运送记录将在世界规则接入后产生。'},
    ]
    data['binding']='three-room-art-navigation-only'
    write(PACKAGE/'scene-contract.json',data)
    write(PACKAGE/'openings.json',{'schema':'classic-openings.v1','openings':u.OPENINGS})
    write(PACKAGE/'lighting.json',{'schema':'classic-lights.v4','fixtures':u.FIXTURES,'runtimeCalibration':'Explicit artistic point approximations; no baked-lightmap or physical-equivalence claim.'})
    write(PACKAGE/'placements.json',{'schema':'classic-station-placements.v1','floorTiles':448,'stationLayoutSha256':sha(PACKAGE/'room-layout.json'),'staffWaypoint':[-10.44,5.40],'sourceStaticActor':'Inherited old scale reference only; runtime loads the independent skinned investigator.','clocksAndTickets':'Decorative original geometry only; not authoritative events or private NPC information.'})
    bpy.context.scene['purpose']='Three connected original interior candidates: inn, bookshop and station. Art/navigation only; no human art approval.'


def render_views(args,brief,inputs):
    devices=u.configure(args.samples,args.width);scene=bpy.context.scene;identity=sha(SOURCE);views=brief['requiredViews'] if args.views=='all' else args.views.split(',');entries=[]
    target=PACKAGE/'render-receipt.json'
    if target.exists():
        old=read(target)
        if old['sourceSha256']==identity:entries=[e for e in old['renders'] if e['view'] not in views]
    folder=PACKAGE/'renders';folder.mkdir(exist_ok=True)
    cutaway=set(read(PACKAGE/'scene-contract.json')['interiors'][-1]['cutawayLayers'])
    for view in views:
        assert view in brief['requiredViews'],view
        for obj in bpy.data.objects:
            obj.hide_render=False;obj.visible_camera=obj.type!='LIGHT';layer=obj.get('layer')
            if view=='station-production' and layer in cutaway:obj.visible_camera=False
            if view.startswith('station-plan-'):
                obj.hide_render=layer not in ('station_front','station_shell','station_side_cutaway','station_interior') if view.endswith('floor') else layer!='station_ceiling'
                if obj.type=='LIGHT':obj.hide_render=False
            if view!='district-production' and layer=='actor':obj.hide_render=True
        scene.view_layers[0].material_override=u.MATS['clay'] if view.startswith('station-plan-') else None
        scene.camera=bpy.data.objects[view];file=folder/(view+'.png');scene.render.filepath=str(file)
        start=time.perf_counter();bpy.ops.render.render(write_still=True)
        entry={'view':view,'path':'renders/'+file.name,'sha256':sha(file),'seconds':round(time.perf_counter()-start,2),'dimensions':[args.width,scene.render.resolution_y],'samples':args.samples,'sourceSha256':identity};entries.append(entry)
        write(target,{'schema':'classic-renders.v4','sourceSha256':identity,'inputs':inputs,'engine':'Cycles','device':scene.cycles.device,'devices':devices,'renders':entries,'complete':set(brief['requiredViews'])<=set(e['view'] for e in entries)})
        print('STATION_RENDER='+json.dumps(entry),flush=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--views',default='all');parser.add_argument('--render-existing',action='store_true');parser.add_argument('--width',type=int,default=1440);parser.add_argument('--samples',type=int,default=40)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    PACKAGE.mkdir(parents=True,exist_ok=True);brief=read(PACKAGE/'room-brief.json')
    files=[Path(__file__),ROOT/'scripts/build-blender-classic-bookshop.py',ROOT/'scripts/build-blender-classic-room-v2.py',ROOT/'scripts/build-blender-classic-railway.py',BASE/'classic-bookshop.blend',ROOT/'docs/3d-town/classic-railway-v2/licensed/provenance.json',PACKAGE/'room-layout.json',PACKAGE/'room-brief.json']
    inputs=[{'path':str(f.relative_to(ROOT)).replace('\\','/'),'sha256':sha(f)} for f in files]
    if args.render_existing:
        author=read(PACKAGE/'authoring-receipt.json');assert author['inputs']==inputs and author['source']['sha256']==sha(SOURCE)
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE));u.MATS={m.name:m for m in bpy.data.materials}
    else:
        build();u.configure(args.samples,args.width);bpy.context.scene.camera=bpy.data.objects['station-production'];bpy.context.preferences.filepaths.save_version=0
        bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        write(PACKAGE/'authoring-receipt.json',{'schema':'classic-authoring.v4','inputs':inputs,'source':{'path':SOURCE.name,'sha256':sha(SOURCE),'bytes':SOURCE.stat().st_size},'blenderVersion':bpy.app.version_string,'inheritedMaterialProvenance':'../classic-railway-v2/licensed/provenance.json','baseColorFactors':read(BASE/'authoring-receipt.json')['baseColorFactors'],'humanArtApproved':False})
    if args.views!='none':render_views(args,brief,inputs)
    print('STATION_SOURCE='+str(SOURCE),flush=True)


if __name__=='__main__':main()
