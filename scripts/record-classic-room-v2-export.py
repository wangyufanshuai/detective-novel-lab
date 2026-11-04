"""Validate optimized v2 geometry and the actual PBR texture bindings."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base_record',ROOT/'scripts/record-classic-railway-export.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.PACKAGE=ROOT/'docs/3d-town/classic-railway-v2';base.OUTPUT=ROOT/'public/assets/classic-railway/v2'
g,_=base.glb(base.OUTPUT/'classic-railway.glb');raw,_=base.glb(base.PACKAGE/'meshes/classic-railway-raw.glb')
checks=[]
expected=base.read(base.PACKAGE/'authoring-receipt.json')['baseColorFactors']
for name in ['aged_walnut','polished_walnut','oxblood_leather']+['parquet_oak_'+str(i) for i in range(5)]:
    material=next(m for m in g['materials'] if m['name']==name)
    original=next(m for m in raw['materials'] if m['name']==name)
    pbr=material['pbrMetallicRoughness'];source=original['pbrMetallicRoughness']
    assert 'baseColorTexture' in pbr and 'metallicRoughnessTexture' in pbr and 'normalTexture' in material,name
    assert pbr.get('baseColorFactor')==source.get('baseColorFactor'),name
    assert all(abs(a-b)<1e-6 for a,b in zip(pbr.get('baseColorFactor',[1,1,1,1]),expected[name])),(name,'Source tint did not survive export')
    checks.append({'material':name,'baseColorTexture':True,'roughnessTexture':True,'normalTexture':True,'baseColorFactor':pbr.get('baseColorFactor',[1,1,1,1])})
base.main()
base.write(base.PACKAGE/'runtime/material-check.json',{'checks':checks,'assetSha256':base.sha(base.OUTPUT/'classic-railway.glb'),'scriptSha256':base.sha(Path(__file__)),'passed':True})
