"""Record inspected bookshop v2 layout and candidate Form review, without human approval."""
from pathlib import Path
import hashlib, json, subprocess, sys, time

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'docs/3d-town/classic-bookshop-v2'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, v): p.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

source_sha = sha(P/'classic-bookshop.blend')
assert source_sha == 'a8399c41ed64d1e0617dd8160906fbf7664f49c9c37a75449a4cbcc12e9658f6', 'A new source needs a fresh visual review.'
function = read(P/'function-review.json')
render = read(P/'render-receipt.json')
assert function['passed'] and function['sourceSha256'] == render['sourceSha256'] == source_sha and render['complete']
assert len(render['renders']) == 13
for item in render['renders']: assert sha(P/item['path']) == item['sha256']

layout = read(ROOT/'docs/3d-town/classic-bookshop-v1/room-layout.json')
layout['roomId'] = 'classic-bookshop-v2'
layout['sourceSha256'] = source_sha
layout['sourceRule'] = 'Descriptive layout reconciled with the exact reviewed v2 source; builder derives from retained station source, not this file.'
for item in layout['instances']:
    if item['id'] == 'shop-counter': item['position'][1] += .18
layout['instances'] += [
    {'id':'shop-v2-rear-joinery','kind':'wall-panel-run','endpoints':[[-6.23,5.832],[1.03,5.832]],'wallPenetrationMeters':.002,'maxProjectionMeters':.073,'heightMeters':1.248},
    {'id':'shop-v2-west-joinery','kind':'wall-panel-run','endpoints':[[-6.282,.47],[-6.282,5.8]],'wallPenetrationMeters':.002,'maxProjectionMeters':.073,'heightMeters':1.248},
    {'id':'shop-v2-east-joinery','kind':'wall-panel-run','endpoints':[[1.082,.47],[1.082,5.8]],'wallPenetrationMeters':.002,'maxProjectionMeters':.073,'heightMeters':1.248},
    {'id':'shop-v2-survey','kind':'original-decorative-diagram','position':[-.37,5.765,2.31],'size':[.98,.06,.68],'worldBound':False},
    {'id':'shop-v2-wall-sconces','kind':'supported-practical-pair','wallPlateCenters':[[-1.23,5.817,2.18],[.74,5.817,2.18]],'sourcePrefix':'shop_v2_sconce','worldBound':False},
]
layout['productionCamera']['viewport']=[1600,900]
write(P/'room-layout.json', layout)
props = {'schema':'classic-bookshop-props.v2','inheritedDistrictProps':{'path':'../classic-station-v1/props.json','sha256':sha(ROOT/'docs/3d-town/classic-station-v1/props.json')},'props':[
    {'id':'bookshop-wall-joinery','class':'architectural','function':'Backed recess panels, stiles, rails and dado caps establish a continuous dark timber base.','attachmentFace':'Three retained walls; measured 2 mm overlap','sourcePrefixes':['shop_v2_rear_','shop_v2_west_','shop_v2_east_'],'rejectionCriteria':['Daylight gap behind backing','Route narrowed below capsule clearance','Unsupported cap']},
    {'id':'bookshop-wall-sconces','class':'practical-light','function':'A pair of supported brass arms, sockets, spiders and pleated shades frames the repair corner.','attachmentFace':'Rear wall; measured 1.5 mm plate overlap','sourcePrefixes':['shop_v2_sconce_'],'rejectionCriteria':['Floating wall plate','Bulb visibly hanging below socket','Shade without support']},
    {'id':'bookshop-survey-frame','class':'secondary','function':'Restrained original railway-quarter diagram, without authoritative clues.','dimensionsMeters':[.98,.06,.68],'attachmentFace':'Rear wall','sourcePrefixes':['shop_v2_survey_'],'rejectionCriteria':['Frame obscures head','Fake authoritative case information']},
    {'id':'bookshop-counter','class':'retained-service-workplace','function':'Retained counter and all supported objects moved 0.18 m rearward, opening the front turn into the staff passage.','position':[-.25,3.53],'attachmentFace':'floor','rejectionCriteria':['Blocked staff passage','Floating ledger, lamp or bell']},
]}
for item in props['props']:
    item.update({'authorship':'Original project Blender geometry, with retained licensed wood texture.','humanArtApproved':False,'paidGeneration':False})
write(P/'props.json',props)
write(P/'placements.json',{'schema':'classic-bookshop-placements.v2','sourceSha256':source_sha,'layoutSha256':sha(P/'room-layout.json'),'counterTranslationMeters':[0,.18,0],'staffWaypoint':[.60,3.30],'residentCast':{'path':'../../../public/assets/classic-residents/v10/cast.json','sha256':sha(ROOT/'public/assets/classic-residents/v10/cast.json')},'residentPlacementRule':'All three resident positions and the independent workstand are retained. Render reference collection is excluded from the environment export.','decorativeDiagramWorldBound':False})
brief=read(P/'room-brief.json');brief['binding']='Bookshop environment art/navigation candidate. Decorative diagrams, clocks, notes and character demonstrations are not authoritative simulation events.';write(P/'room-brief.json',brief)

validator=Path('E:/CodexData/.codex/plugins/cache/openai-curated-remote/build-3d-game-rooms/0.3.3/skills/build-3d-game-rooms/scripts/validate_room.py')
gates={}
for gate in ('function','form'):
    result=subprocess.run([sys.executable,str(validator),str(P),'--gate',gate],capture_output=True,text=True,encoding='utf-8')
    log=P/f'formal-skill-{gate}.log';log.write_text(result.stdout+result.stderr,encoding='utf-8')
    gates[gate]={'passed':result.returncode==0,'report':log.name,'sha256':sha(log),'scope':'Formal plugin package schema; separate from measured local Function and agent visual inspection. Human approvals remain pending.'}

write(P/'form-review.json',{'schema':'classic-bookshop-form-review.v2','createdAtUnix':time.time(),'sourceSha256':source_sha,'functionReviewSha256':sha(P/'function-review.json'),'renderReceiptSha256':sha(P/'render-receipt.json'),'reviewer':'Codex inspected all 13 actual formal-02 Cycles PNGs via view_image after the corrected Function check.','renderCoverage':[r['view'] for r in render['renders']],'candidatePreviewEligible':True,'humanFormApproved':False,'observations':[
    'Production cutaway shows dark timber backing and rails below muted olive wallpaper, preserving readable bookcases and a clear central browsing space.',
    'Workbench view shows the retained actual resident with hands and book over the independent repair stand, framed by wood joinery rather than a blank wall.',
    'Four corners and low entry show open door and clear floor. Counter shift creates a wider front turn into the staff passage; no props were detached from its surface.',
    'Ceiling-up and both obliques show closed ceiling substrate, attached beams and suspended pendants. Sconce arms, sockets, shade rims and wall plates are visible together.',
    'Both clay plans are projections of actual source meshes. The render-only character/workstation reference is hidden in diagnostic plans and corners; Function meshes include the workstand separately.',
    'Exterior district stays unchanged at this scale. No new downloaded assets, paid generation or external mesh service was used.'
],'repairs':['Panel backing and sconce plates seated into the real wall','Service counter assembly shifted 0.18 m rearward','Removed redundant exposed sconce bulb and added socket/spider support','Reduced subdivisions only on small new diagram lines and lamp struts; static geometry 617251 triangles'],
'limitations':['Local art candidate; user/human art review remains pending.','Books and decorative diagram are simplified; diagnostic wide lenses distort edge proportions.','Workbench render crops the upper map and sconces to prioritize the resident; production and corner views provide full context.','Dynamic runtime lighting must be verified separately; no baked-lightmap or Cycles/runtime equivalence claim.','Three stationary art residents are not autonomous Agent behavior or case events.'],
'formalSkillGates':gates,'candidateAuthorization':'User explicitly requested autonomous development of the approved classical Blender sample before later human review.','recorderSha256':sha(Path(__file__))})
print(json.dumps({'sourceSha256':source_sha,'rendersInspected':len(render['renders']),'formalPluginGates':gates,'localCandidateEligible':True}))
