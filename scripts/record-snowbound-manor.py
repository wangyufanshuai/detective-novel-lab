"""Assemble truthful candidate records without substituting tool checks for art approval."""
from pathlib import Path
from collections import Counter
import json,math,hashlib

ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/snowbound-manor-v1'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

source_sha=sha(P/'snowbound-manor.blend')
function=read(P/'function-review.json');renders=read(P/'renders/render-receipt.json');plans=read(P/'plans/render-receipt.json')
assert function['sourceSha256']==renders['sourceSha256']==plans['sourceSha256']==source_sha
placements=read(P/'placements.json')['instances'];credits=read(P/'licensed/provenance.json')['assets']
for group in [renders,plans]:
    for item in group['renders']:assert sha(P/item['path'])==item['sha256']
counts=Counter(p['asset'] for p in placements)
asset_dimensions={a['id']:a['dimensions'] for a in read(P/'asset-study.json')}
brief=read(P/'room-brief.json')
brief.update({'purpose':'Snowbound classical detective manor: exterior, arrival and main lounge art candidate.',
 'runtimeSurface':'Background Blender source and fixed production/review cameras. Three.js integration pending.',
 'boundsMeters':[22.8,13,10.9],
 'hero':{'id':'hearth-conversation-group','role':'fireplace, clock and seated conversation as the hall focal point','reservedBoundsMeters':[6.8,4.95,3.8]},
 'symmetry':{'mode':'bilateral','order':2,'appliesTo':['architecture','barriers','circulation','repeatedProps'],
             'exceptions':['Sofa versus two armchairs expresses a conversational group.','Arrival register and luggage have different functions.','Forest and drifts follow irregular natural distribution.']},
 'circulation':{'description':'2.5 m main aperture; arrival runner branches around conversation group to fireplace, registry and two closed wing doors.','targetMinimumClearanceMeters':.9,'verification':'2D navigation for radius 0.27 m with 0.012 m margin; full clearance and live controller acceptance remain open.'},
 'productionCamera':{'viewport':[1920,1080],'location':[5.15,1.05,2.05],'target':[-.35,7.2,1.8],'verticalFovDegrees':math.degrees(2*math.atan(20.25/(2*25)))},
 'performanceBudget':{'maxSceneTriangles':1500000,'maxVLowBytes':12582912,'maxHighTextureBytes':134217728},
 'creditBudget':{'maximumCredits':0,'approvalRequired':True},
 'environment':{'type':'none','identity':'original blue-hour world and volumetric exterior haze','source':'scripts/build-snowbound-manor.py','assignmentKey':'snowbound-manor-v1'},
 'artifacts':{'floorPlan':'plans/lower-room.png','reflectedCeilingPlan':'plans/reflected-ceiling.png','planMetadata':'plan-metadata.json','wallElevations':['plans/front-elevation.png'],'visualTarget':'ART-DIRECTION.zh-CN.md','openingContactSheet':'plans/front-apertures.png'},
 'artifactLimitations':['Opening projection covers the main facade; per-opening masks for all upper/wing apertures are not yet produced.'],
 'scope':'local candidate; no human art, live runtime, real device or Agent acceptance'})
write(P/'room-brief.json',brief)
props=[]
for a in credits:
    if a['id'] not in counts:continue
    p=next(p for p in placements if p['asset']==a['id']);lo,hi=p['evaluatedBounds']
    props.append({'id':a['id'],'function':'Ceiling pendant' if a['id']=='Chandelier_03' else 'Period room furnishing',
      'description':a['id']+' from '+a['page'],'class':'hero' if a['id']=='sofa_03' else 'reusable',
      'dimensionsMeters':[v*p['uniformScale'] for v in asset_dimensions[a['id']]],'attachmentFace':'ceiling' if a['id']=='Chandelier_03' else 'freestanding' if a['id']=='mantel_clock_01' else 'floor',
      'semanticFront':'negative-z' if a['id']=='Chandelier_03' else 'negative-y','intendedInstances':counts[a['id']],
      'targetPolycount':60000,'rejectionCriteria':['provider checksum disagreement','incorrect orientation or support','unreadable or unsuitable period silhouette'],
      'source':{'provider':'Poly Haven','license':'CC0-1.0','provenance':'licensed/provenance.json'},
      'reviewImage':'renders/asset-study.png','humanApproved':False,'attempts':[]})
write(P/'props.json',{'schema':'game-room.prop-manifest.v1','roomId':'snowbound-manor-v1',
                    'generation':{'provider':'not-used','apiModel':None,'hardCreditCeiling':0,'paidCalls':0},'assets':props})
instances=[]
for p in placements:
    item=dict(p,assetId=p['asset'])
    if p['asset']=='Chandelier_03':item.update({'attachmentFace':'top','support':'visible ceiling rose and suspension stem'})
    elif p['asset']=='mantel_clock_01':item.update({'attachmentFace':'bottom','support':'mantel top at 2.445 m'})
    else:item.update({'attachmentFace':'bottom','support':'carpet top or timber floor as declared by placement elevation'})
    instances.append(item)
write(P/'room-layout.json',{'schema':'game-room.layout.v1','roomId':'snowbound-manor-v1','units':'meters',
 'surfaces':[{'id':s['id'],'sourceObject':s['id'],'source':'snowbound-manor.blend'} for s in function['structuralShells']],
 'instances':instances, 'productionCamera':brief['productionCamera']})
plan=read(P/'plan-metadata.json');plan.update({'style':'monochrome-engineering','projectionSource':'actual-meshes',
 'layers':['lower-room','reflected-ceiling'],'semanticLabelsOutsideImage':True,'aiInspirationIncluded':False,
 'coverage':['room-outline','cutouts','openings','exterior-apron','main-sign','ingress-props','floor-markers','barriers','columns','circulation','placed-features'],
 'sourceSha256':source_sha,'geometry':'plans/render-receipt.json','labels':'scene-contract.json',
 'notes':'Source geometry projections. Navigation paths and object IDs are in metadata rather than painted into the plan.'})
write(P/'plan-metadata.json',plan)
reviews=read(P/'milestone-reviews.json')
reviews['function'].update({'status':'candidate-automated-subset-reviewed','evidence':['function-review.json','plans/lower-room.png','scene-contract.json'],
 'strangestElement':'Both side doors are deliberately closed: their destination rooms are outside the current sample.',
 'notes':'Human approval remains absent. The measured subset is not full Function signoff.'})
reviews['form'].update({'status':'candidate-visual-review','evidence':['form-review.json','renders/render-receipt.json'],
 'strangestElement':'Flames and repeated background foliage remain simplified effects.',
 'notes':'See actual image inspection and limitations in form-review.json. Human approval is false.'})
reviews['runtime'].update({'status':'not-run','notes':'No browser export, real-device or Windows package acceptance in this art-first stage.'})
write(P/'milestone-reviews.json',reviews)
report=read(P/'final-report.json');report.update({'status':'local-blender-art-candidate','sourceSha256':source_sha,
 'verification':'package-verification.json',
 'postmortem':{'observations':['The exterior and hall are native modeled scenes; Agent and runtime acceptance remain separate.'],
              'corrections':['Replaced paper-like trees with licensed fir variants.','Refined rug, local lighting and area-light visibility.','Moved obstructed review cameras and adjusted two navigation observation points.'],
              'remainingRisks':[issue['description'] for issue in read(P/'form-review.json')['openIssues']]},
 'gates':{'function':False,'form':False,'runtime':False},'humanArtApproved':False,
 'automatedSubset':{'function':function['passedAutomatedSubset'],'details':'function-review.json'},
 'reviewRenders':{'corners':['renders/corner-'+x+'.png' for x in ['sw','se','ne','nw']],
                 'ceiling':['renders/ceiling-up.png','renders/ceiling-oblique-a.png','renders/ceiling-oblique-b.png']},
 'delivered':['snowbound-manor.blend','renders/exterior.png','renders/manor-gate.png','renders/hall.png','renders/hearth-detail.png','plans/lower-room.png'],
 'remaining':['art-direction feedback','full runtime texture/lighting export','browser and target-device measurements','Agent residents, case simulation and room interiors'],
 'skillAdapter':'The generic validator also requires a different opening schema, Meshy generation and human signoff. This package uses a custom source-bound opening audit, zero-spend public-CC0 assets and original geometry. It does not claim that validator passed.'})
write(P/'final-report.json',report)
if (P/'browser-review.json').exists():
    browser=read(P/'browser-review.json')
    assert browser['sourceSha256']==source_sha
    for file,digest in browser['sourceFiles'].items():assert sha(ROOT/file)==digest,file
    report.update({'status':'native-and-browser-art-candidate','browserReview':'browser-review.json'})
    report['automatedSubset']['browserSmoke']=True
    report['delivered'].append('http://127.0.0.1:3187/snowbound-manor')
    report['runtimeChecks'].update({'textureTiers':True,'lightingManifest':True,
        'browserCapture':'../../../output/playwright/snowbound-manor-hall-final.png',
        'performanceEvidence':'browser-review.json','scope':'Local short browser samples on the current Windows computer. Full release and human Runtime gates remain false.'})
    report['remaining']=['art refinement and user review','indirect-light parity and further geometry optimization',
                         'long-duration and packaged Windows validation','visible character, Agent residents and case simulation']
    report['postmortem']['remainingRisks']=[i['description'] for i in read(P/'form-review.json')['openIssues'] if i['id']!='runtime']+browser['visualReview']['openIssues']
    reviews['runtime'].update({'status':'local-browser-candidate-checked','evidence':['browser-review.json'],
        'notes':'Current Windows/Chromium short samples passed the observed 60 Hz frame budget; no human, packaged-build or cross-device acceptance is claimed.'})
    write(P/'milestone-reviews.json',reviews);write(P/'final-report.json',report)
print(json.dumps({'sourceSha256':source_sha,'renders':len(renders['renders']),'routes':len(function['routes']),'automatedSubset':function['passedAutomatedSubset'],'humanArtApproved':False}),flush=True)
