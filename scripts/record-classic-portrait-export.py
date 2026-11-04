"""Validate the actual portrait sources and compressed runtime assets."""
from pathlib import Path
import hashlib
import importlib.util
import io
import json
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v3'
PUBLIC = ROOT / 'public/assets/classic-residents/v3'
BASE_PUBLIC = ROOT / 'public/assets/classic-residents/v1'
spec = importlib.util.spec_from_file_location('preserved_export_checks', ROOT / 'scripts/record-classic-residents-export.py')
checks = importlib.util.module_from_spec(spec); spec.loader.exec_module(checks)
read, write, sha = checks.read, checks.write, checks.sha


def payload(path):
    data = path.read_bytes(); doc = checks.glb(path)
    json_length = struct.unpack_from('<I', data, 12)[0]
    start = 20 + json_length
    assert data[start + 4:start + 8] == b'BIN\0'
    binary = data[start + 8:]
    images = []
    for image in doc['images']:
        assert 'uri' not in image
        view = doc['bufferViews'][image['bufferView']]
        blob = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        with Image.open(io.BytesIO(blob)) as im:
            size, mode = list(im.size), im.mode
            decoded = im.convert('RGBA').tobytes()
        images.append({'name': image.get('name'), 'mimeType': image['mimeType'], 'dimensions': size,
                       'mode': mode, 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest(),
                       'decodedRgbaSha256': hashlib.sha256(decoded).hexdigest()})
    def texture_info(material, key):
        info = material.get(key) if key == 'normalTexture' else material.get('pbrMetallicRoughness', {}).get(key)
        if info is None:
            return None
        texture = doc['textures'][info['index']]
        source = texture.get('source', texture.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
        assert source is not None
        return images[source]
    materials = {}
    for material in doc['materials']:
        materials[material['name']] = {
            'alphaMode': material.get('alphaMode', 'OPAQUE'), 'alphaCutoff': material.get('alphaCutoff'),
            'doubleSided': material.get('doubleSided', False),
            'baseColorFactor': material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1]),
            'baseColorTexture': texture_info(material, 'baseColorTexture'),
            'normalTexture': texture_info(material, 'normalTexture'),
        }
    return doc, images, materials


def main():
    ledger = read(PACKAGE / 'licensed/makehuman-system/provenance.json')
    for record in ledger['files']:
        assert sha(ROOT / record['path']) == record['sha256']
    assert not ledger['upstreamProgramCodeIncluded']
    assert all(not r['included'] for r in ledger['rejectedLicenseConflicts'])
    cast = read(ROOT / 'public/assets/classic-residents/v2/cast.json')
    reports = []
    for actor in checks.IDS:
        folder = PACKAGE / actor; original = read(BASE_PUBLIC / (actor + '.json'))
        author, render, raw = [read(folder / name) for name in ('authoring-review.json', 'render-review.json', 'raw-export.json')]
        source = folder / (original['id'] + '.blend'); source_hash = sha(source)
        assert source_hash == author['sourceSha256'] == render['sourceSha256'] == raw['sourceSha256']
        for path, expected in author['inputs'].items():
            assert sha(ROOT / path) == expected, path
        assert author['packedTextures'], (actor, 'missing packed texture evidence')
        for im in author['packedTextures']:
            assert sha(ROOT / im['path']) == im['sha256'] and max(im['dimensions']) <= 2048
            assert im['packedBytes'] == (ROOT / im['path']).stat().st_size
        assert len(author['animatedBounds']) == 116 and not author['invalidWeightVertices']
        required = {'three-quarter', 'portrait', 'face-front', 'front', 'profile', 'back', 'walk-contact', 'walk-passing', 'hands'}
        assert {r['view'] for r in render['renders']} == required
        for r in render['renders']:
            assert sha(folder / r['path']) == r['sha256']
        for cloth in author['clothAuthoring']:
            assert sha(ROOT / cloth['cachePath']) == cloth['cacheSha256']
        raw_path = folder / (original['id'] + '-raw.glb'); assert sha(raw_path) == raw['rawSha256']
        asset = PUBLIC / (actor + '.glb')
        before_doc, before_images, before_mats = payload(raw_path)
        doc, images, mats = payload(asset)
        before, after = checks.summary(before_doc), checks.summary(doc)
        for key in before:
            if key == 'clips':
                assert before[key].keys() == after[key].keys()
                assert all(abs(before[key][name] - after[key][name]) < 1e-6 for name in before[key])
            else:
                assert before[key] == after[key], (actor, key, before[key], after[key])
        assert after['triangles'] == author['triangles'] < 60000 and after['materials'] <= 14
        assert asset.stat().st_size < 6000000
        assert {'EXT_meshopt_compression', 'EXT_texture_webp'} <= set(doc['extensionsUsed'])
        assert all(max(im['dimensions']) <= 2048 for im in images)
        assert mats.keys() == before_mats.keys()
        for name in mats:
            a, b = before_mats[name], mats[name]
            for key in ('alphaMode', 'alphaCutoff', 'doubleSided', 'baseColorFactor'):
                assert a[key] == b[key], (actor, name, key)
            if a['normalTexture']:
                assert a['normalTexture']['dimensions'] == b['normalTexture']['dimensions']
                assert a['normalTexture']['decodedRgbaSha256'] == b['normalTexture']['decodedRgbaSha256'], (actor, name, 'normal pixels altered')
            if a['baseColorTexture']:
                assert a['baseColorTexture']['dimensions'] == b['baseColorTexture']['dimensions']
                assert b['baseColorTexture']['mimeType'] == 'image/webp'
        assert mats['brow_detail']['alphaMode'] == 'MASK'
        assert mats['skin.001']['baseColorTexture'] and mats['eye_detail']['baseColorTexture']
        for name, expected in author['materialExpectations'].items():
            assert all(abs(a - b) < 1e-6 for a, b in zip(mats[name]['baseColorFactor'], expected['baseColorFactor'])), (actor, name, 'authoring tint lost during export')
        manifest = dict(original, sourceSha256=source_hash, triangles=after['triangles'], materialCount=after['materials'],
                        asset={'url': f'/assets/classic-residents/v3/{actor}.glb', 'sha256': sha(asset), 'bytes': asset.stat().st_size},
                        license='CC0-1.0 anatomy, skin and fitted features; project-authored clothing, bun hair and animation',
                        licenseNoticeUrl='/assets/classic-residents/v3/LICENSE.ASSETS.md',
                        construction='Source anatomical UVs, fitted CC0 eyes and features, original clothing and retained animation. No Agent decisions or runtime cloth.')
        write(PUBLIC / (actor + '.json'), manifest)
        entry = next(e for e in cast['entries'] if e['actorId'] == actor)
        entry.update(manifestUrl=f'/assets/classic-residents/v3/{actor}.json', manifestSha256=sha(PUBLIC / (actor + '.json')))
        reports.append({'actorId': actor, 'sourcePath': source.relative_to(ROOT).as_posix(), 'sourceSha256': source_hash,
                        'asset': manifest['asset'], 'payload': after, 'images': images, 'materials': mats,
                        'renderCount': len(render['renders']), 'authoringReceiptSha256': sha(folder / 'authoring-review.json'),
                        'renderReceiptSha256': sha(folder / 'render-review.json')})
    cast['presentation'] = 'Three stationary art placements using the portrait refinement pass. Idle only; no autonomous decisions, testimony or world binding.'
    write(PUBLIC / 'cast.json', cast)
    license_text = (PACKAGE / 'licensed/makehuman-system/LICENSE.ASSETS.md').read_text(encoding='utf-8')
    license_text += '\n\n## Runtime asset credits\n\nMakeHuman system anatomy, skin, eyes, brows, lashes and short02 hair: CC0-1.0. '
    license_text += 'MargaretToigo / MRT curled-under bob mesh and referenced textures: CC0-1.0. '
    license_text += 'The project independently fits these meshes; original clothes, low bun, cap, props and animation are authored here. '
    license_text += 'No MakeHuman or MPFB application program code is shipped.\n\n'
    license_text += 'Source: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html\n\n'
    license_text += 'Bob source: https://static.makehumancommunity.org/assets/assetpacks/hair01.html\n'
    (PUBLIC / 'LICENSE.ASSETS.md').write_text(license_text, encoding='utf-8')
    write(PACKAGE / 'runtime-export.json', {'schema': 'classic-portrait-export.v3', 'castSha256': sha(PUBLIC / 'cast.json'),
          'residents': reports, 'sourceLedgerSha256': sha(PACKAGE / 'licensed/makehuman-system/provenance.json'),
          'optimizer': {'scriptSha256': sha(ROOT / 'scripts/optimize-classic-portraits.ps1'), 'cliVersion': '4.5.1',
                        'geometry': 'meshopt once, after texture conversion: position 16, normal 10, UV 16', 'textures': 'Base colour WebP quality 90; normals lossless WebP, decoded RGBA pixels verified identical'},
          'humanArtApproved': False, 'worldBound': False, 'runtimeCloth': False})
    print(json.dumps({'residents': [{'actorId': r['actorId'], 'triangles': r['payload']['triangles'],
                                     'bytes': r['asset']['bytes']} for r in reports], 'castSha256': sha(PUBLIC / 'cast.json')}))


if __name__ == '__main__':
    main()
