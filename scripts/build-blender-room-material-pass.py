"""Additive v7 optical modeling, calibrated reflection and multi-view review."""
from pathlib import Path
import argparse
import importlib.util
import json
import math
import sys
import time

import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.blender_room_art_details import refine
from lib.blender_room_microtexture_bake import bake_runtime
from lib.blender_room_prop_uv import author as author_prop_uv
from lib.blender_room_v5_dressing import refine as dress_room
from lib.blender_room_capsule_review import review as capsule_review
from lib.blender_room_surface_details import refine as refine_surfaces
from lib.blender_room_optics_probe import render_probe
from lib.blender_room_optics_details import refine as refine_optics

spec=importlib.util.spec_from_file_location('room_review_base',ROOT/'scripts/build-blender-room-review.py')
base=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--draft',action='store_true')
    parser.add_argument('--resume-bake',action='store_true')
    parser.add_argument('--views',default='all')
    parser.add_argument('--width',type=int,default=1600)
    parser.add_argument('--samples',type=int,default=64)
    parser.add_argument('--atlas',type=int,default=2048)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    source=ROOT/'docs/3d-rooms/candidates/blender-v8'
    output=ROOT/'outputs/blender-v8-draft' if args.draft else source
    output.mkdir(parents=True,exist_ok=True)
    (output/'renders').mkdir(exist_ok=True)
    base.OUT=output
    config=json.loads((source/'composition.json').read_text(encoding='utf-8-sig'))
    if args.resume_bake:
        checkpoint=base.read(output/'authoring-receipt.json')
        for item in checkpoint['inputs']:
            if base.sha(ROOT/item['path'])!=item['sha256']:
                raise RuntimeError('Authoring input changed; rebuild renders: '+item['path'])
        for item in checkpoint['artifacts']:
            if base.sha(output/item['path'])!=item['sha256']:
                raise RuntimeError('Authoring artifact changed: '+item['path'])
        blend=output/'fog-lamp-evidence-room.blend'
        bpy.ops.wm.open_mainfile(filepath=str(blend))
        base.GEOMETRY[:]=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj.get('asset_origin')=='project-local-authored']
        prefs=bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type='OPTIX'
        prefs.get_devices()
        for device in prefs.devices:
            device.use=device.type=='OPTIX'
        bpy.context.scene.cycles.device='GPU'
        args.samples=checkpoint['renderSettings']['samples']
        args.width=checkpoint['renderSettings']['width']
        finish_art(args,source,output,config,blend,checkpoint['renders'],base.read(output/'geometry-audit.json'))
        return
    cameras=base.build_scene(config,base.read(base.SOURCE/'authored-candidate.json'))
    details=refine(base,config,cameras)
    dressing=dress_room(base)
    optics=refine_optics(base,cameras)
    prop_uv=author_prop_uv(base)
    base.write(output/'prop-uv-authoring.json',prop_uv)
    if not optics['passed']:raise RuntimeError('Optical geometry or support check failed: '+json.dumps(optics))
    surfaces=refine_surfaces(base)
    if not surfaces['passed']:raise RuntimeError('Surface repair or pencil support check failed: '+json.dumps(surfaces))
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8
    scene.render.resolution_x=args.width
    scene.render.resolution_y=round(args.width*9/16)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGB'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.45
    bpy.context.preferences.filepaths.save_version=0
    scene.camera=cameras['production']
    blend=output/'fog-lamp-evidence-room.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    entries=[]
    views=list(cameras)+['clay-production'] if args.views=='all' else args.views.split(',')
    for name in views:
        scene.camera=cameras['production' if name=='clay-production' else name]
        bpy.context.view_layer.material_override=base.MATERIALS['Clay'] if name=='clay-production' else None
        path=output/'renders'/(name+'.png')
        scene.render.filepath=str(path)
        start=time.perf_counter()
        bpy.ops.render.render(write_still=True)
        entries.append({'view':name,'path':path.relative_to(output).as_posix(),'sha256':base.sha(path),
                        'seconds':round(time.perf_counter()-start,2),'size':[args.width,scene.render.resolution_y],
                        'horizontalFovDegrees':math.degrees(scene.camera.data.angle_x)})
        print('ART_RENDER='+json.dumps(entries[-1]),flush=True)
    bpy.context.view_layer.material_override=None
    scene.camera=cameras['production']
    if args.draft:
        print('ART_DRAFT_COMPLETE='+str(output),flush=True)
        return
    audit=base.audit(config,cameras)
    audit['spatialReview']['heroSightlines']=details['heroSurfaceSightlines']
    spatial=audit['spatialReview']
    spatial['passed']=not spatial['independentPropBVHIntersections'] and all(v['passed'] for v in spatial['supportContact']+spatial['routes']+spatial['openingRays']) and all(v['heroCenterUnoccluded'] for v in spatial['heroSightlines'])
    spatial['method']+='; semantic first-hit visibility on the actual furnished table surface'
    base.write(output/'geometry-audit.json',audit)
    base.write(output/'art-detail-audit.json',details)
    base.write(output/'dressing-audit.json',dressing)
    base.write(output/'surface-audit.json',surfaces)
    base.write(output/'optics-audit.json',optics)
    capsule=capsule_review(base.GEOMETRY,spatial['routes'])
    base.write(output/'capsule-review.json',capsule)
    if not spatial['passed'] or audit['nonManifoldObjects'] or not details['internalShelfClearancePassed'] or not dressing['passed'] or not capsule['passed']:
        raise RuntimeError('Art geometry preflight failed; inspect geometry and detail audits before exporting.')
    base.write(output/'lighting-manifest.json',{'schema':'game-room.lighting-manifest.v1','roomId':config['roomId'],
               'status':'authoring-candidate','fixtures':base.LIGHTS,'environment':'local uniform world; no HDRI','runtimeBakeVerified':False})
    probe=render_probe(base,output)
    author_inputs=[Path(__file__),ROOT/'scripts/build-blender-room-review.py',ROOT/'scripts/lib/blender_room_art_details.py',
                   ROOT/'scripts/lib/blender_room_spatial_review.py',ROOT/'scripts/lib/blender_room_v5_dressing.py',ROOT/'scripts/lib/blender_room_capsule_review.py',ROOT/'scripts/calibrate-blender-optics-bake.py',source/'composition.json',base.SOURCE/'authored-candidate.json']
    author_inputs += [ROOT/'scripts/lib/blender_room_surface_details.py',ROOT/'scripts/lib/blender_room_optics_probe.py',ROOT/'scripts/lib/blender_room_optics_details.py',ROOT/'scripts/calibrate-blender-optics.py',ROOT/'scripts/lib/blender_room_prop_uv.py']
    artifacts=[blend,output/'geometry-audit.json',output/'art-detail-audit.json',output/'dressing-audit.json',output/'capsule-review.json',output/'lighting-manifest.json',output/'lightmap-calibration.json',output/'surface-audit.json',output/'reflection-probe-receipt.json',output/probe['path']]+[output/entry['path'] for entry in entries]
    artifacts += [output/'optics-audit.json',output/'reflection-calibration.json',output/probe['sourceProxyComparison']['path']]
    base.write(output/'authoring-receipt.json',{'schema':'game-room.authoring-checkpoint.v1',
        'inputs':[{'path':p.relative_to(ROOT).as_posix(),'sha256':base.sha(p)} for p in author_inputs],
        'artifacts':[{'path':p.relative_to(output).as_posix(),'sha256':base.sha(p)} for p in artifacts],
        'renders':entries,'renderSettings':{'samples':args.samples,'width':args.width,'device':'OPTIX'}})
    finish_art(args,source,output,config,blend,entries,audit)


def finish_art(args,source,output,config,blend,entries,audit):
    bake=bake_runtime(base,output,args.atlas)
    bake['lightmap']['runtimePolicy']='baked total diffuse plus source-excluded local reflection and calibrated spatial disk specular; suppress duplicate diffuse and analytic spot specular'
    base.write(output/'material-bake-receipt.json',bake)
    glb=output/'review-room-candidate.glb'
    base.package_manifests(config,blend,glb,audit)
    manifest=base.read(output/'asset-manifest.json')
    manifest['version']='8.0.0-blender-material-candidate'
    manifest['assets'][0]['id']='blender-room-art-pass'
    manifest['assets'][0]['source']='original Blender v8 art, baked PBR and HDR diffuse illumination'
    lightmap=bake['lightmap']
    calibration=base.read(output/'lightmap-calibration.json')
    if not calibration['passed']:
        raise RuntimeError('Lighting calibration failed.')
    lightmap['threeLightMapIntensity']=calibration['threeLightMapIntensity']
    lightmap['calibrationSha256']=base.sha(output/'lightmap-calibration.json')
    base.write(output/'material-bake-receipt.json',bake)
    manifest['assets'].append({'id':'blender-diffuse-lightmap','kind':'texture','path':lightmap['path'],
        'sha256':lightmap['sha256'],'bytes':lightmap['bytes'],'license':'project-local-original',
        'source':'Cycles diffuse direct and indirect bake from the current fixture manifest; no surface color',
        'status':'candidate-only','humanApproval':False,'runtimeVerified':False})
    probe=base.read(output/'reflection-probe-receipt.json')
    manifest['assets'].append({'id':'blender-local-reflection','kind':'texture','path':probe['path'],
        'sha256':probe['sha256'],'bytes':probe['bytes'],'license':'project-local-original',
        'source':'Local HDR radiance capture from the original Blender room; no external HDRI',
        'status':'candidate-only','humanApproval':False,'runtimeVerified':False})
    base.write(output/'asset-manifest.json',manifest)
    ledger=base.read(output/'license-ledger.json')
    ledger['assets']=manifest['assets']
    ledger['localAuthoring']+=['bound volumes and original decorative typography','modeled investigative desk props','original local PBR texture bakes',
                             'biconvex lens, turned brass housing and grooved grip','camera-only area-source proxy surfaces used only for the reflection capture']
    ledger['exportLimitations']=['PBR base color, roughness, metallic and tangent normals are baked from the authoring materials.',
                                 'Glass and emissive fixtures retain their dedicated materials.','Diffuse is baked in HDR; the local static reflection probe has no parallax correction or moving objects.',
                                 'Lens uses real curved surfaces in Cycles; browser transmission uses a uniform 12 mm center-thickness approximation.']
    base.write(output/'license-ledger.json',ledger)
    inputs=[Path(__file__),ROOT/'scripts/build-blender-room-review.py',ROOT/'scripts/lib/blender_room_art_details.py',
            ROOT/'scripts/lib/blender_room_microtexture_bake.py',ROOT/'scripts/lib/blender_room_prop_uv.py',ROOT/'scripts/lib/blender_room_spatial_review.py',ROOT/'scripts/lib/blender_room_v5_dressing.py',ROOT/'scripts/lib/blender_room_capsule_review.py',source/'composition.json',base.SOURCE/'authored-candidate.json']
    inputs += [ROOT/'scripts/lib/blender_room_surface_details.py',ROOT/'scripts/lib/blender_room_optics_probe.py',ROOT/'scripts/lib/blender_room_optics_details.py',ROOT/'scripts/calibrate-blender-optics.py']
    receipt={'schema':'game-room.blender-art-render-receipt.v1','roomId':config['roomId'],'variant':config['variant'],
             'blenderVersion':bpy.app.version_string,'background':bpy.app.background,'device':'OPTIX','samples':args.samples,
             'inputs':[{'path':p.relative_to(ROOT).as_posix(),'sha256':base.sha(p)} for p in inputs],
             'blendSha256':base.sha(blend),'reviewGlbSha256':base.sha(glb),
             'geometryAuditSha256':base.sha(output/'geometry-audit.json'),
             'detailAuditSha256':base.sha(output/'art-detail-audit.json'),
             'dressingAuditSha256':base.sha(output/'dressing-audit.json'),
             'capsuleAuditSha256':base.sha(output/'capsule-review.json'),
             'surfaceAuditSha256':base.sha(output/'surface-audit.json'),
             'opticsAuditSha256':base.sha(output/'optics-audit.json'),
             'reflectionCalibrationSha256':base.sha(output/'reflection-calibration.json'),
             'reflectionProbeReceiptSha256':base.sha(output/'reflection-probe-receipt.json'),
             'lightingManifestSha256':base.sha(output/'lighting-manifest.json'),
             'materialBakeReceiptSha256':base.sha(output/'material-bake-receipt.json'),
             'renders':entries,'humanApproval':False,'runtimeVerified':False}
    base.write(output/'render-receipt.json',receipt)
    report=base.final_report(config,audit,entries)
    report['localCandidateEvidence']={'capsuleEnvelope':True,'wallAttachments':True,'diffuseLightBake':True,'outwardSurfaceRepair':True,'localReflectionProbe':True,'biconvexLens':True,'calibratedAreaSourceReflection':True,'browserLightingVerified':False}
    report['postmortem']['remainingRisks']=['Baked diffuse and the static reflection probe require their companion HDR assets; the probe has no parallax correction.',
        'Live player movement, case-bound interactions, device acceptance and human art approval remain open.']
    base.write(output/'final-report.json',report)
    print('ART_PASS_COMPLETE='+json.dumps({'views':len(entries),'triangles':audit['trianglesEvaluated'],
              'bakedObjects':bake['runtimeMeshObjects'],'glbBytes':glb.stat().st_size}),flush=True)


if __name__=='__main__':
    main()

