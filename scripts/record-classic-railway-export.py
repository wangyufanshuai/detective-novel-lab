"""Record and validate the actual optimized GLB, never rename a raw receipt green."""
from pathlib import Path
import hashlib
import io
import json
import struct
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/"docs/3d-town/classic-railway-v1"
OUTPUT=ROOT/"public/assets/classic-railway/v1"
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding="utf-8"))
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
def glb(p):
    b=p.read_bytes();assert b[:4]==b"glTF"
    n=struct.unpack_from("<I",b,12)[0];g=json.loads(b[20:20+n]);return g,b[28+n:]


def main():
    raw=PACKAGE/"meshes/classic-railway-raw.glb";final=OUTPUT/"classic-railway.glb"
    manifest=read(PACKAGE/"runtime/raw-export.json");brief=read(PACKAGE/"room-brief.json")
    assert manifest["asset"]["sha256"]==sha(raw)
    original,_=glb(raw);g,binary=glb(final)
    triangle_count=lambda d:sum(d["accessors"][p["indices"]]["count"]//3 for m in d["meshes"] for p in m["primitives"])
    assert triangle_count(original)==triangle_count(g)==manifest["sourceTriangles"]
    required={"sample_player","sample_leg_left","sample_leg_right","sample_arm_left","sample_arm_right","layer_inn_front","layer_inn_upper","layer_ceiling","layer_inn_side_cutaway"}
    assert required<={n.get("name") for n in g["nodes"]}
    images=[]
    for image in g["images"]:
        view=g["bufferViews"][image["bufferView"]];start=view.get("byteOffset",0);payload=binary[start:start+view["byteLength"]]
        with Image.open(io.BytesIO(payload)) as im:width,height=im.size
        assert max(width,height)<=512
        images.append({"name":image.get("name"),"format":image["mimeType"],"size":[width,height],"bytes":len(payload)})
    gpu_estimate=round(sum(i["size"][0]*i["size"][1]*4*4/3 for i in images))
    assert final.stat().st_size<=brief["performanceBudget"]["maxVLowBytes"]
    assert gpu_estimate<=brief["performanceBudget"]["maxHighTextureBytes"]
    optimization={"tool":"@gltf-transform/cli@4.5.1","steps":["resize all textures to at most 512x512","WebP quality 90 for baseColorTexture only; normals remain PNG","meshopt high, position 16, normal 10, texcoord 16 bits requested; repeating UVs are preserved as floats by the tool"],"rawSha256":sha(raw),"rawBytes":raw.stat().st_size,"finalSha256":sha(final),"finalBytes":final.stat().st_size,"trianglesBefore":triangle_count(original),"trianglesAfter":triangle_count(g),"images":images,"estimatedRgbaTextureBytesWithMipmaps":gpu_estimate,"gpuEstimateNote":"Texture storage estimate only; excludes render targets, geometry buffers, browser and process memory.","extensionsRequired":g.get("extensionsRequired",[]),"rawExportReceiptSha256":sha(PACKAGE/"runtime/raw-export.json")}
    write(PACKAGE/"runtime/optimization.json",optimization)
    nav=read(OUTPUT/"navigation.json");nav["assetSha256"]=sha(final);write(OUTPUT/"navigation.json",nav)
    manifest["rawAsset"]={"path":"meshes/classic-railway-raw.glb","sha256":sha(raw),"bytes":raw.stat().st_size}
    manifest["asset"]["sha256"]=sha(final);manifest["asset"]["bytes"]=final.stat().st_size;manifest["navigation"]["sha256"]=sha(OUTPUT/"navigation.json")
    manifest["optimization"]={"path":"runtime/optimization.json","sha256":sha(PACKAGE/"runtime/optimization.json"),"decoder":"Three.js bundled MeshoptDecoder","textures":"512px; WebP base color, PNG normal"}
    manifest["lighting"]="Runtime PBR with hemisphere/key/fixture lights, RoomEnvironment reflections and reduced-resolution GTAO. No baked-lightmap or offline-render equivalence claim."
    write(OUTPUT/"manifest.json",manifest);write(PACKAGE/"runtime-export.json",manifest)
    print(json.dumps({"bytes":final.stat().st_size,"triangles":triangle_count(g),"estimatedTextureBytes":gpu_estimate,"assetSha256":sha(final)}))


if __name__=="__main__":main()
