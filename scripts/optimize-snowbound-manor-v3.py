"""Run glTF Transform without PowerShell interpreting npm notices as failures."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v3';R=P/'runtime';O=ROOT/'public/assets/snowbound-manor/v3'
record=json.loads((R/'raw-export.json').read_text(encoding='utf-8'));raw=ROOT/record['rawAsset']['path']
assert hashlib.sha256(raw.read_bytes()).hexdigest()==record['rawAsset']['sha256']
prefix=['D:/nvm/v24.14.0/node.exe','D:/nvm/v24.14.0/node_modules/npm/bin/npx-cli.js','--yes','--package','@gltf-transform/cli@4.5.1','gltf-transform']
for tier,size in [('high',1024),('balanced',512)]:
    resized=R/f'{tier}-resized.glb';webp=R/f'{tier}-webp.glb';final=O/f'manor-{tier}.glb'
    packed=R/f'{tier}-packed-textures.glb'
    commands=[('resize',[str(raw),str(resized),'--width',str(size),'--height',str(size)])]
    if tier=='high':
        commands.append(('resize',[str(resized),str(packed),'--width','512','--height','512','--pattern','{normal,roughness,*_nor_*,*_arm_*,*_rough_*}']))
    commands.extend([('webp',[str(packed if tier=='high' else resized),str(webp),'--quality','90']),
                     ('meshopt',[str(webp),str(final),'--quantize-position','16','--quantize-texcoord','16','--quantize-normal','10'])])
    for operation,args in commands:
        print(f'{tier}: {operation}',flush=True)
        with (R/f'{tier}-{operation}.log').open('w',encoding='utf-8') as log:
            result=subprocess.run(prefix+[operation]+args,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
        if result.returncode:raise RuntimeError(f'{tier} {operation} failed: see log')
subprocess.run(['D:/blender.exe','--background','--threads','4','--python',str(ROOT/'scripts/denoise-manor-lightmap-v3.py')],cwd=ROOT,check=True)
subprocess.run(['D:/blender.exe','--background','--threads','4','--python',str(ROOT/'scripts/optimize-manor-lightmap-v3.py')],cwd=ROOT,check=True)
subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/record-snowbound-runtime-v3.py')],cwd=ROOT,check=True)
