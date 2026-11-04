"""Independent OBJ/UV and documented MHCLO data readers for CC0 art assets.

The attachment formula follows MakeHuman's public file-format documentation.
No upstream application or add-on program code is imported or distributed.
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector


def read_obj(path):
    points, uvs, faces, uv_faces = [], [], [], []
    groups = []
    group = ''
    for raw in Path(path).read_text(encoding='utf-8-sig').splitlines():
        line = raw.strip()
        if line.startswith('v '):
            points.append(Vector(tuple(map(float, line.split()[1:4]))))
        elif line.startswith('vt '):
            uvs.append(tuple(map(float, line.split()[1:3])))
        elif line.startswith('g '):
            group = line[2:]
        elif line.startswith('f '):
            values = [p.split('/') for p in line.split()[1:]]
            faces.append(tuple(int(p[0]) - 1 for p in values))
            uv_faces.append(tuple(int(p[1]) - 1 for p in values))
            groups.append(group)
    assert len(faces) == len(uv_faces) and points and uvs
    assert all(math.isfinite(v) for p in points for v in p)
    assert all(0 <= i < len(points) for f in faces for i in f)
    assert all(0 <= i < len(uvs) for f in uv_faces for i in f)
    return points, uvs, faces, uv_faces, groups


def assign_uv(obj, coordinates, faces):
    assert len(obj.data.polygons) == len(faces)
    layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for polygon, uv_face in zip(obj.data.polygons, faces):
        assert len(polygon.loop_indices) == len(uv_face)
        for loop, index in zip(polygon.loop_indices, uv_face):
            layer.data[loop].uv = coordinates[index]
    assert all(math.isfinite(c) for p in layer.data for c in p.uv)


def source_subset(original, source_obj):
    """Keep the subset operation's exact polygon order and original UV seams."""
    _, coords, all_faces, all_uv_faces, groups = read_obj(source_obj)
    mapping = {face: uv for face, uv, group in zip(all_faces, all_uv_faces, groups) if group == 'body'}

    def make(u, inv, name, points, faces, keep, transform, weights):
        selected = [face for face in faces if all(keep(points[i]) for i in face)]
        obj = original(u, inv, name, points, faces, keep, transform, weights)
        assign_uv(obj, coords, [mapping[tuple(f)] for f in selected])
        obj['uvOrigin'] = 'Exact source OBJ per-corner UVs, including seam duplicates'
        return obj
    return make


def fitted_proxy(path, base_points):
    """Parse zero-based vertex attachments and positive axis offset scales."""
    lines = Path(path).read_text(encoding='utf-8-sig').splitlines()
    mode = False
    attachments, scales, metadata = [], [1., 1., 1.], {}
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        values = line.split()
        key = values[0]
        if key in ('x_scale', 'y_scale', 'z_scale'):
            axis = 'xyz'.index(key[0]); i, j = int(values[1]), int(values[2]); den = float(values[3])
            assert den > 0
            scales[axis] = abs(base_points[i][axis] - base_points[j][axis]) / den
        elif key.startswith(('shear_', 'l_shear_', 'r_shear_')):
            raise ValueError('Shear attachment requires a separately reviewed implementation')
        elif key == 'verts':
            mode = True
        elif mode and (key.lstrip('-').isdigit()):
            if len(values) == 1:
                attachments.append(base_points[int(values[0])].copy())
            else:
                assert len(values) == 9, (path, values)
                indices = [int(v) for v in values[:3]]
                weights = [float(v) for v in values[3:6]]
                assert abs(sum(weights) - 1) < .001, weights
                point = sum((base_points[i] * w for i, w in zip(indices, weights)), Vector())
                point += Vector(tuple(float(v) * s for v, s in zip(values[6:], scales)))
                attachments.append(point)
        elif mode and key in ('material', 'tag', 'name', 'uuid', 'obj_file', 'max_pole', 'z_depth'):
            metadata[key] = ' '.join(values[1:])
        elif mode:
            mode = False
        else:
            metadata[key] = ' '.join(values[1:])
    obj_path = Path(path).parent / metadata['obj_file']
    original, uvs, faces, uv_faces, _ = read_obj(obj_path)
    assert len(attachments) == len(original), (path, len(attachments), len(original))
    assert all(math.isfinite(c) for p in attachments for c in p)
    return attachments, uvs, faces, uv_faces


def proxy_object(u, inv, name, path, points, transform, material):
    fitted, uvs, faces, uv_faces = fitted_proxy(path, points)
    obj = u.mesh(name, [transform(p) for p in fitted], faces, material, True)
    assign_uv(obj, uvs, uv_faces)
    inv.skin(obj, 'head')
    obj['assetOrigin'] = 'MakeHuman system art assets / CC0-1.0'
    obj['attachmentMethod'] = 'Documented barycentric attachment with per-axis offset scales'
    return obj


def load_texture(u, path, normal=False):
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = 'Non-Color' if normal else 'sRGB'
    if max(image.size) > 2048:
        original = list(image.size)
        scale = 2048 / max(original)
        image.scale(round(original[0] * scale), round(original[1] * scale))
        output = u.PACKAGE / 'textures' / (Path(path).stem + '-2048.png')
        output.parent.mkdir(parents=True, exist_ok=True)
        image.filepath_raw = str(output); image.file_format = 'PNG'; image.save()
        image['derivation'] = 'Blender image scaling from preserved source texture'
        image['originalDimensions'] = original
        image['sourceFile'] = str(path)
    return image


def image_material(u, name, path, roughness, cutout=None, normal_path=None):
    material = u.material(name, 'ffffff', roughness, 0)
    material = u.MATS[name]
    tree = material.node_tree
    bsdf = tree.nodes['Principled BSDF']
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.image = load_texture(u, path)
    assert max(texture.image.size) <= 2048, (path, list(texture.image.size))
    texture.image.colorspace_settings.name = 'sRGB'
    tree.links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
    if cutout is not None:
        # Blender's current glTF exporter recognises this as alphaMode MASK,
        # avoiding sorted translucent hair in the actual runtime.
        threshold = tree.nodes.new('ShaderNodeMath')
        threshold.operation = 'GREATER_THAN'
        threshold.inputs[1].default_value = cutout
        tree.links.new(texture.outputs['Alpha'], threshold.inputs[0])
        tree.links.new(threshold.outputs[0], bsdf.inputs['Alpha'])
        material.surface_render_method = 'DITHERED'
        material.use_backface_culling = False
    if normal_path:
        normal_texture = tree.nodes.new('ShaderNodeTexImage')
        normal_texture.image = load_texture(u, normal_path, normal=True)
        normal_texture.image.colorspace_settings.name = 'Non-Color'
        normal = tree.nodes.new('ShaderNodeNormalMap')
        tree.links.new(normal_texture.outputs['Color'], normal.inputs['Color'])
        tree.links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    return material
