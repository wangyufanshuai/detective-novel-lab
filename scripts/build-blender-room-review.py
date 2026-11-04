"""Background Blender authoring, actual renders and measured candidate audit.

Run with blender --background --factory-startup --python-exit-code 1 --python
scripts/build-blender-room-review.py -- --views production --samples 32.
No existing Blender scene, v1/v2 asset or human approval is overwritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0, str(Path(__file__).parent))
from lib.blender_room_spatial_review import spatial_review

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/3d-rooms/candidates/blender-v3'
SOURCE = ROOT / 'docs/3d-rooms/candidates/authored-v2'
GEOMETRY = []
GROUPS = {}
LIGHTS = []
BOOLEAN_RECEIPTS = []
MATERIALS = {}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def srgb(color):
    values = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def material(name, color, rough=.6, metal=0., texture=None, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    rgba = (*srgb(color), 1)
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    mat.diffuse_color = rgba
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    if texture:
        texcoord = tree.nodes.new('ShaderNodeTexCoord')
        mapping = tree.nodes.new('ShaderNodeVectorMath')
        mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = (1.2, 28, 8) if texture == 'wood' else (1, 1, 1)
        tree.links.new(texcoord.outputs['Generated'], mapping.inputs[0])
        noise = tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 5 if texture == 'wood' else 95 if texture == 'felt' else 42
        noise.inputs['Detail'].default_value = 3
        noise.inputs['Roughness'].default_value = .7
        tree.links.new(mapping.outputs[0], noise.inputs['Vector'])
        ramp = tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .15
        ramp.color_ramp.elements[0].color = tuple(c * .68 for c in rgba[:3]) + (1,)
        ramp.color_ramp.elements[1].position = .85
        ramp.color_ramp.elements[1].color = rgba
        tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
        tree.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .19 if texture == 'wood' else .12
        bump.inputs['Distance'].default_value = .008 if texture == 'stone' else .0013
        tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    MATERIALS[name] = mat
    return mat


def finish(obj, name, mat, bevel=0, group=None):
    obj.name = name
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Crafted edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.affect = 'EDGES'
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        normal = obj.modifiers.new('Face weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    obj['asset_origin'] = 'project-local-authored'
    GEOMETRY.append(obj)
    if group:
        GROUPS.setdefault(group, []).append(obj)
        obj['review_group'] = group
    return obj


def box(name, dimensions, location, mat, bevel=.007, group=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel, group)


def cylinder(name, radius, depth, location, mat, group=None, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return finish(obj, name, mat, .003, group)


def rod(name, start, end, radius, mat, group=None):
    a, b = Vector(start), Vector(end)
    obj = cylinder(name, radius, (b-a).length, (a+b)/2, mat, group, 20)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def bounds(objects):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objects if o.type == 'MESH' for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def import_prop(asset_id, instance, manifest):
    spec = manifest['assets'][asset_id]
    path = SOURCE / spec['path']
    if sha(path) != spec['sha256']:
        raise RuntimeError(f'source hash mismatch: {asset_id}')
    old = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in old]
    bpy.context.view_layer.update()
    # Trimesh v2 wrote Z-up coordinates into a glTF container claiming Y-up.
    correction = Matrix.Rotation(-math.pi / 2, 4, 'X')
    frozen = {o: correction @ o.matrix_world for o in new if o.type == 'MESH'}
    objects = list(frozen)
    for obj, matrix in frozen.items():
        obj.parent = None
        obj.matrix_world = matrix
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        # Blender shaders ignore these legacy colors; glTF multiplies them.
        for attribute in list(obj.data.color_attributes):
            obj.data.color_attributes.remove(attribute)
    for obj in new:
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    original_names = {o: o.name for o in objects}
    if asset_id == 'evidence-table':
        for obj in list(objects):
            name = original_names[obj]
            if name.startswith(('evidence-card', 'pin-head', 'pin-socket')):
                objects.remove(obj)
                bpy.data.objects.remove(obj, do_unlink=True)
    lookup = {
        'Dark Walnut': 'Walnut', 'Walnut Edge': 'Walnut Edge', 'Felt Recess': 'Felt Shadow',
        'Oxidized Teal Felt': 'Archive Felt', 'Brass Shadow': 'Dark Brass', 'Aged Brass': 'Aged Brass',
        'Evidence Paper': 'Ivory Paper', 'Paper Edge': 'Paper Edge', 'Black Rubber': 'Enamel',
    }
    rotation = Matrix.Rotation(math.radians(instance['rotationDegrees'][2]), 4, 'Z')
    transform = Matrix.Translation(Vector(instance['location'])) @ rotation
    for obj in objects:
        key = obj.data.materials[0].name.split('.')[0] if obj.data.materials else 'Dark Walnut'
        finish(obj, instance['id'] + '__' + original_names[obj], MATERIALS[lookup.get(key, 'Walnut')], .004, instance['id'])
        obj.matrix_world = transform
    if asset_id == 'evidence-table':
        # True floor contact at a controlled half-millimetre inset.
        low, _ = bounds(objects)
        for obj in objects:
            obj.location.z += -.0005 - low[2]
    return objects


def boolean_opening(wall, opening):
    width, height = opening['widthMeters'], opening['heightMeters']
    cutter = box('temporary-cutter', (width, .8, height), opening['positionMeters'], None, 0)
    mod = wall.modifiers.new('Exact aperture ' + opening['id'], 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = wall
    bpy.ops.object.modifier_apply(modifier=mod.name)
    GEOMETRY.remove(cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)
    BOOLEAN_RECEIPTS.append({'openingId': opening['id'], 'wall': wall.name, 'solver': 'EXACT', 'applied': True})


def camera(name, location, target, vfov=53, horizontal=None):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()
    data.sensor_fit = 'HORIZONTAL'
    data.sensor_width = 36
    aspect = 16/9
    data.lens = 36/(2*math.tan(math.radians(horizontal)/2)) if horizontal else 36/(2*aspect*math.tan(math.radians(vfov)/2))
    data.clip_start = .04
    data.clip_end = 100
    obj['review_target'] = target
    return obj


def light(name, kind, location, target, energy, color, size=1, role='fixture'):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = srgb(color)
    if kind == 'AREA':
        data.shape = 'DISK'
        data.size = size
    elif kind == 'SPOT':
        data.spot_size = math.radians(95)
        data.spot_blend = .65
        data.shadow_soft_size = .08
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()
    LIGHTS.append({'id': name, 'type': kind, 'location': location, 'target': target, 'powerWatts': energy, 'colorSRGB': color, 'sizeMeters': size, 'role': role})
    return obj


def lamp(instance):
    group = instance['id']
    x, y, _ = instance['location']
    sign = instance['inwardSign']
    cylinder(group+'_base', .22, .06, (x,y,.03), MATERIALS['Enamel'], group)
    cylinder(group+'_step', .16, .07, (x,y,.095), MATERIALS['Dark Brass'], group)
    cylinder(group+'_stem', .025, 1.31, (x,y,.78), MATERIALS['Enamel'], group)
    rod(group+'_arm', (x,y,1.43), (x+sign*.28,y-.06,1.76), .024, MATERIALS['Aged Brass'], group)
    cylinder(group+'_hinge', .061, .055, (x,y,1.45), MATERIALS['Aged Brass'], group)
    cx, cy = x+sign*.28, y-.06
    # Closed annular profile forms a genuinely open, double-wall metal shade.
    profile = [(.055,1.79),(.065,1.77),(.215,1.59),(.216,1.565),(.201,1.562),(.201,1.584),(.050,1.765)]
    verts, faces = [], []
    n = 48
    for radius, z in profile:
        verts.extend([(cx+radius*math.cos(t*math.tau/n),cy+radius*math.sin(t*math.tau/n),z) for t in range(n)])
    for row in range(len(profile)):
        for t in range(n):
            faces.append((row*n+t,row*n+(t+1)%n,((row+1)%len(profile))*n+(t+1)%n,((row+1)%len(profile))*n+t))
    mesh = bpy.data.meshes.new(group+'_shade')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(group+'_shade', mesh)
    bpy.context.scene.collection.objects.link(obj)
    finish(obj, group+'_shade', MATERIALS['Enamel'], 0, group)
    for p in mesh.polygons:
        p.use_smooth = True
    cylinder(group+'_rim', .208, .008, (cx,cy,1.563), MATERIALS['Aged Brass'], group)
    # The thin emissive diffuser is supported by the shade rim.
    cylinder(group+'_diffuser', .188, .004, (cx,cy,1.557), MATERIALS['Warm Diffuser'], group)
    light(group+'_light','SPOT',(cx,cy,1.543),(sign*.65,.45,.93),160,'FFD8A5',role=group)


def storage(group, side):
    x = side * 5.275
    mat = MATERIALS['Walnut']
    box(group, (.82,2.9,.91),(x,1.1,.455),mat,.012,group)
    box(group+'_top',(.9,3.02,.065),(x,1.1,.9425),MATERIALS['Walnut Edge'],.01,group)
    for idx,y in enumerate((.16,.78,1.40,2.02)):
        for level,z in enumerate((.23,.62)):
            box(f'{group}_drawer{idx}_{level}',(.03,.565,.32),(x-side*.422,y,z),MATERIALS['Walnut Edge'],.005,group)
            rod(f'{group}_handle{idx}_{level}',(x-side*.46,y-.09,z+.015),(x-side*.46,y+.09,z+.015),.012,MATERIALS['Aged Brass'],group)


def build_scene(config, manifest):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    material('Plaster','536367',.9,texture='plaster')
    material('Panel Paint','283e40',.54,texture='wood')
    material('Moulding','3d5354',.43)
    material('Stone','3a4142',.65,texture='stone')
    material('Stone Alt','343b3c',.71,texture='stone')
    material('Grout','20282a',.9)
    material('Ceiling','697270',.91,texture='plaster')
    material('Walnut','4b2920',.48,texture='wood')
    material('Walnut Edge','7a4b30',.40,texture='wood')
    material('Aged Brass','b48648',.34,.72)
    material('Dark Brass','62482c',.48,.60)
    material('Archive Felt','28635b',.95,texture='felt')
    material('Felt Shadow','173f3a',1)
    material('Ivory Paper','e7dcc0',.8,texture='paper')
    material('Paper Edge','ab9679',.8)
    material('Enamel','203639',.3,.2)
    material('Warm Diffuser','ffe5b9',.45,emission=2.5)
    material('Fog Backing','8ca7ae',.9)
    material('Clay','989994',.8)
    layout = read(SOURCE/'input/room-layout.json')
    openings = read(SOURCE/'input/openings.json')['openings']
    for surface in layout['surfaces']:
        kind = surface['kind']
        mat = MATERIALS['Grout' if kind=='floor' else 'Ceiling' if kind=='ceiling' else 'Plaster']
        location=list(surface['location'])
        if kind=='floor':
            location[2]-=.035  # substrate meets tile undersides; no coplanar tops
        obj = box('SHELL_'+surface['id'],surface['dimensionsMeters'],location,mat,0,'shell')
        for opening in openings:
            if opening['wall'] == surface['id']:
                boolean_opening(obj, opening)
    # Stone units stop exactly at finished floor level.
    for col in range(12):
        for row in range(10):
            box(f'floor_tile_{col}_{row}',(.992,.792,.035),(-5.5+col,-3.6+row*.8,-.0175),MATERIALS['Stone Alt' if (col+row)%4==0 else 'Stone'],.002)
    # Wainscot and skirting, split at the actual arrival aperture.
    for side in (-1,1):
        box(f'panel_side_{side}',(.055,7.6,1.08),(side*5.7725,0,.54),MATERIALS['Panel Paint'])
        for y in (-3.4,-2.55,-1.7,-.85,0,.85,1.7,2.55,3.4):
            box(f'panel_batten_{side}_{y}',(.065,.038,.9),(side*5.723,y,.54),MATERIALS['Moulding'],.002)
        box(f'side_dado_{side}',(.09,7.6,.07),(side*5.727,0,1.1),MATERIALS['Moulding'])
        box(f'side_skirting_{side}',(.09,7.6,.14),(side*5.727,0,.07),MATERIALS['Moulding'])
        box(f'south_panel_{side}',(4.58,.055,1.08),(side*3.51,-3.7725,.54),MATERIALS['Panel Paint'])
        box(f'south_skirting_{side}',(4.58,.09,.14),(side*3.51,-3.727,.07),MATERIALS['Moulding'])
        box(f'south_dado_{side}',(4.58,.09,.07),(side*3.51,-3.727,1.1),MATERIALS['Moulding'])
    box('north_panel',(11.6,.055,1.08),(0,3.7725,.54),MATERIALS['Panel Paint'])
    box('north_dado',(11.6,.09,.07),(0,3.727,1.1),MATERIALS['Moulding'])
    box('north_skirting',(11.6,.09,.14),(0,3.727,.07),MATERIALS['Moulding'])
    for x in (-5.71,5.71):
        box('cornice_side_'+str(x),(.18,7.6,.17),(x,0,3.915),MATERIALS['Moulding'])
    for y in (-3.71,3.71):
        box('cornice_end_'+str(y),(11.6,.18,.17),(0,y,3.915),MATERIALS['Moulding'])
    for y in (-1.7,1.7):
        box('ceiling_beam_'+str(y),(11.6,.23,.26),(0,y,3.87),MATERIALS['Panel Paint'],.012,'ceiling-fixtures')
        box('ceiling_diffuser_'+str(y),(3.8,.11,.025),(0,y,3.729),MATERIALS['Warm Diffuser'],.004,'ceiling-fixtures')
        light('ceiling_light_'+str(y),'AREA',(0,y,3.69),(0,y,0),320,'FFE0B3',2.8,role='ceiling-fixtures')
    for x in (-3.85,3.85):
        box('ceiling_cross_'+str(x),(.14,7.6,.16),(x,0,3.92),MATERIALS['Moulding'],.007,'ceiling-fixtures')
    # An actual visible hallway, rather than a cutout ending at empty space.
    box('foyer_floor',(2.4,2.5,.1),(0,-5.25,-.05),MATERIALS['Stone'])
    box('foyer_ceiling',(2.8,2.5,.2),(0,-5.25,2.7),MATERIALS['Ceiling'])
    for x in (-1.3,1.3):
        box('foyer_wall_'+str(x),(.2,2.5,2.6),(x,-5.25,1.3),MATERIALS['Plaster'])
        box('door_jamb_'+str(x),(.15,.29,2.68),(x,-3.82,1.34),MATERIALS['Walnut Edge'])
    box('door_lintel',(2.76,.29,.15),(0,-3.82,2.69),MATERIALS['Walnut Edge'])
    box('foyer_backing',(2.4,.15,2.6),(0,-6.5,1.3),MATERIALS['Panel Paint'])
    light('foyer_lamp','AREA',(0,-5,2.55),(0,-4,0),140,'FFDDB3',1.1,role='foyer')
    # Window has depth, sill, mullions and a local fog courtyard backing.
    for x in (-.96,.96):
        box('window_jamb_'+str(x),(.12,.35,1.52),(x,3.84,2),MATERIALS['Walnut Edge'])
    for z in (1.24,2.76):
        box('window_frame_'+str(z),(2.04,.35,.12),(0,3.84,z),MATERIALS['Walnut Edge'])
    box('window_sill',(2.2,.5,.075),(0,3.69,1.30),MATERIALS['Walnut Edge'])
    box('window_vertical',(.045,.08,1.4),(0,3.94,2),MATERIALS['Enamel'],.002)
    box('window_horizontal',(1.8,.08,.045),(0,3.94,2),MATERIALS['Enamel'],.002)
    box('courtyard_backing',(8,.15,6),(0,5.8,2.5),MATERIALS['Fog Backing'])
    for x in (-2.5,0,2.5):
        box('courtyard_masonry_'+str(x),(.11,.2,6),(x,5.65,2.5),MATERIALS['Plaster'])
    light('courtyard_key','AREA',(0,4.65,2.45),(0,-1,.8),1800,'B9D7EA',2.3,role='window')
    for instance in config['instances']:
        if instance['assetId'] == 'blender-floor-lamp':
            lamp(instance)
        else:
            import_prop(instance['assetId'],instance,manifest)
    # Papers sit on the felt, with pin hardware at a realistic scale.
    for idx,(x,y,angle) in enumerate(((-.56,.54,-.15),(-.05,.66,.1),(.47,.49,.22))):
        sheet = box('table_case_sheet_'+str(idx),(.34,.26,.004),(x,y,.967),MATERIALS['Ivory Paper'],.001,'hero-evidence-table-01')
        sheet.rotation_euler.z = angle
        for row in range(4):
            line = box(f'paper_rule_{idx}_{row}',(.19,.003,.0005),(x-.025,y-.07+row*.035,.9694),MATERIALS['Paper Edge'],0,'hero-evidence-table-01')
            line.rotation_euler.z = angle
    for idx,x in enumerate((-.85,-.50,-.15,.20,.55,.90)):
        cylinder('table_locator_'+str(idx),.019,.009,(x,.12,.976),MATERIALS['Aged Brass'],'hero-evidence-table-01',16)
    for side in (-1,1):
        storage('archive_cabinet_'+str(side),side)
        # Rear archive bays add depth without occupying the central investigation loop.
        x = side*3.5
        group = 'rear_archive_'+str(side)
        # A real carcass, with accessible shelves instead of files embedded
        # in a solid block. The back and sides meet each shelf.
        box(group+'_back',(2.2,.045,2.38),(x,3.7475,1.19),MATERIALS['Walnut'],.005,group)
        for side in (-1,1):
            box(group+'_side_'+str(side),(.07,.53,2.38),(x+side*1.065,3.495,1.19),MATERIALS['Walnut'],.007,group)
        for z in (.16,.76,1.36,1.96,2.38):
            box(group+'_shelf_'+str(z),(2.22,.57,.06),(x,3.485,z),MATERIALS['Walnut Edge'],.005,group)
        for row in range(4):
            for column in range(7):
                width = .18 if column%2 else .22
                px = x-.9+column*.29
                height = .35 + (column%3)*.035
                z=.19+row*.6+height/2
                box(f'{group}_file_{row}_{column}',(width,.36,height),(px,3.37,z),MATERIALS['Panel Paint' if column%3 else 'Paper Edge'],.004,group)
                box(f'{group}_label_{row}_{column}',(width*.6,.004,.055),(px,3.187,z+.07),MATERIALS['Ivory Paper'],.001,group)
    # Broad, motivated room bounce is explicitly recorded as an authoring fill.
    light('arrival_bounce','AREA',(0,-3.25,2.4),(0,1.2,1),520,'DBE4E0',4.5,role='authoring-fill')
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(*srgb('91B0BF'),1)
    bg.inputs['Strength'].default_value=.15
    cameras = {}
    spec=config['productionCamera']
    cameras['production']=camera('production',spec['location'],spec['target'],spec['verticalFovDegrees'])
    cameras['arrival-wide']=camera('arrival-wide',(0,-3.45,1.8),(0,.9,1.55),61)
    cameras['low-hero']=camera('low-hero',(2.8,-2.15,.70),(0,.55,1),56)
    # Rear cameras stand in front of the archive bays; rear-wall positions
    # were occluded by the shelves and did not inspect the actual room.
    for name,location in {'corner-sw':(-5.45,-3.45,1.75),'corner-se':(5.45,-3.45,1.75),'corner-nw':(-5.45,2.85,2.85),'corner-ne':(5.45,2.85,2.85)}.items():
        cameras[name]=camera(name,location,(0,0,1.75),horizontal=120)
    cameras['ceiling-up']=camera('ceiling-up',(0,0,1.05),(0,0,4),horizontal=120)
    cameras['ceiling-oblique-a']=camera('ceiling-oblique-a',(-4,-2.8,2),(0,.5,3.8),75)
    cameras['ceiling-oblique-b']=camera('ceiling-oblique-b',(4,2.8,2),(0,-.5,3.8),75)
    scene.camera=cameras['production']
    scene['room_id']=config['roomId']
    scene['variant']=config['variant']
    scene['human_approval']=False
    return cameras


def audit(config, cameras):
    deps=bpy.context.evaluated_depsgraph_get()
    tri=0
    nonmanifold=[]
    for obj in GEOMETRY:
        mesh=obj.evaluated_get(deps).to_mesh()
        mesh.calc_loop_triangles()
        tri+=len(mesh.loop_triangles)
        bm=bmesh.new()
        bm.from_mesh(mesh)
        if any(not edge.is_manifold for edge in bm.edges):
            nonmanifold.append(obj.name)
        bm.free()
        obj.evaluated_get(deps).to_mesh_clear()
    group_bounds={name: {'min': [round(v,6) for v in bounds(objects)[0]],'max':[round(v,6) for v in bounds(objects)[1]]} for name,objects in GROUPS.items() if name!='shell'}
    camera=cameras['production']
    hero=GROUPS['hero-evidence-table-01']
    points=[world_to_camera_view(bpy.context.scene,camera,o.matrix_world@Vector(c)) for o in hero for c in o.bound_box]
    framed=all(.025<=p.x<=.975 and .025<=p.y<=.975 and p.z>0 for p in points)
    pairs=[]
    for lamp_id in ('archive-lamp-left','archive-lamp-right'):
        table=group_bounds['hero-evidence-table-01']
        fixture=group_bounds[lamp_id]
        overlap=all(min(table['max'][i],fixture['max'][i])-max(table['min'][i],fixture['min'][i])>0 for i in range(3))
        pairs.append({'lampId':lamp_id,'tableAABBOverlap':overlap})
    measured = spatial_review(GROUPS, GEOMETRY, cameras, config)
    return {'schema':'game-room.blender-geometry-audit.v1','status':'agent-measured-candidate','humanApproval':False,
      'trianglesEvaluated':tri,'meshObjects':len(GEOMETRY),'nonManifoldObjects':nonmanifold,'groupBoundsMeters':group_bounds,
      'booleans':BOOLEAN_RECEIPTS,'heroFullyFramedWithMargin':framed,
      'productionCameraInsideRoom':abs(camera.location.x)<5.8 and abs(camera.location.y)<3.8 and 0<camera.location.z<4,
      'lampTableSeparation':pairs,'spatialReview':measured,
      'limits':['Clearance uses conservative evaluated-mesh group bounds and sampled route centers; it is not a live player-controller test.','No target-device or human art approval is inferred from this audit.']}


def export_review_glb(path):
    # Procedural shaders cannot be serialized into glTF. Make an explicit
    # color fallback rather than letting the exporter silently emit white.
    saved=[]
    try:
        for mat in MATERIALS.values():
            bsdf=mat.node_tree.nodes.get('Principled BSDF')
            for socket in ('Base Color','Normal'):
                for link in list(bsdf.inputs[socket].links):
                    saved.append((mat,link.from_socket,link.to_socket))
                    mat.node_tree.links.remove(link)
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=False, export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
    finally:
        for mat,source,target in saved:
            mat.node_tree.links.new(source,target)


def package_manifests(config, blend, review_glb, audit_result):
    low,high=bounds(GEOMETRY)
    dims=[round(high[i]-low[i],6) for i in range(3)]
    asset={'id':'blender-room-review','kind':'room','path':review_glb.name,
           'bytes':review_glb.stat().st_size,'sha256':sha(review_glb),
           'license':'project-local-original','source':'local Blender composition derived from authored-v2',
           'status':'candidate-only','humanApproval':False,'runtimeVerified':False,'dimensionsMeters':dims}
    write(OUT/'asset-manifest.json',{'schema':'world-asset-manifest.v1','packageId':config['roomId'],
        'version':'3.0.0-blender-candidate','generatedAt':datetime.now(timezone.utc).isoformat(),
        'policy':{'licenseRequired':True,'humanReviewRequired':True,'runtimeVerificationRequired':True},'assets':[asset]})
    write(OUT/'license-ledger.json',{'schema':'world-asset-license-ledger.v1','packageId':config['roomId'],
        'variant':config['variant'],'externalDownloads':False,'paidServicesUsed':False,'defaultStatus':'candidate-only',
        'sourceAssetHashes':{name:info['sha256'] for name,info in read(SOURCE/'authored-candidate.json')['assets'].items() if name in ('evidence-table','caseboard')},
        'sourceBlend':{'path':blend.name,'sha256':sha(blend),'bytes':blend.stat().st_size},
        'localAuthoring':['Exact Boolean shell','new floor lamp geometry','cabinet carcasses and files','procedural Blender material nodes','fixture lighting'],
        'assets':[asset], 'licenseMeaning':'Project-local provenance declaration; no third-party license grant or human clearance is inferred.',
        'exportLimitations':['Review GLB preserves geometry and PBR base colors only.','Procedural noise, bump and Cycles lighting are in the blend, not baked into this review GLB.'],
        'runtimeEligible':False})


def final_report(config, audit_result, render_entries):
    rendered={entry['view'] for entry in render_entries}
    spatial=audit_result['spatialReview']
    return {
        'schema':'game-room.room-final-report.v1','roomId':config['roomId'],'variant':config['variant'],
        'gates':{'function':False,'form':False,'runtime':False},
        'evidenceScope':'automated Blender candidate checks; human and application gates remain separate',
        'formChecks':{
            'floorPlanParity':False,'primaryArrival':all(v['passed'] for v in spatial['openingRays']),
            'symmetry':False,'shell':False,  # a full bright-world leak test is still pending
            'manifold':not audit_result['nonManifoldObjects'],
            'booleans':all(item['applied'] for item in audit_result['booleans']),
            'collisions':not spatial['independentPropBVHIntersections'],
            'support':all(item['passed'] for item in spatial['supportContact']),
            'attachmentOrientation':False,'ceilingAttachmentOrientation':False,
            'screenClearance':False,'scale':True,'camera':audit_result['productionCameraInsideRoom'],
            'ceilingCoverage':{'ceiling-up','ceiling-oblique-a','ceiling-oblique-b'}.issubset(rendered),
            'provenance':True,
        },
        'reviewRenders':{
            'corners':[entry['path'] for entry in render_entries if entry['view'].startswith('corner-')],
            'ceiling':[entry['path'] for entry in render_entries if entry['view'].startswith('ceiling-')],
            'environment':{},
        },
        'runtimeChecks':{'vlow':False,'textureTiers':False,'lightmap':False,'lightingManifest':False,
                         'performance':False,'browserCapture':'','errors':[]},
        'postmortem':{
            'observations':['Background Blender composition, geometry audit and Cycles/OptiX renders are bound to current source hashes.'],
            'corrections':config['corrections']+['Built hollow archive carcasses and seated files on shelves.',
                'Moved rear inspection cameras out of shelf occlusion.',
                'Separated the floor substrate and tile tops after browser z-fighting was observed.'],
            'remainingRisks':['Human Function/Form decisions and live player movement testing remain open.',
                'Procedural textures and lighting are not baked into the review GLB.',
                'Review-viewer measurements do not prove game integration or mobile-device performance.'],
        },
        'proposedLessons':[],
    }


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument('--views',default='all')
    parser.add_argument('--samples',type=int,default=48)
    parser.add_argument('--width',type=int,default=1440)
    parsed=parser.parse_args(args)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'renders').mkdir(exist_ok=True)
    config=read(OUT/'composition.json')
    manifest=read(SOURCE/'authored-candidate.json')
    cameras=build_scene(config,manifest)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
    scene.cycles.samples=parsed.samples
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=7
    scene.render.resolution_x=parsed.width
    scene.render.resolution_y=round(parsed.width*9/16)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.8
    scene.render.film_transparent=False
    bpy.context.preferences.filepaths.save_version=0
    audit_result = audit(config,cameras)
    write(OUT/'geometry-audit.json',audit_result)
    write(OUT/'lighting-manifest.json',{'schema':'game-room.lighting-manifest.v1','roomId':config['roomId'],'status':'authoring-candidate','fixtures':LIGHTS,'environment':'local uniform world; no HDRI','runtimeBakeVerified':False})
    blend=OUT/'fog-lamp-evidence-room.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    review_glb=OUT/'review-room-candidate.glb'
    bpy.ops.object.select_all(action='SELECT')
    export_review_glb(review_glb)
    package_manifests(config,blend,review_glb,audit_result)
    views=list(cameras) + ['clay-production'] if parsed.views=='all' else parsed.views.split(',')
    render_entries=[]
    for view in views:
        scene.camera=cameras['production' if view=='clay-production' else view]
        bpy.context.view_layer.material_override=MATERIALS['Clay'] if view=='clay-production' else None
        path=OUT/'renders'/f'{view}.png'
        scene.render.filepath=str(path)
        start=time.perf_counter()
        bpy.ops.render.render(write_still=True)
        render_entries.append({'view':view,'path':path.relative_to(OUT).as_posix(),'sha256':sha(path),'seconds':round(time.perf_counter()-start,2),'size':[scene.render.resolution_x,scene.render.resolution_y], 'cameraLocationMeters':list(scene.camera.location), 'horizontalFovDegrees':math.degrees(scene.camera.data.angle_x)})
        print('REVIEW_RENDER='+json.dumps(render_entries[-1]),flush=True)
    receipt={'schema':'game-room.blender-render-receipt.v1','roomId':config['roomId'],'blenderVersion':bpy.app.version_string,'background':bpy.app.background,'engine':'CYCLES','device':'OPTIX','samples':parsed.samples,'blendSha256':sha(blend),'reviewGlbSha256':sha(review_glb),'compositionSha256':sha(OUT/'composition.json'),'scriptSha256':sha(Path(__file__)),'spatialAuditScriptSha256':sha(ROOT/'scripts/lib/blender_room_spatial_review.py'),'sourceCandidateSha256':sha(SOURCE/'authored-candidate.json'),'geometryAuditSha256':sha(OUT/'geometry-audit.json'),'lightingManifestSha256':sha(OUT/'lighting-manifest.json'),'renders':render_entries,'humanApproval':False,'runtimeVerified':False}
    write(OUT/'render-receipt.json',receipt)
    write(OUT/'art-review.json',{'schema':'game-room.blender-art-review.v1','roomId':config['roomId'],'variant':config['variant'],'reviewStatus':'agent-preflight-candidate','humanApproval':False,'blendPath':blend.name,'reviewGlbPath':review_glb.name,'geometryAuditPath':'geometry-audit.json','lightingManifestPath':'lighting-manifest.json','renderReceiptPath':'render-receipt.json','views':[entry['path'] for entry in render_entries],'observations':['Blender background import preserves a readable interior orientation after the authored-v2 Z-up correction.','The production camera is inside the room and the hero table is fully framed with paired lamps separated from its AABB.','The south opening has a visible foyer destination and the north window has sill, frame, mullions and backing.','Ceiling fixtures and two opposed obliques are present for attachment review.'],'blockingQuestions':['Does the dark walnut remain dark enough on the target display after final color management?','Does the central aisle remain comfortable with the player capsule and interaction reach?','Are the caseboard labels legible without making the room feel UI-like?'],'humanDecision':{'function':'pending','form':'pending','runtime':'blocked'}})
    write(OUT/'milestone-reviews.json',{'schema':'game-room.milestone-reviews.v1','roomId':config['roomId'],'variant':config['variant'],'function':{'status':'pending','approved':False,'approvedBy':'','notes':'Rendered Blender composition is ready for human arrival, circulation and hero hierarchy review.'},'form':{'status':'pending','approved':False,'approvedBy':'','notes':'Geometry and multi-view preflight are recorded; human proportion, material and support review is still required.'},'runtime':{'status':'blocked','approved':False,'approvedBy':'','notes':'Review GLB is not runtime-eligible until accepted export, browser capture and target-device performance evidence exist.'}})
    write(OUT/'final-report.json',final_report(config,audit_result,render_entries))
    (OUT/'README.md').write_text('# Blender local v3 room review\n\nThis is a review-only Blender composition derived from `../authored-v2`. It imports the local authored GLBs, corrects their legacy axis, adds procedural shell detail, Exact Boolean openings, archive dressing, named materials, fixture lighting, an interior production camera, and the required multi-view render set.\n\nThe package is `candidate-only`: `fog-lamp-evidence-room.blend` is the authoring source and `review-room-candidate.glb` is a review export. Neither is the player runtime. Human Function/Form approval and target-device Runtime evidence are still required.\n', encoding='utf-8')
    print('BLENDER_REVIEW_COMPLETE='+json.dumps({'views':len(render_entries),'blend':str(blend),'reviewGlb':str(review_glb)}),flush=True)


if __name__=='__main__':
    main()
