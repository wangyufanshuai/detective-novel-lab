"""Download specifically selected public CC0 assets; verify provider MD5 and SHA256.

No paid generation, credentials, project uploads, or third-party preview images.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/3d-town/snowbound-manor-v1'
DEST = PACKAGE / 'licensed'
MODELS = [('ArmChair_01','2k'), ('sofa_03','2k'), ('ClassicConsole_01','2k'),
          ('Chandelier_03','2k'), ('round_wooden_table_02','2k'),
          ('mantel_clock_01','2k'), ('fir_sapling','2k')]
TEXTURES = ['old_stone_wall_02', 'roof_slates_02']

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent':'DetectiveTownLocalArt/1.0'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def obtain(directory, relative, item):
    path = (directory / relative).resolve()
    path.relative_to(directory.resolve())
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != item['md5']:
        payload = fetch(item['url'])
        assert len(payload) == item['size'], f'Size mismatch: {relative}'
        assert hashlib.md5(payload).hexdigest() == item['md5'], f'MD5 mismatch: {relative}'
        path.write_bytes(payload)
    return {'path':path.relative_to(PACKAGE).as_posix(), 'url':item['url'],
            'sourceMd5':item['md5'], 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'bytes':path.stat().st_size}

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    catalog=json.loads(fetch('https://api.polyhaven.com/assets?t=models'))
    texture_catalog=json.loads(fetch('https://api.polyhaven.com/assets?t=textures'))
    ledger=[]
    for asset,resolution in MODELS + [(a,'2k') for a in TEXTURES]:
        directory=DEST/asset; directory.mkdir(exist_ok=True)
        metadata=json.loads(fetch('https://api.polyhaven.com/files/'+asset))
        write(directory/'files-api.json', metadata)
        record={'id':asset,'provider':'Poly Haven','page':'https://polyhaven.com/a/'+asset,
                'license':'CC0-1.0','licenseUrl':'https://polyhaven.com/license',
                'authors':(catalog|texture_catalog)[asset].get('authors'),
                'resolution':resolution,'files':[]}
        if asset not in TEXTURES:
            entry=metadata['gltf'][resolution]['gltf']
            relative=entry['url'].rsplit('/',1)[-1]
            record['files'].append(obtain(directory,relative,entry))
            record['gltf']=str((directory/relative).relative_to(PACKAGE)).replace('\\','/')
            for relative,item in entry.get('include',{}).items():
                record['files'].append(obtain(directory,relative,item))
        else:
            record['maps']={}
            for role,key in [('color','Diffuse'),('normal','nor_gl'),('roughness','Rough')]:
                choices=metadata[key][resolution]
                fmt='jpg' if 'jpg' in choices else 'png'
                entry=choices[fmt]
                receipt=obtain(directory,role+'.'+fmt,entry)
                record['files'].append(receipt)
                record['maps'][role]=receipt['path']
        ledger.append(record)
        write(DEST/'provenance.json', {'retrievedAt':datetime.now(timezone.utc).isoformat(),
                                     'assets':ledger,'uploads':[],'paidServices':[]})
        print(asset, sum(f['bytes'] for f in record['files']), flush=True)
    lines=['# Snowbound manor asset credits','',
           'The following assets were obtained directly from Poly Haven under CC0-1.0.',
           'Original bytes, provider checksums and local SHA256 hashes are retained in provenance.json.',
           '','License: https://polyhaven.com/license','']
    for a in ledger: lines.append('- '+a['id']+' — '+', '.join(a['authors'])+' — '+a['page'])
    lines += ['', 'The manor architecture, snow, staging, original props and lighting are project authored.',
              'No franchise setting or character is represented as licensed.']
    (DEST/'CREDITS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

if __name__=='__main__': main()
