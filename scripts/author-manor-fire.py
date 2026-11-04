"""Original bounded flame density, shared by Blender and the WebGL volume.

This is an authored visual field, not a fluid simulation. The binary is z/y/x
ordered, unsigned normalized R8; the PNG is the same field in an 8 x 8 atlas.
"""
from pathlib import Path
import numpy as np
from PIL import Image
import json, hashlib

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/snowbound-manor-v2/textures'
P.mkdir(parents=True,exist_ok=True)
W,H,D=128,64,64
z,y,x=np.meshgrid(np.linspace(0,1,D),np.linspace(0,1,H),np.linspace(0,1,W),indexing='ij')
rng=np.random.default_rng(1932)

def noise(scale):
    grid=rng.random((scale+2,scale+2,scale+2))
    xx,yy,zz=x*scale,y*scale,z*scale
    ix,iy,iz=xx.astype(int),yy.astype(int),zz.astype(int)
    fx,fy,fz=xx-ix,yy-iy,zz-iz
    fx,fy,fz=[v*v*(3-2*v) for v in (fx,fy,fz)]
    result=np.zeros_like(x)
    for a in range(2):
        for b in range(2):
            for c in range(2):
                result+=grid[iz+a,iy+b,ix+c]*(fz if a else 1-fz)*(fy if b else 1-fy)*(fx if c else 1-fx)
    return result

coarse=noise(7);fine=noise(22);field=np.zeros_like(x)
plumes=[(.13,.42,.42,.060),(.25,.60,.78,.061),(.36,.35,.55,.052),
        (.49,.62,.92,.071),(.61,.38,.63,.057),(.73,.59,.76,.055),(.86,.44,.47,.047)]
for i,(cx,cy,height,radius) in enumerate(plumes):
    t=z/height
    bend=np.sin(t*9+i*1.77)*t*.045+(coarse-.5)*.09
    taper=np.maximum(1-t,0)**.78*radius+.0015
    radial=np.sqrt(((x-cx-bend)/taper)**2+((y-cy-(fine-.5)*.055)/(taper*1.35))**2)
    envelope=np.clip((1-radial)*2.5,0,1)*np.clip((1-t)*10,0,1)
    # A broken, thinner outer reaction region leaves visible dark gaps.
    hollow=.30+.70*np.clip(radial/.6,0,1)
    tongues=np.clip((coarse*.65+fine*.35-.28)*2.2,0,1)
    field=np.maximum(field,envelope*hollow*tongues)
field*=np.clip(z*35,0,1)
field[[0,-1],:,:]=0;field[:,[0,-1],:]=0;field[:,:,[0,-1]]=0
pixels=np.rint(np.clip(field,0,1)*255).astype(np.uint8)
binary=P/'hearth-density.r8';binary.write_bytes(pixels.tobytes())
atlas=np.zeros((H*8,W*8),dtype=np.uint8)
for i in range(D):atlas[(i//8)*H:(i//8+1)*H,(i%8)*W:(i%8+1)*W]=pixels[i]
png=P/'hearth-density.png';Image.fromarray(np.flipud(atlas)).save(png)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
recipe={'schema':'manor-fire-field.v1','kind':'original-authored-volume-not-fluid-simulation','seed':1932,
        'size':[W,H,D],'order':'z-y-x','format':'unorm8','atlasTiles':[8,8],
        'position':[0,10.17,.83],'dimensions':[1.62,.62,.92],
        'densityMultiplier':.04,'emissionMultiplier':20,'temperature':[1350,1350],
        'binary':{'path':binary.name,'sha256':sha(binary),'bytes':binary.stat().st_size},
        'atlas':{'path':png.name,'sha256':sha(png)},'generatorSha256':sha(Path(__file__))}
(P/'fire-field.json').write_text(json.dumps(recipe,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'maxHeat':float(field.max()),'occupiedVoxels':int((pixels>0).sum()),'bytes':binary.stat().st_size}))
