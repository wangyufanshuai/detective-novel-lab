"""Read-only export of the snowbound source, preserving evaluated normals and UVs.

This is a local runtime candidate. It does not assert human Form approval or
equivalence between Cycles illumination and the browser's fixture lighting.
"""
from collections import defaultdict, Counter
from pathlib import Path
import hashlib, json, shutil
import bpy

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'docs/3d-town/snowbound-manor-v1'
OUT = ROOT / 'public/assets/snowbound-manor/v1'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p, value): p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def main():
    source = P/'snowbound-manor.blend'; identity = sha(source)
    author, function, form = (read(P/f) for f in ['authoring-receipt.json','function-review.json','form-review.json'])
    assert author['source']['sha256'] == function['sourceSha256'] == form['sourceSha256'] == identity
    assert function['passedAutomatedSubset'] and not function['failures']
    assert sha(P/'scene-contract.json') == function['sceneContractSha256']
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    bucket = defaultdict(lambda: {'v':[], 'f':[], 'uv':[], 'n':[], 'smooth':[]})
    skipped, source_counts = [], Counter()
    for obj in list(bpy.context.scene.objects):
        if obj.type not in ('MESH','FONT','CURVE'): continue
        layer = obj.get('layer')
        if layer in ('weather','atmosphere'):
            skipped.append({'name':obj.name,'layer':layer,'reason':'runtime weather/atmosphere replacement'}); continue
        if not layer: raise RuntimeError('Unclassified mesh: '+obj.name)
        ev = obj.evaluated_get(dg); data = ev.to_mesh(); uv = data.uv_layers.active
        normal_matrix = ev.matrix_world.to_3x3().inverted().transposed()
        source_counts[layer] += 1
        for mi, material in enumerate(data.materials):
            polys = [poly for poly in data.polygons if poly.material_index == mi]
            if not polys: continue
            values = bucket[(layer, material.name)]
            used = sorted({vi for poly in polys for vi in poly.vertices})
            mapping = {vi:len(values['v'])+i for i,vi in enumerate(used)}
            values['v'].extend(tuple(ev.matrix_world @ data.vertices[vi].co) for vi in used)
            for poly in polys:
                values['f'].append(tuple(mapping[vi] for vi in poly.vertices))
                values['smooth'].append(poly.use_smooth)
                values['uv'].extend(tuple(uv.data[li].uv) if uv else (0,0) for li in poly.loop_indices)
                values['n'].extend(tuple((normal_matrix @ data.corner_normals[li].vector).normalized()) for li in poly.loop_indices)
        ev.to_mesh_clear()
    collection = bpy.data.collections.new('Snowbound runtime candidate'); bpy.context.scene.collection.children.link(collection)
    roots, export_objects, material_stats = {}, [], []
    for layer, mat in bucket:
        if layer not in roots:
            root=bpy.data.objects.new('layer_'+layer,None);root['layer']=layer
            collection.objects.link(root);roots[layer]=root;export_objects.append(root)
        values=bucket[(layer,mat)];name='manor_'+layer+'_'+mat
        data=bpy.data.meshes.new(name);data.from_pydata(values['v'],[],values['f']);data.update()
        data.materials.append(bpy.data.materials[mat]);uv=data.uv_layers.new(name='UVMap')
        for loop,value in zip(uv.data,values['uv']): loop.uv=value
        for poly,smooth in zip(data.polygons,values['smooth']): poly.use_smooth=smooth
        data.normals_split_custom_set(values['n'])
        obj=bpy.data.objects.new(name,data);obj['layer']=layer;obj.parent=roots[layer]
        collection.objects.link(obj);export_objects.append(obj)
        material_stats.append({'name':mat,'layer':layer,'triangles':sum(len(f)-2 for f in values['f'])})
    # Export selected derivatives only; never save over the reviewed source.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in export_objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=export_objects[-1]
    OUT.mkdir(parents=True,exist_ok=True);(P/'runtime').mkdir(exist_ok=True)
    raw=P/'runtime/manor-raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,
        export_extras=True,export_cameras=False,export_lights=False,export_animations=False,
        export_yup=True,export_apply=True)
    assert sha(source)==identity, 'Native source changed during export'
    navigation=read(P/'scene-contract.json')
    navigation['player']['spawn']=[0,-7.8]
    navigation['interiors']=[dict(navigation['interior'],id='hall',label='壁炉大厅')]
    navigation['runtimeGround']={'exterior':.04,'porch':.30,'interior':navigation['floor'], 'porchBounds':[-2.25,2.25,-4.9,.16]}
    write(OUT/'navigation.json',navigation)
    for filename in ['CREDITS.md','font-OFL.txt']:
        candidate=P/'licensed'/filename
        if not candidate.exists():candidate=ROOT/'docs/3d-town/classic-railway-v2/licensed'/filename
        shutil.copy2(candidate,OUT/filename)
    record={'schema':'snowbound-runtime-export.v1','status':'local-preview-candidate','sourceSha256':identity,
        'rawAsset':{'path':str(raw.relative_to(ROOT)).replace('\\','/'),'sha256':sha(raw),'bytes':raw.stat().st_size},
        'exporterSha256':sha(Path(__file__)),'sourceLayers':dict(source_counts),'materialBatches':material_stats,
        'triangles':sum(m['triangles'] for m in material_stats),'skipped':skipped,
        'fixtures':read(P/'lighting.json')['fixtures'],'fixturesSha256':sha(P/'lighting.json'),
        'proofs':{f:sha(P/f) for f in ['authoring-receipt.json','function-review.json','form-review.json','scene-contract.json']},
        'humanArtApproved':False,'agentWorldBound':False,'lightmapBaked':False,
        'lighting':'Runtime fixture calibration; no baked-lighting parity claim.'}
    write(P/'runtime/raw-export.json',record)
    print(json.dumps({'rawBytes':raw.stat().st_size,'triangles':record['triangles'],'materialBatches':len(material_stats),'sourceSha256':identity}),flush=True)

if __name__=='__main__': main()
