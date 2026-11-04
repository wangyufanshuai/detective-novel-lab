"""Bake static opaque disk-source visibility onto the actual v9 lighting atlas."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/3d-rooms/candidates/blender-v11'
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
calibration=read('area-visibility-calibration.json')
if not calibration['passed'] or calibration['sourceSha256']!=sha(ROOT/'scripts/calibrate-blender-area-visibility.py'):
    raise RuntimeError('Current independent visibility controls required')
source=OUT/'runtime-baked.blend';bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=256;scene.cycles.use_denoising=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
atlas=bpy.data.objects['Baked atlas source'];size=read('material-bake-receipt.json')['atlasSize'][0]
for obj in scene.objects:
    if obj.type=='MESH':obj.hide_render=obj!=atlas;obj.hide_set(obj!=atlas)
material=bpy.data.materials.new('Unit visibility receiver');material.use_nodes=True
tree=material.node_tree;tree.nodes.clear();diffuse=tree.nodes.new('ShaderNodeBsdfDiffuse');diffuse.inputs['Color'].default_value=(1,1,1,1)
out=tree.nodes.new('ShaderNodeOutputMaterial');tree.links.new(diffuse.outputs[0],out.inputs['Surface'])
tex=tree.nodes.new('ShaderNodeTexImage');tree.nodes.active=tex
atlas.data.materials.clear();atlas.data.materials.append(material)
for face in atlas.data.polygons:face.material_index=0
bpy.ops.object.select_all(action='DESELECT');atlas.select_set(True);bpy.context.view_layer.objects.active=atlas
scene.render.bake.margin=6;scene.render.bake.use_clear=True;scene.render.bake.use_selected_to_active=False
fixtures=[f for f in read('lighting-manifest.json')['fixtures'] if f['type']=='AREA'];masks=[];records=[]
for fixture in fixtures:
    for obj in scene.objects:
        if obj.type=='LIGHT':obj.hide_render=obj.name!=fixture['id']
    arrays={}
    for mode in ['occluded','unoccluded']:
        atlas.visible_shadow=mode=='occluded'
        target=bpy.data.images.new(fixture['id']+' '+mode,width=size,height=size,alpha=False,float_buffer=True)
        target.colorspace_settings.name='Linear Rec.709';tex.image=target
        bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT'},uv_layer='RoomLightUV')
        values=np.empty(size*size*4,dtype=np.float32);target.pixels.foreach_get(values)
        arrays[mode]=values.reshape(size,size,4)[:,:,:3].mean(axis=2).copy();bpy.data.images.remove(target)
    denominator=arrays['unoccluded'];numerator=arrays['occluded'];valid=denominator>1e-4
    ratio=np.zeros_like(denominator);np.divide(numerator,denominator,out=ratio,where=valid)
    if not np.isfinite(ratio).all():raise RuntimeError('Non-finite visibility')
    masks.append(np.clip(ratio,0,1));records.append({'fixture':fixture['id'],'validPixels':int(valid.sum()),
        'fractionStronglyOccluded':float((ratio[valid]<.1).mean()),'fractionAbove1Point1':float((ratio[valid]>1.1).mean()),
        'ratioQuantiles':np.quantile(ratio[valid],[0,.1,.5,.9,1]).tolist()})
    print('AREA_VISIBILITY_BAKED='+json.dumps(records[-1]),flush=True)
assets=[];gpu_references=[]
for group in range(2):
    pixels=np.zeros((size,size,4),dtype=np.float32);pixels[:,:,3]=1
    for channel in range(3):
        index=group*3+channel
        if index<len(masks):pixels[:,:,channel]=masks[index]
    target=bpy.data.images.new('Static area visibility '+str(group),width=size,height=size,alpha=False,float_buffer=False)
    target.colorspace_settings.name='Non-Color';target.pixels.foreach_set(pixels.ravel())
    file=OUT/f'textures/area-visibility-{group}.png';target.filepath_raw=str(file);target.file_format='PNG';target.save()
    # Reopen the actual encoded PNG as data; verify that no display transform was applied.
    decoded=bpy.data.images.load(str(file),check_existing=False);decoded.colorspace_settings.name='Non-Color'
    values=np.empty(size*size*4,dtype=np.float32);decoded.pixels.foreach_get(values)
    quantization_error=float(np.abs(values.reshape(size,size,4)[:,:,:3]-pixels[:,:,:3]).max())
    if quantization_error>1/255+.00001:raise RuntimeError('Visibility PNG encoding changed linear data')
    rgb=values.reshape(size,size,4)[:,:,:3]
    # Select asymmetric texels so a vertical-flip error cannot pass with zeros.
    for channel in range(2 if group else 3):
        difference=np.abs(rgb[:,:,channel]-rgb[::-1,:,channel])
        y,x=np.unravel_index(np.argmax(difference),difference.shape)
        gpu_references.append({'texture':group,'uv':[(int(x)+.5)/size,(int(y)+.5)/size],
            'expectedRGB':rgb[y,x,:].tolist(),'verticalFlipContrast':float(difference[y,x])})
    assets.append({'id':'blender-area-visibility-'+str(group),'kind':'texture','path':file.relative_to(OUT).as_posix(),
        'sha256':sha(file),'bytes':file.stat().st_size,'license':'project-local-original','source':'Cycles static opaque disk-source visibility ratio',
        'status':'candidate-only','humanApproval':False,'runtimeVerified':False,'maximumEncodingError':quantization_error})
report={'schema':'game-room.area-visibility-bake.v1','sourceBlendSha256':sha(source),'sourceSha256':sha(Path(__file__)),
    'lightingManifestSha256':sha(OUT/'lighting-manifest.json'),'calibrationSha256':sha(OUT/'area-visibility-calibration.json'),
    'size':[size,size],'samplesPerBake':256,'fixtureOrder':[f['id'] for f in fixtures],'records':records,'textures':assets,
    'encoding':'linear data RGB PNG, no display transform; RGB of texture 0 then RG of texture 1','uvChannel':1,
    'gpuReferences':gpu_references,'humanApproval':False,'runtimeVerified':False,'viewDependentGlossyVisibilityExact':False,'glassOcclusionIncluded':False,
    'limitations':['Opaque static receiver atlas only; retained glass has no visibility UV.',
                   'Diffuse-weighted source visibility approximates partial glossy shadowing; it is not a view-dependent ray-traced solution.',
                   'A changed fixture or geometry requires a new bake.']}
(OUT/'area-visibility-receipt.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
manifest=read('asset-manifest.json');manifest['assets']=[a for a in manifest['assets'] if not a['id'].startswith('blender-area-visibility-')]+assets
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
ledger=read('license-ledger.json');ledger['assets']=manifest['assets']
(OUT/'license-ledger.json').write_text(json.dumps(ledger,indent=2),encoding='utf-8')
print('AREA_VISIBILITY_COMPLETE='+json.dumps({'textures':len(assets),'bytes':sum(a['bytes'] for a in assets)}),flush=True)
