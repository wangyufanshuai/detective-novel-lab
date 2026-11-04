"""Reviewed v3 native source -> UV2/indirect-light/runtime-fire candidate."""
from collections import defaultdict,Counter
from pathlib import Path
import hashlib,json,shutil,importlib.util
import bpy
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v3';OUT=ROOT/'public/assets/snowbound-manor/v3'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    source=P/'snowbound-manor.blend';identity=sha(source)
    author,function,form,contact=(read(P/f) for f in ['authoring-receipt.json','function-review.json','form-review.json','contact-review.json'])
    assert author['source']['sha256']==function['sourceSha256']==form['sourceSha256']==contact['sourceSha256']==identity
    assert function['passedAutomatedSubset'] and not function['failures'] and contact['passed']
    assert sha(P/'scene-contract.json')==function['sceneContractSha256']==contact['navigationSha256']
    bpy.ops.wm.open_mainfile(filepath=str(source));(P/'runtime').mkdir(exist_ok=True)
    spec=importlib.util.spec_from_file_location('indirect',ROOT/'scripts/bake-manor-indirect.py')
    baker=importlib.util.module_from_spec(spec);spec.loader.exec_module(baker);bake=baker.bake(P)
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    bucket=defaultdict(lambda:{'v':[],'f':[],'uv':[],'uv2':[],'n':[],'smooth':[]})
    skipped=[];counts=Counter()
    for obj in list(bpy.context.scene.objects):
        if obj.type not in ('MESH','FONT','CURVE'):continue
        layer=obj.get('layer')
        if layer in ('weather','atmosphere','fire_volume'):
            skipped.append({'name':obj.name,'layer':layer,'reason':'manifest-bound runtime replacement'});continue
        if not layer:raise RuntimeError('Unclassified mesh '+obj.name)
        ev=obj.evaluated_get(dg);data=ev.to_mesh();uv=data.uv_layers[0] if data.uv_layers else None;uv2=data.uv_layers.get('LightmapUV')
        normal=ev.matrix_world.to_3x3().inverted().transposed();counts[layer]+=1
        for index,material in enumerate(data.materials):
            polys=[p for p in data.polygons if p.material_index==index]
            if not polys:continue
            values=bucket[(layer,material.name)]
            used=sorted({i for p in polys for i in p.vertices});mapping={i:len(values['v'])+j for j,i in enumerate(used)}
            values['v'].extend(tuple(ev.matrix_world@data.vertices[i].co) for i in used)
            for poly in polys:
                values['f'].append(tuple(mapping[i] for i in poly.vertices));values['smooth'].append(poly.use_smooth)
                values['uv'].extend(tuple(uv.data[i].uv) if uv else (0,0) for i in poly.loop_indices)
                values['uv2'].extend(tuple(uv2.data[i].uv) if uv2 else (0,0) for i in poly.loop_indices)
                values['n'].extend(tuple((normal@data.corner_normals[i].vector).normalized()) for i in poly.loop_indices)
        ev.to_mesh_clear()
    collection=bpy.data.collections.new('Snowbound v3 runtime');bpy.context.scene.collection.children.link(collection)
    roots={};objects=[];stats=[];baked_materials={}
    for (layer,mat),values in bucket.items():
        if layer not in roots:
            root=bpy.data.objects.new('layer_'+layer,None);root['layer']=layer;collection.objects.link(root);roots[layer]=root;objects.append(root)
        name='manor_'+layer+'_'+mat;data=bpy.data.meshes.new(name);data.from_pydata(values['v'],[],values['f']);data.update()
        material=bpy.data.materials[mat]
        if layer=='baked_architecture':
            if mat not in baked_materials:baked_materials[mat]=material.copy();baked_materials[mat].name=mat+'_baked'
            material=baked_materials[mat]
        data.materials.append(material);uv=data.uv_layers.new(name='UVMap')
        for loop,value in zip(uv.data,values['uv']):loop.uv=value
        if layer=='baked_architecture':
            uv2=data.uv_layers.new(name='LightmapUV')
            for loop,value in zip(uv2.data,values['uv2']):loop.uv=value
            data.uv_layers.active_index=0;uv.active_render=True
        for poly,smooth in zip(data.polygons,values['smooth']):poly.use_smooth=smooth
        data.normals_split_custom_set(values['n'])
        obj=bpy.data.objects.new(name,data);obj['layer']=layer;obj['usesIndirectAtlas']=layer=='baked_architecture';obj.parent=roots[layer]
        collection.objects.link(obj);objects.append(obj)
        stats.append({'name':material.name,'layer':layer,'triangles':sum(len(f)-2 for f in values['f'])})
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[-1];OUT.mkdir(parents=True,exist_ok=True);raw=P/'runtime/manor-raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,
        export_lights=False,export_animations=False,export_yup=True,export_apply=True,export_texcoords=True)
    assert sha(source)==identity
    nav=read(P/'scene-contract.json');nav['player']['spawn']=[0,-7.8];nav['interiors']=[dict(nav['interior'],id='hall',label='壁炉大厅')]
    nav['runtimeGround']={'exterior':.04,'porch':.30,'interior':nav['floor'],'porchBounds':[-2.25,2.25,-4.9,.16]};write(OUT/'navigation.json',nav)
    for name in ['CREDITS.md','font-OFL.txt']:shutil.copy2(ROOT/'public/assets/snowbound-manor/v1'/name,OUT/name)
    shutil.copy2(P/'runtime/indirect-light.exr',OUT/'indirect-light.exr');shutil.copy2(P/'textures/hearth-density.r8',OUT/'hearth-density.r8')
    record={'schema':'snowbound-runtime-export.v3','status':'local-preview-candidate','sourceSha256':identity,
            'rawAsset':{'path':raw.relative_to(ROOT).as_posix(),'sha256':sha(raw),'bytes':raw.stat().st_size},'exporterSha256':sha(Path(__file__)),
            'sourceLayers':dict(counts),'materialBatches':stats,'triangles':sum(m['triangles'] for m in stats),'skipped':skipped,
            'fixtures':read(P/'lighting.json')['fixtures'],'fixturesSha256':sha(P/'lighting.json'),
            'proofs':{f:sha(P/f) for f in ['authoring-receipt.json','function-review.json','form-review.json','contact-review.json','scene-contract.json']},
            'fire':read(P/'textures/fire-field.json'),'lightmap':bake,'humanArtApproved':False,'agentWorldBound':False,
            'lightmapBaked':True,'lighting':'Indirect diffuse on named architecture receivers; calibrated runtime direct fixtures; no complete Cycles equivalence.'}
    write(P/'runtime/raw-export.json',record);print(json.dumps({'rawBytes':raw.stat().st_size,'triangles':record['triangles'],'batches':len(stats)}),flush=True)

if __name__=='__main__':main()
