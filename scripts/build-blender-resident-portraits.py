"""Third character pass: source UVs, fitted eyes, lashes and licensed hair.

Run with background Blender. Earlier authoring packages remain unchanged.
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
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v3'
FIRST = ROOT / 'docs/3d-town/classic-residents-v1'
SECOND = ROOT / 'docs/3d-town/classic-residents-v2'
DATA = PACKAGE / 'licensed/makehuman-system'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


tail = module('preserved_tailoring', ROOT / 'scripts/build-blender-resident-tailoring.py')
assets = module('portrait_data_reader', ROOT / 'scripts/classic-resident-portrait-assets.py')
base, inv, u = tail.base, tail.inv, tail.u
for item in (tail, base, inv, u):
    item.PACKAGE = PACKAGE
original_materials = base.materials
original_subset = base.anatomy.subset_mesh
SPECS = json.loads((PACKAGE / 'portrait-assets.json').read_text())
CONTEXT = {}
PARTS = []


def materials(profile):
    original_materials(profile)
    spec = SPECS[profile['actorId']]
    skin = assets.image_material(u, 'skin', DATA / spec['skin'], .52)
    p = skin.node_tree.nodes['Principled BSDF']
    p.inputs['Subsurface Weight'].default_value = .055
    p.inputs['Subsurface Scale'].default_value = .012
    p.inputs['Subsurface Radius'].default_value = (1., .45, .24)
    eye = assets.image_material(u, 'eye_detail', DATA / 'eyes/materials/brown_eye.png', .16)
    eye.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value = .28
    eye.node_tree.nodes['Principled BSDF'].inputs['Coat Roughness'].default_value = .08
    assets.image_material(u, 'brow_detail', DATA / 'eyebrows/eyebrow001/eyebrow001.png', .8, .30)
    assets.image_material(u, 'lash_detail', DATA / 'eyelashes/eyelashes01/eyelashes01.png', .8, .30)
    if spec['hair'] == 'authored-bun':
        yy, xx = base.np.mgrid[0:512, 0:512] / 512
        phase = xx * math.tau * 160 + .9 * base.np.sin(yy * math.tau)
        shade = .94 + .045 * base.np.cos(phase) + .015 * base.np.cos(phase * 2.3)
        color = PACKAGE / 'textures/authored-bun-colour.png'
        normal = PACKAGE / 'textures/authored-bun-normal.png'
        u.png(color, shade[..., None] * base.np.array([.20, .145, .104]))
        nx = .06 * base.np.sin(phase)
        normals = base.np.stack((nx, base.np.zeros_like(nx), base.np.sqrt(1 - nx * nx)), axis=-1)
        u.png(normal, normals * .5 + .5)
        mat = assets.image_material(u, 'authored_bun_hair', color, .69, normal_path=normal)
        u.MATS['hair'] = mat; u.MATS['hair_high'] = mat
    else:
        name = spec['hair']
        diffuse = DATA / f'hair/{name}/{name}_diffuse.png'
        normal = DATA / f'hair/{name}/{name}_normal.png'
        if name == 'toigo_curled_under_bob':
            diffuse = DATA / f'hair/{name}/GingerHair.png'
            normal = DATA / f'hair/{name}/BakedHairNORMAL.png'
        hair_material = assets.image_material(u, 'fitted_hair', diffuse, .72, None if name == 'toigo_curled_under_bob' else .35,
                                               normal if normal.exists() else None)
        tree = hair_material.node_tree
        bsdf = tree.nodes['Principled BSDF']
        texture = next(n for n in tree.nodes if n.type == 'TEX_IMAGE' and n.image.colorspace_settings.name == 'sRGB')
        tint = tree.nodes.new('ShaderNodeMix'); tint.data_type = 'RGBA'; tint.blend_type = 'MULTIPLY'
        tint.inputs[0].default_value = 1
        factor = (.18, .22, .28, 1) if name == 'toigo_curled_under_bob' else (.45, .43, .39, 1)
        tint.inputs[7].default_value = factor
        tree.links.new(texture.outputs['Color'], tint.inputs[6])
        tree.links.new(tint.outputs[2], bsdf.inputs['Base Color'])
        hair_material['expectedBaseColorFactor'] = factor


def record_part(obj):
    obj.data.calc_loop_triangles()
    coords = [v.co for v in obj.data.vertices]
    uv = obj.data.uv_layers.active
    assert uv and len(uv.data) == len(obj.data.loops)
    values = [float(c) for v in uv.data for c in v.uv]
    assert all(math.isfinite(c) for c in values) and max(values) - min(values) > .001
    PARTS.append({'name': obj.name, 'triangles': len(obj.data.loop_triangles), 'vertices': len(coords),
                  'bounds': [[min(p[k] for p in coords), max(p[k] for p in coords)] for k in range(3)],
                  'uvLoops': len(uv.data), 'uvRange': [min(values), max(values)]})


def anatomy(u, inv, profile):
    head, transform, joint = tail.anatomy(u, inv, profile)
    points, _, _ = base.anatomy.read_source(profile)
    CONTEXT.update(points=points, transform=transform)
    # The licensed skin texture carries lip and skin colour. Do not multiply
    # its colours by the older hand-authored cheek and mouth vertex tint.
    for obj in inv.SKIN:
        if obj.name.startswith(('anatomical_head', 'anatomical_hand_')):
            colors = obj.data.color_attributes.get('SkinTone')
            if colors:
                colors.data.foreach_set('color', [1., 1., 1., 1.] * len(colors.data))
            record_part(obj)
    tail.remove_skin_prefix('eye_white', 'iris', 'pupil', 'eyebrow', 'station_moustache')
    for name, path, material in [
        ('fitted_eyes', 'eyes/low-poly/low-poly.mhclo', 'eye_detail'),
        ('fitted_eyebrows', 'eyebrows/eyebrow001/eyebrow001.mhclo', 'brow_detail'),
        ('fitted_eyelashes', 'eyelashes/eyelashes01/eyelashes01.mhclo', 'lash_detail'),
    ]:
        if name == 'fitted_eyelashes' and profile['body'] == 'male':
            continue
        obj = assets.proxy_object(u, inv, name, DATA / path, points, transform, material)
        if name == 'fitted_eyes':
            # Enough curvature for the close inspection view, while preserving
            # the actual source eye opening and UV topology.
            tail.active(obj)
            sub = obj.modifiers.new('eye_silhouette', 'SUBSURF')
            sub.levels = 1
            bpy.ops.object.modifier_apply(modifier=sub.name)
        record_part(obj)
    return head, transform, joint


def hair(u, inv, head, profile):
    name = SPECS[profile['actorId']]['hair']
    if name == 'authored-bun':
        surface = BVHTree.FromPolygons([v.co for v in head.data.vertices], [p.vertices for p in head.data.polygons])
        origin = Vector((0, .012, 1.712)); points = []; faces = []; rows, segments = 20, 72
        for row in range(rows + 1):
            for col in range(segments + 1):
                angle = math.tau * col / segments
                end = 1.87 - .55 * max(0, math.cos(angle)) + .40 * max(0, -math.cos(angle))
                end += .025 * math.sin(angle * 3 + .4)
                theta = max(.003, end * row / rows)
                direction = Vector((math.sin(theta) * math.sin(angle), -math.sin(theta) * math.cos(angle), math.cos(theta)))
                hit, norm, _, _ = surface.ray_cast(origin, direction)
                assert hit is not None, (row, col)
                point = hit + norm * (.004 + .0008 * math.cos(angle * 18 + row * .35))
                points.append(point)
        for row in range(rows):
            for col in range(segments):
                k = row * (segments + 1) + col; faces.append((k + segments + 1, k + segments + 2, k + 1, k))
        scalp = u.mesh('authored_swept_bun_scalp', points, faces, 'hair', True)
        layer = scalp.data.uv_layers.active
        for polygon in scalp.data.polygons:
            for loop in polygon.loop_indices:
                i = scalp.data.loops[loop].vertex_index
                a, t = i % (segments + 1) / segments, i // (segments + 1) / rows
                layer.data[loop].uv = (a + .09 * math.sin(a * math.tau) * math.sin(t * math.pi), t)
        bm = bmesh.new(); bm.from_mesh(scalp.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.0001)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(scalp.data); bm.free()
        inv.skin(scalp, 'head'); record_part(scalp)
        bun = inv.sphere('authored_low_coiled_bun', (0, .125, 1.701), (.045, .035, .041), 'hair', 'head')
        layer = bun.data.uv_layers.active
        for polygon in bun.data.polygons:
            for loop in polygon.loop_indices:
                p = bun.data.vertices[bun.data.loops[loop].vertex_index].co - Vector((0, .125, 1.701))
                layer.data[loop].uv = (math.atan2(p.x, p.z) / math.tau + .5, (p.y + .035) / .07)
        record_part(bun)
        return
    obj = assets.proxy_object(u, inv, 'fitted_' + name, DATA / f'hair/{name}/{name}.mhclo',
                              CONTEXT['points'], CONTEXT['transform'], 'fitted_hair')
    if profile['outfit'] == 'station':
        for vertex in obj.data.vertices:
            p = vertex.co
            if p.z > 1.745:
                p.z = 1.745 + (p.z - 1.745) * .10
        obj.data.update()
        obj['projectAdaptation'] = 'Top hair compressed beneath the opaque station cap; no hair through its crown'
    record_part(obj)


def clothes(profile):
    tail.clothes(profile)
    tail.remove_skin_prefix('standing_linen_collar')
    collar = base.loft('standing_linen_collar', [(1.535, .069, .066, 0, .009),
                        (1.555, .069, .066, 0, .009), (1.576, .067, .064, 0, .009)], 'shirt', 'head', 48)
    # A standing collar must have an actual opening for the neck. The original
    # loft closed it with an n-gon, producing visible intersections at the rim.
    bm = bmesh.new(); bm.from_mesh(collar.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if len(f.verts) > 4], context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(collar.data); bm.free()
    tail.active(collar)
    solid = collar.modifiers.new('collar_fabric_thickness', 'SOLIDIFY'); solid.thickness = .0015
    bpy.ops.object.modifier_apply(modifier=solid.name)
    if profile['outfit'] == 'station':
        tail.remove_skin_prefix('peaked_cap_band', 'peaked_cap_crown', 'cap_peak', 'cap_braid', 'original_station_roundel')
        base.loft('fitted_station_cap_band', [(1.741, .098, .119, 0, -.005), (1.778, .101, .123, 0, -.005)], 'ink', 'head', 64)
        base.loft('fitted_station_cap_crown', [(1.775, .103, .125, 0, -.005), (1.790, .115, .137, 0, -.005),
                  (1.816, .119, .137, 0, -.002), (1.841, .108, .125, 0, .001),
                  (1.853, .077, .091, 0, .001), (1.858, .023, .030, 0, .001)], 'coat', 'head', 64)
        verts, faces = [], []; cols, rows = 48, 5
        for row in range(rows + 1):
            t = row / rows
            for col in range(cols + 1):
                a = -.5 * math.pi + math.pi * col / cols
                x = (.098 + .010 * t) * math.sin(a)
                y = -.005 - (.123 + .067 * t) * math.cos(a)
                z = 1.746 - .011 * t * math.cos(a) - .002 * t * t
                verts.append((x, y, z))
        for row in range(rows):
            for col in range(cols):
                k = row * (cols + 1) + col; faces.append((k, k + 1, k + cols + 2, k + cols + 1))
        brim = u.mesh('curved_station_cap_brim', verts, faces, 'ink', True)
        tail.active(brim); solid = brim.modifiers.new('leather_brim_thickness', 'SOLIDIFY'); solid.thickness = .003
        bpy.ops.object.modifier_apply(modifier=solid.name); inv.skin(brim, 'head')
        inv.tube('fitted_cap_braid', [(.102 * math.sin(a), -.006 - .125 * math.cos(a), 1.760) for a in [-1.45 + i * 2.9 / 32 for i in range(33)]], .0018, 'brass', 'head')
        inv.sphere('original_station_roundel', (0, -.143, 1.80), (.012, .003, .015), 'brass', 'head')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', default='resident-03,resident-06,resident-08')
    parser.add_argument('--views', default='three-quarter,portrait,face-front,front,profile,back,walk-contact,walk-passing,hands')
    parser.add_argument('--width', type=int, default=1100)
    parser.add_argument('--samples', type=int, default=48)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    ledger = json.loads((DATA / 'provenance.json').read_text())
    for row in ledger['files']:
        assert base.sha(ROOT / row['path']) == row['sha256'], row['path']
    cache = PACKAGE / 'cloth-cache'
    cache.mkdir(parents=True, exist_ok=True)
    for p in (SECOND / 'cloth-cache').glob('*.json'):
        target = cache / p.name
        if not target.exists():
            shutil.copyfile(p, target)
        else:
            assert base.sha(target) == base.sha(p)
    base.materials, base.clothes = materials, clothes
    base.anatomy.subset_mesh = assets.source_subset(original_subset, base.anatomy.DATA / '3dobjs/base.obj')
    base.anatomy.anatomy, base.anatomy.hair, inv.pose = anatomy, hair, tail.pose
    profiles = json.loads((FIRST / 'profiles.json').read_text(encoding='utf-8'))['profiles']
    for profile in profiles:
        if profile['actorId'] not in args.ids.split(','):
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        u.MATS.clear(); u.CONTACTS.clear(); PARTS.clear(); CONTEXT.clear()
        tail.SIMULATIONS.clear(); tail.SCULPTED.clear()
        body, rig, clips = base.make(profile)
        body['origin'] = 'Original clothing and animation; CC0 anatomy, skin textures, fitted eyes, brows, lashes and selected hair'
        review = base.review(body, rig)
        assert review['triangles'] < 60000 and review['materials'] <= 14, review['materials']
        base.setup_stage()
        scale = profile['height'] / 1.802
        face = bpy.data.objects['face-front']; face.location = (0, -3, 1.684 * scale)
        face.rotation_euler = (Vector((0, -.015, 1.684 * scale)) - face.location).to_track_quat('-Z', 'Y').to_euler()
        face.data.ortho_scale = .405 * scale
        portrait = bpy.data.objects['portrait']; portrait.location = (1.1, -2.8, 1.90 * scale)
        portrait.rotation_euler = (Vector((0, -.015, 1.565 * scale)) - portrait.location).to_track_quat('-Z', 'Y').to_euler()
        portrait.data.ortho_scale = .64 * scale
        front = bpy.data.objects['front']; front.location = (0, -5, 1.28)
        front.rotation_euler = (Vector((0, 0, 1.02)) - front.location).to_track_quat('-Z', 'Y').to_euler()
        devices = u.configure(args.samples, args.width)
        scene = bpy.context.scene; scene.render.resolution_y = args.width
        scene.camera = bpy.data.objects['three-quarter']
        folder = PACKAGE / profile['actorId']; folder.mkdir(parents=True, exist_ok=True)
        source = folder / (profile['id'] + '.blend')
        bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(source))
        identity = base.sha(source)
        packed_textures = []
        for im in bpy.data.images:
            if im.source != 'FILE' or not im.filepath:
                continue
            texture_path = Path(bpy.path.abspath(im.filepath)).resolve()
            assert texture_path.is_file() and im.packed_file, im.name
            packed_hash = hashlib.sha256(bytes(im.packed_file.data)).hexdigest()
            assert packed_hash == base.sha(texture_path), im.name
            packed_textures.append({'name': im.name, 'dimensions': list(im.size), 'sourceFile': im.get('sourceFile'),
                                    'derivation': im.get('derivation'), 'path': texture_path.relative_to(ROOT).as_posix(),
                                    'sha256': packed_hash, 'packedBytes': len(im.packed_file.data)})
        assert packed_textures, 'The portable Blender source must contain its image textures'
        inputs = [Path(__file__), ROOT / 'scripts/classic-resident-portrait-assets.py',
                  ROOT / 'scripts/build-blender-resident-tailoring.py', ROOT / 'scripts/build-blender-classic-residents.py',
                  ROOT / 'scripts/classic-resident-anatomy.py', ROOT / 'scripts/build-blender-classic-investigator.py',
                  ROOT / 'scripts/build-blender-classic-railway.py', FIRST / 'profiles.json', PACKAGE / 'portrait-assets.json',
                  DATA / 'provenance.json', base.anatomy.DATA / 'provenance.json']
        review.update({'schema': 'classic-resident-portrait-authoring.v3', 'sourceSha256': identity,
                       'profile': profile, 'inputs': {p.relative_to(ROOT).as_posix(): base.sha(p) for p in inputs},
                       'devices': devices, 'clothAuthoring': list(tail.SIMULATIONS), 'sculptedGarments': list(tail.SCULPTED),
                       'portraitParts': list(PARTS), 'sourceAssetLedgerSha256': base.sha(DATA / 'provenance.json'),
                       'materialExpectations': {mat.name: {'baseColorFactor': list(mat['expectedBaseColorFactor'])}
                                                for mat in body.data.materials if 'expectedBaseColorFactor' in mat},
                       'packedTextures': packed_textures,
                       'runtimeCloth': False, 'clips': [{'name': n, 'durationSeconds': c / 30} for n, c in clips],
                       'strideMeters': .96 * float(rig.scale.z),
                       'skinMaterialScope': 'Licensed diffuse texture shared between Blender and GLB. The small Cycles subsurface contribution is not a claim of identical runtime subsurface shading.'})
        base.write(folder / 'authoring-review.json', review)
        entries = []; (folder / 'renders').mkdir(exist_ok=True)
        if args.views != 'none':
            for view in args.views.split(','):
                scene.camera = bpy.data.objects['three-quarter' if view.startswith('walk') else view]
                inv.pose('Walk' if view.startswith('walk') else 'Idle', .25 if view == 'walk-passing' else 0)
                scene.render.filepath = str(folder / 'renders' / f'{view}.png')
                bpy.ops.render.render(write_still=True)
                entries.append({'view': view, 'path': f'renders/{view}.png', 'sha256': base.sha(Path(scene.render.filepath))})
        base.write(folder / 'render-review.json', {'sourceSha256': identity, 'engine': 'Cycles', 'samples': args.samples,
                                                  'renders': entries, 'humanArtApproved': False})
        inv.pose('Idle', 0); bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True); rig.select_set(True)
        raw = folder / (profile['id'] + '-raw.glb')
        bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True, export_animations=True,
            export_animation_mode='ACTIONS', export_force_sampling=True, export_anim_slide_to_zero=True, export_skins=True,
            export_apply=False, export_extras=True, export_cameras=False, export_lights=False, export_yup=True)
        base.write(folder / 'raw-export.json', {'sourceSha256': identity, 'rawSha256': base.sha(raw), 'bytes': raw.stat().st_size})
        print(json.dumps({'actorId': profile['actorId'], 'sourceSha256': identity, 'triangles': review['triangles'],
                          'materials': review['materials'], 'rawBytes': raw.stat().st_size}), flush=True)


if __name__ == '__main__':
    main()
