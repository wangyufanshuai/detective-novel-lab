"""Add the checked inn cape to the rehearsal bundle; reuse unchanged assets."""
from pathlib import Path
import argparse, hashlib, json, re, shutil
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/3d-town/classic-motion-v2'
p = argparse.ArgumentParser(); p.add_argument('--trial', required=True); args = p.parse_args()
assert re.fullmatch(r'cape-[0-9]+', args.trial)
P = BASE / 'step-16' / args.trial
OLD = ROOT / 'public/assets/classic-motion/v2-step15'
DEST = ROOT / 'public/assets/classic-motion/v2-step16-cape'
URL = '/assets/classic-motion/v2-step16-cape/'
EXPORT = P / 'export-candidate-02/resident-08'
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert not DEST.exists(), 'Keep previously packaged candidates immutable'
source = P / 'resident-08/resident.blend'; identity = sha(source)
reviews = {}
for name in ['route-mesh-diagnostic', 'pose-diagnostic', 'retention-review', 'cloth-form-review']:
    file = P / (name + '.json'); review = read(file); assert review['passed'], name
    if review.get('sourceSha256'): assert review['sourceSha256'] == identity
    for name2, value in review.get('sourceHashes', {}).items(): assert sha(ROOT / name2) == value
    reviews[file.relative_to(ROOT).as_posix()] = sha(file)
form = read(P / 'cloth-form-review.json'); assert form['formal'] and form['selectedActor'] == 'resident-08' and len(form['rows']) == 6
assert all(r['sourceSha256'] == identity for r in form['rows'])
assert form.get('capeSelfContactChecked') and all(r['maxima'].get('cape__self') == 0 for r in form['rows'])
if (source.parent / 'motion-edit.json').exists():
    motion_file = P / 'motion-retention-review.json'; motion = read(motion_file)
    assert motion['complete'] and motion['passed'] and motion['sourceSha256'] == identity
    reviews[motion_file.relative_to(ROOT).as_posix()] = sha(motion_file)
visual = read(P / 'assistant-visual-review.json'); assert visual['complete'] and visual['eligibleForFunction'] and visual['sourceSha256'] == identity
assert visual['renderReviewSha256'] == sha(P / 'renders/review.json')
art_form = read(P / 'assistant-form-review.json')
assert art_form['complete'] and art_form['eligibleForBrowserExport'] and art_form['sourceSha256'] == identity
for name, value in art_form['reviews'].items(): assert sha(P / (name + '.json')) == value
blend = read(P / 'blend-diagnostic.json'); assert blend['complete'] and blend['garmentPassed'] and len(blend['rows']) == 19
assert blend['formReviewSha256'] == sha(P / 'cloth-form-review.json')
assert all(r['maximumContacts'].get('cape__self') == 0 for r in blend['rows'])
ground = read(P / 'optimized-runtime-grounding-diagnostic.json'); assert ground['passed'] and ground['complete'] and len(ground['rows']) == 19
assert ground['helperSha256'] == sha(ROOT / 'app/town-play/art-sample/character-grounding.ts')
assert ground['blendPlanSha256'] == sha(P / 'blend-diagnostic.json')
asset = EXPORT / 'optimized.glb'; export = read(EXPORT / 'export-review.json'); optimization = read(EXPORT / 'optimization-review.json')
roundtrip = read(EXPORT / 'optimized-roundtrip-review.json')
assert export['complete'] and export['sourceSha256'] == identity
assert optimization['complete'] and optimization['optimized']['sha256'] == sha(asset)
assert optimization['exportReviewSha256'] == sha(EXPORT / 'export-review.json')
assert optimization['sourceAssetSha256'] == export['asset']['sha256']
assert roundtrip['passed'] and roundtrip['assetSha256'] == sha(asset)
assert ground['assetHashes'][asset.relative_to(ROOT).as_posix()] == sha(asset)
old_receipt = read(BASE / 'step-15/runtime-package-review.json')
for name, value in old_receipt['publicFiles'].items(): assert sha(OLD / name) == value
for name in ['assistant-visual-review.json','assistant-form-review.json','blend-diagnostic.json','optimized-runtime-grounding-diagnostic.json']:
    reviews[(P/name).relative_to(ROOT).as_posix()] = sha(P/name)
DEST.mkdir(parents=True)
shutil.copyfile(asset, DEST / 'resident-08.glb')

def write(name, value):
    file = DEST / name; file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'url': URL + name, 'sha256': sha(file)}

actor = read(OLD / 'resident-08.json')
actor.update(sourceSha256=identity, worldBound=False, humanArtApproved=False,
             construction='Retained character with a narrower continuous double-sided cape and a revised lower-elbow approach/release. Six authored clips with the existing writing contact path and prop timing; skeleton, UVs and materials retained. See source-bound reviews.',
             sourceReviews=P.relative_to(ROOT).as_posix())
actor['asset'] = {'url': URL+'resident-08.glb','sha256':sha(asset),'bytes':asset.stat().st_size}
actor['clips'] = export['clips']; actor_spec = write('resident-08.json', actor)
cast = read(OLD / 'cast.json'); row = next(r for r in cast['entries'] if r['actorId']=='resident-08')
row['manifestUrl'], row['manifestSha256'] = actor_spec['url'], actor_spec['sha256']
cast_spec = write('cast.json', cast)
manifest = read(OLD / 'manifest.json'); manifest['residentCast'] = cast_spec
manifest['sourceReviews'] = P.relative_to(ROOT).as_posix()
manifest['retainedSceneReviews'] = 'docs/3d-town/classic-motion-v2/step-15'
bundle = write('manifest.json', manifest)
retained = {name: value for name,value in old_receipt['publicFiles'].items() if name not in ['cast.json','manifest.json','resident-08.glb','resident-08.json']}
report = {'complete':True,'manifest':bundle,'sourceSha256':identity,'sourceAssetSha256':sha(asset),'sourceReviews':reviews,
          'newFiles':{p.name:sha(p) for p in sorted(DEST.iterdir())},'retainedFiles':{(OLD/name).relative_to(ROOT).as_posix():value for name,value in retained.items()},
          'packagerSha256':sha(Path(__file__)),'worldBound':False,'humanApproved':False,'browserIntegrated':False,
          'scope':'Only the inn resident is repackaged. The reviewed scene, other two residents, navigation and routes are referenced unchanged. This remains a separate rehearsal, without Agent decisions, save migration or novel events.'}
(P/'runtime-package-review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(P/'runtime-packager.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'manifest':bundle,'newBytes':sum(p.stat().st_size for p in DEST.iterdir())}))
