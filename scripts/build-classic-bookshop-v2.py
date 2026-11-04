"""Refine the original bookshop joinery, practical lights and work corner."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,math,sys,time
import bpy,numpy as np
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-bookshop-v2';BASE=ROOT/'docs/3d-town/classic-station-v1'
spec=importlib.util.spec_from_file_location('retained_station',ROOT/'scripts/build-blender-classic-station.py');station=importlib.util.module_from_spec(spec);spec.loader.exec_module(station)
shop=station.shop;room=shop.room;u=station.u;F=.18
read,write,sha=station.read,station.write,station.sha
VIEWS=['shop-production','shop-workbench','shop-corner-sw','shop-corner-se','shop-corner-nw','shop-corner-ne','shop-low-entry','shop-ceiling-up','shop-ceiling-oblique-a','shop-ceiling-oblique-b','shop-plan-floor','shop-plan-ceiling','district-production']

def hash_geometry(obj):
    h=hashlib.sha256()
    if obj.type=='MESH':
        for v in obj.data.vertices:h.update(np.asarray(v.co,dtype='<f4').tobytes())
        for p in obj.data.polygons:h.update(np.asarray(p.vertices,dtype='<i4').tobytes())
    elif obj.type in ('FONT','CURVE'):h.update(str(obj.data.name).encode())
    return h.hexdigest()
def identity():
    return {o.name:{'geometry':hash_geometry(o),'matrix':[float(v) for row in o.matrix_world for v in row],
        'materials':[m.name if m else None for m in o.data.materials] if o.type in ('MESH','FONT','CURVE') else [],
        'light':(o.data.type,o.data.energy,list(o.data.color)) if o.type=='LIGHT' else None,'layer':o.get('layer')} for o in bpy.context.scene.objects}

def wallpaper():
    folder=P/'textures';folder.mkdir(parents=True,exist_ok=True)
    n=768;y,x=np.mgrid[0:n,0:n].astype(float)/n;rng=np.random.default_rng(1929)
    # Original repeating stem-and-leaf print. Low contrast keeps faces and
    # books legible in the elevated camera; all frequencies tile seamlessly.
    stems=np.exp(-(np.sin(math.tau*x*2+.14*np.sin(math.tau*y*2))/.065)**2)
    leaves=np.zeros((n,n))
    for cx,cy,angle in [(.0,.18,-.6),(.0,.68,.6),(.5,.43,-.6),(.5,.93,.6)]:
        for sign in (-1,1):
            dx=(x-(cx+sign*.055)+.5)%1-.5;dy=(y-cy+.5)%1-.5
            a=sign*angle;xx=dx*math.cos(a)+dy*math.sin(a);yy=-dx*math.sin(a)+dy*math.cos(a)
            ellipse=(xx/.054)**2+(yy/.115)**2
            outline=np.exp(-((ellipse-1)/.10)**2);vein=np.exp(-(xx/.006)**2)*(ellipse<1)
            leaves=np.maximum(leaves,np.maximum(outline,vein*.55))
    stripe=np.exp(-(np.sin(math.tau*(x-.25))/.11)**2)*.12
    grain=(rng.random((n,n))-.5)*.008;weave=.002*np.sin(x*math.tau*192)*np.cos(y*math.tau*192)
    color=np.array([.365,.391,.321])+(grain+weave)[...,None]
    pattern=np.maximum(stems*.38,leaves*.60)+stripe
    color=color+pattern[...,None]*np.array([.075,.070,.043])
    path=folder/'original-olive-print.png';u.png(path,color)
    mat=u.material('shop_olive_wallpaper','ffffff',.91,0,None,.38)
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path));tex.extension='REPEAT'
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    tex.image.pack();return mat

def panel_run(name,start,end,side):
    # Coordinates follow the inner face of the intact masonry shell. New
    # panels are backed and slightly overlap; no decorative false openings.
    length=(Vector(end)-Vector(start)).length;n=round(length/.63);step=length/n
    def box(s,t,z,w,h,depth,mat,edge=.003):
        pos=Vector(start).lerp(Vector(end),t/length)
        if side=='rear':loc=(pos.x,5.832-depth/2,F+z);size=(w,depth,h)
        elif side=='west':loc=(-6.282+depth/2,pos.y,F+z);size=(depth,w,h)
        else:loc=(1.082-depth/2,pos.y,F+z);size=(depth,w,h)
        obj=u.box(name+'_'+s,loc,size,mat,edge);obj['joineryPurpose']=s;return obj
    box('backing',length/2,.65,length,1.13,.020,'aged_walnut')
    for j in range(n):
        center=(j+.5)*step
        box('recessed_field',center,.665,step-.105,.775,.027,'shop_panel_field',.008)
        for sign in (-1,1):box('bead',center+sign*(step-.102)/2,.665,.014,.802,.039,'shop_panel_edge',.003)
        for z in (.274,1.056):box('bead',center,z,step-.105,.014,.039,'shop_panel_edge',.003)
    for j in range(n+1):box('stile',j*step,.65,.065,1.13,.048,'aged_walnut')
    for name2,z,h,depth in [('skirting',.09,.18,.060),('bottom_rail',.23,.07,.047),('top_rail',1.12,.12,.047),('cap_shadow',1.206,.028,.060),('dado_cap',1.234,.028,.073)]:
        box(name2,length/2,z,length,h,depth,'shop_panel_edge' if name2=='dado_cap' else 'aged_walnut',.006)

def materials_and_joinery():
    wallpaper()
    for name,factor in [('shop_panel_field',(.46,.50,.45)),('shop_panel_edge',(.66,.61,.49))]:
        material=bpy.data.materials['aged_walnut'].copy();material.name=name;u.MATS[name]=material
        for node in material.node_tree.nodes:
            if node.type=='MIX' and node.data_type=='RGBA' and node.blend_type=='MULTIPLY':node.inputs[7].default_value=(*factor,1)
        material['uvMeters']=1.5
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('shop_ground_side','shop_ground_rear')):
            obj.data.materials.clear();obj.data.materials.append(u.MATS['shop_olive_wallpaper']);u.uv(obj,.38)
    for side,start,end,layer in [('rear',(-6.23,5.79,0),(1.03,5.79,0),'bookshop_shell'),('west',(-6.25,.47,0),(-6.25,5.8,0),'bookshop_shell'),('east',(1.05,.47,0),(1.05,5.8,0),'bookshop_side_cutaway')]:
        u.LAY=layer;panel_run('shop_v2_'+side, start,end,side)
    # Existing crown profiles stay attached to the ceiling, now in timber.
    for obj in bpy.data.objects:
        if obj.name.startswith(('shop_cornice','shop_ceiling_beam')):
            obj.data.materials.clear();obj.data.materials.append(u.MATS['shop_panel_edge']);u.uv(obj,1.5)

def map_and_sconces():
    # Keep the original counter assembly, moving all of its supported props
    # together to enlarge the turn between the open door and staff passage.
    counter_prefixes=('shop_counter_','shop_ledger_','shop_bell_','shop_lamp_','shop_banker_')
    for obj in bpy.data.objects:
        if obj.name.startswith(counter_prefixes) or obj.name=='shop-counter-lamp':obj.location.y+=.18
    next(f for f in u.FIXTURES if f['id']=='shop-counter-lamp')['position'][1]+=.18
    for obj in list(bpy.data.objects):
        if obj.name.startswith('shop_map_'):bpy.data.objects.remove(obj,do_unlink=True)
    u.LAY='bookshop_shell';cx,cy,cz=-.37,5.765,F+2.13;w0,h0=.98,.68
    u.box('shop_v2_survey_back',(cx,cy,cz),(w0,.050,h0),'aged_walnut',.004)
    u.box('shop_v2_survey_paper',(cx,cy-.028,cz),(w0-.11,.004,h0-.11),'paper',0)
    for sign in (-1,1):
        u.box('shop_v2_survey_frame',(cx+sign*(w0-.032)/2,cy-.031,cz),(.032,.025,h0),'shop_panel_edge',.005)
        u.box('shop_v2_survey_frame',(cx,cy-.031,cz+sign*(h0-.032)/2),(w0,.025,.032),'shop_panel_edge',.005)
    ink_y=cy-.031
    # A restrained authored railway quarter diagram: public architecture,
    # not hidden case facts or a generated promise of discoverable evidence.
    for z in (-.135,-.117):u.tube('shop_v2_survey_track',[(cx-.38,ink_y,cz+z),(cx+.37,ink_y,cz+z+.052)],.0012,'ink')
    for j in range(27):
        x=cx-.37+j*.028;z=cz-.135+(x-cx+.38)/.75*.052
        u.tube('shop_v2_survey_sleeper',[(x,ink_y,z-.009),(x,ink_y,z+.026)],.0008,'ink')
    for x,width in [(-.31,.21),(-.03,.18),(.22,.16)]:
        for z in (.015,.145):
            u.tube('shop_v2_survey_block',[(cx+x-width/2,ink_y,cz+z),(cx+x+width/2,ink_y,cz+z),(cx+x+width/2,ink_y,cz+z+.073),(cx+x-width/2,ink_y,cz+z+.073),(cx+x-width/2,ink_y,cz+z)],.001,'ink')
    shop.label('shop_v2_survey_title','RIVERBEND', (cx,ink_y-.001,cz+.255),.45,'ink')
    shop.label('shop_v2_survey_caption','RAILWAY QUARTER', (cx,ink_y-.001,cz-.234),.37,'ink')
    for x in (-1.23,.74):
        u.LAY='bookshop_shell';z=F+2.00
        plate=u.box('shop_v2_sconce_plate',(x,5.817,z),(.08,.029,.20),'worn_bronze',.012);plate['support']='shop_ground_rear'
        u.tube('shop_v2_sconce_arm',[(x,5.805,z-.04),(x,5.70,z-.055),(x,5.57,z-.028),(x,5.54,z+.07)],.012,'worn_bronze')
        u.cylinder('shop_v2_sconce_cup',(x,5.54,z+.075),.049,.035,'worn_bronze',24)
        u.cylinder('shop_v2_sconce_socket',(x,5.54,z+.155),.014,.125,'worn_bronze',16)
        room.shade('shop_v2_sconce_shade',x,5.54,z+.19,.095,.20)
        for angle in (0,math.tau/3,2*math.tau/3):
            u.tube('shop_v2_sconce_spider',[(x+.015*math.cos(angle),5.54+.015*math.sin(angle),z+.21),(x+.050*math.cos(angle),5.54+.050*math.sin(angle),z+.39)],.0025,'worn_bronze')
        room.local_light('shop-v2-sconce-'+str(x),(x,5.54,z+.17),18,3.2,2.4)
    for name,watts,intensity in [('shop-pendant--3.5',90,12),('shop-pendant--1.1',75,10),('shop-window-daylight',210,6)]:
        fixture=next(f for f in u.FIXTURES if f['id']==name);fixture.update(sourceWatts=watts,runtimeIntensity=intensity)
        obj=bpy.data.objects.get(name if name!='shop-window-daylight' else 'shop_window_daylight');assert obj is not None,name;obj.data.energy=watts
    # Millimetre ink lines and support wires do not need high-order bevels.
    for obj in bpy.data.objects:
        if obj.type=='CURVE' and obj.name.startswith('shop_v2_'):
            obj.data.bevel_resolution=0;obj.data.resolution_u=1

def append_resident():
    source=ROOT/'docs/3d-town/classic-residents-v10/resident-03/rb-xu-zhiwei.blend'
    manifest=read(ROOT/'public/assets/classic-residents/v10/resident-03.json');assert sha(source)==manifest['sourceSha256']
    names=['rb-xu-zhiwei_skin','rb-xu-zhiwei_rig','restorer_workstation','restorer_book_anchor','restorer_bound_book','restorer_book_stand','restorer_felt_cradle']
    with bpy.data.libraries.load(str(source),link=False) as (available,chosen):
        # Preserve the complete explicitly named workstation hierarchy.
        chosen.objects=[n for n in available.objects if n in names or n.startswith('restorer_')]
    collection=bpy.data.collections.new('Retained v10 resident render reference');bpy.context.scene.collection.children.link(collection)
    objects=[]
    for obj in chosen.objects:
        if obj is None:continue
        collection.objects.link(obj);obj['layer']='review_resident';obj['runtimeExcluded']=True;objects.append(obj)
    for obj in objects:
        if obj.parent is None:obj.location+=Vector((.55,4.95,F))
    rig=bpy.data.objects['rb-xu-zhiwei_rig'];action=bpy.data.actions.get('InspectBook');assert action
    rig.animation_data_create();rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    return {'path':source.relative_to(ROOT).as_posix(),'sha256':sha(source),'purpose':'actual retained art character for room renders; independent runtime asset and no world binding'}

def render(source,folder,views,samples,width):
    bpy.ops.wm.open_mainfile(filepath=str(source));u.configure(samples,width);scene=bpy.context.scene;entries=[]
    for view in views:
        scene.frame_set(111)
        for obj in scene.objects:
            obj.hide_render=False;obj.visible_camera=obj.type!='LIGHT';layer=obj.get('layer')
            if layer=='actor':obj.hide_render=True
            if layer=='review_resident' and view not in ('shop-production','shop-workbench','district-production'):obj.hide_render=True
            if view in ('shop-production','shop-workbench') and layer in ('bookshop_front','bookshop_upper','bookshop_side_cutaway','bookshop_ceiling','inn_upper','inn_front','inn_side_cutaway','ceiling','inn_neighbor_cutaway'):
                obj.visible_camera=False
            if view.startswith('shop-plan-'):
                allowed=('bookshop_shell','bookshop_interior','bookshop_front','bookshop_side_cutaway') if view=='shop-plan-floor' else ('bookshop_ceiling',)
                if obj.type!='LIGHT':obj.hide_render=layer not in allowed
        scene.view_layers[0].material_override=bpy.data.materials['clay'] if view.startswith('shop-plan-') else None
        scene.camera=bpy.data.objects[view];path=folder/'renders'/(view+'.png');path.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True);entries.append({'view':view,'path':path.relative_to(folder).as_posix(),'sha256':sha(path)})
    write(folder/'render-receipt.json',{'sourceSha256':sha(source),'renderer':'Cycles','samples':samples,'renders':entries,'complete':set(VIEWS)<=set(views)})

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pilot',default='joinery-01');parser.add_argument('--formal',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    folder=P if args.formal else P/'pilots'/args.pilot;folder.mkdir(parents=True,exist_ok=True)
    source=BASE/'classic-station.blend';base_manifest=read(ROOT/'public/assets/classic-station/v1/manifest.json');assert sha(source)==base_manifest['sourceSha256']
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0;before=identity()
    u.MATS={m.name:m for m in bpy.data.materials};u.PACKAGE=P;u.LAY='bookshop_shell';u.PART='static';u.CONTACTS=[];u.FIXTURES=read(BASE/'lighting.json')['fixtures']
    materials_and_joinery();map_and_sconces();resident=append_resident()
    u.camera('shop-workbench',(1.55,1.45,F+1.47),(.55,4.95,F+.97),4.18)
    scene=bpy.context.scene;scene.frame_set(111);u.configure(48 if args.formal else 32,1600 if args.formal else 1280)
    for obj in scene.objects:obj.hide_render=False;obj.visible_camera=obj.type!='LIGHT'
    scene.camera=bpy.data.objects['shop-production'];bpy.ops.file.pack_all();bpy.context.view_layer.update();after=identity()
    removed=[n for n in before if n not in after];changed=[n for n in before if n in after and before[n]!=after[n]]
    assert all(n.startswith('shop_map_') for n in removed),removed
    assert all(n.startswith(('shop_ground_','shop_cornice','shop_ceiling_beam','shop-pendant-','shop_window_daylight','shop_counter_','shop_ledger_','shop_bell_','shop_lamp_','shop_banker_','shop-counter-lamp')) for n in changed),changed
    output=folder/'classic-bookshop.blend';bpy.ops.wm.save_as_mainfile(filepath=str(output))
    (folder/'builder.py').write_bytes(Path(__file__).read_bytes())
    inputs=[{'path':source.relative_to(ROOT).as_posix(),'sha256':sha(source)},resident]
    write(folder/'authoring-receipt.json',{'source':{'path':output.relative_to(ROOT).as_posix(),'sha256':sha(output)},'inputs':inputs,'builderSha256':sha(Path(__file__)),
        'newObjects':[n for n in after if n not in before],'changedRetainedObjects':changed,'replacedMapObjects':removed,'otherSourceObjectsUnchanged':len(before)-len(changed)-len(removed),
        'humanArtApproved':False,'worldBound':False,'noNewThirdPartyAssets':True})
    write(folder/'lighting.json',{'schema':'classic-lights.v4','fixtures':u.FIXTURES,'runtimeCalibration':'Shared fixture positions and explicit artistic intensities. Blender watts are not runtime lumens; current preview has no baked lightmap.'})
    contract=read(BASE/'scene-contract.json')
    for item in contract['colliders']:
        if item['id'].startswith('shop-side-'):item['size'][0]=.44
        if item['id']=='shop-rear':item['size'][1]=.49
        if item['id']=='shop-counter':item['center'][1]+=.18
    write(folder/'scene-contract.json',contract)
    render(output,folder,VIEWS if args.formal else ['shop-workbench','shop-production','shop-ceiling-oblique-b'],48 if args.formal else 32,1600 if args.formal else 1280)
    print(json.dumps({'sourceSha256':sha(output),'newObjects':len(after)-len(before)+len(removed),'changedRetainedObjects':changed,'renderCount':len(VIEWS) if args.formal else 3}))

if __name__=='__main__':main()
