"""Read the retained room without changing it before a new art-direction study."""
from pathlib import Path
import bpy, json, hashlib
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/3d-town/classic-motion-v2/layout-01/room.blend'
OUT = ROOT / 'docs/3d-town/classic-atmosphere-v1'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
objects = []
for obj in bpy.context.scene.objects:
    if obj.type == 'LIGHT' or (obj.type in ('MESH', 'CURVE', 'FONT') and any(s in obj.name for s in ('chair-', 'writing', 'fireplace', 'wainscot', 'panel', 'parquet', 'ceiling', 'table', 'lamp', 'pendant'))):
        if obj.type == 'MESH' and obj.name.startswith('parquet') and any(r['name'].startswith('parquet') for r in objects): continue
        objects.append({'name':obj.name,'type':obj.type,'location':list(obj.location),'dimensions':list(obj.dimensions),'layer':obj.get('layer'),
                        'materials':[s.material.name if s.material else None for s in obj.material_slots],
                        'light': {'energy':obj.data.energy,'color':list(obj.data.color),'type':obj.data.type} if obj.type=='LIGHT' else None})
materials=[]
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    materials.append({'name':mat.name,'users':mat.users,'color':list(bsdf.inputs['Base Color'].default_value) if bsdf else None,
                      'roughness':bsdf.inputs['Roughness'].default_value if bsdf else None,
                      'nodes':[{'name':n.name,'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None} for n in mat.node_tree.nodes]})
report={'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'objects':objects,'materials':materials}
(OUT/'source-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'complete':True,'objects':len(objects),'materials':len(materials)}))
