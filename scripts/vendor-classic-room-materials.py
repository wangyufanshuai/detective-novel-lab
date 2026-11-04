"""Vendor two specifically selected CC0 PBR sets and an existing OFL font.

Only public asset downloads are requested. No project files or credentials are
uploaded. Original bytes and server checksums remain beside a SHA-256 ledger.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import urllib.request
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-railway-v2'
sys.path.insert(0,str(ROOT/'output/tool-deps/classic-room'))


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'DetectiveTownLocalArt/1.0'})
    with urllib.request.urlopen(request,timeout=60) as response:return response.read()


def main():
    folder=PACKAGE/'licensed';folder.mkdir(parents=True,exist_ok=True)
    ledger=[]
    for asset,color_key in [('wood_table_001','Diffuse'),('leather_red_02','coll1')]:
        target=folder/asset;target.mkdir(exist_ok=True)
        metadata=json.loads(fetch('https://api.polyhaven.com/files/'+asset))
        write(target/'files-api.json',metadata)
        maps={}
        for role,key,fmt in [('color',color_key,'jpg'),('normal','nor_gl','png'),('roughness','Rough','jpg')]:
            entry=metadata[key]['1k'][fmt]
            file=target/(role+'.'+fmt)
            if not file.exists() or hashlib.md5(file.read_bytes()).hexdigest()!=entry['md5']:
                payload=fetch(entry['url'])
                assert hashlib.md5(payload).hexdigest()==entry['md5'],entry['url']
                file.write_bytes(payload)
            maps[role]={'path':str(file.relative_to(PACKAGE)).replace('\\','/'),'url':entry['url'],'sourceMd5':entry['md5'],'sha256':sha(file),'bytes':file.stat().st_size}
        ledger.append({'id':asset,'provider':'Poly Haven','page':'https://polyhaven.com/a/'+asset,'license':'CC0-1.0','licenseUrl':'https://polyhaven.com/license','maps':maps})
    from fontTools.ttLib import TTFont
    from fontTools import subset
    original=ROOT/'public/fonts/noir/noir-serif-sc-regular.woff2'
    font=TTFont(original);font.flavor=None
    options=subset.Options();options.name_IDs=['*'];options.name_legacy=True
    sub=subset.Subsetter(options=options);sub.populate(unicodes=list(range(32,127))+[0x2013,0x2014]);sub.subset(font)
    # This converted/subset derivative receives its own family name.
    names={1:'Railway Serif Study',2:'Regular',3:'RailwaySerifStudy-Regular-v1',4:'Railway Serif Study Regular',6:'RailwaySerifStudy-Regular',16:'Railway Serif Study',17:'Regular'}
    for record in font['name'].names:
        if record.nameID in names:record.string=names[record.nameID].encode(record.getEncoding())
    out=folder/'railway-serif-study.ttf';font.save(out)
    license_src=ROOT/'public/fonts/noir/notoserifsc-OFL.txt';shutil.copyfile(license_src,folder/'font-OFL.txt')
    ledger.append({'id':'railway-serif-study','source':'public/fonts/noir/noir-serif-sc-regular.woff2','sourceSha256':sha(original),'license':'SIL-OFL-1.1','licensePath':'licensed/font-OFL.txt','licenseSha256':sha(folder/'font-OFL.txt'),'modification':'Latin sign subset and WOFF2-to-SFNT conversion; renamed Railway Serif Study; copyright records retained.','path':str(out.relative_to(PACKAGE)).replace('\\','/'),'sha256':sha(out)})
    write(folder/'provenance.json',{'retrievedAt':datetime.now(timezone.utc).isoformat(),'assets':ledger,'uploads':[]})
    (folder/'CREDITS.md').write_text('# Third-party material and font credits\n\nThe wood_table_001 and leather_red_02 texture sets are from Poly Haven, CC0-1.0.\n\n- https://polyhaven.com/a/wood_table_001\n- https://polyhaven.com/a/leather_red_02\n- https://polyhaven.com/license\n\nThe sign font is a renamed Latin subset of the project Noto Serif SC font, under SIL Open Font License 1.1. See font-OFL.txt. Source copyright is retained in the font.\n\nAll room geometry and additional mathematical patterns are authored in this project. These material credits do not assert rights over any third-party trademark or franchise.\n',encoding='utf-8')
    print(json.dumps({'assets':[entry['id'] for entry in ledger],'files':sum(len(entry.get('maps',{})) for entry in ledger)+1},ensure_ascii=False))


if __name__=='__main__':main()
