"""Bind the authored bookshop, measured routes and actual local browser evidence."""
from pathlib import Path
import datetime, hashlib, json, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'docs/3d-town/classic-bookshop-v2'
PUBLIC=ROOT/'public/assets/classic-bookshop/v2'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def ref(p): return {'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p)}
def cli(name):
    s=(ROOT/'output/playwright'/name).read_text(encoding='utf-8-sig')
    assert '### Error' not in s,name
    return json.JSONDecoder().raw_decode(s.split('### Result',1)[1].lstrip())[0]

author=read(P/'authoring-receipt.json');renders=read(P/'render-receipt.json')
function=read(P/'function-review.json');form=read(P/'form-review.json')
manifest=read(PUBLIC/'manifest.json');cast=read(PUBLIC/'cast.json')
source_sha=sha(P/'classic-bookshop.blend');asset_sha=sha(PUBLIC/'classic-street.glb')
assert source_sha==author['source']['sha256']==renders['sourceSha256']==function['sourceSha256']==form['sourceSha256']==manifest['sourceSha256']
assert asset_sha==manifest['asset']['sha256']==cast['sceneAssetSha256']
assert sha(PUBLIC/'cast.json')==manifest['residentCast']['sha256']
assert sha(PUBLIC/'navigation.json')==manifest['navigation']['sha256']
assert author['builderSha256']==sha(P/'builder.py')==sha(ROOT/'scripts/build-classic-bookshop-v2.py')
assert function['reviewerScriptSha256']==sha(ROOT/'scripts/review-classic-bookshop-v2.py')
assert form['recorderSha256']==sha(ROOT/'scripts/prepare-classic-bookshop-v2-delivery.py')
assert manifest['exporterSha256']==sha(ROOT/'scripts/export-classic-bookshop-v2.py')
assert form['functionReviewSha256']==sha(P/'function-review.json') and form['renderReceiptSha256']==sha(P/'render-receipt.json')
assert function['passed'] and form['candidatePreviewEligible'] and renders['complete'] and len(renders['renders'])==13
for name,identity in manifest['proofs'].items(): assert sha(P/name)==identity,name
for item in author['inputs']: assert sha(ROOT/item['path'])==item['sha256'],item['path']
for item in renders['renders']: assert sha(P/item['path'])==item['sha256'],item['path']
retained_cast=read(ROOT/'public/assets/classic-residents/v10/cast.json')
assert cast['entries']==retained_cast['entries'] and not cast['worldBound']
navigation=read(P/'navigation-review.json')
assert navigation['passed'] and navigation['castSha256']==sha(PUBLIC/'cast.json') and navigation['navigationSha256']==sha(PUBLIC/'navigation.json')
assert read(P/'typecheck.json')['exitCode']==0
assert read(P/'runtime/material-check.json')['passed']
flow=cli('classic-shop-v2-final-flow.log');tour=cli('classic-shop-v2-tour.log')
assert flow['passed'] and all(flow['checks'].values()) and tour['passed']
assert not flow['browserErrors'] and not tour['browserErrors'] and not flow['apiRequests'] and not tour['worldApiRequests']
assert [tour[k]['roomId'] for k in ('station','bookshop','after')]==['station','bookshop','inn']
for key in ('station','bookshop','staff','after'):
    assert tour[key]['assetSha256']==asset_sha and tour[key]['sourceSha256']==source_sha
    assert tour[key]['cutawayShadows']['mode']=='complete-shell'
    assert all('layer_'+n in tour[key]['cutawayShadows']['occluders'] for n in tour[key]['hiddenLayers'])
assert flow['reset']['cutawayShadows']['mode']=='normal' and flow['reset']['hiddenLayers']==[]
for entry in cast['entries']:
    am=ROOT/('public'+entry['manifestUrl']);assert sha(am)==entry['manifestSha256']
    actor=read(am);observed=next(a for a in flow['held']['residents'] if a['actorId']==entry['actorId'])
    assert actor['asset']['sha256']==observed['assetSha256'] and actor['sourceSha256']==observed['sourceSha256']
performance={label:cli(name) for label,name in [('overview','classic-shop-v2-final-overview-performance.log'),('twoBookActions','classic-shop-v2-final-work-performance.log')]}
assert performance['overview']['mode']=='overview'
for label,item in performance.items():
    assert item['assetSha256']==asset_sha and item['sourceSha256']==source_sha
    assert item['viewport']=={'width':1920,'height':1080} and item['deviceScaleFactor']==1 and item['frames']>1000
    assert item['p95Ms']<16.7 and item['over33_4']==0
console=(P/'browser-console.log').read_text(encoding='utf-8-sig');assert '[ERROR]' not in console
runtime={'schema':'classic-bookshop-runtime-review.v2','sourceSha256':source_sha,'assetSha256':asset_sha,'castSha256':sha(PUBLIC/'cast.json'),
    'flow':flow,'tour':tour,'performance':performance,'processMemory':read(P/'process-memory.json'),
    'console':{'errors':0,'warnings':console.count('[WARNING]'),'note':'Retained shader precision warning.'},
    'scope':'Actual local Chrome/RTX 4060 Laptop, 1080p, DPR 1, loaded sample. No cold-load, packaged Windows, concurrent Agent or long-duration claim.',
    'humanArtApproved':False,'worldBound':False}
write(P/'runtime-review.json',runtime)
images=['classic-shop-v2-final-held.png','classic-shop-v2-final-bookshop-play.png','classic-shop-v2-interior.png','classic-shop-v2-inn-return.png','classic-shop-v2-street.png']
write(P/'visual-review.json',{'sourceSha256':source_sha,'assetSha256':asset_sha,'reviewer':'Codex direct inspection of all 13 formal Cycles renders and the listed actual browser screenshots.',
    'reviewedImages':[ref(ROOT/'output/playwright'/n) for n in images],
    'observations':['Continuous wall-backed dark joinery and subdued original olive print give the bookshop more period detail.',
        'Player passage and the repair station stay separate; a real keyboard route reached the counter staff aisle.',
        'Room cutaways remain usable while complete building roots participate in the directional shadow pass.',
        'The actual held-book action remains synchronized, with the existing head/eye pose and return behavior.',
        'Small pleated lampshades show high-frequency highlight noise at the elevated gameplay scale; their source meshes have no non-adjacent triangle overlaps in the focused check. This visual defect is not declared fixed.',
        'Runtime practical lights do not cast individual shadows and are artistically calibrated. Materials and light do not yet match the concept or Cycles exactly.'],
    'humanArtApproved':False,'formFullyAccepted':False})

direction_path=ROOT/'docs/vision/classic-detection-2026-10-08/direction.json';direction=read(direction_path)
direction['status']='three-interiors-bookshop-joinery-three-art-residents-human-acceptance-pending'
sample=direction['runtimeSample'];sample.update(package='../../3d-town/classic-bookshop-v2/README.zh-CN.md',sourceSha256=source_sha,assetSha256=asset_sha,
    scope='Three connected original interiors with refined bookshop joinery, printed wallpaper, supported sconces and complete-shell directional shadows during cutaway. Three stationary art residents and a user-triggered book demonstration; no Agent/case binding.')
sample['residentCompanion'].update(castUrl='/assets/classic-bookshop/v2/cast.json',castSha256=sha(PUBLIC/'cast.json'))
write(direction_path,direction)
overview=performance['overview'];work=performance['twoBookActions']
readme=f'''# 河湾旧书店 v2：木作、墙纸与室内阴影

已在[铁路街角样板](http://127.0.0.1:3187/town-play/art-sample)启用。旧书店增加连续护墙板、原创橄榄绿墙纸、木作收边和两盏有支架的壁灯，重新布置修书角；柜台连同账本、铃和台灯向后移动 18 cm，留出前方转入店员通道的空间。

![实际浏览器画面](../../../output/playwright/classic-shop-v2-final-bookshop-play.png)

## 本轮交付

- [后台 Blender 源文件](classic-bookshop.blend)，以及 13 张实际 Cycles 渲染：全室、修书台、四角、低机位、天花仰视、两张天花斜视、地面与天花平面、街区全景。
- 三条护墙板背面嵌入墙体 2 mm，壁灯底板嵌入 1.5 mm；柜台后通道、三个居民观察点可达。实际网格检查覆盖 1075 个路径位置、三个高度，最小表面距离约 0.270 m，对应半径 0.26 m 的样板玩家；这不是通用无障碍或全空间碰撞认证。
- 场景保留 617,251 三角面，压缩后 14,778,636 字节。颜色贴图压至 512 像素；法线图保留 PNG，并验证与缩小到 512 像素后的像素一致。纹理 RGBA 加 mipmap 估算约 29.36 MB，不代表总显存。
- 进入室内隐藏屋顶和近侧墙时，完整建筑仍参与主光阴影计算。出门和归位恢复外观；这是实时阴影处理，没有烘焙光照。
- 沿用 v10 许知微、v8 顾远山和林阿梨、v9 修书台；新场景目录重新绑定版本。人物拿书、视线、放回、重复输入、合上手记继续动作及归位都通过真实键盘检查。

## 实际运行范围

本机 Chrome、RTX 4060 Laptop、1920×1080、DPR 1。全景 {overview['measuredMs']/1000:.2f} 秒：P95 {overview['p95Ms']:.2f} ms、最高 {overview['maxMs']:.2f} ms；记录中 {overview['over16_7']} 帧略高于 16.7 ms 的数值边界。两次完整拿书动作 {work['measuredMs']/1000:.2f} 秒：P95 {work['p95Ms']:.2f} ms、最高 {work['maxMs']:.2f} ms，超过 16.7 ms 的帧为 {work['over16_7']}。控制台零错误，保留一条着色器精度警告。

浏览器进程内存只采集了一次快照，约 1.13 GB 工作集、1.77 GB 私有内存；不能据此认定无泄漏或推断显存。冷启动、Windows 安装包、真实 Agent 并发和长时运行未在本轮验收。

## 保留的问题与下一阶段

小灯罩的密集褶皱仍有高光噪点，书籍和街区示意图仍较简化，人物表情和重心变化不足。人工美术验收未完成；插件的正式生产包验收也因自定义数据格式、平面元数据与里程碑评阅缺项而未通过，本轮通过的是单独记录的本地 Function、Form 候选检查与浏览器验证。

现在依然是三个可进入的地点、三名静止美术居民。下一阶段应把工作动作接到规则裁定后的居民行为与持续动作状态，再逐步扩大地点和居民；这一步完成前，拿书演示不作为 Agent 自主行为、物证或案件事件。完整小镇、事件驱动案件、Windows 交付及小说同源桥接仍属于活动目标。

旧场景、人物源文件和既有资产保留；没有引入新的第三方素材、上传或付费生成。

[Function 检查](function-review.json) · [Form 候选检查](form-review.json) · [浏览器记录](runtime-review.json) · [本轮交付记录](final-report.json)
'''
(P/'README.zh-CN.md').write_text(readme,encoding='utf-8')

previous=read(ROOT/'docs/3d-town/classic-residents-v10/final-report.json')
protected=[r for r in previous['references'] if r['path'].startswith(('public/assets/','docs/3d-town/'))]
for item in protected: assert sha(ROOT/item['path'])==item['sha256'],'Retained original changed: '+item['path']
references=protected+[ref(ROOT/i['path']) for i in author['inputs']]
names=['classic-bookshop.blend','builder.py','authoring-receipt.json','render-receipt.json','function-review.json','form-review.json','scene-contract.json','lighting.json','props.json','placements.json','room-layout.json','room-brief.json','openings.json','navigation-review.json','typecheck.json','runtime-export.json','runtime-review.json','visual-review.json','process-memory.json','browser-processes.json','browser-console.log','README.zh-CN.md','textures/original-olive-print.png','runtime/material-source.json','runtime/material-check.json','runtime/optimization.json','runtime/raw-export.json','meshes/classic-street-raw.glb','formal-skill-function.log','formal-skill-form.log']
references += [ref(P/n) for n in names]+[ref(P/r['path']) for r in renders['renders']]+[ref(PUBLIC/n) for n in ('manifest.json','navigation.json','cast.json','classic-street.glb','CREDITS.md','font-OFL.txt')]
references += [ref(ROOT/'output/playwright'/n) for n in images+['classic-shop-v2-tour.js','classic-shop-v2-tour.log','classic-shop-v2-final-flow.js','classic-shop-v2-final-flow.log','classic-shop-v2-final-overview-performance.log','classic-shop-v2-final-work-performance.log','classic-shop-v2-final-processes.log','classic-cast-performance.js','classic-book-work-performance.js','classic-station-processes.js']]
references += [ref(ROOT/'output/character-source-audit'/n) for n in ['check-sconces.py','bookshop-v2-sconce-geometry.json','bookshop-v2-formal-02.log','bookshop-v2-function-02.log']]
references += [ref(ROOT/'scripts'/n) for n in ['build-classic-bookshop-v2.py','review-classic-bookshop-v2.py','prepare-classic-bookshop-v2-delivery.py','export-classic-bookshop-v2.py','record-classic-bookshop-v2-export.py','optimize-classic-bookshop-v2.ps1','check-classic-bookshop-v2-navigation.mjs','record-classic-bookshop-v2-delivery.py']]
references += [ref(ROOT/'app/town-play/art-sample'/n) for n in ['ClassicScene.tsx','sample-cutaway-shadows.ts','sample-navigation.ts','sample-character.ts','ClassicArtSample.tsx','classic-art.module.css']]+[ref(direction_path)]
unique={r['path']:r for r in references}
report={'schema':'classic-bookshop-delivery.v2','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'verified-local-bookshop-art-candidate','sourceSha256':source_sha,'assetSha256':asset_sha,
    'checks':{'thirteenActualRendersInspected':True,'measuredFunction':True,'candidateForm':True,'runtimeNavigationAndStaffPassage':True,'retainedCharacterAction':True,'cutawayShadowRestoration':True,'typecheck':True,'shortWarmFrameTimeTarget':True},
    'protectedPriorReferences':len(protected),'formalProductionGatePassed':False,'humanArtApproved':False,'worldBound':False,'fullGoalComplete':False,
    'remaining':['Small lampshade highlight noise and more refined material/lighting','Three-to-twelve rule-adjudicated Agent residents and world-bound work','Six locations and case/event investigation loop','Windows packaging, cold load and long-run performance','Same-world novel bridge and original chapters','Human art and play review'],'references':list(unique.values())}
write(P/'final-report.json',report)
validator=Path('E:/CodexData/.codex/plugins/cache/openai-curated-remote/build-3d-game-rooms/0.3.3/skills/build-3d-game-rooms/scripts/validate_room.py')
result=subprocess.run([sys.executable,str(validator),str(P),'--gate','runtime'],capture_output=True,text=True,encoding='utf-8')
log=P/'formal-skill-runtime.log';log.write_text(result.stdout+result.stderr,encoding='utf-8')
report['formalProductionGatePassed']=result.returncode==0;report['references'].append(ref(log));write(P/'final-report.json',report)
for item in report['references']:assert sha(ROOT/item['path'])==item['sha256'],item['path']
print(json.dumps({'status':report['status'],'verifiedReferences':len(report['references']),'protectedPriorReferences':len(protected),'formalProductionGatePassed':report['formalProductionGatePassed'],'fullGoalComplete':False}))
