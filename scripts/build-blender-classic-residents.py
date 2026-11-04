"""Clothed classical town residents, authored with background Blender.

Pinned CC0 anatomy; original clothing, hair, props and animation. No world
decisions, private knowledge or character secrets are copied into these assets.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import numpy as np

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v1'


def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


inv=module('character_authorship',ROOT/'scripts/build-blender-classic-investigator.py')
anatomy=module('resident_anatomy',ROOT/'scripts/classic-resident-anatomy.py')
u=inv.u
u.PACKAGE=PACKAGE;inv.PACKAGE=PACKAGE
GARMENT=None


def detail_tube(name,points,radius,mat,weights):
    ob=u.tube(name,points,radius,mat)
    ob.data.resolution_u=3;ob.data.bevel_resolution=0
    return inv.skin(ob,weights)


def detail_sphere(name,loc,scale,mat,weights):
    if max(scale)>.008:return inv.skin(u.sphere(name,loc,scale,mat),weights)
    bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=8,radius=1)
    mesh=bpy.data.meshes.new(name);bm.to_mesh(mesh);bm.free()
    for v in mesh.vertices:v.co=Vector(loc)+Vector((v.co.x*scale[0],v.co.y*scale[1],v.co.z*scale[2]))
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(u.MATS[mat]);u.tag(ob)
    for poly in mesh.polygons:poly.use_smooth=True
    u.uv(ob);return inv.skin(ob,weights)


inv.tube=detail_tube;inv.sphere=detail_sphere


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def materials(p):
    u.MATS.clear()
    for name,color,rough,metal in [
        ('coat',p['coat'],.84,0),('accent',p['accent'],.80,0),('shirt','c6bda5',.82,0),
        ('trousers','464444' if p['body']=='male' else '514650',.91,0),
        ('skin',p['skin'],.58,0),('hair',p['hairColor'],.70,0),
        ('iris','4c4a31',.35,0),('ivory','b5b2a4',.30,0),
        ('ink','252823',.49,0),('leather','503e2c',.58,0),('brass','ae915d',.34,.72)]:
        u.material(name,color,rough,metal)
    u.MATS['hair_high']=u.MATS['hair'];u.MATS['fold']=u.MATS['coat'];u.MATS['shoe']=u.MATS['ink']
    u.MATS['skin'].node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.075
    # Vertex colours are directly readable by both Cycles and glTF.
    mat=u.MATS['skin'];tree=mat.node_tree;bsdf=tree.nodes['Principled BSDF'];base=tuple(bsdf.inputs['Base Color'].default_value)
    color=tree.nodes.new('ShaderNodeVertexColor');color.layer_name='SkinTone'
    mult=tree.nodes.new('ShaderNodeMix');mult.data_type='RGBA';mult.blend_type='MULTIPLY';mult.inputs[0].default_value=1.;mult.inputs[6].default_value=base
    tree.links.new(color.outputs['Color'],mult.inputs[7]);tree.links.new(mult.outputs[2],bsdf.inputs['Base Color'])
    # Original tileable twill normal, shared by all fabric colours.
    texture=PACKAGE/'textures'/'fine-twill-normal.png'
    if not texture.exists():
        texture.parent.mkdir(parents=True,exist_ok=True);n=256;y,x=np.mgrid[0:n,0:n]/n
        h=np.sin((x+y)*math.tau*32)*.00002+np.sin((x-y)*math.tau*64)*.000004
        dx=(np.roll(h,-1,1)-np.roll(h,1,1))*n/2;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*n/2
        normal=np.stack((-dx,-dy,np.ones_like(dx)),axis=-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
        u.png(texture,normal*.5+.5)
    for name in ('coat','shirt','trousers','accent'):
        m=u.MATS[name];m['uvMeters']=.12
        nodes=m.node_tree.nodes;im=nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(texture),check_existing=True);im.image.colorspace_settings.name='Non-Color'
        normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45
        m.node_tree.links.new(im.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],nodes['Principled BSDF'].inputs['Normal'])


def loft(name,rings,mat,weights,sides=32,open_front=0,folds=0):
    # No automatic dense solidification; topology density follows silhouette.
    verts=[];faces=[];count=sides+1 if open_front else sides
    for row,(z,rx,ry,cx,cy) in enumerate(rings):
        gap=math.asin(min(.95,open_front/rx)) if open_front else 0
        for j in range(count):
            a=gap+(math.tau-2*gap)*j/sides
            ripple=1+folds*math.cos(a*12)*max(0,(rings[-1][0]-z)/(rings[-1][0]-rings[0][0]))
            verts.append((cx+rx*math.sin(a)*ripple,cy-ry*math.cos(a)*ripple,z))
    for row in range(len(rings)-1):
        for j in range(sides):
            k=j+1 if open_front else (j+1)%count
            faces.append((row*count+j,row*count+k,(row+1)*count+k,(row+1)*count+j))
    if not open_front:
        faces.extend([tuple(reversed(range(count))),tuple((len(rings)-1)*count+j for j in range(count))])
    ob=u.mesh(name,verts,faces,mat,True)
    if open_front:
        mod=ob.modifiers.new('fabric_edge','SOLIDIFY');mod.thickness=.003;mod.offset=-1
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    return inv.skin(ob,weights)


def panel(name,outline,mat,weight='chest',offset=.003):
    # Bilinear grid with the correct chest curvature, rather than a flat n-gon.
    a,b,c,d=[Vector(p) for p in outline];verts=[];faces=[];n=6
    for i in range(n+1):
        for j in range(n+1):
            q=(a*(1-j/n)+b*j/n)*(1-i/n)+(d*(1-j/n)+c*j/n)*(i/n)
            if GARMENT and name not in ('cap_peak','linen_apron_bib','apron_patch_pocket') and q.z>.86:
                hit=GARMENT.ray_cast(Vector((q.x,-.5,q.z)),Vector((0,1,0)))[0]
                layers={'shirt_front':.007,'tie':.018,'collar_leaf':.021,'jacket_notched_lapel':.015,'draped_shawl':.012}
                if hit:q.y=hit.y-layers.get(name,.008)
            q.y-=offset;verts.append(q)
    for i in range(n):
        for j in range(n):k=i*(n+1)+j;faces.append((k,k+1,k+n+2,k+n+1))
    return inv.skin(u.mesh(name,verts,faces,mat,True),weight)


def sleeves(mat):
    for s,side in [(-1,'L'),(1,'R')]:
        loft('set_in_sleeve_'+side,[(.946,.034,.038,s*.278,-.025),(.99,.042,.045,s*.279,-.018),
            (1.10,.054,.057,s*.283,-.013),(1.18,.063,.065,s*.284,-.013),
            (1.25,.066,.071,s*.278,-.008),(1.35,.071,.077,s*.263,.002),
            (1.42,.079,.080,s*.245,.008),(1.47,.073,.073,s*.218,.008),
            (1.487,.042,.046,s*.194,.008)],mat,inv.arm_weight(side),28)
        loft('cuff_'+side,[(.934,.032,.034,s*.278,-.025),(.957,.036,.038,s*.278,-.025)],'shirt','hand_'+side,24)
        inv.sphere('cuff_fastening_'+side,(s*.314,-.029,.951),(.0035,.004,.005),'brass','hand_'+side)


def legs(p):
    female=p['body']=='female'
    for s,side in [(-1,'L'),(1,'R')]:
        x=s*.102
        rings=[(.095,.052 if female else .063,.053,x,-.004),(.18,.054 if female else .068,.062,x,-.002),
             (.32,.058 if female else .065,.063,x,-.015),(.515,.072,.076,x,-.030),
             (.72,.083,.088,x,-.008),(.96,.086,.092,x,0)]
        if female:rings=rings[:3]+[(.41,.064,.067,x,-.02)]
        loft(('stocking_' if female else 'pressed_trousers_')+side,rings,'trousers',inv.leg_weight(side),24)
        width=.061 if female else .075;depth=.122 if female else .149
        loft('leather_shoe_'+side,[(.020,width,depth,x,-.046),(.045,width+.002,depth+.004,x,-.049),
             (.073,width-.004,depth-.013,x,-.040),(.109,.051,.062,x,.005),(.129,.045,.049,x,.015)],'shoe','foot_'+side,28)
        loft('welted_sole_'+side,[(0,width,depth,x,-.049),(.009,width+.002,depth+.004,x,-.049),(.022,width+.002,depth+.004,x,-.049)],'leather','foot_'+side,28)
        inv.box('heel_'+side,(x,.040,.011),(.096 if female else .12,.069,.022),'shoe','foot_'+side,.004)
        if female:
            inv.tube('shoe_strap_'+side,[(x-width,-.015,.074),(x,-.036,.102),(x+width,-.015,.074)],.0035,'leather','foot_'+side)
        else:
            for i in range(3):inv.tube('laces_'+side,[(x-.022,-.057+i*.016,.101),(x+.022,-.052+i*.016,.101)],.0014,'leather','foot_'+side)


def clothes(p):
    global GARMENT
    female=p['body']=='female';outfit=p['outfit']
    loft('standing_linen_collar',[(1.539,.064,.064,0,.009),(1.555,.060,.059,0,.009),(1.563,.057,.056,0,.009)],'shirt','head',32)
    if female:
        skirt=[(.18,.275,.204,0,.012),(.34,.267,.198,0,.009),(.55,.244,.183,0,.005),
               (.75,.218,.163,0,.002),(.90,.193,.146,0,0),(1.015,.167,.132,0,0),(1.075,.162,.126,0,0)]
        loft('gored_wool_skirt',skirt,'trousers',inv.coat_weight,48,folds=.018)
        top=[(1.035,.172,.130,0,0),(1.10,.168,.128,0,0),(1.21,.195,.138,0,0),
             (1.31,.208,.143,0,0),(1.40,.211,.131,0,.004),(1.47,.200,.105,0,.009),
             (1.51,.163,.086,0,.009),(1.551,.058,.054,0,.009)]
        blouse='shirt' if outfit in ('restorer','apron','flower','vest') else 'coat'
        garment=anatomy.garment(u,inv,p,blouse,1.02)
        GARMENT=BVHTree.FromPolygons([v.co for v in garment.data.vertices],[f.vertices for f in garment.data.polygons])
        if outfit not in ('restorer','apron','flower'):
            for z in (1.12,1.20,1.28,1.36,1.435):inv.sphere('blouse_button',(0,-(.145 if z<1.38 else .126),z),(.004,.003,.004),'brass',inv.torso)
        loft('waistband',[(1.014,.184,.145,0,.006),(1.065,.183,.143,0,.006)],'accent',inv.torso,40)
        if outfit in ('restorer','apron','flower'):
            panel('linen_apron_bib',[(-.094,-.166,1.39),(.094,-.166,1.39),(.13,-.146,1.035),(-.13,-.146,1.035)],'accent',inv.torso)
            # Full front apron follows the widening skirt and has a real lower hem.
            verts=[];faces=[]
            for ri,z in enumerate([.32,.50,.72,.91,1.045]):
                rx=.17+(1.045-z)*.076;ry=.136+(1.045-z)*.099
                for j in range(19):
                    a=-.76+j/18*1.52
                    verts.append((rx*math.sin(a)*1.25,-ry*math.cos(a)-.012,z))
            for ri in range(4):
                for j in range(18):k=ri*19+j;faces.append((k,k+1,k+20,k+19))
            inv.skin(u.mesh('working_apron',verts,faces,'accent',True),inv.coat_weight)
            for s in (-1,1):inv.tube('apron_shoulder_strap',[(s*.075,-.145,1.38),(s*.11,-.083,1.51),(s*.12,.063,1.51),(s*.11,.133,1.13)],.009,'accent',inv.torso)
            panel('apron_patch_pocket',[(-.066,-.184,.90),(.066,-.184,.90),(.066,-.198,.77),(-.066,-.198,.77)],'coat',inv.coat_weight)
        if outfit in ('shawl','teacher'):
            # Broad shawl reads as a separate silhouette in the play camera.
            for s in (-1,1):
                panel('draped_shawl',[(s*.016,-.072,1.548),(s*.234,-.075,1.454),
                    (s*.27,-.109,1.264),(s*.055,-.160,1.345)],'accent',inv.torso)
                # The edge trim follows the same shoulder surface as the shawl.
                path=[]
                for x,z in [(s*.016,1.548),(s*.14,1.41),(s*.055,1.345)]:
                    hit=GARMENT.ray_cast(Vector((x,-.5,z)),Vector((0,1,0)))[0]
                    path.append((x,hit.y-.021 if hit else -.10,z))
                inv.tube('shawl_piping',path,.0015,'shirt',inv.torso)
            inv.sphere('shawl_brooch',(0,-.123,1.446),(.013,.005,.018),'brass','chest')
        if outfit in ('reporter','vest'):
            for s in (-1,1):panel('fitted_waistcoat',[(s*.01,-.151,1.04),(s*.173,-.125,1.045),(s*.184,-.106,1.45),(s*.055,-.115,1.38)],'coat',inv.torso)
    else:
        top=[(.87,.211,.155,0,.008),(.99,.204,.148,0,.004),(1.11,.193,.146,0,0),
            (1.24,.214,.154,0,0),(1.35,.233,.151,0,.004),(1.44,.237,.131,0,.008),
            (1.49,.207,.106,0,.011),(1.553,.061,.056,0,.011)]
        garment=anatomy.garment(u,inv,p,'coat',.87)
        GARMENT=BVHTree.FromPolygons([v.co for v in garment.data.vertices],[f.vertices for f in garment.data.polygons])
        panel('shirt_front',[(-.055,-.066,1.544),(.055,-.066,1.544),(.048,-.152,1.355),(-.048,-.152,1.355)],'shirt',inv.torso)
        for s in (-1,1):
            panel('collar_leaf',[(s*.011,-.069,1.549),(s*.06,-.061,1.535),(s*.074,-.116,1.46),(s*.022,-.123,1.499)],'shirt',inv.torso)
            panel('jacket_notched_lapel',[(s*.061,-.080,1.53),(s*.143,-.104,1.45),(s*.075,-.164,1.245),(s*.013,-.164,1.27)],'coat',inv.torso,.004)
            panel('jacket_pocket',[(s*.075,-.153,1.12),(s*.183,-.092,1.12),(s*.186,-.095,1.01),(s*.078,-.157,1.01)],'coat',inv.torso,.008)
        panel('tie',[(-.012,-.128,1.508),(.012,-.128,1.508),(.017,-.169,1.31),(-.017,-.169,1.31)],'accent','chest')
        for s in (-1,1):
            for z in (1.07,1.19,1.30):inv.sphere('jacket_button',(s*.059,-.159,z),(.007,.004,.007),'brass',inv.torso)
        if outfit in ('station','constable','postman'):
            loft('peaked_cap_band',[(1.756,.091,.096,0,.018),(1.791,.094,.099,0,.015)],'ink','head',48)
            loft('peaked_cap_crown',[(1.787,.097,.102,0,.015),(1.810,.113,.119,0,.013),(1.836,.107,.111,0,.014),(1.851,.070,.075,0,.014)],'coat','head',48)
            panel('cap_peak',[(-.096,-.061,1.77),(.096,-.061,1.77),(.078,-.162,1.75),(-.078,-.162,1.75)],'ink','head')
            inv.sphere('original_station_roundel',(0,-.100,1.796),(.012,.003,.015),'brass','head')
            for s in (-1,1):inv.tube('cap_braid',[(0,-.109,1.777),(s*.054,-.091,1.779),(s*.09,-.034,1.783)],.002,'brass','head')
        if outfit=='station':
            for s in (-1,1):inv.tube('station_moustache',[(s*.002,-.137,1.648),(s*.013,-.133,1.646),(s*.025,-.119,1.642)],.0027,'hair','head')


def accessories(p):
    outfit=p['outfit']
    if outfit in ('restorer','teacher','watchmaker'):
        for s in (-1,1):
            points=[(s*.031+math.cos(a)*.016,-.111,1.688+math.sin(a)*.011) for a in [j*math.tau/24 for j in range(25)]]
            inv.tube('wire_spectacle_rim',points,.0008,'brass','head')
            inv.tube('spectacle_temple',[(s*.047,-.109,1.689),(s*.073,-.055,1.692),(s*.082,.005,1.689)],.0008,'brass','head')
        inv.tube('spectacle_bridge',[(-.015,-.111,1.690),(0,-.117,1.694),(.015,-.111,1.690)],.0008,'brass','head')
    if outfit=='restorer':
        for s in (-1,1):
            inv.tube('bookbinder_brush',[(s*.034,-.199,.815),(s*.034,-.195,.963)],.0025,'leather',inv.coat_weight)
        inv.box('linen_book_spine',(.115,-.206,.827),(.025,.027,.132),'leather',inv.coat_weight,.001)
    if outfit in ('postman','reporter'):
        inv.box('worn_leather_satchel',(.335,.018,.93),(.14,.14,.20),'leather','bag',.012)
        inv.box('satchel_flap',(.335,-.059,.963),(.143,.012,.12),'leather','bag',.004)
        inv.tube('shoulder_strap',[(-.18,-.082,1.49),(-.13,-.159,1.37),(.11,-.17,1.16),(.33,-.069,1.0)],.008,'leather',inv.torso)
    if outfit=='reporter':
        inv.box('folding_camera',(.08,-.173,1.14),(.092,.057,.071),'ink',inv.torso,.004)
        inv.sphere('camera_lens',(.08,-.208,1.14),(.022,.013,.022),'brass',inv.torso)
    if outfit=='carpenter':
        loft('tool_belt',[(.978,.208,.154,0,0),(1.012,.207,.153,0,0)],'leather',inv.torso,40)
        inv.box('hammer_handle',(.21,-.13,.851),(.025,.023,.25),'leather',inv.torso,.003)
        inv.box('hammer_head',(.21,-.13,.982),(.11,.031,.04),'ink',inv.torso,.004)
    if outfit=='flower':
        for i in range(3):
            x=-.028+i*.029
            inv.tube('flower_stem',[(x,-.199,.835),(x,-.183,.99+i*.012)],.0016,'coat',inv.coat_weight)
            for j in range(5):
                a=j*math.tau/5;inv.sphere('flower_petal',(x+.009*math.cos(a),-.187,1.0+i*.012+.009*math.sin(a)),(.007,.003,.007),'shirt',inv.coat_weight)
    if outfit in ('shawl','teacher'):
        for i in range(17):
            a=-1.12+i*2.24/16
            inv.sphere('small_pearl',(math.sin(a)*.057,-.079-math.cos(a)*.026,1.516-.017*math.cos(a)),(.003,.003,.003),'ivory','chest')


def make(profile):
    global GARMENT
    GARMENT=None
    inv.SKIN.clear();inv.BONES.clear();inv.RIG=None
    materials(profile);clothes(profile);legs(profile)
    head,_,_=anatomy.anatomy(u,inv,profile);anatomy.hair(u,inv,head,profile);accessories(profile)
    # Avoid undefined zero vertex colours when Blender joins coloured skin and clothing.
    for obj in inv.SKIN:
        if not obj.data.color_attributes.get('SkinTone'):
            ca=obj.data.color_attributes.new(name='SkinTone',type='FLOAT_COLOR',domain='POINT')
            ca.data.foreach_set('color',[1.,1.,1.,1.]*len(obj.data.vertices))
            obj.data.color_attributes.active_color=ca
    body=inv.rig();rig=inv.RIG;body.name=profile['id']+'_skin';rig.name=profile['id']+'_rig'
    body['origin']='project clothing, hair and props plus pinned CC0 anatomical mesh';body['actorId']=profile['actorId'];body['worldBound']=False
    scale=profile['height']/1.802;rig.scale=(scale*profile['build'],scale,scale)
    clips=inv.animate();bpy.context.view_layer.update()
    return body,rig,clips


def review(body,rig):
    body.data.calc_loop_triangles();invalid=[v.index for v in body.data.vertices if not v.groups or abs(sum(g.weight for g in v.groups)-1)>1e-5 or len(v.groups)>4]
    assert not invalid
    frames=[]
    for kind,count in [('Idle',90),('Walk',24)]:
        for f in range(count+1):
            inv.pose(kind,f/count);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
            ev=body.evaluated_get(dg);mesh=ev.to_mesh();coords=[body.matrix_world@v.co for v in mesh.vertices]
            bounds=[[min(v[k] for v in coords),max(v[k] for v in coords)] for k in range(3)]
            frames.append({'clip':kind,'frame':f,'bounds':bounds});ev.to_mesh_clear()
    inv.pose('Idle',0);bpy.context.view_layer.update()
    assert min(f['bounds'][2][0] for f in frames)>-.012
    return {'triangles':len(body.data.loop_triangles),'vertices':len(body.data.vertices),'bones':len(rig.data.bones),
        'materials':len(body.data.materials),'invalidWeightVertices':invalid,'animatedBounds':frames,
        'blendedWeightVertices':sum(len(v.groups)>1 for v in body.data.vertices),
        'humanArtApproved':False,'worldBound':False}


def setup_stage():
    inv.stage()
    u.camera('portrait',(1.1,-2.8,1.90),(0,-.015,1.515),.70)
    u.camera('face-front',(0,-3,1.655),(0,-.015,1.655),.48)
    u.camera('hands',(1.4,-2.5,1.3),(0,-.03,.92),.85)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ids',default='resident-03,resident-06,resident-08');parser.add_argument('--views',default='three-quarter,portrait,face-front,profile,back,walk-passing,hands');parser.add_argument('--width',type=int,default=1000);parser.add_argument('--samples',type=int,default=48)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    profiles=json.loads((PACKAGE/'profiles.json').read_text(encoding='utf-8'))['profiles']
    wanted={p['actorId'] for p in profiles} if args.ids=='all' else set(args.ids.split(','))
    for p in profiles:
        if p['actorId'] not in wanted:continue
        bpy.ops.wm.read_factory_settings(use_empty=True);u.MATS.clear();u.CONTACTS.clear()
        body,rig,clips=make(p);report=review(body,rig);setup_stage();devices=u.configure(args.samples,args.width)
        scene=bpy.context.scene;scene.render.resolution_y=args.width;scene.camera=bpy.data.objects['three-quarter']
        folder=PACKAGE/p['actorId'];folder.mkdir(parents=True,exist_ok=True)
        source=folder/(p['id']+'.blend');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source))
        identity=sha(source);report.update({'schema':'classic-resident-authoring.v1','sourceSha256':identity,
            'profile':p,'inputs':{str(path.relative_to(ROOT)).replace('\\','/'):sha(path) for path in [Path(__file__),ROOT/'scripts/classic-resident-anatomy.py',ROOT/'scripts/build-blender-classic-investigator.py',ROOT/'scripts/build-blender-classic-railway.py',PACKAGE/'profiles.json',anatomy.DATA/'provenance.json']},
            'devices':devices,'clips':[{'name':n,'durationSeconds':c/30} for n,c in clips],
            'strideMeters':.96*float(rig.scale.z),'rights':'CC0 MakeHuman/MPFB base topology and adult deltas; original project garments, hair, accessories, skin colour variation and animations.'})
        write(folder/'authoring-review.json',report)
        entries=[]
        if args.views!='none':
            (folder/'renders').mkdir(exist_ok=True)
            for view in args.views.split(','):
                scene.camera=bpy.data.objects['three-quarter' if view.startswith('walk') else view]
                inv.pose('Walk' if view.startswith('walk') else 'Idle',.25 if view=='walk-passing' else 0)
                scene.render.filepath=str(folder/'renders'/f'{view}.png');bpy.ops.render.render(write_still=True)
                entries.append({'view':view,'path':f'renders/{view}.png','sha256':sha(Path(scene.render.filepath))})
            write(folder/'render-review.json',{'sourceSha256':identity,'engine':'Cycles','samples':args.samples,'renders':entries,'humanArtApproved':False})
        inv.pose('Idle',0);bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
        raw=folder/(p['id']+'-raw.glb')
        bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_animations=True,
            export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,
            export_apply=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
        write(folder/'raw-export.json',{'sourceSha256':identity,'rawSha256':sha(raw),'bytes':raw.stat().st_size})
        print(json.dumps({'actorId':p['actorId'],'sourceSha256':identity,'triangles':report['triangles'],'materials':report['materials'],'rawBytes':raw.stat().st_size}),flush=True)


if __name__=='__main__':main()
