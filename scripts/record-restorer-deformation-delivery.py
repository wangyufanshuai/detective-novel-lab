"""Record actual saved-source, rendered, browser and local-device evidence."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-residents-v10';F=P/'resident-03';PUBLIC=ROOT/'public/assets/classic-residents/v10'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def ref(p):return {'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)}
def cli(name):
    text=(ROOT/'output/playwright'/name).read_text(encoding='utf-8-sig');assert '### Error' not in text,name
    return json.JSONDecoder().raw_decode(text.split('### Result',1)[1].lstrip())[0]
export=read(P/'runtime-export.json');saved=read(F/'saved-source-review.json');renders=read(F/'render-review.json')
manifest=read(PUBLIC/'resident-03.json');cast=read(PUBLIC/'cast.json');nav=read(P/'navigation-review.json');types=read(P/'typecheck.json')
assert types['exitCode']==0 and nav['passed'] and nav['castSha256']==sha(PUBLIC/'cast.json')
assert manifest['sourceSha256']==sha(F/'rb-xu-zhiwei.blend')==saved['sourceSha256']==renders['sourceSha256']
assert saved['reopenedDeliverySource'] and all(v==0 for v in saved['maxima'].values())
flow=cli('classic-gaze-v10-flow.log');walk=cli('classic-gaze-v10-bookshop.log')
assert flow['passed'] and all(flow['checks'].values()) and walk['passed'] and not flow['browserErrors'] and not flow['apiRequests']
for entry in cast['entries']:
    am=read(ROOT/('public'+entry['manifestUrl']));assert sha(ROOT/('public'+entry['manifestUrl']))==entry['manifestSha256']
    captured=next(r for r in flow['held']['residents'] if r['actorId']==entry['actorId'])
    assert captured['sourceSha256']==am['sourceSha256'] and captured['assetSha256']==am['asset']['sha256']
actor=next(r for r in flow['held']['residents'] if r['actorId']=='resident-03')
assert actor['work']['workstationSha256']==manifest['workAction']['workstation']['sha256']
assert {j['name'] for j in actor['gazeJointQuaternions']}=={'eye_L','eye_R','head'}
performance={label:cli(name) for label,name in [('overview','classic-gaze-v10-overview-performance.log'),('twoBookActions','classic-gaze-v10-work-performance.log')]}
for label,r in performance.items():
    assert r['viewport']=={'width':1920,'height':1080} and r['deviceScaleFactor']==1 and r['frames']>1000
    actor=next(a for a in r['residents'] if a['actorId']=='resident-03');assert actor['sourceSha256']==manifest['sourceSha256'] and actor['assetSha256']==manifest['asset']['sha256']
    assert r['p95Ms']<16.7 and r['over16_7']==0
console=(P/'browser-console.log').read_text(encoding='utf-8-sig');assert '[ERROR]' not in console
evidence_names=['classic-gaze-v10-flow.log','classic-gaze-v10-bookshop.log','classic-gaze-v10-overview-performance.log','classic-gaze-v10-work-performance.log','classic-gaze-v10-processes.log']
browser={'schema':'classic-restorer-deformation-browser.v10','sourceSha256':manifest['sourceSha256'],'castSha256':sha(PUBLIC/'cast.json'),
    'flow':flow,'walk':walk,'performance':performance,'processMemory':read(P/'process-memory.json'),
    'console':{'errors':0,'warnings':console.count('[WARNING]'),'note':'Retained shader precision warning.'},
    'evidence':[ref(ROOT/'output/playwright'/n) for n in evidence_names],'worldBound':False,'humanArtApproved':False}
write(P/'runtime-review.json',browser)
visual={'sourceSha256':manifest['sourceSha256'],'reviewKind':'agent inspection of all 12 actual saved Cycles renders and actual browser pixels',
    'reviewedRenders':[ref(F/r['path']) for r in renders['renders']],
    'reviewedBrowserImages':[ref(ROOT/'output/playwright/classic-gaze-v10-held.png')],
    'observations':['Continuous sleeves no longer form the large pointed fans seen in v9. Shoulder and elbow volume reads more consistently in front, back and overhead views.',
        'The head and both eyes turn down toward the held book, then return. The collar remains attached to the chest.',
        'Small angular creases remain near the elbow and cuff. This is an authored skinned garment, not dynamic cloth.',
        'The face remains expressionless; eyelid motion, blink, hair motion and a torso weight shift are absent.',
        'The room still has broad flat surfaces and lighting below the approved concept direction. No overall art acceptance is claimed.'],
    'humanArtApproved':False,'formFullyAccepted':False}
write(P/'visual-review.json',visual)
direction_path=ROOT/'docs/vision/classic-detection-2026-10-08/direction.json';direction=read(direction_path)
companion=direction['runtimeSample']['residentCompanion'];companion.update(package='../../3d-town/classic-residents-v10/README.zh-CN.md',castUrl='/assets/classic-residents/v10/cast.json',castSha256=sha(PUBLIC/'cast.json'),
    scope='Three stationary art residents. Resident-03 retains the eight-second book action with refined sleeve binding and authored head/eye attention. Residents 06/08 retain v8; workstation retains v9. No Agent/case binding; nine residents remain drafts.',humanArtApproved=False)
next(r for r in companion['refinedResidents'] if r['actorId']=='resident-03').update(sourceSha256=manifest['sourceSha256'],assetSha256=manifest['asset']['sha256'])
write(direction_path,direction)
perf=performance['twoBookActions'];overview=performance['overview'];memory=browser['processMemory'];stretch=saved['sleeveStretchMaxima']
readme=f'''# 河湾居民 v10：肩袖与看书视线

许知微的八秒查看旧书动作继续细化：重分配连续衬衫的肩袖权重，修整袖管体积，加入两根眼部骨骼，让头部与视线随书本位置变化。仍是用户触发的美术动作样板，尚未绑定 Agent 决策、职业产出或案件。

![实际浏览器画面](../../../output/playwright/classic-gaze-v10-held.png)

打开[铁路街角样板](http://127.0.0.1:3187/town-play/art-sample)，步行进入旧书店，走近许知微后按 E，再选择“查看旧书动作”。动作结束会把书放回；Esc 合上手记后动作继续，归位会恢复人物、视线与书本。

## Blender 与动作

- [交付源文件](resident-03/rb-xu-zhiwei.blend)保留原有拓扑、UV、材质和 50 根骨骼，新增 eye_L / eye_R。2420 个衬衫顶点位置被修整，2520 个衣料或眼部顶点的权重发生可记录变化。原有 Idle / Walk 和工作动作中除头部外的旧骨骼姿态保持一致。
- [保存后复查](resident-03/saved-source-review.json)覆盖八秒动作的 481 个姿态（60 Hz）。手—书、手—桌、书—桌、不同手指之间及手指—衣料的表面三角形检查为零交叉；持握阶段拇指最近间距最高 1.941 mm、下方手指 0.729 mm。这不是全部衣料自碰撞或人体包覆的证明。
- 袖面全动作最高边长比 {stretch['maximumEdgeLengthRatio']:.3f}，每帧 95 分位边长比的最高值 {stretch['p95EdgeLengthRatio']:.3f}。原 v9 在六个比较姿态中的最高边长比为 8.250；前后统计范围已区分。
- 充分注视阶段，眼骨前向与指定书面目标的最大夹角 {saved['maximumAttentiveGazeAngleDegrees']:.2f}°。这是几何视线检查，尚无眼睑、眨眼或面部表情。
- [12 张正式 Cycles 渲染](resident-03/render-review.json)包括四角、低机位、天花斜视、伸手、抓握、放回、静止、视线和肩袖近景。所有实际图像已由代理检查，人工艺术验收仍待进行。
- 工作台、书本、它们的 481 个采样姿态及原有手部动作保持一致。模型为 36,668 三角面、11 材质、52 骨骼，压缩后 {manifest['asset']['bytes']:,} 字节；法线贴图解码像素保持一致，沿用 v9 工作台资源。

## Function、Form 与运行检查

三个居民观察点均可达，工作台碰撞有效。浏览器用真实键盘走进旧书店；Tab / Shift+Tab、动作触发、重复输入、关闭后完成、再次播放及归位通过。实际导出骨骼中头部与两眼发生旋转，动作结束和归位后眼部恢复。未产生世界模拟 API 请求，类型检查通过。

本机 Chrome、1920×1080、DPR 1，已加载场景全景 {overview['measuredMs']/1000:.2f} 秒：P95 {overview['p95Ms']:.2f} ms、最高 {overview['maxMs']:.2f} ms；连续两次查看旧书 {perf['measuredMs']/1000:.2f} 秒：P95 {perf['p95Ms']:.2f} ms、最高 {perf['maxMs']:.2f} ms。两段超过 16.7 ms 的帧数均为零。控制台零错误，保留一条着色器精度警告。

这是本机短时、已加载样板证据。冷启动、Windows 安装包、Agent 并发和长时运行尚未验收；旧 v2 / v6 的 533.7 ms / 199.9 ms 卡顿记录保留，不能由这次短测宣布已解决。浏览器进程内存为一次快照，不能推断显存占用或无泄漏。

肩肘的大幅拉扯已经改善，袖口仍有小折线；表情、眼睑、头发与身体重心变化，以及室内灯光和大面材质仍需继续打磨。Form 总验收、人工验收、自主居民社会、案件生成和 Windows 成品均未完成。旧人物、旧版本源文件和资产保留，本轮没有新增第三方资产。

[运行记录](runtime-review.json) · [视觉复查](visual-review.json) · [本轮交付记录](final-report.json)
'''
(P/'README.zh-CN.md').write_text(readme,encoding='utf-8')
references=[*export['preservedOriginals'],export['source'],export['cast'],export['savedSourceReview'],export['renders'],export['rawExport'],export['optimizer']]
references += [{'path':'public'+manifest['asset']['url'],'sha256':manifest['asset']['sha256']}]
references += [ref(P/name) for name in ('runtime-export.json','runtime-review.json','visual-review.json','navigation-review.json','typecheck.json','process-memory.json','browser-console.log','README.zh-CN.md')]
references += [ref(direction_path),ref(PUBLIC/'resident-03.json'),ref(PUBLIC/'LICENSE.ASSETS.md')]
references += visual['reviewedRenders']+visual['reviewedBrowserImages']+browser['evidence']
references += [ref(ROOT/'app/town-play/art-sample'/name) for name in ('sample-character.ts','sample-navigation.ts','ClassicScene.tsx','ClassicArtSample.tsx','classic-art.module.css')]
references += [ref(ROOT/'scripts'/name) for name in ('build-restorer-deformation.py','finalize-restorer-deformation.py','record-restorer-deformation-export.py','record-restorer-deformation-delivery.py','check-restorer-deformation-navigation.mjs')]
references += [ref(P/'pilots/sleeves-gaze-03'/name) for name in ('builder.py','authoring-review.json','restorer-deformation.blend')]
references += [ref(ROOT/'output/playwright'/name) for name in ('classic-gaze-v10-flow.js','classic-gaze-v10-bookshop.js','classic-book-work-performance.js','classic-cast-performance.js','classic-station-processes.js')]
unique={r['path']:r for r in references}
for r in unique.values():assert sha(ROOT/r['path'])==r['sha256'],r['path']
assert '/assets/classic-residents/v10/cast.json' in (ROOT/'app/town-play/art-sample/ClassicScene.tsx').read_text(encoding='utf-8')
write(P/'final-report.json',{'schema':'classic-restorer-deformation-delivery.v10','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status':'verified-local-sleeve-and-gaze-art-candidate','sourceSha256':manifest['sourceSha256'],'castSha256':sha(PUBLIC/'cast.json'),
    'checks':{'savedSourceAndHalfFrames':True,'twelveFormalViewsReviewed':True,'contactChecks':True,'navigation':True,'browserHeadEyeMotionAndReset':True,'typecheck':True,'localWarmFrameTimeTarget':True},
    'formFullyAccepted':False,'humanArtApproved':False,'worldBound':False,'fullGoalComplete':False,'references':list(unique.values()),
    'remaining':['Fine cuff/elbow creases, eye lids, facial and torso animation','Interior light and large-surface material refinement','Rule-adjudicated Agent work binding','Full town/event/case expansion','Packaged Windows lifecycle/performance','Novel workflow and same-world bridge']})
print(json.dumps({'status':'verified-local-sleeve-and-gaze-art-candidate','verifiedReferences':len(unique),'sourceSha256':manifest['sourceSha256'],'fullGoalComplete':False}))
