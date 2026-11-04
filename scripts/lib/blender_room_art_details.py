"""Original geometry and material refinement for the archive room, in metres."""
import math
import random

import bpy
import bmesh
from mathutils import Matrix, Vector


def remove(base, objects):
    for obj in list(objects):
        if obj in base.GEOMETRY:
            base.GEOMETRY.remove(obj)
        for group in base.GROUPS.values():
            if obj in group:
                group.remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)


def rotate_objects(objects, center, angle):
    transform = Matrix.Translation(Vector(center)) @ Matrix.Rotation(angle, 4, 'Z') @ Matrix.Translation(-Vector(center))
    for obj in objects:
        obj.matrix_world = transform @ obj.matrix_world


def type_mesh(base, name, body, position, size, mat, group, rotation=(0, 0, 0)):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = body
    data.size = size
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.extrude = .00014
    data.resolution_u = 3
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = rotation
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    # Font cap and side-wall vertices may be coincident but disconnected.
    # Weld at micron scale, well below the modeled embossing thickness.
    converted=bpy.context.object.data
    bm=bmesh.new()
    bm.from_mesh(converted)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(converted)
    bm.free()
    return base.finish(bpy.context.object, name, mat, 0, group)


def torus(base, name, major, minor, location, mat, group):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=10, location=location)
    obj = bpy.context.object
    for face in obj.data.polygons:
        face.use_smooth = True
    return base.finish(obj, name, mat, 0, group)


def rich_material(base, name, color, kind, roughness, metal=0, axis=0):
    mat = base.material(name, color, roughness, metal)
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    coord = tree.nodes.new('ShaderNodeTexCoord')
    scale = tree.nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    axes = [75, 75, 75] if kind == 'wood' else [1, 1, 1]
    if kind == 'wood':
        axes[axis] = 1.7
    scale.inputs[1].default_value = axes
    tree.links.new(coord.outputs['Object'], scale.inputs[0])
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1 if kind == 'wood' else 145 if kind == 'paper' else 35
    noise.inputs['Detail'].default_value = 3
    noise.inputs['Roughness'].default_value = .7
    tree.links.new(scale.outputs[0], noise.inputs['Vector'])
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    rgb = base.srgb(color)
    ramp.color_ramp.elements[0].position = .2
    ramp.color_ramp.elements[0].color = (*[v * (.38 if kind == 'wood' else .7) for v in rgb], 1)
    ramp.color_ramp.elements[1].position = .8
    ramp.color_ramp.elements[1].color = (*rgb, 1)
    tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
    tree.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    rough = tree.nodes.new('ShaderNodeMapRange')
    rough.inputs['To Min'].default_value = max(.12, roughness-.14)
    rough.inputs['To Max'].default_value = min(1, roughness+.16)
    tree.links.new(noise.outputs['Fac'], rough.inputs['Value'])
    tree.links.new(rough.outputs['Result'], bsdf.inputs['Roughness'])
    bump = tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .16
    bump.inputs['Distance'].default_value = .0006 if kind == 'wood' else .00022
    tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def refine_materials(base):
    old_wood = {'Walnut': '48291c', 'Walnut Edge': '744b2b'}
    variants = {name: [rich_material(base, f'{name} Grain {axis}', color, 'wood', .46 if name == 'Walnut' else .38, axis=axis) for axis in range(3)] for name, color in old_wood.items()}
    brass = rich_material(base, 'Brushed Antique Brass', 'b99455', 'metal', .36, .88)
    paper = rich_material(base, 'Cotton Paper', 'dfd3af', 'paper', .88)
    for obj in base.GEOMETRY:
        if not obj.data.materials:
            continue
        old = obj.data.materials[0].name
        if old in variants:
            low, high = base.bounds([obj])
            axis = max(range(3), key=lambda i: high[i]-low[i])
            obj.data.materials[0] = variants[old][axis]
        elif old == 'Aged Brass':
            obj.data.materials[0] = brass
        elif old == 'Ivory Paper':
            obj.data.materials[0] = paper
    for name, color, rough in (
        ('Oxblood Leather', '4f2322', .63), ('Moss Cloth', '454d3a', .86),
        ('Ink Cloth', '26363b', .8), ('Buff Board', 'a38b60', .86),
        ('Folder Stock', 'ae8c50', .87), ('Paper Ink', '35413d', .95),
        ('Red Wax', '742b24', .42), ('Pencil Cedar', 'bf8950', .63),
        ('Pencil Graphite', '252a29', .43), ('Soot Stone', '34434b', .88),
    ):
        base.material(name, color, rough)
    glass = base.material('Optical Glass', 'c6e4d9', .075)
    glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .82
    glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.46
    return variants


def desk_details(base):
    group = 'hero-evidence-table-01'
    remove(base, [obj for obj in base.GROUPS[group] if obj.name.startswith(('table_case_sheet_', 'paper_rule_', 'table_locator_'))])
    felt = next(obj for obj in base.GROUPS[group] if 'tray-felt' in obj.name)
    surface = base.bounds([felt])[1][2]
    mat = base.MATERIALS
    # A bound notebook with separate covers, page block and a shaped spine.
    start = len(base.GEOMETRY)
    x, y = -.73, .67
    for z in (surface+.003, surface+.055):
        base.box('notebook_cover', (.37, .255, .006), (x, y, z), mat['Oxblood Leather'], .005, group)
    base.box('notebook_pages', (.35, .232, .045), (x+.004, y, surface+.029), mat['Cotton Paper'], .002, group)
    base.box('notebook_spine', (.013, .258, .055), (x-.18, y, surface+.029), mat['Oxblood Leather'], .005, group)
    for index in range(7):
        base.box('notebook_page_edge', (.33, .0005, .0005), (x+.003, y-.117, surface+.012+index*.0048), mat['Paper Edge'], 0, group)
    for px in (x-.145, x+.145):
        base.box('notebook_gilt_rule', (.0015, .195, .0006), (px, y, surface+.0585), mat['Brushed Antique Brass'], 0, group)
    type_mesh(base, 'notebook_title', 'FIELD NOTES', (x, y, surface+.0587), .025, mat['Brushed Antique Brass'], group)
    rotate_objects(base.GEOMETRY[start:], (x, y, surface), -.12)

    # Open file with layers and restrained printed marks, authored as decorative text.
    start = len(base.GEOMETRY)
    x, y = -.16, .33
    base.box('folio_cover', (.61, .375, .004), (x, y, surface+.0024), mat['Folder Stock'], .003, group)
    base.box('folio_tab', (.12, .045, .003), (x+.185, y+.196, surface+.0024), mat['Folder Stock'], .002, group)
    for index in range(4):
        base.box('folio_paper_'+str(index), (.54, .325, .0011), (x+.002*index, y+.001*index, surface+.005+index*.0012), mat['Cotton Paper'], .0004, group)
    top = surface+.0094
    type_mesh(base, 'folio_heading', 'OBSERVATIONS', (x, y+.108, top), .024, mat['Paper Ink'], group)
    for row, width in enumerate((.39, .42, .32, .395, .25, .41)):
        base.box('folio_ink_rule', (width, .0015, .00025), (x-.038, y+.060-row*.026, top), mat['Paper Ink'], 0, group)
    base.box('folio_margin', (.001, .185, .00025), (x-.218, y-.018, top), mat['Red Wax'], 0, group)
    base.box('folio_clip_base', (.068, .023, .009), (x-.13, y+.157, top+.0045), mat['Dark Brass'], .003, group)
    base.rod('folio_clip_wire', (x-.155, y+.151, top+.012), (x-.105, y+.151, top+.012), .0018, mat['Brushed Antique Brass'], group)
    rotate_objects(base.GEOMETRY[start:], (x, y, surface), .07)

    # Closed envelope and a modeled wax impression.
    x, y = .39, .77
    start = len(base.GEOMETRY)
    base.box('envelope_body', (.32, .188, .004), (x, y, surface+.0026), mat['Cotton Paper'], .002, group)
    mesh = bpy.data.meshes.new('envelope_flap')
    vertices = [(x-.154,y+.086,surface+.0048), (x+.154,y+.086,surface+.0048), (x,y-.018,surface+.0048)]
    vertices += [(a,b,c+.0008) for a,b,c in vertices]
    mesh.from_pydata(vertices, [], [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)])
    obj = bpy.data.objects.new('envelope_flap', mesh)
    bpy.context.scene.collection.objects.link(obj)
    base.finish(obj, 'envelope_flap', mat['Paper Edge'], 0, group)
    base.cylinder('wax_seal', .022, .003, (x, y-.012, surface+.0064), mat['Red Wax'], group, 24)
    torus(base, 'wax_seal_impression', .014, .0012, (x,y-.012,surface+.0083), mat['Red Wax'], group)
    rotate_objects(base.GEOMETRY[start:], (x,y,surface), -.14)

    # Lens, metal retaining ring and handle are independent modeled parts.
    x, y = .63, .40
    torus(base, 'magnifier_retaining_ring', .064, .008, (x,y,surface+.009), mat['Brushed Antique Brass'], group)
    base.cylinder('magnifier_lens', .0565, .003, (x,y,surface+.009), mat['Optical Glass'], group, 48)
    base.rod('magnifier_neck', (x+.041,y-.050,surface+.011), (x+.090,y-.112,surface+.012), .008, mat['Brushed Antique Brass'], group)
    base.rod('magnifier_grip', (x+.083,y-.104,surface+.012), (x+.220,y-.269,surface+.012), .012, mat['Oxblood Leather'], group)
    base.rod('magnifier_endcap', (x+.215,y-.263,surface+.012), (x+.228,y-.279,surface+.012), .0125, mat['Brushed Antique Brass'], group)

    # Hexagonal pencils placed off the file so the central interaction stays clear.
    for idx in range(2):
        x, y = -.68+idx*.025, .12
        rod = base.cylinder('cedar_pencil_'+str(idx), .004, .22, (x,y,surface+.004), mat['Pencil Cedar'], group, 6)
        rod.rotation_euler = (math.pi/2, 0, -.4+idx*.09)
    # A shallow index tray with open interior and visible paper tabs.
    x,y=.94,.81
    base.box('index_tray_bottom',(.255,.285,.005),(x,y,surface+.0025),mat['Walnut Grain 0'],.002,group)
    for sign in (-1,1):
        base.box('index_tray_side',(.008,.285,.048),(x+sign*.124,y,surface+.029),mat['Walnut Grain 1'],.002,group)
        base.box('index_tray_end',(.247,.008,.035),(x,y+sign*.137,surface+.023),mat['Walnut Grain 0'],.002,group)
    for row in range(3):
        base.box('index_card_stack',(.214,.226,.006),(x,y+.003*row,surface+.010+row*.0065),mat['Cotton Paper'],.001,group)
        base.box('index_card_tab',(.047,.034,.001),(x-.065+row*.062,y+.121,surface+.014+row*.0065),mat['Folder Stock'],.001,group)
    return {'feltSurfaceMeters':surface, 'decorativeTextIsWorldEvidence':False,
            'features':['bound notebook','layered file','clamp','sealed envelope','retained glass lens','hexagonal pencils','open index tray']}


def archive_details(base, seed):
    rng = random.Random(seed)
    remove(base, [o for o in base.GEOMETRY if o.name.startswith('rear_archive_') and ('_file_' in o.name or '_label_' in o.name)])
    mat=base.MATERIALS
    palette=['Oxblood Leather','Moss Cloth','Ink Cloth','Buff Board','Panel Paint']
    checks=[]
    for side in (-1,1):
        group='rear_archive_'+str(side)
        cx=side*3.5
        for row in range(4):
            floor=.19+row*.6
            ceiling=(.76+row*.6)-.03 if row<3 else 2.35
            cursor=cx-.993
            for index in range(10):
                width=rng.uniform(.125,.205)
                if cursor+width>cx+.988:
                    break
                x=cursor+width/2
                cursor+=width+rng.uniform(.012,.028)
                if (row+index+side)%11==0:
                    cursor+=.09  # deliberate missing volume, not accidental clipping
                    continue
                h=min(rng.uniform(.32,.48),ceiling-floor-.018)
                depth=rng.uniform(.29,.37)
                front=3.19+rng.uniform(0,.035)
                y=front+depth/2
                name=f'{group}_bound_{row}_{index}'
                start=len(base.GEOMETRY)
                cover=mat[palette[rng.randrange(len(palette))]]
                base.box(name+'_pages',(width-.014,depth-.018,h-.012),(x,y+.003,floor+h/2),mat['Cotton Paper'],.002,group)
                for sign in (-1,1):
                    base.box(name+'_board',(.008,depth,h),(x+sign*(width/2-.004),y,floor+h/2),cover,.003,group)
                base.box(name+'_spine',(width,.009,h),(x,front+.0045,floor+h/2),cover,.003,group)
                label=base.box(name+'_label',(width*.64,.0015,.055),(x,front-.0009,floor+h*.69),mat['Cotton Paper'],.0005,group)
                for rule in range(2):
                    base.box(name+'_label_rule',(width*.43,.0005,.001),(x,front-.0019,floor+h*.7-rule*.014),mat['Paper Ink'],0,group)
                if index%3==0:
                    for z in (floor+.055,floor+h-.044):
                        base.box(name+'_gilt_band',(width,.0014,.004),(x,front-.0006,z),mat['Brushed Antique Brass'],0,group)
                rotate_objects(base.GEOMETRY[start:], (x,y,floor), rng.uniform(-.023,.023))
                low,high=base.bounds(base.GEOMETRY[start:])
                checks.append({'id':name,'bottom':round(low[2],5),'top':round(high[2],5),
                               'shelfTop':round(floor,5),'nextShelfUnderside':round(ceiling,5),
                               'passed':low[2]>=floor-.001 and high[2]<=ceiling-.01})
    return checks


def atmosphere(base):
    # Keep circulation and architectural bilateral symmetry; loose files are the explicit exception.
    targets={'arrival_bounce':95, 'courtyard_key':1000, 'foyer_lamp':95,
             'ceiling_light_-1.7':110,'ceiling_light_1.7':160,
             'archive-lamp-left_light':190,'archive-lamp-right_light':150}
    for fixture in base.LIGHTS:
        power=targets[fixture['id']]
        fixture['powerWatts']=power
        bpy.data.objects[fixture['id']].data.energy=power
    bpy.context.scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.055
    mat=base.MATERIALS
    # Make the external wall's construction readable in the window opening.
    for row in range(6):
        z=.45+row*.44
        for column in range(7):
            x=-3.0+column*.95+(row%2)*.46
            base.box(f'courtyard_stone_{row}_{column}',(.924,.035,.414),(x,5.7075,z),mat['Soot Stone'],.01)
    # Real jamb relief and panel mouldings deepen the foyer without narrowing it.
    for x in (-1.205,1.205):
        for z in (.10,1.02):
            base.box('foyer_dado',(.045,2.3,.06),(x,-5.25,z),mat['Moulding'],.003)
    base.box('foyer_fixture_body',(.42,.24,.04),(0,-5.0,2.58),mat['Dark Brass'],.005)
    base.box('foyer_fixture_diffuser',(.36,.19,.01),(0,-5.0,2.555),mat['Warm Diffuser'],.003)


def refine(base, config, cameras):
    refine_materials(base)
    desk=desk_details(base)
    archives=archive_details(base,config['artPass']['seed'])
    atmosphere(base)
    cameras['hero-detail']=base.camera('hero-detail',(1.18,-.87,1.69),(-.05,.45,1.0),48)
    bpy.context.view_layer.update()
    visibility=[]
    deps=bpy.context.evaluated_depsgraph_get()
    for name in ('production','corner-sw','corner-se','corner-nw','corner-ne'):
        origin=cameras[name].location
        delta=Vector((0,.45,desk['feltSurfaceMeters']+.006))-origin
        hit,loc,normal,index,obj,matrix=bpy.context.scene.ray_cast(deps,origin,delta.normalized(),distance=delta.length+.2)
        group=obj.get('review_group') if hit else None
        visibility.append({'view':name,'firstHitGroup':group,'heroCenterUnoccluded':group=='hero-evidence-table-01'})
    return {'schema':'game-room.art-detail-audit.v1','seed':config['artPass']['seed'],
            'desk':desk,'archiveShelfClearance':archives,'heroSurfaceSightlines':visibility,
            'internalShelfClearancePassed':all(c['passed'] for c in archives),
            'humanApproval':False}
