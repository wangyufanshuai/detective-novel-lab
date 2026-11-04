"""Vendor only CC0 graphical data at a pinned official MPFB commit.

No MPFB program logic is installed or included in the game. Every downloaded
byte is checked against the Git blob identity returned by the GitHub connector.
"""
from pathlib import Path
import hashlib
import json
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs/3d-town/classic-residents-v1/licensed/mpfb'
TREE = json.loads((ROOT / 'output/character-source-audit/mpfb-source-tree.json').read_text(encoding='utf-8'))
COMMIT = TREE['commit']
PREFIX = 'src/mpfb/data/'
FILES = ['LICENSE.md', 'LICENSE.ASSETS.md', PREFIX+'3dobjs/base.obj',
         PREFIX+'mesh_metadata/basemesh_vertex_groups.json', PREFIX+'targets/macrodetails/macro.json']
FILES += [PREFIX+'targets/macrodetails/'+name+'.target.gz' for name in [
    'asian-male-young', 'asian-male-old', 'asian-female-young', 'asian-female-old',
    'caucasian-male-young', 'caucasian-male-old', 'caucasian-female-young', 'caucasian-female-old']]


def git_hash(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()


def main():
    records = []
    for path in FILES:
        item = next(x for x in TREE['tree'] if x['path'] == path)
        local = DEST / path.removeprefix(PREFIX)
        local.parent.mkdir(parents=True, exist_ok=True)
        url = f'https://cdn.jsdelivr.net/gh/makehumancommunity/mpfb2@{COMMIT}/{path}'
        if not local.exists() or git_hash(local.read_bytes()) != item['sha']:
            pending = local.with_suffix(local.suffix+'.download')
            subprocess.run(['curl.exe','--location','--fail','--silent','--show-error',
                            '--connect-timeout','15','--max-time','60',url,'--output',str(pending)],check=True)
            data = pending.read_bytes()
            assert len(data) == item['size'] and git_hash(data) == item['sha'], path
            pending.replace(local)
        data = local.read_bytes()
        records.append({'path':str(local.relative_to(ROOT)).replace('\\','/'),
            'upstreamPath':path, 'sourceUrl':f'https://github.com/makehumancommunity/mpfb2/blob/{COMMIT}/{path}',
            'downloadUrl':url, 'bytes':len(data), 'gitBlobSha1':git_hash(data),
            'sha256':hashlib.sha256(data).hexdigest(),
            'license':'CC0-1.0' if path.startswith(PREFIX) or path == 'LICENSE.ASSETS.md' else 'license notice'})
        print('VERIFIED',path,len(data),flush=True)
    ledger = {'schema':'classic-resident-source-ledger.v1','retrievedAt':datetime.now(timezone.utc).isoformat(),
        'repository':'https://github.com/makehumancommunity/mpfb2','commit':COMMIT,
        'licenseBasis':'LICENSE.md section C explicitly lists base mesh, targets and JSON mesh metadata under CC0-1.0.',
        'officialLicenseUrl':'https://static.makehumancommunity.org/about/license.html',
        'upstreamCodeIncluded':False, 'files':records,
        'scope':'Anatomical reference topology and adult shape deltas. Clothing, hair, accessories and animation remain project-authored. Art phenotype choices are provisional and do not alter world identities.'}
    (DEST/'provenance.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VENDORED',len(records),'CC0_DATA_BYTES',sum(x['bytes'] for x in records))


if __name__ == '__main__':
    main()
