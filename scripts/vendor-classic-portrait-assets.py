"""Extract an allowlisted set of CC0 system art assets from the verified archive."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/classic-residents-v3'
DEST = PACKAGE / 'licensed/makehuman-system'
AUDIT = ROOT / 'output/character-source-audit'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    archive_record = json.loads((AUDIT / 'makehuman-system-download.json').read_text())
    archive = ROOT / archive_record['archive']
    assert sha(archive) == archive_record['sha256']
    prefixes = ['skins/' + n + '/' for n in ('young_asian_female', 'middleage_asian_female', 'middleage_asian_male')]
    prefixes += ['hair/bob01/', 'hair/short02/', 'eyes/low-poly/', 'eyebrows/eyebrow001/', 'eyelashes/eyelashes01/']
    extras = ['eyes/materials/brown.mhmat', 'eyes/materials/brown_eye.png']
    records = []
    with zipfile.ZipFile(archive) as z:
        selected = [n for n in z.namelist() if not n.endswith(('/', '.thumb')) and
                    (any(n.startswith(p) for p in prefixes) or n in extras)]
        for name in selected:
            data = z.read(name)
            if name.endswith(('.mhclo', '.mhmat', '.obj')):
                assert 'explicitly released as CC0' in data[:2000].decode('utf-8'), name
            path = DEST / name
            assert path.resolve().is_relative_to(DEST.resolve())
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                assert path.read_bytes() == data, name
            else:
                path.write_bytes(data)
            info = {'path': path.relative_to(ROOT).as_posix(), 'archiveMember': name,
                    'bytes': len(data), 'sha256': sha(path), 'license': 'CC0-1.0'}
            if data[:8] == b'\x89PNG\r\n\x1a\n':
                info['dimensions'] = list(struct.unpack_from('>II', data, 16))
            records.append(info)
    hair_archive = json.loads((AUDIT / 'hair01-download.json').read_text())
    assert sha(ROOT / hair_archive['archive']) == hair_archive['sha256']
    with zipfile.ZipFile(ROOT / hair_archive['archive']) as z:
        prefix = 'hair/toigo_curled_under_bob/'
        metadata = z.read(prefix + 'toigo_curled_under_bob.mhclo').decode()
        assert '# license CC0' in metadata and '# author MRT' in metadata
        for name in z.namelist():
            if not name.startswith(prefix) or name.endswith(('/', '.thumb')):
                continue
            data = z.read(name); path = DEST / name; path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                assert path.read_bytes() == data
            else:
                path.write_bytes(data)
            info = {'path': path.relative_to(ROOT).as_posix(), 'archiveMember': name,
                    'archiveSha256': hair_archive['sha256'], 'bytes': len(data), 'sha256': sha(path),
                    'license': 'CC0-1.0', 'author': 'MargaretToigo / MRT',
                    'licenseMetadata': prefix + 'toigo_curled_under_bob.mhclo'}
            if data[:8] == b'\x89PNG\r\n\x1a\n':
                info['dimensions'] = list(struct.unpack_from('>II', data, 16))
            records.append(info)
    shutil.copyfile(AUDIT / 'makehuman-system-official-page.html', DEST / 'official-source-page.html')
    shutil.copyfile(AUDIT / 'hair01-official-page.html', DEST / 'official-hair-page.html')
    shutil.copyfile(ROOT / 'docs/3d-town/classic-residents-v1/licensed/mpfb/LICENSE.ASSETS.md', DEST / 'LICENSE.ASSETS.md')
    provenance = {'schema': 'classic-portrait-source-ledger.v3', 'retrievedAt': datetime.now(timezone.utc).isoformat(),
                  'archive': archive_record, 'hairArchive': hair_archive, 'files': records,
                  'sourcePageSha256': sha(DEST / 'official-source-page.html'),
                  'licenseBasis': 'Official system pack lists its assets under CC0; its selected OBJ, MHCLO and MHMAT files explicitly record the September 2020 CC0 release. The additional MargaretToigo bob has a CC0 declaration in its MHCLO and a matching official pack entry; its OBJ and referenced material/texture files are included as that asset. Conflicting-license bun candidates are excluded.',
                  'upstreamProgramCodeIncluded': False,
                  'rejectedLicenseConflicts': [
                      {'asset': 'rehmanpolanski_hair_bun_brown', 'listedLicense': 'CC0', 'fileLicense': 'AGPL3', 'included': False},
                      {'asset': 'elvs_reverse_french_braid_bun', 'listedLicense': 'CC0', 'fileLicense': 'CC_by', 'included': False}
                  ],
                  'formatReference': 'https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html'}
    (DEST / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    spec = {
        'resident-03': {'skin': 'skins/young_asian_female/young_lightskinned_female_diffuse3.png', 'hair': 'toigo_curled_under_bob'},
        'resident-06': {'skin': 'skins/middleage_asian_male/middleage_lightskinned_male_diffuse2.png', 'hair': 'short02'},
        'resident-08': {'skin': 'skins/middleage_asian_female/middleage_lightskinned_female_diffuse2.png', 'hair': 'authored-bun'},
    }
    (PACKAGE / 'portrait-assets.json').write_text(json.dumps(spec, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'files': len(records), 'sourceBytes': sum(f['bytes'] for f in records),
                      'textures': {f['archiveMember']: f['dimensions'] for f in records if 'dimensions' in f}}))


if __name__ == '__main__':
    main()
