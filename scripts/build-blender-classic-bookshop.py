"""Add an original, walkable antiquarian bookshop to the reviewed v2 street."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,math,random,sys,time
import bpy
from mathutils import Vector,Matrix

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-railway-v2';PACKAGE=ROOT/'docs/3d-town/classic-bookshop-v1';SOURCE=PACKAGE/'classic-bookshop.blend'
spec=importlib.util.spec_from_file_location('room_geometry',ROOT/'scripts/build-blender-classic-room-v2.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room)
u=room.u;F=.18;RNG=random.Random(193411);BOOKS=0
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def remove(*prefixes):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefixes):bpy.data.objects.remove(obj,do_unlink=True)
def label(name,body,pos,width,mat='board_letters',rot=(math.pi/2,0,0)):
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.font=bpy.data.fonts['Railway Serif Study Regular'];data.size=1;data.align_x='CENTER';data.align_y='CENTER';data.extrude=.0008;data.resolution_u=2
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=rot;data.materials.append(u.MATS[mat]);u.tag(obj)
    bpy.context.view_layer.update();ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();w=max(v.co.x for v in mesh.vertices)-min(v.co.x for v in mesh.vertices);ev.to_mesh_clear();data.size=width/w
    return obj


def shell():
    # The neighboring inn wall also crosses the elevated gameplay camera ray.
    # Keep its wall-mounted dressing together, restoring all of it outside the shop.
    for obj in bpy.data.objects:
        if obj.name=='inn_left_wall' or obj.name.startswith(('route_map_','map_town','map_heading','timetable_')) or (obj.name.startswith(('side_wainscot','side_panel_field','side_dado','side_skirt')) and obj.location.x<6):
            obj['layer']='inn_neighbor_cutaway'
    # Preserve the front's real Boolean apertures, split the old single opaque
    # shop mass into independently revealable ground, upper, and ceiling layers.
    upper=('bookshop_upper','books_upper','bookshop_eaves','bookshop_roof','book_roof','bookshop_authored_slate','book_chimney','book_pot')
    for obj in bpy.data.objects:
        if obj.get('layer')=='bookshop':obj['layer']='bookshop_upper' if obj.name.startswith(upper) else 'bookshop_front'
    remove('bookshop_side','bookshop_rear','bookshop_closed_door','bookshop_door_glass','bookshop_door_panel','bookshop_knob','bookshop_interior_back')
    u.COLLIDERS=[c for c in u.COLLIDERS if c['id']!='bookshop']
    for x in (-6.43,1.23):
        u.LAY='bookshop_shell' if x<0 else 'bookshop_side_cutaway'
        u.wall('shop_ground_side_'+str(x),(x,3.15,F+1.57),(.30,5.70,3.14),'plaster',[])
        u.rect('shop-side-'+str(x),x,3.15,.30,5.70)
        u.LAY='bookshop_upper';u.box('shop_upper_side_'+str(x),(x,3.15,F+4.44),(.30,5.70,2.72),'plaster',.008)
    u.LAY='bookshop_shell';u.wall('shop_ground_rear',(-2.6,6,F+1.57),(7.65,.34,3.14),'plaster',[]);u.rect('shop-rear',-2.6,6,7.65,.34)
    u.LAY='bookshop_upper';u.box('shop_upper_rear',(-2.6,6,F+4.44),(7.65,.34,2.72),'plaster',.008)
    u.LAY='bookshop_front'
    u.rect('shop-front-left',-3.8975,.30,5.055,.32);u.rect('shop-front-right',.5775,.30,1.295,.32)
    u.rect('shop-window-display',-3.9,.765,4.10,1.07)
    # A hinged leaf is fully opened along the eastern jamb, outside the arrival.
    u.box('shop_open_door',(-.125,1.045,F+1.22),(.08,1.18,2.44),'green',.012)
    for z in (.50,1.65):u.box('shop_door_field',(-.172,1.045,F+z),(.017,.93,.66),'dark_emerald',.006)
    u.sphere('shop_door_handle',(-.209,1.48,F+1.10),(.025,.025,.025),'worn_bronze',16)
    u.rect('shop-open-leaf',-.125,1.045,.11,1.18)
    for item in u.OPENINGS:
        if item['id']=='book-door':item['destination']='Connected bookshop with browsing, reading and service aisles';item['doorState']='opened inward at eastern jamb'
    u.LAY='bookshop_interior'
    u.box('shop_floor_substrate',(-2.60,3.15,F-.10),(7.65,5.70,.12),'aged_walnut',0)
    boards=[]
    for j in range(25):
        y=.46+j*(5.37/25)
        for i in range(8):
            a=max(-6.28,-6.28+i*1.1-(.55 if j%2 else 0));b=min(1.08,-6.28+(i+1)*1.1-(.55 if j%2 else 0))
            if b>a+.015:boards.append((((a+b)/2,y+5.37/50,F-.020),(b-a-.003,5.37/25-.003,.04),0))
    u.batch_boxes('shop_wood_floor',boards,'polished_walnut',.002)
    u.LAY='bookshop_shell'
    for x in (-6.255,1.055):
        u.LAY='bookshop_shell' if x<0 else 'bookshop_side_cutaway'
        u.box('shop_skirt_side',(x,3.15,F+.10),(.05,5.38,.20),'aged_walnut',.005)
        u.box('shop_dado_side',(x,3.15,F+1.05),(.07,5.38,.065),'aged_walnut',.006)
    u.LAY='bookshop_shell'
    u.box('shop_skirt_rear',(-2.60,5.805,F+.10),(7.34,.05,.20),'aged_walnut',.005)
    u.LAY='bookshop_ceiling';u.box('shop_ceiling',(-2.60,3.15,F+3.14),(7.66,5.71,.12),'ceiling',0)
    for y in (.51,5.78):
        u.box('shop_cornice_long',(-2.60,y,F+3.03),(7.35,.12,.10),'ivory',.012)
        u.box('shop_cornice_long_shadow',(-2.60,y,F+2.956),(7.35,.13,.025),'aged_walnut',.006)
    for x in (-6.23,1.03):u.box('shop_cornice_side',(x,3.15,F+3.03),(.12,5.25,.10),'ivory',.012)
    for x in (-4.45,-.75):u.box('shop_ceiling_beam',(x,3.15,F+3.033),(.09,5.30,.095),'aged_walnut',.008)
    return len(boards)


def book(name,x,y,z,w,h,d,mat):
    global BOOKS
    BOOKS+=1
    # Closed page block, individual covers, rounded spine, raised binding bands.
    u.box(name+'_pages',(x,y+.004,z+h/2),(max(w-.009,.012),d-.018,h-.013),'paper',0)
    for dx in (-w/2+.0025,w/2-.0025):u.box(name+'_cover',(x+dx,y,z+h/2),(.005,d,h),mat,0)
    profile=[(x-w/2+w*i/8,y-d/2-.004*math.sin(math.pi*i/8)) for i in range(9)]+[(x+w/2,y-d/2+.012),(x-w/2,y-d/2+.012)]
    n=len(profile);verts=[(xx,yy,zz) for zz in (z,z+h) for xx,yy in profile]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    u.mesh(name+'_spine',verts,faces,mat)
    for zz in (.13,.85):u.box(name+'_band',(x,y-d/2-.006,z+h*zz),(w*.87,.003,.006),'board_letters',0)
    if w>.036:u.box(name+'_title',(x,y-d/2-.0065,z+h*.68),(w*.66,.002,.015),'board_letters',0)


def bookcase(entry):
    name=entry['id'];x,y=entry['position'];w,d,h=entry['size'];angle=entry['angle'];before=set(bpy.data.objects.keys());u.LAY='bookshop_interior'
    u.box(name+'_back',(x,y+d/2-.012,F+h/2),(w,.024,h),'aged_walnut',.004)
    u.box(name+'_base',(x,y,F+.12),(w+.04,d+.04,.24),'aged_walnut',.008)
    for dx in (-w/2+.034,w/2-.034):
        u.box(name+'_stile',(x+dx,y,F+h/2),(.068,d,h),'aged_walnut',.006)
        u.box(name+'_fluted_post',(x+dx,y-d/2-.011,F+h/2),(.046,.024,h-.12),'polished_walnut',.006)
    for zz,width,depth in [(h+.018,w+.075,d+.07),(h+.072,w+.10,d+.09)]:u.box(name+'_cornice',(x,y,F+zz),(width,depth,.055),'aged_walnut',.010)
    rows=5;step=(h-.46)/rows
    for row in range(rows):
        z=F+.25+row*step;u.box(name+'_shelf',(x,y,z),(w-.09,d-.025,.032),'polished_walnut',.003)
        xx=x-w/2+.085
        while xx<x+w/2-.11:
            width=RNG.uniform(.032,.073);height=RNG.uniform(step*.66,step*.88);depth=RNG.uniform(d*.51,d*.68)
            if xx+width>x+w/2-(.34 if row%2 else .065):break
            book(name+'_volume',xx+width/2,y-d/2+depth/2+.014,z+.016,width,height,depth,RNG.choice(('book_red','book_green','book_ochre','shop_book_blue','shop_book_taupe')))
            xx+=width+RNG.uniform(.003,.011)
        if row%2:
            for k in range(3):
                cx=x+w/2-.21;zz=z+.016+k*.046
                u.box(name+'_stack_pages',(cx,y-.015,zz+.022),(.26,.21,.035),'paper',0)
                for dz in (.002,.042):u.box(name+'_stack_cover',(cx,y-.015,zz+dz),(.28,.23,.004),'book_green' if k%2 else 'book_red',0)
    label(name+'_category',entry['category'],(x,y-d/2-.035,F+h-.13),min(w*.66,.88))
    u.transform_group(before,(x,y,0),angle);u.rect(name,x,y,w+.12,d+.13,angle)


def reading_chair(name,x,y,angle):
    before=set(bpy.data.objects.keys());u.LAY='bookshop_interior'
    for dx in (-.22,.22):
        for dy in (-.21,.21):u.cylinder(name+'_leg',(x+dx,y+dy,F+.225),.025,.45,'aged_walnut',16,top=.034)
    u.box(name+'_seat_frame',(x,y,F+.455),(.54,.55,.07),'aged_walnut',.020)
    seat=u.box(name+'_padded_seat',(x,y,F+.510),(.47,.48,.07),'shop_velvet',0);u.bevel(seat,.027,3)
    for dx in (-.225,.225):u.tube(name+'_back_post',[(x+dx,y+.22,F+.40),(x+dx,y+.29,F+.96)],.024,'aged_walnut')
    u.box(name+'_top_rail',(x,y+.29,F+.98),(.54,.072,.10),'aged_walnut',.018)
    for dx in (-.15,-.075,0,.075,.15):u.tube(name+'_spindle',[(x+dx,y+.23,F+.52),(x+dx,y+.285,F+.93)],.012,'aged_walnut')
    u.transform_group(before,(x,y,0),angle);u.rect(name,x,y,.60,.66,angle)


def table_and_atlas(entry):
    x,y=entry['position'];u.LAY='bookshop_interior'
    u.cylinder('shop_reading_table_top',(x,y,F+.80),.66,.075,'polished_walnut',48)
    for dx in (-.39,.39):
        for dy in (-.33,.33):u.cylinder('shop_reading_table_leg',(x+dx,y+dy,F+.365),.035,.73,'aged_walnut',20,top=.052)
    u.box('shop_reading_table_apron',(x,y,F+.72),(1.01,.90,.12),'aged_walnut',.008);u.rect('shop-reading-table',x,y,1.34,1.34)
    # Open atlas with a modeled central gutter and slightly curved paper leaves.
    z=F+.843;u.box('shop_atlas_cover',(x,y,z),(.57,.42,.010),'book_red',.004)
    for sign in (-1,1):
        verts=[];n=14
        for yy in (-.196,.196):
            for i in range(n+1):
                t=i/n;verts.append((x+sign*(.008+t*.264),y+yy,z+.018+.023*math.sin(t*math.pi)))
        faces=[(i,i+1,n+2+i,n+1+i) for i in range(n)]
        if sign<0:faces=[tuple(reversed(f)) for f in faces]
        obj=u.mesh('shop_atlas_leaf',verts,faces,'paper',True);mod=obj.modifiers.new('bound_pages','SOLIDIFY');mod.thickness=.010;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        for j in range(3):
            points=[]
            for k in range(9):
                t=.12+k*.09;xx=sign*(.008+t*.264);yy=-.145+j*.13+.014*math.sin(k*.9+j)
                points.append((x+xx,y+yy,z+.019+.023*math.sin(t*math.pi)))
            curve=u.tube('shop_atlas_route',points,.0016,'green');curve.data.resolution_u=2
    u.box('shop_bookmark',(x+.20,y-.177,z+.049),(.015,.16,.001),'board_letters',0)


def counter(entry):
    x,y=entry['position'];u.LAY='bookshop_interior'
    u.box('shop_counter_base',(x,y,F+.47),(.72,2.1,.94),'aged_walnut',.012)
    u.box('shop_counter_top',(x,y,F+.98),(.82,2.22,.09),'polished_walnut',.018)
    for yy in (y-.67,y,y+.67):
        u.box('shop_counter_field',(x-.373,yy,F+.53),(.023,.59,.65),'green',.006)
        u.box('shop_counter_drawer',(x+.372,yy,F+.75),(.025,.58,.18),'aged_walnut',.006)
        u.sphere('shop_counter_handle',(x+.395,yy,F+.75),(.020,.025,.02),'worn_bronze',12)
    u.rect('shop-counter',x,y,.86,2.25)
    z=F+1.025
    u.box('shop_ledger_cover',(x-.05,y-.22,z),(.48,.34,.01),'book_green',.003)
    u.paper('shop_ledger_page',x-.05,y-.22,z+.004,.44,.30)
    u.tube('shop_counter_pen',[(x+.18,y-.40,z+.015),(x+.16,y-.17,z+.015)],.004,'iron')
    # A supported brass bell and a green-shaded desk lamp identify service use.
    u.cylinder('shop_bell_base',(x-.16,y-.78,z+.016),.063,.032,'worn_bronze',24)
    u.sphere('shop_counter_bell',(x-.16,y-.78,z+.043),(.057,.057,.030),'worn_bronze',20)
    u.cylinder('shop_bell_button',(x-.16,y-.78,z+.081),.012,.025,'worn_bronze',16)
    lx,ly=x+.03,y+.61
    u.cylinder('shop_lamp_base',(lx,ly,z+.018),.10,.036,'worn_bronze',28)
    u.tube('shop_lamp_stem',[(lx,ly,z+.035),(lx,ly,z+.30)],.016,'worn_bronze')
    verts=[];n=20
    for dx in (-.18,.18):
        for i in range(n+1):
            a=math.pi*i/n;verts.append((lx+dx,ly+math.cos(a)*.105,z+.29+math.sin(a)*.095))
    faces=[(i,i+1,n+2+i,n+1+i) for i in range(n)];shade=u.mesh('shop_banker_shade',verts,faces,'green',True);mod=shade.modifiers.new('metal_shell','SOLIDIFY');mod.thickness=.003;bpy.context.view_layer.objects.active=shade;bpy.ops.object.modifier_apply(modifier=mod.name)
    u.sphere('shop_lamp_bulb',(lx,ly,z+.285),(.075,.018,.018),'warm_bulb',16)
    room.local_light('shop-counter-lamp',(lx,ly,z+.265),18,7,2.4)


def fittings():
    u.LAY='bookshop_ceiling'
    for x,y in ((-3.5,2.8),(-1.1,4.65)):
        u.cylinder('shop_pendant_rose',(x,y,F+3.057),.082,.045,'worn_bronze',24)
        u.cylinder('shop_pendant_stem',(x,y,F+2.83),.015,.42,'worn_bronze',20)
        u.sphere('shop_pendant_opal',(x,y,F+2.55),(.19,.19,.155),'lamp',24)
        u.cylinder('shop_pendant_cap',(x,y,F+2.672),.15,.041,'worn_bronze',24)
        # Keep the analytic light below the opaque opal diffuser so it can
        # illuminate the room instead of being trapped in its own fixture.
        room.local_light('shop-pendant-'+str(x),(x,y,F+2.355),135,18,5)
    u.LAY='shop-window-light'
    light=bpy.data.lights.new('shop_window_daylight','AREA');light.energy=300;light.shape='RECTANGLE';light.size=3.6;light.size_y=1.7;light.color=(.76,.85,1)
    obj=bpy.data.objects.new('shop_window_daylight',light);bpy.context.collection.objects.link(obj);obj.location=(-3.9,1.22,F+1.65);obj.rotation_euler=(Vector((-3.5,4.5,1.0))-obj.location).to_track_quat('-Z','Y').to_euler();u.tag(obj)
    u.FIXTURES.append({'id':'shop-window-daylight','position':list(obj.location),'color':'#c2d9ff','sourceWatts':300,'sourceType':'AREA','runtimeIntensity':7,'distance':5,'note':'Runtime point approximation of window fill; not physical equivalence.'})
    u.LAY='bookshop_interior'
    # A framed original map and a small clock are separate from canonical clues.
    u.box('shop_map_frame',(.28,5.785,F+1.76),(1.19,.085,.85),'aged_walnut',.010)
    u.box('shop_map_paper',(.28,5.735,F+1.76),(1.04,.008,.70),'paper',0)
    for j in range(3):
        curve=u.tube('shop_map_route',[(.28-.43+k*.105,5.728,F+1.50+j*.20+.035*math.sin(k*1.2+j)) for k in range(9)],.0035,'green');curve.data.resolution_u=2
    label('shop_map_title','RAILWAY DISTRICT',(.28,5.725,F+2.02),.72,'ink')
    before=set(bpy.data.objects.keys())
    u.cylinder('shop_clock_rim',(0,0,0),.20,.045,'aged_walnut',40)
    u.cylinder('shop_clock_dial',(0,0,.027),.176,.015,'ivory',40)
    for k in range(12):
        a=k*math.tau/12;u.tube('shop_clock_tick',[(math.sin(a)*.14,math.cos(a)*.14,.037),(math.sin(a)*.163,math.cos(a)*.163,.037)],.003,'ink')
    u.tube('shop_clock_minute',[(0,0,.041),(.07,.095,.041)],.004,'ink');u.tube('shop_clock_hour',[(0,0,.044),(-.069,.035,.044)],.005,'ink')
    for obj in bpy.data.objects:
        if obj.name not in before:obj.matrix_world=Matrix.Translation(Vector((.28,5.809,F+2.55)))@Matrix.Rotation(math.pi/2,4,'X')@obj.matrix_world
    # A narrow packing shelf uses the otherwise dead rear staff corner.
    u.box('shop_parcel_shelf',(.65,5.59,F+.82),(.70,.48,.055),'aged_walnut',.008)
    for x in (.41,.89):u.box('shop_parcel_bracket',(x,5.735,F+.66),(.035,.19,.30),'worn_bronze',.004)
    for z,w,d in [(.89,.41,.26),(.98,.32,.24)]:u.box('shop_wrapped_parcel',(.63,5.57,F+z),(w,d,.09),'paper',.006)
    u.rect('shop-parcel-shelf',.65,5.59,.74,.51)


def cameras():
    specs=[('shop-production',(6.4,-10.95,14),(-2.60,3.05,1.0),12.4,None),('shop-corner-sw',(-5.50,1.50,F+1.65),(-2.6,3.25,F+1.4),None,10.3923),('shop-corner-se',(.74,1.85,F+1.65),(-2.6,3.25,F+1.4),None,10.3923),('shop-corner-nw',(-5.40,5.04,F+1.65),(-2.6,3.25,F+1.4),None,10.3923),('shop-corner-ne',(.74,5.24,F+1.65),(-2.6,3.25,F+1.4),None,10.3923),('shop-low-entry',(-.72,-.90,F+1.55),(-1.7,3.2,F+1.35),None,18),('shop-ceiling-up',(-2.5,3.7,F+1.55),(-2.5,3.7,F+3.08),None,5.2),('shop-ceiling-oblique-a',(-5.4,1.54,F+1.43),(-.6,4.8,F+2.95),None,13),('shop-ceiling-oblique-b',(.70,5.2,F+1.44),(-4.7,1.6,F+2.95),None,13),('shop-plan-floor',(-2.60,3.12,18),(-2.60,3.12,0),12.8,None),('shop-plan-ceiling',(-2.60,3.12,.02),(-2.60,3.12,4),12.8,None)]
    for name,pos,target,scale,lens in specs:u.camera(name,pos,target,scale,lens or 32)


def build():
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'classic-railway.blend'));u.MATS={m.name:m for m in bpy.data.materials};u.PART='static';u.CONTACTS=[]
    u.OPENINGS=read(BASE/'openings.json')['openings'];data=read(BASE/'scene-contract.json');u.COLLIDERS=data['colliders'];u.FIXTURES=read(BASE/'lighting.json')['fixtures']
    for name,color in [('shop_book_blue','293942'),('shop_book_taupe','685746'),('shop_velvet','30433a'),('clay','aaaaaa')]:u.material(name,color,.86,0)
    u.MATS['clay'].use_fake_user=True
    layout=read(PACKAGE/'room-layout.json');boards=shell()
    for item in layout['instances']:
        if item['kind']=='bookcase':bookcase(item)
        elif item['kind']=='reading-table':table_and_atlas(item)
        elif item['kind']=='chair':reading_chair(item['id'],*item['position'],item['angle'])
        elif item['kind']=='counter':counter(item)
    fittings();cameras()
    # Store the physical rooms independently. Legacy 'interior' remains the inn
    # alias for archived consumers; current navigation uses the interiors list.
    data['colliders']=u.COLLIDERS;data['interiors']=[dict(data['interior'],id='inn',label='铁路旅馆会客室'),{'id':'bookshop','label':'格雷福德旧书店','bounds':[-6.28,1.08,.46,5.83],'door':[-.72,.30],'cutawayLayers':['bookshop_upper','bookshop_front','bookshop_side_cutaway','bookshop_ceiling','inn_upper','inn_front','inn_side_cutaway','ceiling','inn_neighbor_cutaway']}]
    for interaction in data['interactions']:
        interaction['roomId']='inn' if interaction['id'] in ('tea','letters') else None
        if interaction['id']=='books':interaction['description']='真实橱窗后连接可进入的旧书店。沿街走到右侧门口，可以入店查看藏书与翻书桌。'
    data['interactions'] += [{'id':'shop-arrival','label':'进入旧书店','position':[-.72,-.20],'roomId':None,'description':'真实门洞连通街道与书店。沿入口通道走进去，可以查看书架、翻书桌和柜台。'},{'id':'shop-reading','label':'翻阅地图册','position':[-2.30,2.80],'roomId':'bookshop','description':'摊开的地图册放在翻书桌上。这里的路线与书籍属于当前布景，还没有被写成正式案件线索。'},{'id':'shop-counter','label':'查看订书簿','position':[-1.12,3.30],'roomId':'bookshop','description':'柜台上放着订书簿、书写用具与黄铜铃；柜台后留有店员通道。本轮先验证空间与观察操作。'},{'id':'shop-shelves','label':'浏览旧藏书架','position':[-3.90,4.83],'roomId':'bookshop','description':'旧藏分成旅行、历史和小说几类，每一层都有独立装订与书脊。书名分类是美术陈设，不会揭露隐藏案件信息。'}]
    data['binding']='two-room-art-navigation-only';write(PACKAGE/'scene-contract.json',data);write(PACKAGE/'openings.json',{'schema':'classic-openings.v1','openings':u.OPENINGS})
    write(PACKAGE/'lighting.json',{'schema':'classic-lights.v3','fixtures':u.FIXTURES,'runtimeCalibration':'Explicit artistic runtime intensities; no physical equivalence or baked-lightmap claim.'})
    write(PACKAGE/'placements.json',{'schema':'classic-bookshop-placements.v1','floorBoards':boards,'authoredBooks':BOOKS,'layoutSha256':sha(PACKAGE/'room-layout.json'),'staffWaypoint':[.60,3.30],'sourceStaticActor':'Inherited old scale reference only; runtime loads the independent skinned investigator.'})
    bpy.context.scene['purpose']='Two connected original interior candidates: railway inn and antiquarian bookshop. No Agent/case state or human art approval.'


def render_views(args,brief,inputs):
    devices=u.configure(args.samples,args.width);scene=bpy.context.scene;identity=sha(SOURCE);views=brief['requiredViews'] if args.views=='all' else args.views.split(',');entries=[]
    target=PACKAGE/'render-receipt.json'
    if target.exists():
        old=read(target)
        if old['sourceSha256']==identity:entries=[e for e in old['renders'] if e['view'] not in views]
    folder=PACKAGE/'renders';folder.mkdir(exist_ok=True)
    for view in views:
        assert view in brief['requiredViews'],view
        for obj in bpy.data.objects:
            obj.hide_render=False;obj.visible_camera=obj.type!='LIGHT';layer=obj.get('layer')
            if view=='shop-production' and layer in ('bookshop_front','bookshop_upper','bookshop_side_cutaway','bookshop_ceiling','inn_upper','inn_front','inn_side_cutaway','ceiling','inn_neighbor_cutaway'):obj.visible_camera=False
            if view=='interior-production' and layer in ('inn_front','inn_upper','inn_side_cutaway','ceiling'):obj.visible_camera=False
            if view.startswith('shop-plan-'):
                obj.hide_render=layer not in ('bookshop_front','bookshop_shell','bookshop_side_cutaway','bookshop_interior') if view.endswith('floor') else layer!='bookshop_ceiling'
                if obj.type=='LIGHT':obj.hide_render=False
            if view!='street-production' and layer=='actor':obj.hide_render=True
        scene.view_layers[0].material_override=u.MATS['clay'] if view.startswith('shop-plan-') else None;scene.camera=bpy.data.objects[view];file=folder/(view+'.png');scene.render.filepath=str(file)
        start=time.perf_counter();bpy.ops.render.render(write_still=True);entry={'view':view,'path':'renders/'+file.name,'sha256':sha(file),'seconds':round(time.perf_counter()-start,2),'dimensions':[args.width,scene.render.resolution_y],'sourceSha256':identity};entries.append(entry)
        write(target,{'schema':'classic-renders.v3','sourceSha256':identity,'inputs':inputs,'engine':'Cycles','device':scene.cycles.device,'devices':devices,'samples':args.samples,'renders':entries,'complete':set(brief['requiredViews'])<=set(e['view'] for e in entries)})
        print('BOOKSHOP_RENDER='+json.dumps(entry),flush=True)


def main():
    p=argparse.ArgumentParser();p.add_argument('--views',default='all');p.add_argument('--render-existing',action='store_true');p.add_argument('--width',type=int,default=1440);p.add_argument('--samples',type=int,default=40);args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    PACKAGE.mkdir(parents=True,exist_ok=True);brief=read(PACKAGE/'room-brief.json')
    files=[Path(__file__),ROOT/'scripts/build-blender-classic-room-v2.py',ROOT/'scripts/build-blender-classic-railway.py',BASE/'classic-railway.blend',BASE/'licensed/provenance.json',PACKAGE/'room-layout.json',PACKAGE/'room-brief.json']
    inputs=[{'path':str(f.relative_to(ROOT)).replace('\\','/'),'sha256':sha(f)} for f in files]
    if args.render_existing:
        author=read(PACKAGE/'authoring-receipt.json');assert author['inputs']==inputs and author['source']['sha256']==sha(SOURCE);bpy.ops.wm.open_mainfile(filepath=str(SOURCE));u.MATS={m.name:m for m in bpy.data.materials}
    else:
        build();u.configure(args.samples,args.width);bpy.context.scene.camera=bpy.data.objects['shop-production'];bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)
        write(PACKAGE/'authoring-receipt.json',{'schema':'classic-authoring.v3','inputs':inputs,'source':{'path':SOURCE.name,'sha256':sha(SOURCE),'bytes':SOURCE.stat().st_size},'blenderVersion':bpy.app.version_string,'inheritedMaterialProvenance':'../classic-railway-v2/licensed/provenance.json','baseColorFactors':read(BASE/'authoring-receipt.json')['baseColorFactors'],'humanArtApproved':False})
    if args.views!='none':render_views(args,brief,inputs)
    print('BOOKSHOP_SOURCE='+str(SOURCE),flush=True)

if __name__=='__main__':main()
