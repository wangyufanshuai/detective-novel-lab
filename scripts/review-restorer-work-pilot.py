from pathlib import Path
import bpy,json,sys,importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('work',ROOT/'scripts/build-blender-restorer-work.py');work=importlib.util.module_from_spec(spec);spec.loader.exec_module(work)
pilot=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'book-03'
folder=work.PACKAGE/'pilots'/pilot
bpy.ops.wm.open_mainfile(filepath=str(folder/'restorer-inspect-book.blend'))
old=work.read(folder/'authoring-review.json')
frames=work.evaluate(bpy.data.objects['rb-xu-zhiwei_skin'],bpy.data.objects['rb-xu-zhiwei_rig'],bpy.data.objects['restorer_book_anchor'],bpy.data.objects['restorer_bound_book'],old['frames'])
keys=['handBookTrianglePairs','handStandTrianglePairs','bookStandTrianglePairs']
summary={key:{'maximum':max(r[key] for r in frames),'frames':[r['frame'] for r in frames if r[key]]} for key in keys}
for side in ('L','R'):
    summary[side]={k:max(r['contacts'][side][k] for r in frames if r['bothHandsRequired']) for k in ('thumbGapMeters','lowerFingerGapMeters')}
    summary[side]['garmentFrames']=[r['frame'] for r in frames if r['contacts'][side]['fingerGarmentTrianglePairs']]
work.write(folder/'independent-contact-review.json',{'sourceSha256':work.sha(folder/'restorer-inspect-book.blend'),'reviewerSha256':work.sha(Path(__file__)),'evaluationSha256':work.sha(ROOT/'scripts/build-blender-restorer-work.py'),'summary':summary,'frames':frames})
print(json.dumps(summary))
