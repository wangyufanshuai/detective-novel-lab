"""Vendor only the CC0 suit art selected from the preserved official archive."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/3d-town/classic-residents-v5/licensed/mrt-suit'
AUDIT=ROOT/'output/character-source-audit'
ARCHIVE=AUDIT/'suits01_cc0.zip'
PREFIX='clothes/toigo_male_double-breasted_suit/'
EXPECTED='2b1d8676f3863b188e9eea98c1d8f234543d54c440e791d92b819f8ee1861f19'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ARCHIVE)==EXPECTED
OUT.mkdir(parents=True,exist_ok=True)
files=[]
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None
    names=['toigo_male_double-breasted_suit.mhclo','suit_double_breasted.obj','suit_double_breasted.mhmat',
           'DB-suit.png','DB-suit-norm.png','DB-suit-spec.png','toigo_male_double-breasted_suit.thumb']
    for name in names:
        data=archive.read(PREFIX+name)
        if name.endswith(('.mhclo','.obj')):
            header=data.decode('utf-8-sig')[:500]
            assert '# license CC0' in header and '# author MRT' in header
        path=OUT/name
        if path.exists(): assert path.read_bytes()==data
        else: path.write_bytes(data)
        files.append({'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'bytes':len(data)})
page=AUDIT/'suits01-official-page.html'
(OUT/'official-page.html').write_bytes(page.read_bytes())
ledger={'schema':'classic-uniform-source.v1','author':'Margaret Toigo / MRT','license':'CC0-1.0',
        'sourceUrl':'https://files2.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip',
        'officialPage':'https://static.makehumancommunity.org/assets/assetpacks/suits01.html',
        'archiveSha256':EXPECTED,'officialPageSha256':sha(OUT/'official-page.html'),
        'licenseBasis':'Official asset table marks the male double-breasted suit CC0. Both its OBJ and MHCLO headers explicitly state author MRT and license CC0. Material and referenced textures are kept with that asset.',
        'files':files,'upstreamProgramCodeIncluded':False,
        'adaptationScope':'Fit selected clothing art to the project resident and skeleton, retaining source surface UVs. Hat, public identity, face, hands and game animation remain project/preserved portrait work.'}
(OUT/'provenance.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'LICENSE.ASSETS.md').write_text('# Selected suit artwork\n\nMargaret Toigo / MRT male double-breasted suit: CC0-1.0.\n\nSource: https://static.makehumancommunity.org/assets/assetpacks/suits01.html\n\nCC0 text: https://creativecommons.org/publicdomain/zero/1.0/\n\nOBJ and MHCLO headers and their referenced material textures are preserved. No MakeHuman or MakeClothes program code is included.\n',encoding='utf-8')
print(json.dumps({'selectedFiles':len(files),'bytes':sum(f['bytes'] for f in files),'license':ledger['license']}))
