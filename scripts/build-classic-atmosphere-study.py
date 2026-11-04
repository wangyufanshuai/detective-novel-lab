"""A source-preserving native Blender composition study after the user's art rejection.

This is the FIRST composition/light study, not Function/Form/runtime approval.
No scene, save, resident, or public asset is replaced by this script.
"""
from pathlib import Path
import argparse, bpy, hashlib, importlib.util, json, math, sys, time
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2/layout-01/room.blend'
PACKAGE = ROOT / 'docs/3d-town/classic-atmosphere-v1'
p=argparse.ArgumentParser();p.add_argument('--attempt',default='study-01');p.add_argument('--samples',type=int,default=48);p.add_argument('--width',type=int,default=1440)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);OUT=PACKAGE/args.attempt
OUT.mkdir(exist_ok=True);assert not any(OUT.iterdir()), 'Keep every populated art attempt'
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
write=lambda f,d:f.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
base_hash=sha(BASE)
bpy.ops.wm.open_mainfile(filepath=str(BASE));scene=bpy.context.scene
spec=importlib.util.spec_from_file_location('room_geometry',ROOT/'scripts/build-blender-classic-railway.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
u.MATS={m.name:m for m in bpy.data.materials};u.LAY='interior';u.PART='atmosphere-study'
F=.18
before_objects=set(bpy.data.objects.keys())

def shader(mat):return next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
def color_finish(name,saturation,value,normal=.20):
    mat=u.MATS[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=shader(mat)
    if bs.inputs['Base Color'].is_linked:
        src=bs.inputs['Base Color'].links[0].from_socket
        hue=nodes.new('ShaderNodeHueSaturation');hue.name='Study pigment and grain restraint';hue.inputs['Saturation'].default_value=saturation;hue.inputs['Value'].default_value=value
        links.new(src,hue.inputs['Color']);links.new(hue.outputs['Color'],bs.inputs['Base Color'])
    for node in nodes:
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=normal

for name in ('aged_walnut','polished_walnut'):
    color_finish(name,.64,.68)
for i in range(5):color_finish('parquet_oak_'+str(i),.52,.60,.16)
color_finish('oxblood_leather',.66,.64,.25)
for name in ('curtain','woven_carpet'):
    bs=shader(u.MATS[name]);bs.inputs['Sheen Weight'].default_value=.32
    bs.inputs['Sheen Roughness'].default_value=.72

# A quiet, original botanical print. The metres-based UVs are authored below.
n=768; yy,xx=np.mgrid[0:n,0:n]/n
stem=np.exp(-((xx-.5-.055*np.sin(yy*math.tau))/.009)**2)
pattern=stem*.28
for cy in (.20,.43,.66,.89):
    for side in (-1,1):
        dx=(xx-(.5+side*.095));dy=yy-cy
        a=side*.65
        rx=dx*math.cos(a)+dy*math.sin(a);ry=-dx*math.sin(a)+dy*math.cos(a)
        leaf=np.exp(-((rx/.075)**2+(ry/.022)**2)*2.4)
        pattern+=leaf*.50
rgb=np.array([.205,.229,.186])[None,None,:]+pattern[...,None]*np.array([.065,.060,.035])
rgb+=(np.sin(xx*math.tau*211)*np.sin(yy*math.tau*193))[...,None]*.002
u.png(OUT/'original-olive-wallpaper.png',rgb)
mat=u.material('study_olive_wallpaper','ffffff',.94)
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'original-olive-wallpaper.png'))
mat.node_tree.links.new(tex.outputs['Color'],shader(mat).inputs['Base Color'])

def wallpaper(name,center,size,axis):
    o=u.box(name,center,size,'study_olive_wallpaper',0)
    uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
    for loop in o.data.loops:
        co=o.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((co.x if axis=='y' else co.y)/.28,co.z/.42)
    return o

# Back and side walls have no new openings; lining meets the retained substrate.
wallpaper('study_rear_wallpaper',(6.4,6.626,2.36),(8.40,.008,1.73),'y')
wallpaper('study_west_wallpaper',(2.174,3.4,2.36),(.008,6.40,1.73),'x')
wallpaper('study_east_wallpaper',(10.626,3.4,2.36),(.008,6.40,1.73),'x')

# Curved leather wings and continuous edging add construction to the retained
# chairs, within their existing plan envelope. Their existing matrix places them.
for name,cx,cy in [('chair-west',6.25,3.22),('chair-east',9.15,3.65)]:
    transform=bpy.data.objects[name+'_tufted_back'].matrix_world.copy()
    for side in (-1,1):
        verts=[];nu=12;nv=18
        for j in range(nv+1):
            t=j/nv;z=F+.76+t*.43
            for i in range(nu+1):
                s=i/nu
                verts.append((cx+side*(.365+.05*math.sin(math.pi*s)*math.sin(math.pi*t)),cy+.29-s*(.19+.04*math.sin(math.pi*t)),z))
        faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
        ob=u.mesh('study_'+name+'_wing',verts,faces,'oxblood_leather',True);ob.matrix_world=transform
        mod=ob.modifiers.new('Upholstery thickness','SOLIDIFY');mod.thickness=.027
        uv=ob.data.uv_layers.new(name='UVMap')
        for loop in ob.data.loops:
            v=ob.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.y/.56,v.z/.56)
        points=[(cx+side*.366,cy+.10-.04*math.sin(math.pi*t),F+.76+t*.43) for t in np.linspace(0,1,24)]
        edge=u.tube('study_'+name+'_wing_seam',points,.0035,'lining');edge.matrix_world=transform

# A restrained library corner, outside the retained left arrival aisle.
cx,cy,w,d,h=3.18,6.36,1.10,.44,1.80
for x in (cx-w/2,cx+w/2):u.box('study_library_side',(x,cy,F+h/2),(.045,d,h),'aged_walnut',.008)
u.box('study_library_back',(cx,6.595,F+h/2),(w,.025,h),'aged_walnut',.004)
for z in (.08,.55,1.02,1.49,1.80):u.box('study_library_shelf',(cx,cy,F+z),(w+.03,d+.02,.042),'polished_walnut',.006)
for row,z in enumerate((.102,.572,1.042)):
    for i in range(14):
        bw=.045+.012*((i*7+row)%3);bh=.22+.018*((i*5+row)%6)
        bx=cx-.47+i*.068;by=6.28+.009*(i%3)
        color=('book_green','book_red','book_ochre')[((i*5)+row)%3]
        u.box('study_library_book',(bx,by,F+z+bh/2),(bw,.22,bh),color,.0025)
        for zz in (.05,bh-.04):u.box('study_book_spine_rule',(bx,by-.112,F+z+zz),(bw*.76,.003,.004),'worn_bronze',0)

# Supported practical light on the rear-left of the existing tea table.
x,y,z=7.35,3.64,F+.81
u.cylinder('study_table_lamp_base',(x,y,z+.016),.10,.032,'worn_bronze',32)
u.cylinder('study_table_lamp_stem',(x,y,z+.135),.014,.22,'worn_bronze',24)
u.sphere('study_table_lamp_bowl',(x,y,z+.20),(.045,.045,.045),'worn_bronze',24)
verts=[];segments=96
for row,(zz,r) in enumerate(((z+.245,.16),(z+.48,.09))):
    for i in range(segments):
        a=i*math.tau/segments;rr=r+(.003 if i%2 else -.003);verts.append((x+math.cos(a)*rr,y+math.sin(a)*rr,zz))
shade=u.mesh('study_table_lamp_shade',verts,[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)],'lampshade',True)
mod=shade.modifiers.new('Fabric lining','SOLIDIFY');mod.thickness=.0018
for zz,r in ((z+.245,.16),(z+.48,.09)):
    u.tube('study_shade_binding',[(x+math.cos(a)*r,y+math.sin(a)*r,zz) for a in np.linspace(0,math.tau,49)],.003,'embroidered_trim')
u.sphere('study_table_lamp_bulb',(x,y,z+.30),(.025,.025,.035),'warm_bulb',16)
data=bpy.data.lights.new('study_table_lamp','POINT');data.energy=24;data.color=(1,.68,.35);data.shadow_soft_size=.035
light=bpy.data.objects.new('study_table_lamp',data);bpy.context.collection.objects.link(light);light.location=(x,y,z+.27)

# The unsealed correspondence is scene dressing, not an accepted case fact.
u.paper('study_unsealed_letter',7.55,2.99,F+.815,.22,.145)
u.box('study_envelope',(7.83,3.03,F+.814),(.19,.115,.002),'paper',.001)
u.tube('study_envelope_flap',[(7.735,3.087,F+.816),(7.83,3.025,F+.816),(7.925,3.087,F+.816)],.0006,'book_ochre')

# Reduce broad overhead illumination; real windows and visible fittings lead.
for obj in scene.objects:
    if obj.type!='LIGHT':continue
    name=obj.name
    if name=='hazy_daylight':obj.data.energy=.22;obj.data.color=(.75,.84,1)
    elif name=='broad_overcast_key':obj.data.energy=600;obj.data.color=(.67,.78,1)
    elif name.startswith('window_fill_'):obj.data.energy=300;obj.data.color=(.70,.81,1)
    elif name=='sitting_room_pendant_light':obj.data.energy=22
    elif name=='reading-lamp-light':obj.data.energy=44
    elif name.startswith('wall-sconce'):obj.data.energy=20
    elif name=='console-lamp-light':obj.data.energy=24
    elif name=='hearth-embers':obj.data.energy=13
world=scene.world;world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.53,.70,1);world.node_tree.nodes['Background'].inputs[1].default_value=.18
for obj in scene.objects:
    if obj.type in ('MESH','CURVE','FONT'):
        obj.hide_render=False;obj.visible_camera=True
    if obj.type=='LIGHT':obj.hide_render=False

fixtures=[{'id':o.name,'type':o.data.type,'position':list(o.location),'sourceWatts':o.data.energy,'color':list(o.data.color)} for o in scene.objects if o.type=='LIGHT']
write(OUT/'lighting.json',{'fixtures':fixtures,'runtimeCalibrated':False,'scope':'Native Blender lights for first composition study; no exported equivalence.'})
camera=u.camera('study_observation',(4.12,.80,1.75),(7.55,4.38,1.40),lens=26)
game=u.camera('study_exploration',(11.5,-2.5,8.0),(6.70,3.50,1.10),scale=9.5)
devices=u.configure(args.samples,args.width);scene.view_settings.exposure=.55
scene.camera=camera;scene.render.image_settings.color_mode='RGB'
scene['artStatus']='composition-study-only-after-user-rejected-current-visual-style'
scene['humanApproved']=False
new_objects=sorted(set(bpy.data.objects.keys())-before_objects)
write(OUT/'authored-objects.json',{'objects':new_objects,'sourceScene':str(BASE.relative_to(ROOT)),'sourceSha256':base_hash,'newPaidOrDownloadedAssets':False})
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
source=OUT/'room.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
report={'complete':False,'stage':'composition-and-lighting-study','sourceSha256':sha(source),'parentSha256':base_hash,'builderSha256':sha(Path(__file__)),'devices':devices,'samples':args.samples,'renders':[],
        'humanApproved':False,'functionPassed':False,'formPassed':False,'runtimePassed':False,'exported':False,
        'limitations':['Character redesign is not part of this first environment study.','Four-corner/ceiling review and full Function/Form remain pending.','Offline material nodes require baking/calibration before WebGL.','No gameplay, world decision, evidence or saved state changed.']}
for name,cam in [('observation',camera),('exploration',game)]:
    scene.camera=cam
    for obj in scene.objects:
        if obj.type in ('MESH','CURVE','FONT'):
            obj.visible_camera=not(name=='exploration' and obj.get('layer') in ('ceiling','inn_upper','inn_front','inn_side_cutaway'))
    scene.render.filepath=str(OUT/(name+'.png'));started=time.monotonic();bpy.ops.render.render(write_still=True)
    report['renders'].append({'view':name,'file':name+'.png','sha256':sha(OUT/(name+'.png')),'seconds':round(time.monotonic()-started,2),'camera':list(cam.location),'cameraType':cam.data.type,'dimensions':[scene.render.resolution_x,scene.render.resolution_y]})
    write(OUT/'render-review.json',report);print(json.dumps({'view':name,'complete':True}),flush=True)
assert sha(BASE)==base_hash
report['complete']=True;write(OUT/'render-review.json',report)
(OUT/'builder.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'renders':len(report['renders']),'source':str(source)}),flush=True)
