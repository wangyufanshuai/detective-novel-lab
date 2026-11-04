"""Record a bounded art milestone without promoting it into the running game."""
from pathlib import Path
import argparse,hashlib,json
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-05');p.add_argument('--followup-pilot');args=p.parse_args();P=BASE/args.pilot
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
layout=read(BASE/'layout-01/layout-integrity.json');architecture=read(BASE/'layout-01/render-review.json');renders=read(P/'renders/render-review.json');routes=read(P/'routes.json');mesh=read(P/'route-mesh-diagnostic.json');retention=read(P/'retention-review.json');pose=read(P/'pose-diagnostic.json');cloth=read(P/'cloth-form-review.json')
visual=read(P/'assistant-visual-review.json');assert visual['complete']and not visual['humanApproved'];assert visual['compositionSha256']==sha(P/'renders/composed.blend')
assert set(visual['inspectedPosePaths'])==set(r['path']for r in renders['renders'])
assert layout['passed']and architecture['complete']and renders['complete']and mesh['complete']
assert layout['sourceSha256']==architecture['sourceSha256']==sha(BASE/'layout-01/room.blend')
for folder,report in [(BASE/'layout-01',architecture),(P/'renders',renders)]:
 for row in report['renders']:assert sha(folder/row['path'])==row['sha256']
assert renders['sourceSha256']==sha(P/'renders/composed.blend')
for name,value in renders['retainedSources'].items():assert sha(ROOT/name)==value,name
for name,value in routes['sourceHashes'].items():assert sha(ROOT/name)==value,name
for report in (mesh,pose):
 for name,value in report['sourceHashes'].items():assert sha(ROOT/name)==value,name
assert mesh['routesSha256']==sha(P/'routes.json')and cloth['functionReviewSha256']==sha(P/'route-mesh-diagnostic.json')
for row in cloth['rows']:assert row['sourceSha256']==sha(P/row['actorId']/'resident.blend')
for row in retention['rows']:assert row['sourceSha256']==sha(P/row['actorId']/'resident.blend')
runtime=read(ROOT/'docs/3d-town/classic-motion-v1/review.json');runtime_changes=[name for name,value in runtime['sources'].items()if sha(ROOT/name)!=value]
files=[BASE/'layout-01/room.blend',BASE/'layout-01/layout-integrity.json',BASE/'layout-01/render-review.json',P/'renders/render-review.json',P/'renders/composed.blend',P/'routes.json',P/'route-mesh-diagnostic.json',P/'retention-review.json',P/'pose-diagnostic.json',P/'cloth-form-review.json',P/'assistant-visual-review.json']
for folder in sorted(P.glob('resident-*')):
 for name in ['resident.blend','authoring-review.json','garment-correctives.json','waist-fit.json','garment-builder.py','accessory-builder.py','tool-motion-builder.py']:
  if(folder/name).exists():files.append(folder/name)
for name in ['morph-construction-audit.json','skirt-field-diagnosis.json','skirt-field-inspector.py']:
 if(P/name).exists():files.append(P/name)
blends=None
if(P/'blend-diagnostic.json').exists():
 blends=read(P/'blend-diagnostic.json');assert blends['complete']and blends['formReviewSha256']==sha(P/'cloth-form-review.json')
 for name,value in blends['sourceHashes'].items():assert sha(ROOT/name)==value,name
 files.extend([P/'blend-diagnostic.json',P/'blend-inspector.py'])
probes=[]
for file in P.glob('resident-*/gltf-probe/*-review.json'):
 probe=read(file);assert probe['sourceSha256']==sha(file.parent.parent/'resident.blend');assert probe['glbSha256']==sha(file.with_name(file.name.replace('-review.json','.glb')))
 probes.append({'actorId':file.parent.parent.name,'clip':probe['clip'],'passed':probe['passed'],'samples':len(probe['samples']),'maximumVertexDistanceMeters':max(r['maximumSymmetricVertexDistance']for r in probe['samples']),'maximumRetainedClipDurationErrorSeconds':probe['maximumRetainedClipDurationErrorSeconds'],'morphTargets':probe['morphTargets'],'bytes':probe['bytes'],'report':file.relative_to(ROOT).as_posix()});files.extend([file,file.with_name(file.name.replace('-review.json','.glb'))])
motion=None;motion_file=P/'motion-preview/review.json'
if motion_file.exists():
 motion=read(motion_file);assert motion['complete']and motion['sourceSha256']==sha(P/'renders/composed.blend');assert motion['residentSourceSha256']==sha(P/'resident-06/resident.blend');assert motion['replaySceneSha256']==sha(motion_file.parent/'scene.blend');assert motion['videoSha256']==sha(motion_file.parent/motion['video'])
 for row in motion['frames']:assert row['sha256']==sha(motion_file.parent/row['file'])
 files.extend([motion_file,motion_file.parent/'scene.blend',motion_file.parent/motion['video']])
followup=None;followup_note=''
skirt_previews=[]
for preview_file in sorted(P.glob('motion-previews/*/review.json')):
 preview=read(preview_file);folder=preview_file.parent;assert preview['complete']and preview['sourceSha256']==sha(P/'renders/composed.blend');assert preview['residentSourceSha256']==sha(P/preview['actorId']/'resident.blend');assert preview['replaySceneSha256']==sha(folder/'scene.blend');assert preview['videoSha256']==sha(folder/preview['video'])
 for row in preview['frames']:assert row['sha256']==sha(folder/row['file'])
 files.extend([preview_file,folder/'scene.blend',folder/preview['video']]);skirt_previews.append({'actorId':preview['actorId'],'uniqueFrames':preview['uniqueFrames'],'previewFrameRate':preview['previewFrameRate'],'repetitions':preview['repetitions'],'path':(folder/preview['video']).relative_to(ROOT).as_posix(),'scope':preview['scope']})
if args.followup_pilot:
 folder=BASE/args.followup_pilot;diagnostic=read(folder/'foot-branch-diagnosis.json');candidate=folder/'resident-08/resident.blend';assert diagnostic['sourceSha256']==sha(candidate);assert read(candidate.parent/'authoring-review.json')['sourceSha256']==sha(candidate)
 followup={'pilot':args.followup_pilot,'actorId':'resident-08','sourceSha256':sha(candidate),'anklesPassed':diagnostic['anklesPassed'],'maximumPlantedAnkleDrift':max(c['maximumPlantedAnkleDrift']for c in diagnostic['clips']),'samples':sum(c['samples']for c in diagnostic['clips']),'fullFunctionFormReviewed':False,'scope':diagnostic['scope']}
 files.extend([candidate,candidate.parent/'authoring-review.json',folder/'foot-branch-diagnosis.json',folder/'foot-branch-inspector.py',folder/'builder.py'])
 followup_note=f"\n后续旅馆膝盖修复候选 `{args.followup_pilot}` 已保存：脚踝帧间诊断{'通过'if diagnostic['anklesPassed']else'仍未通过'}（{followup['samples']} 个姿势采样）。它尚未重新完成渲染、完整动线/衣料/鞋底验收，不能用本页 `{args.pilot}` 的报告替代。见 [下一步](NEXT.zh-CN.md)。\n"
new_cloth=[r for r in cloth['rows']if r['clip']in ('BackAway','ApproachWork','TurnLeft')];old_cloth=[r for r in cloth['rows']if r not in new_cloth]
exports=[];grounding=None;browser=None
for folder in sorted((P/'export-candidate-02').glob('resident-*')):
 if not(folder/'optimized-roundtrip-review.json').exists():continue
 export=read(folder/'export-review.json');optimized=read(folder/'optimization-review.json');review=read(folder/'optimized-roundtrip-review.json')
 assert export['sourceSha256']==review['sourceSha256']==sha(P/folder.name/'resident.blend')
 assert optimized['sourceAssetSha256']==export['asset']['sha256']==sha(folder/'resident-raw.glb')
 assert review['complete']and review['passed']and review['assetSha256']==optimized['optimized']['sha256']==sha(folder/'optimized.glb')
 exports.append({'actorId':folder.name,'clips':len(review['rows']),'optimizedBytes':optimized['optimized']['bytes'],'passed':review['passed'],'maximumDistanceMeters':review['maximumDistanceMeters']})
 files.extend([folder/'export-review.json',folder/'optimization-review.json',folder/'optimized-roundtrip-review.json',folder/'optimized.glb'])
ground_file=P/'optimized-runtime-grounding-diagnostic.json'
if ground_file.exists():
 grounding=read(ground_file);assert grounding['complete']and grounding['passed']
 assert grounding['helperSha256']==sha(ROOT/'app/town-play/art-sample/character-grounding.ts')
 for name,value in grounding['assetHashes'].items():assert sha(ROOT/name)==value,name
 files.extend([ground_file,ROOT/'app/town-play/art-sample/character-grounding.ts'])
browser_file=P/'browser-review.json'
if browser_file.exists():
 browser=read(browser_file)
 for name,value in browser['sourceHashes'].items():assert sha(ROOT/name)==value,name
 files.append(browser_file)
record={'schema':'classic-egress-review.v1','recordedAt':datetime.now(timezone.utc).isoformat(),'pilot':args.pilot,
 'status':'blender-candidate-runtime-integration-pending','goalComplete':False,'humanApproved':False,'exported':len(exports)==3,'browserIntegrated':bool(browser and browser['loaded']),'targetDevicePerformanceAccepted':False,
 'sources':{str(f.relative_to(ROOT)):sha(f)for f in files},
 'layout':{'integrityPassed':layout['passed'],'renders':len(architecture['renders']),'notes':['Parcel shelf and its existing brackets relocated to the front side wall; no extra shims were needed.','Station counter and all 54 associated objects moved together by 0.30 m.']},
 'visualInspection':visual,
 'diagnosticGltfExports':probes,
 'mergedOptimizedExports':exports,
 'runtimeGrounding':None if grounding is None else {'passed':grounding['passed'],'transitions':len(grounding['rows']),'maximumAppliedLiftMeters':max(r['maximumAppliedLiftMeters']for r in grounding['rows']),'scope':grounding['scope']},
 'browserPreview':browser,
 'prospectiveBlends':None if blends is None else {'transitions':len(blends['rows']),'garmentPassed':blends['garmentPassed'],'floorPenetrationPassed':blends['floorPenetrationPassed'],'minimumSoleHeightFromIdleFloorMeters':min(r['minimumSoleHeightFromIdleFloorMeters']for r in blends['rows']),'scope':blends['scope']},
 'nativeSkirtPreviews':skirt_previews,
 'followupPilot':followup,
 'nativeMotionPreview':None if motion is None else {'frames':len(motion['frames']),'previewFrameRate':motion['previewFrameRate'],'path':(motion_file.parent/motion['video']).relative_to(ROOT).as_posix(),'scope':motion['scope']},
 'poses':{'renders':len(renders['renders']),'retentionPassed':retention['passed'],'fineSamplingPassed':pose['passed'],'stepFrames':pose['stepFrames'],'maximumPlantedAnkleDrift':max(r['maximumPlantedAnkleDrift']for r in pose['rows']),'maximumPlantedSoleGap':max(r['maximumAbsolutePlantedSoleGap']for r in pose['rows'])},
 'function':{'routes':len(mesh['rows']),'samples':sum(r['samples']for r in mesh['rows']),'sourceMeshPassed':mesh['passed'],'routePlanPassed':routes['passed'],'routesWithContacts':sum(bool(r['contacts'])for r in mesh['rows'])},
 'form':{'clothPassed':cloth['passed'],'newClipIssues':[{'actorId':r['actorId'],'clip':r['clip'],'maxima':r['maxima']}for r in new_cloth if any(r['maxima'].values())],
  'retainedClipIssues':[{'actorId':r['actorId'],'clip':r['clip'],'maxima':r['maxima'],'deskPairs':r['maximumDeskPairs']}for r in old_cloth if any(r['maxima'].values())or r['maximumDeskPairs']],
  'actorGarmentChecks':[{'actorId':actor,'clips':len([r for r in cloth['rows']if r['actorId']==actor]),'passed':all(not any(r['maxima'].values())and not r['maximumDeskPairs']for r in cloth['rows']if r['actorId']==actor)}for actor in sorted({r['actorId']for r in cloth['rows']})],
  'limitations':['Skirt/leg surface review excludes the lower hem below 15 cm.','Source pose sampling does not establish continuous collision, runtime transition quality or human art acceptance.']},
 'previousRuntime':{'review':'docs/3d-town/classic-motion-v1/review.json','sourceChanges':runtime_changes},
 'remaining':([]if cloth['passed']else['Resolve the remaining recorded garment intersections.'])+['Review movement transitions in motion, then export a separately versioned scene, cast and animations.','Integrate only after Form review, then repeat browser and Windows target-device performance checks.']}
if not pose['passed']or not cloth['passed']or not mesh['passed']or not retention['passed']or visual.get('requiredCorrections'):record['status']='blender-candidate-art-repair-required'
if blends and not blends['floorPenetrationPassed']and not grounding:
 if record['status']=='blender-candidate-runtime-integration-pending':record['status']='blender-candidate-motion-repair-required'
 record['remaining'].insert(0,'Correct the measured sole penetration during local quaternion fades, then verify actual root placement and foot contact in runtime playback.')
if grounding:
 record['remaining']=['Review source-bound preview route corners, physical contacts and visual quality in browser.','Migrate the authoritative live-world scene profile only with save compatibility checks.','Complete packaged Windows performance and human art/play review.']
if browser:
 record['status']='browser-motion-candidate-review-pending'
 record['remaining']=browser.get('remaining',[])+record['remaining']
record['remaining']=visual.get('requiredCorrections',[])+record['remaining']
(BASE/'review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
cloth_note='两名长裙角色使用四个共同作用于裙面和围裙的局部形变；站立与工作时形变权重为零。Walk 只调整裙摆骨骼的跟随方式，腿部步态保留。修复师工具随围裙一起变形。'if(P/'resident-03/accessory-builder.py').exists()else'两名穿长裙角色的裙腿、围裙关系仍需修复。'
garment_file=P/'resident-03/garment-correctives.json'
if garment_file.exists()and read(garment_file).get('morphEncoding',{}).get('basisCreation')=='explicit from_mix=False':cloth_note='两名长裙角色已从原始源重建四个独立形变，站立与工作时权重为零。每个目标的原始最大位移单独核实为约 0.22 m；实际动作仅使用其中的一部分。修复师围裙与贴身工具使用同一位移场，Walk 仅修改裙摆骨骼跟随，保留腿部步态。'
if(P/'morph-construction-audit.json').exists():cloth_note='后续原生动作帧检查否决了本版裙摆外形：创建形变时出现累积，实际幅度超过设计值。先前位移上界声明无效；正在从原始源重建独立形变。接触检查与 GLB 往返通过均不能代替外形质量。'
next_note='源模型采样检查通过，接下来处理新旧动作衔接与正式资源导出。'if all([cloth['passed'],pose['passed'],mesh['passed'],retention['passed']])else'尚有源模型检查未通过，具体问题见 review.json；修复后才推进正式资源导出。'
if blends and not blends['floorPenetrationPassed']and not grounding:next_note+=' 衣物在混合动作中仍无接触，但部分鞋底下沉；该衔接问题仍待修复，不能宣告游戏动作验收通过。'
if grounding:next_note=f'三名居民各六组完整动作已导出、压缩并重新导回 Blender 比对，最大顶点距离 {max(r["maximumDistanceMeters"]for r in exports)*1000:.3f} mm。实际 Three.js 混合动作的鞋底修正已通过 {len(grounding["rows"])} 组检查。原始混合的下沉记录保留，不能把修正后的结果归为源动画本来无下沉。'
browser_note='新候选的浏览器、目标设备性能及人工审美验收尚未执行。'
if browser:browser_note='[浏览器人物与动线样板](http://127.0.0.1:3187/town-play/motion-sample) 已实际载入；检查范围与待修问题见 review.json。Windows 成品包性能及人工审美尚未验收。'
preview_note=(f'值班员 [Blender 原生动作片段]({args.pilot}/motion-preview/station-back-away.mp4) 为 15 fps 诊断预览。'if motion else'')
for preview in skirt_previews:
 preview_note+=f"\n[{preview['actorId']} 的裙摆动作预览]({Path(preview['path']).relative_to(BASE.relative_to(ROOT)).as_posix()}) 使用 24 张实际帧重复播放三次，角色原地踏步以检查衣料；不是行进或动作衔接验收。\n"
preview_note+='这些原生渲染不代表游戏帧率或浏览器播放验收。'
text=f'''# 居民工作台进出动作与房间布局

当前 Blender 候选：`{args.pilot}`。原游戏资源和世界状态未由本次候选替换。

- 书店包裹架移到前侧墙；原支架直接贴合，没有新增垫片。车站柜台与附属物一起前移 30 厘米。
- 已完成 {len(architecture['renders'])} 张房间多角度实渲染、{len(renders['renders'])} 张居民动作实渲染。
- 动线：{len(mesh['rows'])} 条，{sum(r['samples']for r in mesh['rows'])} 个模型姿势采样；有家具接触的路线 {sum(bool(r['contacts'])for r in mesh['rows'])} 条。
- {30/pose['stepFrames']:g} Hz 脚步检查（含关键帧之间的采样）：{'通过'if pose['passed']else'仍需修复'}；服装与身体表面检查：{'通过'if cloth['passed']else'仍需修复'}。具体失败动作见 [review.json](review.json)。
- UV、绑定、静止骨架、贴图与旧动作独立比对：{'通过'if retention['passed']else'未通过'}。明确登记的衣料形变和 Walk 裙摆骨骼允许改变；其余旧动作曲线逐项核对。旅馆角色保留此前 195 个前腰顶点、最大 18 mm 的修形。
- 值班员使用两个局部衣片形变；站立、行走、转身和工作时不扩张外套，退步/靠台时前片的修形上限约 11.31 mm。单段 GLB 导出再导入为诊断样本，未推广成游戏资源。

{cloth_note}

{next_note} {browser_note} 本阶段不代表整体项目完成。
{followup_note}

## 实际 Blender 渲染

![旧书店正式构图](layout-01/shop-production.png)
![车站正式构图](layout-01/station-production.png)
![修复师转身]({args.pilot}/renders/resident-03-turned.png)
![值班员退步]({args.pilot}/renders/resident-06-retreat-first.png)
![旅馆角色退步]({args.pilot}/renders/resident-08-retreat-second.png)

{preview_note} 原生制作细节与未采用的试验见 [本轮制作说明]({args.pilot}/AUTHORING.zh-CN.md)。

## 源文件

- [房间布局](layout-01/room.blend)
- [修复师]({args.pilot}/resident-03/resident.blend)、[值班员]({args.pilot}/resident-06/resident.blend)、[旅馆老板]({args.pilot}/resident-08/resident.blend)
- [实渲染记录]({args.pilot}/renders/render-review.json)、[动线检查]({args.pilot}/route-mesh-diagnostic.json)、[旧数据比对]({args.pilot}/retention-review.json)

`step-02` 至 `step-04` 为保留的过程候选。`step-04` 的早期整手碰撞分类包含手腕共享接缝，不能把该项计数当作手指穿衣；当前检查已改用解剖手指标签，保留原报告以供追溯。
'''
(BASE/'README.zh-CN.md').write_text(text,encoding='utf-8')
print(json.dumps({'status':record['status'],'function':record['function'],'poses':record['poses'],'form':record['form'],'runtimeSourceChanges':runtime_changes},ensure_ascii=False))
