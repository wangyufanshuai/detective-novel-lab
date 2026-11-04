"""Export the reviewed three-room source with independent visibility roots and UVs."""
from collections import defaultdict
from pathlib import Path
import hashlib,json,shutil
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-bookshop-v2'
OUTPUT=ROOT/'public/assets/classic-bookshop/v2'
LICENSED=ROOT/'docs/3d-town/classic-railway-v2/licensed'
LAYERS=('street','bookshop','inn_front','inn_shell','inn_side_cutaway','inn_upper','inn_neighbor_cutaway','interior','ceiling','bookshop_front','bookshop_upper','bookshop_shell','bookshop_side_cutaway','bookshop_interior','bookshop_ceiling','shop_neighbor_cutaway','shop_neighbor_furniture','station_front','station_shell','station_side_cutaway','station_interior','station_ceiling','station_roof')
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    source=PACKAGE/'classic-bookshop.blend';identity=sha(source)
    author=read(PACKAGE/'authoring-receipt.json');function=read(PACKAGE/'function-review.json');form=read(PACKAGE/'form-review.json')
    assert author['source']['sha256']==identity==function['sourceSha256']==form['sourceSha256']
    assert function['passed'] and form['candidatePreviewEligible'] and read(PACKAGE/'render-receipt.json')['complete']
    assert function['stage']=='function-candidate'
    assert form['functionReviewSha256']==sha(PACKAGE/'function-review.json')
    assert function['sceneContractSha256']==sha(PACKAGE/'scene-contract.json')
    assert form['renderReceiptSha256']==function['renderReceiptSha256']==sha(PACKAGE/'render-receipt.json')
    for item in author['inputs']:assert item['sha256']==sha(ROOT/item['path']),item['path']
    bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    (PACKAGE/'runtime').mkdir(exist_ok=True)
    factors={m.name:list(n.inputs[7].default_value) for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='MIX' and n.data_type=='RGBA' and n.blend_type=='MULTIPLY'}
    write(PACKAGE/'runtime/material-source.json',{'sourceSha256':identity,'baseColorFactors':factors,'wallpaperSha256':sha(PACKAGE/'textures/original-olive-print.png'),'exporterSha256':sha(Path(__file__))})
    scene=read(PACKAGE/'scene-contract.json');origin=Vector((*scene['player']['spawn'],scene['floor']))
    collection=bpy.data.collections.new('Reviewed three-room runtime export');bpy.context.scene.collection.children.link(collection)
    objects=[];roots={};joints={}
    for name in LAYERS:
        root=bpy.data.objects.new('layer_'+name,None);collection.objects.link(root);root['layer']=name;roots[name]=root;objects.append(root)
    assert all(layer in roots for room in scene['interiors'] for layer in room['cutawayLayers'])
    actor=bpy.data.objects.new('sample_player',None);collection.objects.link(actor);actor.location=origin;actor['binding']='source-static-scale-reference';objects.append(actor)
    for part,pivot in scene['actorPivots'].items():
        if part=='body':continue
        joint=bpy.data.objects.new('sample_'+part,None);joint.parent=actor;joint.location=pivot;collection.objects.link(joint);joints[part]=joint;objects.append(joint)
    buckets=defaultdict(lambda:{'vertices':[],'faces':[],'uv':[],'smooth':[]})
    for obj in list(bpy.context.scene.objects):
        if obj in objects or obj.type not in ('MESH','FONT','CURVE') or obj.get('runtimeExcluded') or obj.get('layer')=='review_resident':continue
        layer=obj.get('layer');part=obj.get('part','static')
        assert layer in roots or layer=='actor',('Unclassified export object',obj.name,layer)
        ev=obj.evaluated_get(dg);mesh=ev.to_mesh();uv=mesh.uv_layers.active
        offset=origin+Vector(scene['actorPivots'][part]) if layer=='actor' else Vector((0,0,0))
        for mi,mat in enumerate(mesh.materials):
            polygons=[p for p in mesh.polygons if p.material_index==mi]
            if not polygons:continue
            bucket=buckets[(layer,part,mat.name)];used=sorted({vi for p in polygons for vi in p.vertices});mapping={vi:len(bucket['vertices'])+i for i,vi in enumerate(used)}
            bucket['vertices'].extend(tuple(ev.matrix_world@mesh.vertices[vi].co-offset) for vi in used)
            for p in polygons:
                bucket['faces'].append(tuple(mapping[vi] for vi in p.vertices));bucket['smooth'].append(p.use_smooth)
                bucket['uv'].extend(tuple(uv.data[li].uv) if uv else (0,0) for li in p.loop_indices)
        ev.to_mesh_clear()
    for (layer,part,mat),v in buckets.items():
        name='sample_'+layer+'_'+part+'_'+mat;mesh=bpy.data.meshes.new(name);mesh.from_pydata(v['vertices'],[],v['faces']);mesh.update();mesh.materials.append(bpy.data.materials[mat])
        uv=mesh.uv_layers.new(name='UVMap')
        for loop,value in zip(uv.data,v['uv']):loop.uv=value
        for poly,smooth in zip(mesh.polygons,v['smooth']):poly.use_smooth=smooth
        obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);obj.parent=(actor if part=='body' else joints[part]) if layer=='actor' else roots[layer];obj['origin']='project-local-authored';obj['layer']=layer;objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True);obj.hide_render=False
    OUTPUT.mkdir(parents=True,exist_ok=True);target=OUTPUT/'classic-street.glb'
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_apply=True)
    asset_sha=sha(target);scene.update({'assetSha256':asset_sha,'sourceSha256':identity});write(OUTPUT/'navigation.json',scene)
    lights=read(PACKAGE/'lighting.json')['fixtures'];overrides={'hearth-embers':{'color':'#ff5620','runtimeIntensity':1.3}}
    for fixture in lights:
        if fixture['id'] in overrides:fixture.update(overrides[fixture['id']])
    for file in ('CREDITS.md','font-OFL.txt'):shutil.copy2(LICENSED/file,OUTPUT/file)
    manifest={'schema':'classic-bookshop-runtime.v2','status':'local-art-and-navigation-sample','sourceSha256':identity,'asset':{'url':'/assets/classic-bookshop/v2/classic-street.glb','sha256':asset_sha,'bytes':target.stat().st_size},'navigation':{'url':'/assets/classic-bookshop/v2/navigation.json','sha256':sha(OUTPUT/'navigation.json')},'sourceTriangles':function['evaluatedTriangles'],'exportedMaterialMeshes':len(buckets),'lights':lights,'exporterSha256':sha(Path(__file__)),'proofs':{file:sha(PACKAGE/file) for file in ('authoring-receipt.json','render-receipt.json','function-review.json','form-review.json','scene-contract.json','lighting.json')},'worldBound':False,'humanArtApproved':False,'fontDependency':function['fontDependency'],'thirdPartyAssets':read(LICENSED/'provenance.json')['assets'],'materialProvenanceSha256':sha(LICENSED/'provenance.json'),'licenseDocuments':['/assets/classic-bookshop/v2/CREDITS.md','/assets/classic-bookshop/v2/font-OFL.txt'],'runtimeFixtureCalibration':{'overrides':overrides,'reason':'Retain the reviewed localized ember tint. Window area emitter is approximated by an explicitly recorded point source. Artistic calibration, not radiometric equivalence.'},'lighting':'Runtime PBR, hemisphere/key/fixture lights and RoomEnvironment reflections; no baked-lightmap or offline-render equivalence claim.'}
    manifest['materialSourceSha256']=sha(PACKAGE/'runtime/material-source.json')
    manifest['renderReferenceExcluded']=True
    manifest['originalPattern']={'path':'textures/original-olive-print.png','sha256':sha(PACKAGE/'textures/original-olive-print.png'),'authorship':'Original stem/leaf repeat drawn locally; not an external asset.'}
    write(OUTPUT/'manifest.json',manifest);write(PACKAGE/'runtime-export.json',manifest)
    print(json.dumps({'asset':manifest['asset'],'materialMeshes':len(buckets),'sourceTriangles':function['evaluatedTriangles']}),flush=True)

if __name__=='__main__':main()
