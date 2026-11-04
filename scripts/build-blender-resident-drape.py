"""Fourth resident pass: continuous coiffure and a settled shoulder cape.

The preserved v3 portrait pipeline supplies licensed anatomy and features.
New hair, collar, cape and garment shaping are original project geometry.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v4'
PREVIOUS = ROOT / 'docs/3d-town/classic-residents-v3'
spec = importlib.util.spec_from_file_location('preserved_portraits', ROOT / 'scripts/build-blender-resident-portraits.py')
portrait = importlib.util.module_from_spec(spec); spec.loader.exec_module(portrait)
base, tail, inv, u = portrait.base, portrait.tail, portrait.inv, portrait.u
for item in (portrait, base, tail, inv, u):
    item.PACKAGE = PACKAGE
old_accessories = base.accessories
PARTS = []
FINISHING = []


def finish_surface(obj, thickness=0, subdivision=0):
    tail.active(obj)
    if subdivision:
        mod = obj.modifiers.new('continuous_fabric_curvature', 'SUBSURF'); mod.levels = subdivision
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if thickness:
        mod = obj.modifiers.new('sewn_fabric_thickness', 'SOLIDIFY'); mod.thickness = thickness; mod.offset = -1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.update()
    return obj


def topology(obj, name, expected_boundary=None):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    boundary = [e for e in bm.edges if e.is_boundary]
    nonmanifold = [e for e in bm.edges if not e.is_manifold and not e.is_boundary]
    degenerate = [f for f in bm.faces if f.calc_area() < 1e-11]
    if expected_boundary is not None:
        assert len(boundary) == expected_boundary, (name, len(boundary), expected_boundary)
    assert not nonmanifold and not degenerate, (name, len(nonmanifold), len(degenerate))
    PARTS.append({'name': name, 'vertices': len(bm.verts), 'faces': len(bm.faces),
                  'boundaryEdges': len(boundary), 'nonmanifoldEdges': len(nonmanifold), 'degenerateFaces': len(degenerate)})
    bm.free()


def layer_label(obj, value):
    attr = obj.data.attributes.new('ArtClothLayer', 'INT', 'POINT')
    attr.data.foreach_set('value', [value] * len(obj.data.vertices))


def animation_clearance(body):
    labels = body.data.attributes['ArtClothLayer'].data
    body.data.calc_loop_triangles()
    triangles = {label: [tuple(tri.vertices) for tri in body.data.loop_triangles
                        if all(labels[i].value == label for i in tri.vertices)] for label in (1, 2)}
    assert triangles[1] and triangles[2]
    rows = []
    for clip, count in [('Idle', 90), ('Walk', 24)]:
        for frame in range(count + 1):
            inv.pose(clip, frame / count); bpy.context.view_layer.update()
            evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh(); points = [v.co.copy() for v in mesh.vertices]
            shirt = BVHTree.FromPolygons(points, triangles[1], all_triangles=True)
            cape = BVHTree.FromPolygons(points, triangles[2], all_triangles=True)
            overlaps = shirt.overlap(cape)
            rows.append({'clip': clip, 'frame': frame, 'intersectingTrianglePairs': len(overlaps)})
            evaluated.to_mesh_clear()
    worst = max(rows, key=lambda row: row['intersectingTrianglePairs'])
    if worst['intersectingTrianglePairs']:
        folder = PACKAGE / 'diagnostics'; folder.mkdir(exist_ok=True)
        base.write(folder / 'cape-animation-contact-failure.json', {'worst': worst, 'frames': rows})
        inv.pose(worst['clip'], worst['frame'] / (90 if worst['clip'] == 'Idle' else 24))
        bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'cape-animation-contact-failure.blend'))
    assert not worst['intersectingTrianglePairs'], worst
    inv.pose('Idle', 0)
    return {'scope': 'Triangle intersections between the evaluated cape and underlying blouse across both complete clips; excludes other garment pairs and arbitrary future poses.',
            'frames': rows, 'maximumIntersectingTrianglePairs': worst['intersectingTrianglePairs']}


def materials(profile):
    portrait.materials(profile)
    yy, xx = base.np.mgrid[0:512, 0:512] / 512
    # All horizontal frequencies are integral: the scalp UV wrap has no colour
    # or normal discontinuity. Broad grooming direction comes from mesh UVs.
    phase = math.tau * 128 * xx + 1.2 * base.np.sin(math.pi * yy)
    shade = .95 + .055 * base.np.cos(phase) + .018 * base.np.cos(2 * phase)
    color, normal = [PACKAGE / 'textures' / ('swept-bun-' + kind + '.png') for kind in ('colour', 'normal')]
    u.png(color, shade[..., None] * base.np.array([.205, .148, .106]))
    nx = .16 * base.np.sin(phase) + .025 * base.np.sin(2 * phase)
    normals = base.np.stack((nx, base.np.zeros_like(nx), base.np.sqrt(1 - nx * nx)), axis=-1)
    u.png(normal, normals * .5 + .5)
    mat = portrait.assets.image_material(u, 'swept_bun_hair', color, .62, normal_path=normal)
    u.MATS['hair'] = mat; u.MATS['hair_high'] = mat
    # A small, authored wool variation shared by Blender and the GLB. Keep the
    # existing normal texture, which is already part of the preserved pipeline.
    noise = base.np.random.default_rng(813).random(xx.shape)
    weave = .95 + .025 * base.np.cos(math.tau * (xx * 128 + yy * 128)) + .025 * noise
    for name, code in [('accent', profile['accent']), ('coat', profile['coat'])]:
        rgb = base.np.array([int(code[i:i + 2], 16) / 255 for i in (0, 2, 4)])
        path = PACKAGE / 'textures' / (name + '-woven-colour.png')
        u.png(path, weave[..., None] * rgb)
        mat = u.MATS[name]; tree = mat.node_tree
        tex = tree.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(path))
        tree.links.new(tex.outputs['Color'], tree.nodes['Principled BSDF'].inputs['Base Color'])
        tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .88


def hair(u, inv, head, profile):
    surface = BVHTree.FromPolygons([v.co for v in head.data.vertices], [p.vertices for p in head.data.polygons])
    origin = Vector((0, .012, 1.712))
    rows, segments = 28, 80
    def point(angle, fraction):
        front = max(0, math.cos(angle))
        rear = max(0, -math.cos(angle))
        end = 1.90 - .63 * front + .40 * rear + .065 * math.sin(2 * angle - .3)
        end += .014 * front * (math.sin(angle * 17) + .35 * math.sin(angle * 29))
        theta = end * fraction
        swept = angle + .23 * math.sin(math.pi * fraction) * math.cos(angle)
        direction = Vector((math.sin(theta) * math.sin(swept), -math.sin(theta) * math.cos(swept), math.cos(theta)))
        hit = surface.ray_cast(origin, direction)[0]
        assert hit is not None
        fullness = .005 + .012 * math.sin(math.pi * fraction) ** .8
        fullness += .006 * front * math.sin(math.pi * fraction) ** 2
        fullness += .0016 * math.sin(angle * 9 + theta * 2.8) * math.sin(math.pi * fraction) ** 2
        return hit + direction * fullness
    verts = [point(0, 0)]
    for row in range(1, rows + 1):
        verts.extend(point(math.tau * col / segments, row / rows) for col in range(segments))
    faces = [(0, 1 + col, 1 + (col + 1) % segments) for col in range(segments)]
    for row in range(rows - 1):
        for col in range(segments):
            a = 1 + row * segments + col; b = 1 + row * segments + (col + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    obj = u.mesh('continuous_swept_coiffure', verts, faces, 'hair', True)
    layer = obj.data.uv_layers.active
    for face in obj.data.polygons:
        uv = []
        for loop in face.loop_indices:
            i = obj.data.loops[loop].vertex_index
            uv.append((None, 0) if i == 0 else (((i - 1) % segments) / segments, ((i - 1) // segments + 1) / rows))
        values = [a for a, _ in uv if a is not None]
        wraps = max(values) - min(values) > .5
        values = [a + (1 if wraps and a < .5 else 0) for a in values]
        for loop, (a, t) in zip(face.loop_indices, uv):
            a = sum(values) / len(values) if a is None else a + (1 if wraps and a < .5 else 0)
            layer.data[loop].uv = (a + .16 * math.sin(a * math.tau) * math.sin(t * math.pi), t)
    topology(obj, 'continuous-scalp-before-thickness', expected_boundary=segments)
    finish_surface(obj, .0012)
    inv.skin(obj, 'head'); portrait.record_part(obj)
    topology(obj, 'continuous-scalp-final', expected_boundary=0)
    # A shaped, compressed low bun with coherent surface grooves, rather than
    # multiple detached hair balls. It tucks into the back of the scalp.
    bun = u.sphere('folded_low_chignon', (0, .125, 1.692), (.048, .032, .041), 'hair', 32)
    center = Vector((0, .125, 1.692))
    for vertex in bun.data.vertices:
        q = vertex.co - center
        angle = math.atan2(q.x / .048, q.z / .041)
        relief = .0023 * math.cos(angle * 9 + q.y * 80) * max(0, 1 - (q.y / .034) ** 2)
        radial = Vector((q.x, 0, q.z))
        if radial.length > .001:
            vertex.co += radial.normalized() * relief
    layer = bun.data.uv_layers.active
    for face in bun.data.polygons:
        values = []
        for loop in face.loop_indices:
            q = bun.data.vertices[bun.data.loops[loop].vertex_index].co - center
            values.append((math.atan2(q.x, q.z) / math.tau + .5, (q.y + .034) / .068))
        wraps = max(a for a, _ in values) - min(a for a, _ in values) > .5
        for loop, (a, t) in zip(face.loop_indices, values):
            layer.data[loop].uv = (a + (1 if wraps and a < .5 else 0) + .18 * t, t)
    inv.skin(bun, 'head'); portrait.record_part(bun)


def soft_collar():
    tail.remove_skin_prefix('standing_linen_collar')
    verts, faces = [], []
    cols, rows = 64, 5
    for row in range(rows + 1):
        t = row / rows
        for col in range(cols + 1):
            a = .08 + (math.tau - .16) * col / cols
            radial = math.sin(t * math.pi / 2)
            x = (.074 + .015 * radial) * math.sin(a)
            y = .009 - (.070 + .010 * radial) * math.cos(a)
            z = 1.556 - .030 * t - .006 * max(0, math.cos(a)) * t
            verts.append((x, y, z))
    for row in range(rows):
        for col in range(cols):
            k = row * (cols + 1) + col; faces.append((k, k + 1, k + cols + 2, k + cols + 1))
    obj = u.mesh('rolled_linen_neckline', verts, faces, 'shirt', True)
    finish_surface(obj, .0012, 1); inv.skin(obj, inv.torso)
    topology(obj, 'rolled-collar-final', expected_boundary=0)


def draped_cape(blouse):
    tail.remove_skin_prefix('draped_shawl', 'shawl_piping', 'shawl_brooch')
    surface = BVHTree.FromPolygons([v.co for v in blouse.data.vertices], [p.vertices for p in blouse.data.polygons])
    rows, cols = 15, 48
    verts, faces = [], []
    for row in range(rows):
        t = row / (rows - 1)
        for col in range(cols + 1):
            a = .105 + (math.tau - .21) * col / cols
            rx = .080 + .257 * t
            ry = .075 + .119 * t
            folds = .004 * math.sin(a * 10 + t * .8) * t
            x = (rx + folds) * math.sin(a)
            y = .009 - (ry + folds) * math.cos(a)
            z = 1.548 - (.244 + .018 * max(0, math.cos(a))) * t ** 1.45
            hit = surface.ray_cast(Vector((x, y, 2)), Vector((0, 0, -1)))[0]
            if hit is not None:
                z = max(z, hit.z + .013)
            verts.append((x, y, z))
    for row in range(rows - 1):
        for col in range(cols):
            k = row * (cols + 1) + col; faces.append((k + cols + 1, k + cols + 2, k + 1, k))
    obj = u.mesh('settled_wool_shoulder_cape', verts, faces, 'accent', True)
    layer = obj.data.uv_layers.active
    for loop in obj.data.loops:
        row, col = divmod(loop.vertex_index, cols + 1)
        layer.data[loop.index].uv = (col / cols * 3.5, row / (rows - 1) * 2.3)
    def pins(p, index):
        row, _ = divmod(index, cols + 1)
        return 1 if row == 0 else .8 if row == 1 else .15 if row == 2 else 0
    tail.settle(obj, pins, [tail.collider(blouse, 'cape_blouse_contact')], frames=72, bend=.12, mass=.01, tension=120)
    # Take the hem from the final smoothed boundary. The first trial traced the
    # pre-subdivision edge, leaving an exposed wire around the rounded corners.
    finish_surface(obj, subdivision=1)
    maximum_adjustment = 0
    adjusted = 0
    for vertex in obj.data.vertices:
        hit, normal, _, distance = surface.find_nearest(vertex.co)
        signed_distance = (vertex.co - hit).dot(normal)
        # The curved shoulder needs extra ease: positive vertex clearance alone
        # did not stop two long inner faces from cutting across its convex crest.
        shoulder_ease = .006 * inv.smooth((abs(vertex.co.x) - .18) / .05) * math.exp(-((vertex.co.z - 1.435) / .060) ** 2)
        clearance = .006 + shoulder_ease
        if distance < .025 and signed_distance < clearance:
            offset = clearance - signed_distance
            vertex.co += normal * offset
            maximum_adjustment = max(maximum_adjustment, offset); adjusted += 1
    assert maximum_adjustment < .025, maximum_adjustment
    obj.data.update()
    FINISHING.append({'object': obj.name, 'method': '6 mm stand-off plus up to 6 mm shoulder ease after smoothing, before 2 mm inward thickness',
                      'afterSimulation': True, 'adjustedVertices': adjusted, 'maximumAdjustmentMeters': maximum_adjustment})
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.normal_update()
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    assert boundary
    start = boundary[0].verts[0]; current = start; previous = None; hem = []
    while True:
        hem.append(current.co + current.normal * .0003)
        edge = next(edge for edge in current.link_edges if edge.is_boundary and edge != previous)
        current, previous = edge.other_vert(current), edge
        if current == start: break
        assert len(hem) <= len(boundary)
    assert len(hem) == len(boundary)
    bm.free()
    finish_surface(obj, .0020)
    def cape_weights(p):
        # Match the underlying sleeve's blend at the same shoulder position.
        # A weak arm blend left the cape behind during the Walk forward swing.
        t = inv.smooth((abs(p.x) - .165) / .07)
        result = {name: weight * (1 - t) for name, weight in inv.torso(p).items()}
        for name, weight in inv.arm_weight('L' if p.x < 0 else 'R')(p).items():
            result[name] = result.get(name, 0) + weight * t
        return result
    layer_label(obj, 2)
    inv.skin(obj, cape_weights); portrait.record_part(obj)
    topology(obj, 'settled-cape-final', expected_boundary=0)
    curve = bpy.data.curves.new('cape_integrated_hem', 'CURVE'); curve.dimensions = '3D'
    curve.bevel_depth = .0008; curve.bevel_resolution = 0
    spline = curve.splines.new('POLY'); spline.points.add(len(hem) - 1); spline.use_cyclic_u = True
    for point, position in zip(spline.points, hem): point.co = (*position, 1)
    binding = bpy.data.objects.new('cape_integrated_hem', curve); bpy.context.collection.objects.link(binding)
    curve.materials.append(u.MATS['accent']); inv.skin(binding, cape_weights)
    inv.sphere('cape_clasp', (0, -.092, 1.516), (.010, .004, .012), 'brass', 'chest')


def clothes(profile):
    portrait.clothes(profile)
    blouse = tail.soften_blouse()
    layer_label(blouse, 1)
    tail.draped_skirt()
    tail.remove_skin_prefix('waistband')
    base.loft('fitted_woven_waistband', [(1.018, .190, .150, 0, .006), (1.035, .188, .148, 0, .006),
              (1.064, .181, .142, 0, .006)], 'coat', inv.torso, 64)
    soft_collar(); draped_cape(blouse)


def accessories(profile):
    old_accessories(profile)
    tail.remove_skin_prefix('small_pearl')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--views', default='three-quarter,portrait,face-front,front,profile,back,walk-contact,walk-passing,hands')
    parser.add_argument('--width', type=int, default=1100)
    parser.add_argument('--samples', type=int, default=48)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    PACKAGE.mkdir(parents=True, exist_ok=True); (PACKAGE / 'cloth-cache').mkdir(exist_ok=True)
    for path in (PREVIOUS / 'cloth-cache').glob('*.json'):
        target = PACKAGE / 'cloth-cache' / path.name
        if not target.exists(): shutil.copyfile(path, target)
        else: assert base.sha(target) == base.sha(path)
    for row in json.loads((portrait.DATA / 'provenance.json').read_text())['files']:
        assert base.sha(ROOT / row['path']) == row['sha256']
    base.materials, base.clothes, base.accessories = materials, clothes, accessories
    base.anatomy.subset_mesh = portrait.assets.source_subset(portrait.original_subset, base.anatomy.DATA / '3dobjs/base.obj')
    base.anatomy.anatomy, base.anatomy.hair, inv.pose = portrait.anatomy, hair, tail.pose
    profile = next(p for p in json.loads((portrait.FIRST / 'profiles.json').read_text(encoding='utf-8'))['profiles'] if p['actorId'] == 'resident-08')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    u.MATS.clear(); u.CONTACTS.clear(); portrait.PARTS.clear(); portrait.CONTEXT.clear()
    tail.SIMULATIONS.clear(); tail.SCULPTED.clear(); PARTS.clear(); FINISHING.clear()
    body, rig, clips = base.make(profile)
    body['origin'] = 'Original continuous chignon, simulated cape and skirt; preserved CC0 anatomy and portrait features'
    report = base.review(body, rig)
    clearance = animation_clearance(body)
    assert report['triangles'] < 60000 and report['materials'] <= 14, report['triangles']
    base.setup_stage()
    scale = profile['height'] / 1.802
    for name, loc, target, size in [('face-front', (0, -3, 1.684 * scale), (0, -.015, 1.684 * scale), .405 * scale),
                                   ('portrait', (1.1, -2.8, 1.90 * scale), (0, -.015, 1.565 * scale), .64 * scale),
                                   ('front', (0, -5, 1.28), (0, 0, 1.02), 2.03)]:
        camera = bpy.data.objects[name]; camera.location = loc
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = size
    devices = u.configure(args.samples, args.width)
    scene = bpy.context.scene; scene.render.resolution_y = args.width; scene.camera = bpy.data.objects['three-quarter']
    folder = PACKAGE / profile['actorId']; folder.mkdir(exist_ok=True); (folder / 'renders').mkdir(exist_ok=True)
    source = folder / (profile['id'] + '.blend')
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(source)); identity = base.sha(source)
    images = []
    for image in bpy.data.images:
        if image.source != 'FILE' or not image.filepath: continue
        path = Path(bpy.path.abspath(image.filepath)).resolve()
        assert image.packed_file and path.is_file()
        digest = hashlib.sha256(bytes(image.packed_file.data)).hexdigest()
        assert digest == base.sha(path)
        images.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': digest, 'dimensions': list(image.size), 'packedBytes': len(image.packed_file.data)})
    inputs = [Path(__file__), ROOT / 'scripts/build-blender-resident-portraits.py', ROOT / 'scripts/classic-resident-portrait-assets.py',
              ROOT / 'scripts/build-blender-resident-tailoring.py', ROOT / 'scripts/build-blender-classic-residents.py',
              ROOT / 'scripts/classic-resident-anatomy.py', ROOT / 'scripts/build-blender-classic-investigator.py',
              ROOT / 'scripts/build-blender-classic-railway.py', portrait.FIRST / 'profiles.json',
              PREVIOUS / 'portrait-assets.json', portrait.DATA / 'provenance.json', base.anatomy.DATA / 'provenance.json']
    report.update({'schema': 'classic-resident-drape-authoring.v4', 'sourceSha256': identity, 'profile': profile,
                   'inputs': {p.relative_to(ROOT).as_posix(): base.sha(p) for p in inputs}, 'devices': devices,
                   'clothAuthoring': list(tail.SIMULATIONS), 'sculptedGarments': list(tail.SCULPTED),
                   'topologyChecks': PARTS, 'portraitParts': portrait.PARTS, 'packedTextures': images,
                   'capeBlouseClearance': clearance,
                   'clothFinishing': FINISHING,
                   'runtimeCloth': False, 'humanArtApproved': False})
    base.write(folder / 'authoring-review.json', report)
    renders = []
    if args.views != 'none':
        for view in args.views.split(','):
            scene.camera = bpy.data.objects['three-quarter' if view.startswith('walk') else view]
            inv.pose('Walk' if view.startswith('walk') else 'Idle', .25 if view == 'walk-passing' else 0)
            scene.render.filepath = str(folder / 'renders' / (view + '.png'))
            bpy.ops.render.render(write_still=True)
            renders.append({'view': view, 'path': 'renders/' + view + '.png', 'sha256': base.sha(Path(scene.render.filepath))})
    base.write(folder / 'render-review.json', {'sourceSha256': identity, 'engine': 'Cycles', 'samples': args.samples, 'renders': renders, 'humanArtApproved': False})
    inv.pose('Idle', 0); bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True)
    raw = folder / (profile['id'] + '-raw.glb')
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_anim_slide_to_zero=True, export_skins=True,
        export_apply=False, export_extras=True, export_cameras=False, export_lights=False, export_yup=True)
    base.write(folder / 'raw-export.json', {'sourceSha256': identity, 'rawSha256': base.sha(raw), 'bytes': raw.stat().st_size})
    print(json.dumps({'sourceSha256': identity, 'triangles': report['triangles'], 'materials': report['materials'], 'renderCount': len(renders)}), flush=True)


if __name__ == '__main__':
    main()
