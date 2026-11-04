"""Second character pass: settled fabric, relaxed stance and softer hair.

Uses the preserved first-pass authoring helpers and CC0 anatomical data. Cloth
is settled in background Blender and frozen into the skinned game mesh; this is
not a claim of runtime cloth or autonomous resident behavior.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v2'
BASE = ROOT / 'docs/3d-town/classic-residents-v1'
spec = importlib.util.spec_from_file_location('resident_first_pass', ROOT / 'scripts/build-blender-classic-residents.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
inv, u = base.inv, base.u
base.PACKAGE = PACKAGE
inv.PACKAGE = PACKAGE
u.PACKAGE = PACKAGE
original_clothes = base.clothes
original_hair = base.anatomy.hair
original_anatomy = base.anatomy.anatomy
original_pose = inv.pose
SIMULATIONS = []
SCULPTED = []


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def remove_skin_prefix(*prefixes):
    for obj in list(inv.SKIN):
        if obj.name.startswith(prefixes):
            inv.SKIN.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)


def collider(obj, name, shrink=None):
    copy = bpy.data.objects.new(name, obj.data.copy())
    bpy.context.collection.objects.link(copy)
    if shrink:
        for vertex in copy.data.vertices:
            vertex.co = shrink(vertex.co.copy())
    # Collision supports are closed volumes with outward normals. An open skirt
    # shell whose normals face inward pushes cloth into the legs instead of
    # supporting it, even when the solver's stretch parameters are correct.
    bm = bmesh.new()
    bm.from_mesh(copy.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(copy.data)
    bm.free()
    copy.data.update()
    copy.hide_render = True
    copy.display_type = 'WIRE'
    copy['authoringOnly'] = True
    copy.modifiers.new('cloth_contact', 'COLLISION')
    copy.collision.thickness_outer = .002
    copy.collision.thickness_inner = .001
    copy.collision.cloth_friction = 8
    return copy


def settle(obj, pinned, contacts, frames=64, bend=.06, mass=.22, tension=35):
    scene = bpy.context.scene
    scene.frame_set(1)
    scene.render.fps = 30
    original = [v.co.copy() for v in obj.data.vertices]
    pin_weights = [max(0, min(1, pinned(v.co, v.index))) for v in obj.data.vertices]
    controls = {'frames': frames, 'fps': 30, 'quality': 8, 'mass': mass, 'bend': bend,
                'tension': tension, 'compression': 25, 'shear': 12, 'airDamping': 3,
                'collisionDistance': .0015, 'selfDistance': .0007, 'collisionQuality': 5,
                'pinStiffness': 1, 'tensionDamping': 10, 'shearDamping': 10,
                'compressionDamping': 10, 'bendingDamping': .8, 'selfFriction': 5,
                'gravity': list(scene.gravity), 'blenderVersion': bpy.app.version_string}
    inputs = {'controls': controls, 'points': [list(v) for v in original],
              'faces': [list(f.vertices) for f in obj.data.polygons], 'pins': pin_weights,
              'contacts': [{'points': [list(v.co) for v in c.data.vertices],
                            'faces': [list(f.vertices) for f in c.data.polygons],
                            'outer': c.collision.thickness_outer, 'inner': c.collision.thickness_inner,
                            'friction': c.collision.cloth_friction} for c in contacts]}
    signature = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()
    cache = PACKAGE / 'cloth-cache' / (obj.name + '-' + signature + '.json')
    if cache.exists():
        saved = json.loads(cache.read_text(encoding='utf-8'))
        assert saved['inputSha256'] == signature and saved['passed']
        assert len(saved['points']) == len(obj.data.vertices)
        for vertex, point in zip(obj.data.vertices, saved['points']):
            vertex.co = point
        SIMULATIONS.append(dict(saved['review'], cached=True, cacheSha256=base.sha(cache),
                                cachePath=cache.relative_to(ROOT).as_posix()))
        for contact in contacts:
            bpy.data.objects.remove(contact, do_unlink=True)
        print(json.dumps({'reusedVerifiedCloth': obj.name, 'inputSha256': signature}), flush=True)
        return obj
    group = obj.vertex_groups.new(name='tailoring_pins')
    for vertex, weight in zip(obj.data.vertices, pin_weights):
        if weight > 0:
            group.add([vertex.index], min(1, weight), 'REPLACE')
    collection = bpy.data.collections.new('tailoring_contacts_' + obj.name)
    scene.collection.children.link(collection)
    for contact in contacts:
        collection.objects.link(contact)
    cloth = obj.modifiers.new('settle_fabric', 'CLOTH')
    settings = cloth.settings
    settings.quality = 8
    settings.mass = mass
    settings.air_damping = 3
    settings.tension_stiffness = tension
    settings.compression_stiffness = 25
    settings.shear_stiffness = 12
    settings.bending_stiffness = bend
    settings.tension_damping = 10
    settings.compression_damping = 10
    settings.shear_damping = 10
    settings.bending_damping = .8
    settings.vertex_group_mass = group.name
    settings.pin_stiffness = 1
    collision = cloth.collision_settings
    collision.collection = collection
    collision.collision_quality = 5
    collision.distance_min = .0015
    collision.use_self_collision = True
    collision.self_distance_min = .0007
    collision.self_friction = 5
    cloth.point_cache.frame_start = 1
    cloth.point_cache.frame_end = frames
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        if frame % 16 == 0:
            print(json.dumps({'settling': obj.name, 'frame': frame, 'frames': frames}), flush=True)
    active(obj)
    bpy.ops.object.modifier_apply(modifier=cloth.name)
    # Applying cloth replaces the mesh's RNA group handles in Blender 5.2.
    # Resolve the pin group again instead of keeping the pre-apply handle.
    pins = obj.vertex_groups.get('tailoring_pins')
    if pins:
        obj.vertex_groups.remove(pins)
    points = [v.co for v in obj.data.vertices]
    maximum = max((a - b).length for a, b in zip(points, original))
    assert all(math.isfinite(c) for p in points for c in p)
    bounds = [[min(p[k] for p in points), max(p[k] for p in points)] for k in range(3)]
    lengths = [((points[e.vertices[0]] - points[e.vertices[1]]).length /
                max((original[e.vertices[0]] - original[e.vertices[1]]).length, 1e-8)) for e in obj.data.edges]
    review = {'object': obj.name, 'frames': frames, 'fps': 30, 'controls': controls,
              'frozenIntoGameMesh': True, 'vertices': len(points),
              'maxDisplacementMeters': maximum, 'maximumEdgeStretch': max(lengths), 'bounds': bounds}
    if maximum >= .24 or max(lengths) >= 1.4:
        failure = PACKAGE / 'diagnostics'
        failure.mkdir(parents=True, exist_ok=True)
        base.write(failure / (obj.name + '-failed.json'), review)
        bpy.ops.wm.save_as_mainfile(filepath=str(failure / (obj.name + '-failed.blend')))
    assert maximum < .24, (obj.name, 'excess cloth displacement', maximum)
    assert max(lengths) < 1.4, (obj.name, 'excess edge stretch', max(lengths))
    base.write(cache, {'inputSha256': signature, 'passed': True, 'review': review,
                       'points': [list(v) for v in points], 'computedBySha256': base.sha(Path(__file__))})
    SIMULATIONS.append(dict(review, cached=False, cacheSha256=base.sha(cache),
                            cachePath=cache.relative_to(ROOT).as_posix()))
    # Preserve no collision helpers in the exported character selection.
    bpy.data.collections.remove(collection)
    for contact in contacts:
        bpy.data.objects.remove(contact, do_unlink=True)
    scene.frame_set(1)
    return obj


def soften_blouse():
    obj = next(o for o in inv.SKIN if o.name == 'anatomically_fitted_garment')
    # Whole-shirt cloth trials produced torn-looking armpits/cuffs and were
    # rejected. Author controlled compression folds on the intact fitted mesh;
    # the skirt and apron below still use actual cloth settling.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if all(abs(v.co.x) > .228 and .98 < v.co.z < 1.39 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    for v in obj.data.vertices:
        x, y, z = v.co
        if abs(x) > .220 and .972 < z < 1.37:
            a = math.atan2(x - math.copysign(.278, x), -(y + .018))
            side = 1 if x > 0 else -1
            compression = .25 + .75 * max(0, math.cos(a))
            fold = 0
            for center, height, width in [(1.024, .0034, .011), (1.094, .005, .014), (1.173, .0035, .017)]:
                zz = z - center - .012 * math.sin(a + side * .7)
                fold += height * (math.exp(-(zz / width) ** 2)
                         - .52 * math.exp(-((zz - width * 1.35) / (width * .72)) ** 2))
            fold *= compression * inv.smooth((abs(x) - .22) / .028)
            v.co.x += math.sin(a) * fold
            v.co.y -= math.cos(a) * fold
        elif abs(x) < .195 and 1.045 < z < 1.17:
            a = math.atan2(x, -(y - .006))
            fold = .0022 * math.sin(a * 9 + .45) * math.exp(-((z - 1.092) / .035) ** 2)
            v.co.x += math.sin(a) * fold
            v.co.y -= math.cos(a) * fold
    obj.data.update()
    SCULPTED.append({'object': obj.name, 'method': 'authored compression folds on intact fitted cloth topology',
                     'vertices': len(obj.data.vertices), 'simulated': False,
                     'rejectedMethod': 'full-shirt cloth trials retained in diagnostics; not used in final mesh'})
    return obj


def draped_skirt():
    remove_skin_prefix('gored_wool_skirt')
    rows, sides = 25, 80
    verts, faces = [], []
    for i in range(rows):
        t = i / (rows - 1)
        z = 1.06 - .88 * t
        rx = .173 + .120 * t ** .72
        ry = .134 + .079 * t ** .8
        for j in range(sides):
            angle = math.tau * j / sides
            # Authored gored-panel ease seeds broad folds; gravity and contacts
            # settle them. These are real silhouette folds, not painted stripes.
            wave = (math.cos(angle * 12 + .35 * t) + .28 * math.cos(angle * 7 - .6))
            amount = .008 * math.sin(min(1, t * 2) * math.pi / 2)
            verts.append(((rx + amount * wave) * math.sin(angle),
                          .008 - (ry + amount * wave) * math.cos(angle), z))
    for i in range(rows - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a + sides, b + sides, b, a))
    obj = u.mesh('settled_gored_wool_skirt', verts, faces, 'trousers', True)
    # A conservative underskirt support avoids numerical contact with bare legs
    # during this authoring simulation. It is not exported.
    support = u.mesh('underskirt_support',
        [(x * .89, y * .88, z) for x, y, z in verts], faces, 'trousers', True)
    support = collider(support, 'skirt_contact_shell')
    unused = bpy.data.objects.get('underskirt_support')
    bpy.data.objects.remove(unused, do_unlink=True)
    settle(obj, lambda p, idx: 1 if idx < sides else .6 if idx < sides * 2 else 0,
           [support], frames=72, bend=.13, mass=.012, tension=120)
    inv.skin(obj, inv.coat_weight)
    return obj


def draped_apron(blouse, skirt):
    remove_skin_prefix('working_apron', 'linen_apron_bib', 'apron_patch_pocket', 'apron_shoulder_strap')
    rows, cols = 39, 25
    waistband = bpy.data.objects['fitted_linen_waistband']
    supports = [blouse, skirt, waistband]
    support_points, support_faces = [], []
    for support in supports:
        offset = len(support_points)
        support_points.extend(v.co.copy() for v in support.data.vertices)
        support_faces.extend(tuple(i + offset for i in f.vertices) for f in support.data.polygons)
    surface = BVHTree.FromPolygons(support_points, support_faces)
    verts, faces = [], []
    for i in range(rows):
        z = 1.395 - 1.065 * i / (rows - 1)
        width = .095 + (1.395 - z) * .11 if z > 1.045 else .134 + (1.045 - z) * .115
        for j in range(cols):
            s = j / (cols - 1) * 2 - 1
            x = width * s
            hit = surface.ray_cast(Vector((x, -.6, z)), Vector((0, 1, 0)))[0]
            y = (hit.y if hit else -.15) - .014
            y -= .003 * math.sin(s * math.pi * 3 + z * 12) * (1 - s * s)
            verts.append((x, y, z))
    for i in range(rows - 1):
        for j in range(cols - 1):
            a = i * cols + j
            faces.append((a + cols, a + cols + 1, a + 1, a))
    obj = u.mesh('settled_linen_work_apron', verts, faces, 'accent', True)
    def pinned(p, idx):
        row, col = divmod(idx, cols)
        if row == 0 or abs(p.z - 1.045) < .025:
            return 1
        if row == 1 and (col < 3 or col > cols - 4):
            return .8
        return 0
    settle(obj, pinned, [collider(blouse, 'apron_blouse_contact'), collider(skirt, 'apron_skirt_contact'),
                        collider(waistband, 'apron_waistband_contact')],
           frames=64, bend=.045, mass=.008, tension=120)
    inv.skin(obj, inv.coat_weight)
    # Hem cords trace the settled cloth boundary, following its actual drape.
    for indices, name in [(range(0, rows * cols, cols), 'apron_left_hem'),
                          (range(cols - 1, rows * cols, cols), 'apron_right_hem'),
                          (range((rows - 1) * cols, rows * cols), 'apron_lower_hem')]:
        points = [obj.data.vertices[k].co + Vector((0, -.0008, 0)) for k in list(indices)[::2]]
        inv.tube(name, points, .0009, 'accent', inv.coat_weight)
    for s in (-1, 1):
        top = obj.data.vertices[3 if s < 0 else cols - 4].co.copy()
        controls = [top, Vector((s * .096, -.13, 1.455)), Vector((s * .11, -.065, 1.505)),
                    Vector((s * .115, .005, 1.520)), Vector((s * .12, .08, 1.485)),
                    Vector((s * .12, .135, 1.34)), Vector((s * .12, .14, 1.07))]
        blouse_surface = BVHTree.FromPolygons([v.co for v in blouse.data.vertices],
                                            [f.vertices for f in blouse.data.polygons])
        stripverts = []
        for i in range((len(controls) - 1) * 7 + 1):
            section = min(len(controls) - 2, i // 7)
            t = min(1, (i - section * 7) / 7)
            point = controls[section].lerp(controls[section + 1], t)
            for dx in (-.008, .008):
                q = point + Vector((dx, 0, 0))
                hit, normal, _, _ = blouse_surface.find_nearest(q)
                # Preserve the bib attachment, then lay the whole woven strap
                # over the actual shoulder surface so it never vanishes inside.
                if i < 3:
                    q.y = min(q.y, top.y) - .002
                elif hit:
                    q = hit + normal * .004
                stripverts.append(q)
        stripfaces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(stripverts) // 2 - 1)]
        strap = u.mesh('woven_apron_strap', stripverts, stripfaces, 'accent', True)
        inv.skin(strap, inv.torso)
    # A soft pocket follows the apron surface, instead of a flat box on the skirt.
    apron_surface = BVHTree.FromPolygons([v.co for v in obj.data.vertices], [f.vertices for f in obj.data.polygons])
    pocketverts, pocketfaces = [], []
    n = 8
    for i in range(n + 1):
        z = .905 - i / n * .127
        for j in range(n + 1):
            x = -.068 + j / n * .136
            hit = apron_surface.ray_cast(Vector((x, -.6, z)), Vector((0, 1, 0)))[0]
            y = hit.y if hit else -.204
            pocketverts.append((x, y - .003 - .006 * math.sin(j / n * math.pi) * (1 - i / n), z))
    for i in range(n):
        for j in range(n):
            a = i * (n + 1) + j
            pocketfaces.append((a, a + 1, a + n + 2, a + n + 1))
    inv.skin(u.mesh('soft_apron_patch_pocket', pocketverts, pocketfaces, 'accent', True), inv.coat_weight)
    return obj


def clothes(profile):
    original_clothes(profile)
    if profile['outfit'] == 'restorer':
        blouse = soften_blouse()
        skirt = draped_skirt()
        remove_skin_prefix('waistband')
        base.loft('fitted_linen_waistband', [(1.012, .197, .154, 0, .006),
                   (1.030, .192, .149, 0, .006), (1.065, .181, .142, 0, .006)],
                  'accent', inv.torso, 64)
        draped_apron(blouse, skirt)


def hair(u, inv, head, profile):
    if profile['hair'] != 'bob':
        original_hair(u, inv, head, profile)
        return
    rings = [(1.602, .086, .099, .003), (1.65, .094, .111, .003),
             (1.71, .094, .114, .001), (1.745, .088, .113, -.002),
             (1.785, .069, .091, -.003), (1.812, .030, .047, -.005)]
    gaps = [.085, .086, .073, 0, 0, 0]
    verts, faces = [], []
    count = 49
    for row, (z, rx, ry, cy) in enumerate(rings):
        gap = math.asin(min(.998, gaps[row] / rx))
        t = inv.clamp((1.812 - z) / .21)
        for j in range(count):
            a = gap + (math.tau - 2 * gap) * j / (count - 1)
            fold = .0018 * math.sin(a * 16 + t * 2.4) * t
            verts.append(((rx + fold) * math.sin(a), cy - (ry + fold) * math.cos(a),
                          z + .0025 * math.sin(a * 7) * t ** 3))
    for i in range(len(rings) - 1):
        for j in range(count - 1):
            k = i * count + j
            faces.append((k, k + 1, k + count + 1, k + count))
    pole = len(verts)
    verts.append((0, -.005, 1.823))
    for j in range(count - 1):
        faces.append(((len(rings) - 1) * count + j, (len(rings) - 1) * count + j + 1, pole))
    scalp = u.mesh('continuous_finger_wave_bob', verts, faces, 'hair', True)
    bm = bmesh.new()
    bm.from_mesh(scalp.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(scalp.data)
    bm.free()
    active(scalp)
    sub = scalp.modifiers.new('soft_connected_hair', 'SUBSURF')
    sub.levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    thick = scalp.modifiers.new('hair_edge_volume', 'SOLIDIFY')
    thick.thickness = .002
    bpy.ops.object.modifier_apply(modifier=thick.name)
    inv.skin(scalp, 'head')
    # Continuous strand coordinates and a restrained normal map break the
    # helmet-like highlight without floating tubes or a split crown seam.
    layer = scalp.data.uv_layers.active
    for face in scalp.data.polygons:
        values = []
        for loop in face.loop_indices:
            p = scalp.data.vertices[scalp.data.loops[loop].vertex_index].co
            values.append(((math.atan2(p.x, -(p.y + .003)) + math.pi) / math.tau,
                           (p.z - 1.59) / .24))
        wrap = max(v[0] for v in values) - min(v[0] for v in values) > .5
        for loop, (x, y) in zip(face.loop_indices, values):
            layer.data[loop].uv = (x + (1 if wrap and x < .5 else 0), y)
    texture = PACKAGE / 'textures/fine-combed-hair-normal.png'
    n = 256
    yy, xx = base.np.mgrid[0:n, 0:n] / n
    nx = .13 * base.np.sin(xx * math.tau * 110 + .7 * base.np.sin(yy * math.tau * 2))
    ny = .014 * base.np.cos(yy * math.tau * 2)
    normals = base.np.stack((nx, ny, base.np.sqrt(1 - nx * nx - ny * ny)), axis=-1)
    u.png(texture, normals * .5 + .5)
    mat = u.MATS['hair']
    nodes = mat.node_tree.nodes
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(texture), check_existing=True)
    tex.image.colorspace_settings.name = 'Non-Color'
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = .55
    mat.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
    mat.node_tree.links.new(normal.outputs['Normal'], nodes['Principled BSDF'].inputs['Normal'])
    nodes['Principled BSDF'].inputs['Roughness'].default_value = .66


def anatomy(u, inv, profile):
    result = original_anatomy(u, inv, profile)
    for obj in inv.SKIN:
        if not obj.name.startswith('anatomical_hand_'):
            continue
        for vertex in obj.data.vertices:
            p = vertex.co
            t = inv.clamp((.886 - p.z) / .09)
            p.y += .027 * t * t
            p.z += .008 * t * t
    return result


def pose(kind, phase):
    original_pose(kind, phase)
    if kind != 'Idle':
        return
    breathe = math.sin(phase * math.tau)
    offset = Vector((-.008, .001, -.007 + .0005 * breathe))
    inv.RIG.pose.bones['pelvis'].location = inv.RIG.data.bones['pelvis'].matrix_local.to_3x3().inverted() @ offset
    bpy.context.view_layer.update()
    for s, side in ((-1, 'L'), (1, 'R')):
        hip = inv.BONES['thigh_' + side][0] + offset
        ankle = Vector((s * .102, .010 if side == 'L' else -.012, .10))
        upper = (inv.BONES['thigh_' + side][1] - inv.BONES['thigh_' + side][0]).length
        lower = (inv.BONES['shin_' + side][1] - inv.BONES['shin_' + side][0]).length
        knee = inv.leg_ik(hip, ankle, upper, lower)
        inv.worldbone('thigh_' + side, hip, knee)
        inv.worldbone('shin_' + side, knee, ankle)
        inv.worldbone('foot_' + side, ankle, ankle + Vector((s * .009, -.16, 0)))
        shoulder = inv.RIG.pose.bones['upperarm_' + side].head.copy()
        elbow = shoulder + Vector((s * .037, -.018 if side == 'L' else -.030, -.276))
        wrist = elbow + Vector((-s * .009, -.045 if side == 'L' else -.077, -.234 if side == 'L' else -.225))
        inv.worldbone('upperarm_' + side, shoulder, elbow)
        inv.worldbone('forearm_' + side, elbow, wrist)
        inv.worldbone('hand_' + side, wrist, wrist + Vector((s * .008, .011, -.090)))
    head = inv.RIG.pose.bones['head']
    head.rotation_mode = 'XYZ'
    head.rotation_euler.y = -.025 + breathe * .003


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', default='resident-03')
    parser.add_argument('--views', default='three-quarter,tailoring,portrait')
    parser.add_argument('--width', type=int, default=1000)
    parser.add_argument('--samples', type=int, default=48)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    base.clothes, base.anatomy.hair, base.anatomy.anatomy, inv.pose = clothes, hair, anatomy, pose
    profiles = json.loads((BASE / 'profiles.json').read_text(encoding='utf-8'))['profiles']
    for profile in profiles:
        if profile['actorId'] not in args.ids.split(','):
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        u.MATS.clear()
        u.CONTACTS.clear()
        SIMULATIONS.clear()
        SCULPTED.clear()
        body, rig, clips = base.make(profile)
        review = base.review(body, rig)
        base.setup_stage()
        front = bpy.data.objects['front']
        front.location = (0, -5, 1.28)
        front.rotation_euler = (Vector((0, 0, 1.02)) - front.location).to_track_quat('-Z', 'Y').to_euler()
        devices = u.configure(args.samples, args.width)
        scene = bpy.context.scene
        scene.render.resolution_y = args.width
        scene.camera = bpy.data.objects['three-quarter']
        folder = PACKAGE / profile['actorId']
        folder.mkdir(parents=True, exist_ok=True)
        source = folder / (profile['id'] + '.blend')
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
        identity = base.sha(source)
        inputs = [Path(__file__), ROOT / 'scripts/build-blender-classic-residents.py',
                  ROOT / 'scripts/classic-resident-anatomy.py', ROOT / 'scripts/build-blender-classic-investigator.py',
                  ROOT / 'scripts/build-blender-classic-railway.py', BASE / 'profiles.json', base.anatomy.DATA / 'provenance.json']
        review.update({'schema': 'classic-resident-tailoring-authoring.v2', 'sourceSha256': identity,
                       'profile': profile, 'inputs': {p.relative_to(ROOT).as_posix(): base.sha(p) for p in inputs},
                       'devices': devices, 'clothAuthoring': list(SIMULATIONS), 'sculptedGarments': list(SCULPTED),
                       'runtimeCloth': False, 'clips': [{'name': n, 'durationSeconds': c / 30} for n, c in clips],
                       'strideMeters': .96 * float(rig.scale.z)})
        base.write(folder / 'authoring-review.json', review)
        entries = []
        (folder / 'renders').mkdir(exist_ok=True)
        if args.views != 'none':
            for view in args.views.split(','):
                scene.camera = bpy.data.objects['three-quarter' if view.startswith('walk') else view]
                pose('Walk' if view.startswith('walk') else 'Idle', .25 if view == 'walk-passing' else 0)
                scene.render.filepath = str(folder / 'renders' / f'{view}.png')
                bpy.ops.render.render(write_still=True)
                entries.append({'view': view, 'path': f'renders/{view}.png', 'sha256': base.sha(Path(scene.render.filepath))})
        base.write(folder / 'render-review.json', {'sourceSha256': identity, 'engine': 'Cycles', 'samples': args.samples,
                                                  'renders': entries, 'humanArtApproved': False})
        pose('Idle', 0)
        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        rig.select_set(True)
        raw = folder / (profile['id'] + '-raw.glb')
        bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_animations=True,
            export_animation_mode='ACTIONS', export_force_sampling=True, export_anim_slide_to_zero=True, export_skins=True,
            export_apply=False, export_extras=True, export_cameras=False, export_lights=False, export_yup=True)
        base.write(folder / 'raw-export.json', {'sourceSha256': identity, 'rawSha256': base.sha(raw), 'bytes': raw.stat().st_size})
        print(json.dumps({'actorId': profile['actorId'], 'sourceSha256': identity, 'triangles': review['triangles'],
                          'materials': review['materials'], 'rawBytes': raw.stat().st_size}), flush=True)


if __name__ == '__main__':
    main()
