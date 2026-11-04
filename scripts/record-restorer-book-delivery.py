"""Bind this iteration's source, visual, browser and local-device evidence."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-residents-v9';F=P/'resident-03';PUBLIC=ROOT/'public/assets/classic-residents/v9'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def ref(p):return {'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)}
def cli(name):
    path=ROOT/'output/playwright'/name;text=path.read_text(encoding='utf-8-sig');assert '### Error' not in text,name
    return json.JSONDecoder().raw_decode(text.split('### Result',1)[1].lstrip())[0]
export=read(P/'runtime-export.json');saved=read(F/'saved-contact-review.json');renders=read(F/'render-review.json')
manifest=read(PUBLIC/'resident-03.json');cast=read(PUBLIC/'cast.json');nav=read(P/'navigation-review.json');types=read(P/'typecheck.json')
assert types['exitCode']==0 and nav['passed'] and nav['castSha256']==sha(PUBLIC/'cast.json')
assert manifest['sourceSha256']==sha(F/'rb-xu-zhiwei.blend')==saved['sourceSha256']==renders['sourceSha256']
assert saved['reopenedDeliverySource'] and all(v==0 for v in saved['maxima'].values())
flow=cli('classic-book-work.log');walk=cli('classic-book-v9-bookshop.log')
assert flow['passed'] and all(flow['checks'].values()) and walk['passed'] and not flow['browserErrors'] and not flow['apiRequests']
for entry in cast['entries']:
    actor_manifest=read(ROOT/('public'+entry['manifestUrl']));assert sha(ROOT/('public'+entry['manifestUrl']))==entry['manifestSha256']
    captured=next(r for r in flow['held']['residents'] if r['actorId']==entry['actorId'])
    assert captured['sourceSha256']==actor_manifest['sourceSha256'] and captured['assetSha256']==actor_manifest['asset']['sha256']
assert next(r for r in flow['held']['residents'] if r['actorId']=='resident-03')['work']['workstationSha256']==manifest['workAction']['workstation']['sha256']
performance={label:cli(name) for label,name in [('overview','classic-book-overview-performance.log'),('twoBookActions','classic-book-work-performance.log')]}
for label,r in performance.items():
    assert r['viewport']=={'width':1920,'height':1080} and r['deviceScaleFactor']==1 and r['frames']>1000
    actor=next(a for a in r['residents'] if a['actorId']=='resident-03');assert actor['sourceSha256']==manifest['sourceSha256'] and actor['assetSha256']==manifest['asset']['sha256']
    assert r['p95Ms']<16.7 and r['over16_7']==0
console=(P/'browser-console.log').read_text(encoding='utf-8-sig');assert '[ERROR]' not in console
browser={'schema':'classic-restorer-work-browser.v9','sourceSha256':manifest['sourceSha256'],'castSha256':sha(PUBLIC/'cast.json'),
    'flow':flow,'walk':walk,'performance':performance,'processMemory':read(P/'process-memory.json'),
    'console':{'errors':0,'warnings':console.count('[WARNING]'),'note':'Existing shader floating-point precision warning; no JavaScript runtime errors in the owned QA browser.'},
    'evidence':[ref(ROOT/'output/playwright'/n) for n in ('classic-book-work.log','classic-book-v9-bookshop.log','classic-book-overview-performance.log','classic-book-work-performance.log','classic-book-processes.log')],
    'worldBound':False,'humanArtApproved':False}
write(P/'runtime-review.json',browser)
visual={'sourceSha256':manifest['sourceSha256'],'reviewKind':'agent inspection of actual saved Cycles images and actual browser pixels',
    'reviewedRenders':[ref(F/r['path']) for r in renders['renders']],
    'reviewedBrowserImages':[ref(ROOT/'output/playwright/classic-book-work-held.png')],
    'observations':['Closed-book scale, bound spine and independent workstand are legible in the inspection camera.',
        'The grip has an opposed thumb and lower fingers. The cradle provides space below the book.',
        'The previous severe wrist/sleeve collapse is reduced by forearm cuff binding and a 12 mm hem adjustment.',
        'Shoulder and elbow cloth folds are still broad and angular, especially in back and approach views.',
        'The gaze, face and torso remain stiff. No page opening/turning is implemented.',
        'Room light and large architectural surfaces remain flatter than the approved concept direction.'],
    'humanArtApproved':False,'formFullyAccepted':False}
write(P/'visual-review.json',visual)
direction_path=ROOT/'docs/vision/classic-detection-2026-10-08/direction.json';direction=read(direction_path)
companion=direction['runtimeSample']['residentCompanion'];companion.update(package='../../3d-town/classic-residents-v9/README.zh-CN.md',castUrl='/assets/classic-residents/v9/cast.json',castSha256=sha(PUBLIC/'cast.json'),
    scope='Three stationary art residents. Resident-03 has a user-triggered eight-second closed-book inspection and independent workstation. Residents 06/08 retain v8. No Agent/case binding; nine other residents remain drafts.',humanArtApproved=False)
next(r for r in companion['refinedResidents'] if r['actorId']=='resident-03').update(sourceSha256=manifest['sourceSha256'],assetSha256=manifest['asset']['sha256'])
write(direction_path,direction)
perf=performance['twoBookActions'];overview=performance['overview'];memory=browser['processMemory']
readme=f'''# 河湾居民 v9：修书师查看旧书

许知微新增一段 8 秒动作：抬手、从两侧夹住旧书、举起端详、放回书托、松手。书本与工作台单独建模，工作台独立于居民。当前是用户触发的美术动作样板，尚未绑定 Agent 决策、职业产出或案件。

![实际浏览器中查看旧书](../../../output/playwright/classic-book-work-held.png)

## 进入样板

打开 [铁路街角](http://127.0.0.1:3187/town-play/art-sample)，步行进入旧书店，走近许知微后按 E，再点击“查看旧书动作”。Tab / Shift+Tab 可切换动作与关闭按钮；播放期间忽略重复触发。Esc 关闭手记后动作继续完成；归位会重置人物和书本。

## Blender 制作与接触检查

- [交付源文件](resident-03/rb-xu-zhiwei.blend)保留 50 根骨骼及原有 Idle / Walk。拓扑、UV 与静止骨架保持一致；156 个袖口相关顶点重新绑定到前臂，并在建模坐标中收短最多 12 mm，其他人物网格与权重保持一致。
- 原创硬封面旧书、烫金书脊、纸页边缘、毡质书托和木工作台。闭合书本可倾斜端详，没有翻开或逐页翻动。
- [10 张正式渲染](resident-03/render-review.json)包括四角、低机位、天花斜视、伸手、抓握、放回和静止。低机位两次调整仅改变摄影机，模型和每条动作曲线的身份验证保留在 [相机修正记录](resident-03/camera-amendment.json)。
- 保存后重新读取源文件，按 60 Hz 检查整段动作的 481 个姿势。手与书、手与工作台、书与工作台、带标签的指节与其他手指/服装均未检出三角形相交。持书阶段拇指最近接触间隙最大 {saved['heldContactGaps']['thumbGapMeters']*1000:.2f} mm，下方手指最大 {saved['heldContactGaps']['lowerFingerGapMeters']*1000:.2f} mm。范围是这段预制动作的采样姿势，不是任意姿势的物理抓握或整件衣服的自碰撞验证。
- [Function 动线](navigation-review.json)：新增工作台具有碰撞体，三处居民观察位置仍可从起点到达；旧书店路线也已在浏览器用实际按键走过。

## 实机验证与资产

按键观察、焦点切换、动作同步、重复输入、关闭后的完成、书本归位、再次播放和中途重置通过；没有世界 API 请求。检查器与 TypeScript 检查通过。浏览器保留一条已有着色器浮点精度警告，没有 JavaScript 错误。

人物 GLB 为 {manifest['asset']['bytes']:,} 字节、36,668 三角形；独立工作台为 {manifest['workAction']['workstation']['bytes']:,} 字节、2,288 三角形。木纹法线原 PNG 完整保留：首次 WebP 转换改变了法线像素，因此未采用；其他纹理与几何按 [导出记录](runtime-export.json)检查。

RTX 4060 Laptop / Chrome 154 / 1920 × 1080 / DPR 1：

| 采样 | 时长 | P95 帧时间 | 最大帧时间 | 超过 16.7 ms |
| --- | ---: | ---: | ---: | ---: |
| 全景 | {overview['measuredMs']/1000:.2f} s | {overview['p95Ms']:.1f} ms | {overview['maxMs']:.1f} ms | {overview['over16_7']} |
| 连续两次拿书 | {perf['measuredMs']/1000:.2f} s | {perf['p95Ms']:.1f} ms | {perf['maxMs']:.1f} ms | {perf['over16_7']} |

独立 QA 浏览器的 {len(memory['processes'])} 个进程工作集快照合计约 {memory['summedWorkingSetBytes']/1048576:.0f} MiB，私有内存约 {memory['summedPrivateBytes']/1048576:.0f} MiB；共享工作集可能重复计数，未测显存或长期泄漏。本次为已加载的本地开发页面短测，未证明冷启动、Windows 包、长时运行或完整 Agent 世界性能。历史 v2 的 533.7 ms 与 v6 的 199.9 ms 卡顿仍未解释，不能据此宣布消除。

## 美术判断与下一步

抓握和动作闭环已可直接查看；肩袖、腋下与肘部褶皱仍显宽大、棱角化，视线和躯干姿态偏僵，房间灯光仍偏平。这些在 [视觉评阅](visual-review.json)中保留为待修正项。没有人工美术验收，也没有把本次预制动作计作自主社会模拟完成。

下一步先改进袖窿/肘部结构与蒙皮，再补视线、呼吸和身体重心；保留同一抓握接触约束复验。随后将有限动作接到规则裁定的职业活动与 Agent 行为。全镇扩展、事件案件、Windows 打包和小说桥接仍属于未完成的整体 goal。

43 项早期源文件、GLB 与来源记录已重新核对；旧项目内容和存档未参与改写。8 次建模试作与失败检查保存在 pilots。第三方来源沿用已有 CC0 人体/纹理记录与木纹授权，新增书本和工作台由项目制作。

[运行记录](runtime-review.json) · [保存后接触复查](resident-03/saved-contact-review.json) · [本轮交付记录](final-report.json)
'''
(P/'README.zh-CN.md').write_text(readme,encoding='utf-8')
references=[*export['preservedOriginals'],export['source'],export['cast'],export['savedSourceReview'],export['renders'],export['rawExport'],export['cameraAmendment'],export['optimizer']]
for r in export['assets'].values():references.append({'path':'public'+r['asset']['url'],'sha256':r['asset']['sha256']})
references += [ref(P/name) for name in ('runtime-export.json','runtime-review.json','visual-review.json','navigation-review.json','typecheck.json','process-memory.json','browser-console.log','README.zh-CN.md')]
references += [ref(direction_path),ref(PUBLIC/'resident-03.json'),ref(PUBLIC/'LICENSE.ASSETS.md')]
references += visual['reviewedRenders']+visual['reviewedBrowserImages']+browser['evidence']
references += [ref(ROOT/'app/town-play/art-sample'/name) for name in ('sample-character.ts','sample-navigation.ts','ClassicScene.tsx','ClassicArtSample.tsx','classic-art.module.css')]
references += [ref(ROOT/'scripts'/name) for name in ('build-blender-restorer-work.py','finalize-restorer-book-work.py','repair-restorer-low-camera.py','record-restorer-book-export.py','check-restorer-work-navigation.mjs')]
unique={r['path']:r for r in references}
for r in unique.values():assert sha(ROOT/r['path'])==r['sha256'],r['path']
assert '/assets/classic-residents/v9/cast.json' in (ROOT/'app/town-play/art-sample/ClassicScene.tsx').read_text(encoding='utf-8')
write(P/'final-report.json',{'schema':'classic-restorer-work-delivery.v9','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status':'verified-local-art-action-candidate','sourceSha256':manifest['sourceSha256'],'castSha256':sha(PUBLIC/'cast.json'),
    'checks':{'savedSourceAndHalfFrames':True,'tenFormalViewsProduced':True,'contactChecks':True,'navigation':True,'browserActionAndReset':True,'typecheck':True,'localWarmFrameTimeTarget':True},
    'formFullyAccepted':False,'humanArtApproved':False,'worldBound':False,'fullGoalComplete':False,'references':list(unique.values()),
    'remaining':['Sleeve and elbow deformation quality','Gaze, facial and torso animation','Rule-adjudicated Agent work binding','Full town/event/case expansion','Packaged Windows lifecycle/performance','Novel workflow and same-world bridge']})
print(json.dumps({'status':'verified-local-art-action-candidate','verifiedReferences':len(unique),'sourceSha256':manifest['sourceSha256'],'fullGoalComplete':False}))
