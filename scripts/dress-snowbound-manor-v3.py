"""Read-only v2 -> v3: aged library, interrupted tea and storm-worn exterior.

Native geometry is the deliverable; material maps export through standard glTF.
New dressing remains inside existing furniture/architecture footprints.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, math, random, shutil, sys
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/snowbound-manor-v2'
P = ROOT / 'docs/3d-town/snowbound-manor-v3'
SOURCE = P / 'snowbound-manor.blend'
R = random.Random(19341023)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8'))


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


base = load_module('manor_base_v3', 'build-snowbound-manor.py')
u = base.u


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def image_material(name, color, rough, texture=None, rough_map=None, normal=None, metallic=0):
    if name in bpy.data.materials:
        m = bpy.data.materials[name]; m.use_nodes = True
        m.node_tree.nodes.clear(); out = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        m.node_tree.links.new(bsdf.outputs[0], out.inputs['Surface'])
    else:
        m = u.material(name, color, rough, metallic); bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base.rgb(color), 1)
    bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metallic
    for file, socket in [(texture, 'Base Color'), (rough_map, 'Roughness'), (normal, 'Normal')]:
        if not file: continue
        im = bpy.data.images.load(str(P / 'textures' / file), check_existing=True)
        node = m.node_tree.nodes.new('ShaderNodeTexImage'); node.image = im
        if socket != 'Base Color': im.colorspace_settings.name = 'Non-Color'
        if socket == 'Normal':
            norm = m.node_tree.nodes.new('ShaderNodeNormalMap'); norm.inputs['Strength'].default_value = .5
            m.node_tree.links.new(node.outputs['Color'], norm.inputs['Color'])
            m.node_tree.links.new(norm.outputs['Normal'], bsdf.inputs[socket])
        else: m.node_tree.links.new(node.outputs['Color'], bsdf.inputs[socket])
    u.MATS[name] = m
    return m


def tag_group(objects, group, support):
    for obj in objects:
        obj['dressingGroup'] = group; obj['supportObject'] = support


def book(name, center, width, depth, height, style, angle, shelf, support):
    before = set(bpy.data.objects)
    cover = ['library_oxblood', 'library_moss', 'library_navy', 'library_ochre'][style % 4]
    # Upright binding: separate boards, paper block, curved spine and raised bands.
    u.box(name + '_paper', (0, .006, height / 2), (width - .010, depth - .026, height - .015), 'cut_paper', 0)
    for side in [-1, 1]:
        u.box(name + '_board' + str(side), (side * (width / 2 - .002), 0, height / 2), (.004, depth, height), cover, 0)
    sides = 10
    verts = []
    for z in [.002, height - .002]:
        for j in range(sides + 1):
            t = j / sides
            verts.append(((t - .5) * width, -depth / 2 - .004 * math.sin(t * math.pi), z))
    faces = [(j, j + 1, sides + j + 2, sides + j + 1) for j in range(sides)]
    spine = u.mesh(name + '_rounded_spine', verts, faces, 'library_spine_atlas', True)
    uv = spine.data.uv_layers.active
    for poly in spine.data.polygons:
        for li in poly.loop_indices:
            v = spine.data.vertices[spine.data.loops[li].vertex_index].co
            uu = .02 + .96 * (v.x / width + .5); vv = .004 + .992 * v.z / height
            uv.data[li].uv = ((style % 8 + uu) / 8, 1 - (style // 8 + 1 - vv) / 2)
    for f in [.12, .88]:
        u.box(name + '_raised_band' + str(f), (0, -depth / 2 - .003, f * height), (width * .95, .005, .008), cover, 0)
    objects = list(set(bpy.data.objects) - before)
    matrix = Matrix.Rotation(angle, 4, 'Y')
    lowest = min((matrix @ v.co).z for o in objects if o.type == 'MESH' for v in o.data.vertices)
    matrix = Matrix.Translation(Vector((center[0], center[1], shelf - lowest))) @ matrix
    base.group_transform(objects, matrix)
    tag_group(objects, name, support)
    return objects


def library():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('shelved_book', 'spine_gilt')): bpy.data.objects.remove(obj, do_unlink=True)
    u.LAY = 'interior'
    for cx in [-4.2, 4.2]:
        for k in range(4):
            shelf = .25 + .12 + k * .50 + .0325
            support = 'bookcase_shelf' + str((cx, k))
            xx = cx - .63; index = 0
            while xx < cx + .57:
                width = R.uniform(.037, .080); hh = R.uniform(.23, .405)
                if index % 7 == 5: xx += R.uniform(.065, .12)
                if xx + width > cx + .66: break
                tilt = R.uniform(-.035, .035) if index % 4 else R.uniform(-.085, -.045)
                projected = abs(math.sin(tilt)) * hh
                book('bound_volume_' + str((cx, k, index)), (xx + width / 2 + projected / 2, R.uniform(9.36, 9.43)),
                     width, R.uniform(.20, .27), hh, R.randrange(16), tilt, shelf, support)
                xx += width + projected + R.uniform(.004, .012); index += 1
        # Proper plinth, slender fluted pilasters, cornice and brass escutcheons.
        u.box('library_plinth_' + str(cx), (cx, 9.44, .35), (1.66, .59, .13), 'wood', .014)
        for sign in [-1, 1]:
            x = cx + sign * .75
            u.box('library_pilaster_' + str((cx, sign)), (x, 9.17, 1.58), (.085, .055, 2.48), 'edge_wood', .009)
            for z in [.47, 2.71]: u.box('library_capital_' + str((cx, sign, z)), (x, 9.14, z), (.14, .08, .065), 'wood', .006)
        for k in range(4):
            u.box('library_shelf_lip_' + str((cx, k)), (cx, 9.15, .37 + k * .5), (1.43, .045, .048), 'edge_wood', .005)


def lathe(name, pos, profile, material, sides=48):
    vertices = [(pos[0] + r * math.cos(j * math.tau / sides), pos[1] + r * math.sin(j * math.tau / sides), pos[2] + z)
                for r, z in profile for j in range(sides)]
    faces = [(k * sides + j, k * sides + (j + 1) % sides, (k + 1) * sides + (j + 1) % sides, (k + 1) * sides + j)
             for k in range(len(profile) - 1) for j in range(sides)]
    return u.mesh(name, vertices, faces, material, True)


def dressing():
    u.LAY = 'interior'
    for obj in list(bpy.data.objects):
        if obj.name.startswith('open_case_book'):bpy.data.objects.remove(obj,do_unlink=True)
    # The teapot and folded paper fit within the existing circular tea table.
    before = set(bpy.data.objects); x, y, z = .25, 6.78, .958
    lathe('tea_service_pot', (x, y, z), [(0, .002), (.055, .002), (.071, .026), (.077, .084), (.058, .135), (.045, .151)], 'porcelain')
    lathe('tea_service_lid', (x, y, z), [(.049, .142), (.053, .150), (.044, .161), (.008, .172)], 'porcelain')
    u.sphere('tea_service_finial', (x, y, z + .18), (.012, .012, .013), 'brass', 16)
    base.pipe('tea_service_handle', [(x-.065,y,z+.132),(x-.111,y,z+.146),(x-.125,y,z+.073),(x-.071,y,z+.042)], .010, 'porcelain')
    # Curved tapering spout with an actual open lip.
    lathe_obj = lathe('tea_service_spout', (0,0,0), [(.026, 0), (.020,.036), (.014,.078), (.012,.110), (.009,.110), (.010,.084)], 'porcelain', 24)
    lathe_obj.matrix_world = Matrix.Translation(Vector((x+.055,y,z+.060))) @ Matrix.Rotation(.65,4,'Y')
    tag_group(list(set(bpy.data.objects)-before), 'tea_service', 'tea_table')
    # Thin curved sheet, with both thickness and a visible central fold.
    xx, yy, zz = .14, 7.04, .961
    vertices = [(xx + (i/10-.5)*.21, yy + (j-.5)*.15, zz + .004*abs(i/10-.5)) for j in range(2) for i in range(11)]
    faces = [(i, i+1, i+12, i+11) for i in range(10)]
    paper = u.mesh('folded_winter_gazette', vertices, faces, 'winter_gazette')
    for poly in paper.data.polygons:
        for li in poly.loop_indices:
            v=paper.data.vertices[paper.data.loops[li].vertex_index].co
            paper.data.uv_layers.active.data[li].uv=((v.x-xx)/.21+.5,(v.y-yy)/.15+.5)
    mod=paper.modifiers.new('paper edge thickness','SOLIDIFY');mod.thickness=.0008
    paper['supportObject']='tea_table';paper['dressingGroup']='folded_gazette';paper['canonicalEvidence']=False
    # Ink and pen beside the register; all pieces remain on the console top.
    x,y,z=-4.55,1.78,1.217
    before=set(bpy.data.objects)
    u.box('register_ink_bottle',(x,y,z+.028),(.056,.056,.056),'ink_glass',.008)
    u.cylinder('register_ink_cap',(x,y,z+.061),.021,.015,'brass',24)
    tag_group(list(set(bpy.data.objects)-before),'register_ink','arrival_console')
    base.beam('register_fountain_pen',(-4.57,1.28,z+.009),(-4.57,1.44,z+.009),.006,.004,'ebonite',16)
    base.beam('register_pen_nib',(-4.57,1.44,z+.009),(-4.57,1.455,z+.009),.004,0,'brass',12)
    # Weathered leather luggage corners have distinct metal caps and label holders.
    for i,(x,y,z,w,d,h) in enumerate([(3.95,1.2,.261,.93,.5,.38),(3.92,1.2,.641,.76,.45,.25)]):
        obj=bpy.data.objects['travel_case'+str(i)];obj.data.materials[0]=u.MATS['travel_leather']
        for sx in [-1,1]:
            for sz in [-1,1]:
                u.box('case_brass_corner_'+str((i,sx,sz)),(x+sx*(w/2-.03),y-d/2-.006,z+h/2+sz*(h/2-.025)),(.055,.012,.045),'aged_brass',.008)
        u.box('case_label_frame_'+str(i),(x,y-d/2-.012,z+h*.7),(.15,.010,.063),'aged_brass',.005)
        u.box('case_label_'+str(i),(x,y-d/2-.018,z+h*.7),(.129,.002,.043),'cut_paper',.002)


def facade_and_forest():
    u.LAY='upper'
    # Vary the amount of light behind existing glazing; preserve all real apertures.
    shades=[]
    for i,(col,power) in enumerate([('181d22',0),('403a31',.04),('77644a',.16),('ae9265',.38),('6e6352',.10)]):
        m=u.material('occupied_window_'+str(i),col,.91);bsdf=m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Emission Color'].default_value=(*base.rgb(col),1);bsdf.inputs['Emission Strength'].default_value=power
        shades.append(m)
    backing=sorted([o for o in bpy.data.objects if '_room_backing' in o.name],key=lambda o:o.name)
    choices=[2,0,3,1,0,2,0,4,3,1,2,0,4,1,3,0,1,4,0,2,3,0]
    for i,obj in enumerate(backing): obj.data.materials[0]=shades[choices[i%len(choices)]]
    # Cast-iron downpipes, wall collars, and an anchored Juliet rail.
    for x in [-10.95,-6.15,6.15,10.95]:
        base.pipe('rainwater_pipe_'+str(x),[(x,-2.23,.35),(x,-2.23,6.7),(x,-2.45,7.05)],.045,'iron')
        for z in [1.0,3.5,6.3]:
            u.box('pipe_wall_collar_'+str((x,z)),(x,-2.19,z),(.14,.13,.035),'iron',.005)
    u.box('juliet_stone_sill',(0,-.39,4.80),(2.02,.59,.13),'sandstone',.012)
    for x in [-.7,.7]:
        u.box('juliet_corbel_'+str(x),(x,-.28,4.67),(.16,.36,.19),'stone',.012)
    for z in [4.93,5.78]:base.pipe('juliet_rail_'+str(z),[(-.96,-.66,z),(.96,-.66,z)],.022,'iron')
    for j in range(13):
        x=-.9+j*.15
        base.pipe('juliet_upright_'+str(j),[(x,-.66,4.93),(x,-.66,5.78)],.012,'iron')
    for x in [-.96,.96]:
        for z in [4.93,5.78]:base.pipe('juliet_return_'+str((x,z)),[(x,-.66,z),(x,-.17,z)],.018,'iron')
    # Sparse icicles below drained eaves, with varied lengths and no floating tips.
    for side in [-1,1]:
        for j in range(17):
            x=side*(6.08+R.random()*4.85);z=7.37;h=R.uniform(.055,.23)
            base.beam('eave_icicle_'+str((side,j)),(x,-2.52,z),(x,-2.52,z-h),.009,.001,'frosted_ice',8)
    u.LAY='landscape'
    base.bare_tree('winter_ash_left',-14,-5,8.2)
    base.bare_tree('winter_ash_right',15,-1,9.6)
    # Existing licensed linked saplings get slender/wide variants, without new downloads.
    originals=[o for o in bpy.data.objects if o.type=='MESH' and o.get('sourceAsset')=='fir_sapling']
    for obj in originals:
        obj.scale.x*=R.uniform(.82,1.15);obj.scale.y*=R.uniform(.82,1.08)
    for i,(x,y,h) in enumerate([(-17,-10,6.5),(-19,1,9),(18,-7,8.4),(-24,15,11),(23,18,9.6),(-10,24,11),(12,28,12)]):
        if not originals:break
        template=originals[i%len(originals)]
        obj=bpy.data.objects.new('forest_depth_'+str(i),template.data);bpy.context.collection.objects.link(obj)
        obj.location=(x,y,.12);obj.rotation_euler.z=R.uniform(0,math.tau);obj.scale=(h*R.uniform(.8,1),h*.9,h)
        obj['layer']='landscape';obj['sourceAsset']='fir_sapling';obj['origin']='Poly Haven CC0-1.0';obj['derivedLOD']=True


def storm_and_light():
    scene=bpy.context.scene
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.29,.43,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.20
    for name,energy in [('storm_sky',1300),('back_snow_sky',850),('chandelier3.25',52),('chandelier7.1',52)]:
        bpy.data.objects[name].data.energy=energy
    # Expanded volume eliminates the old finite-box boundary in secondary views.
    haze=bpy.data.objects['continuous_atmospheric_haze'];haze.data.transform(Matrix.Scale(4,4))
    m=bpy.data.materials['outdoor snowfall haze'];n=m.node_tree.nodes;l=m.node_tree.links
    vol=next(v for v in n if v.type=='PRINCIPLED_VOLUME');vol.inputs['Density'].default_value=.006
    geo=n.new('ShaderNodeNewGeometry');split=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],split.inputs[0])
    def op(operation,a,b):
        node=n.new('ShaderNodeMath');node.operation=operation
        for index,value in enumerate((a,b)):
            if isinstance(value,(int,float)):node.inputs[index].default_value=value
            else:l.new(value,node.inputs[index])
        return node.outputs[0]
    inside=op('MULTIPLY',op('LESS_THAN',op('ABSOLUTE',split.outputs['X'],0),11.5),
              op('MULTIPLY',op('GREATER_THAN',split.outputs['Y'],-2.8),op('LESS_THAN',split.outputs['Y'],10.8)))
    inside=op('MULTIPLY',inside,op('LESS_THAN',split.outputs['Z'],11.5))
    l.new(op('MULTIPLY',op('SUBTRACT',1,inside),.006),vol.inputs['Density'])
    u.LAY='weather'
    verts=[];faces=[]
    for i in range(2400):
        x=R.uniform(-32,32);y=R.uniform(-42,27);z=R.uniform(.2,16)
        if abs(x)<12 and -2.8<y<11 and z<11.5:continue
        length=R.uniform(.055,.24);width=R.uniform(.003,.010);a=len(verts)
        verts += [(x-width,y,z),(x+width,y,z),(x+length+width,y+.05,z-length*.65),(x+length-width,y+.05,z-length*.65)]
        faces.append((a,a+1,a+2,a+3))
    u.mesh('storm_crosswind_streaks',verts,faces,'falling_snow')


def build():
    identity=sha(BASE/'snowbound-manor.blend')
    assert read(BASE/'authoring-receipt.json')['source']['sha256']==identity
    bpy.ops.wm.open_mainfile(filepath=str(BASE/'snowbound-manor.blend'))
    u.MATS.update({m.name:m for m in bpy.data.materials});u.LAY='interior'
    for name in ['stone','sandstone']:
        image_material(name,'9a9280',.82,'honed-limestone.png','honed-limestone-rough.png','honed-limestone-normal.png')
    image_material('library_spine_atlas','ffffff',.77,'library-spines.png')
    image_material('cut_paper','ffffff',.94,'cut-paper-edges.png')
    image_material('winter_gazette','ffffff',.96,'winter-gazette.png')
    image_material('travel_leather','ffffff',.78,'leather-grain.png','leather-rough.png')
    for name,col in [('library_oxblood','452824'),('library_moss','27372c'),('library_navy','27313b'),('library_ochre','5d492f')]:
        m=u.material(name,col,.77)
        im=bpy.data.images.load(str(P/'textures/leather-rough.png'),check_existing=True);im.colorspace_settings.name='Non-Color'
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
        m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'])
    u.material('aged_brass','857249',.48,.72);u.material('ebonite','151818',.35)
    u.material('bark','39332b',.98)
    u.material('ink_glass','192a26',.28,.2);u.material('frosted_ice','afc6ce',.42)
    print('AUTHORING LIBRARY',flush=True);library()
    print('AUTHORING TABLE AND ARRIVAL DRESSING',flush=True);dressing()
    print('AUTHORING FACADE AND FOREST',flush=True);facade_and_forest()
    print('AUTHORING STORM AND LIGHT',flush=True);storm_and_light()
    u.camera('library-detail',(3.2,7.2,1.78),(4.22,9.42,1.50),lens=42)
    u.camera('desk-detail',(-2.5,2.35,1.70),(-4.55,1.35,1.28),lens=43)
    u.camera('tea-detail',(1.05,5.52,1.7),(.18,6.95,1.03),lens=48)
    scene=bpy.context.scene;scene['sample']='Cedar Hollow v3 lived-in library and snowstorm; art candidate'
    scene.cycles.use_denoising=True;scene.cycles.max_bounces=8
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    for name in ['openings.json','scene-contract.json','placements.json']:
        data=read(BASE/name)
        if 'sourceSha256' in data:data['sourceSha256']=sha(SOURCE)
        write(P/name,data)
    lighting=read(BASE/'lighting.json')
    for item in lighting['fixtures']:
        if item['id'] in bpy.data.objects:item['sourceWatts']=bpy.data.objects[item['id']].data.energy
    write(P/'lighting.json',lighting)
    for name in ['hearth-density.r8','hearth-density.png','fire-field.json']:
        shutil.copy2(BASE/'textures'/name,P/'textures'/name)
    write(P/'authoring-receipt.json',{
        'schema':'snowbound-authoring.v3','source':{'path':SOURCE.name,'sha256':sha(SOURCE)},
        'parentSource':{'path':(BASE/'snowbound-manor.blend').relative_to(ROOT).as_posix(),'sha256':identity},
        'generatorSha256':sha(Path(__file__)),'helperSha256':sha(ROOT/'scripts/build-snowbound-manor.py'),
        'textures':read(P/'textures/authored-textures.json'),
        'licensedProvenance':{'path':'../snowbound-manor-v1/licensed/provenance.json','sha256':sha(ROOT/'docs/3d-town/snowbound-manor-v1/licensed/provenance.json')},
        'changes':['curved leather bindings, pages and worn spine atlas','library joinery','tea service and folded fictional newspaper','ink and pen','leather luggage details',
                   'textured limestone','varied window occupancy','iron downpipes and anchored Juliet rail','grounded bare trees and varied saplings','crosswind snow and expanded exterior haze'],
        'dressingGroups':len({o.get('dressingGroup') for o in bpy.data.objects if o.get('dressingGroup')}),
        'humanArtApproved':False,'agentWorldBound':False,'canonicalCaseEvidence':False})
    assert sha(BASE/'snowbound-manor.blend')==identity


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--render-only',action='store_true')
    parser.add_argument('--views',nargs='+',default=['hall','manor-gate','library-detail','tea-detail'])
    parser.add_argument('--width',type=int,default=1280);parser.add_argument('--samples',type=int,default=48)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not args.render_only:build()
    renderer=load_module('manor_render_v3','refine-snowbound-manor.py');renderer.P=P;renderer.SOURCE=SOURCE
    renderer.render(args.views,args.width,args.samples)
    print('V3 DRESSING AND NATIVE RENDERS COMPLETE',flush=True)
