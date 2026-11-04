"""Inspect a rejected cloth result without changing its saved source."""
from pathlib import Path
import importlib.util
import json
import math
import types
import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
snapshot = ROOT / 'output/character-source-audit/tailoring-full-shirt-experiment.py'
m = types.ModuleType('rejected_tailoring_experiment')
# The snapshot is our own preserved experiment, not an upstream program. Keep
# its original script location for relative inputs while executing its fixed
# contents so later accepted tailoring edits do not change the diagnosis.
m.__file__ = str(ROOT / 'scripts/build-blender-resident-tailoring.py')
exec(compile(snapshot.read_text(encoding='utf-8'), str(snapshot), 'exec'), m.__dict__)
folder = m.PACKAGE / 'diagnostics'
source = folder / 'anatomically_fitted_garment-failed.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
obj = bpy.data.objects['anatomically_fitted_garment']
after = [v.co.copy() for v in obj.data.vertices]
after_edges = [tuple(e.vertices) for e in obj.data.edges]
m.base.setup_stage()
m.u.configure(32, 1100)
scene = bpy.context.scene
scene.render.resolution_y = 1100
scene.camera = bpy.data.objects['tailoring']
scene.render.filepath = str(folder / 'rejected-blouse.png')
bpy.ops.render.render(write_still=True)
# Reconstruct the exact initial cloth positions; no cloth solver is run here.
bpy.ops.wm.read_factory_settings(use_empty=True)
m.inv.SKIN.clear()
profile = next(p for p in json.loads((m.BASE/'profiles.json').read_text(encoding='utf-8'))['profiles'] if p['actorId']=='resident-03')
m.base.materials(profile)
m.original_clothes(profile)
before = next(o for o in m.inv.SKIN if o.name=='anatomically_fitted_garment')
class Captured(Exception):
    pass
def capture(obj, *args, **kwargs):
    raise Captured()
m.settle = capture
try:
    m.soften_blouse()
except Captured:
    pass
assert len(before.data.vertices)==len(after)
assert [tuple(e.vertices) for e in before.data.edges]==after_edges
rows=[]
for edge in before.data.edges:
    a,b=edge.vertices
    old=(before.data.vertices[a].co-before.data.vertices[b].co).length
    new=(after[a]-after[b]).length
    rows.append({'edge':edge.index,'vertices':[a,b],'beforeMeters':old,'afterMeters':new,'ratio':new/max(old,1e-8),
                 'position':list(before.data.vertices[a].co)})
rows.sort(key=lambda r:r['ratio'],reverse=True)
report={'rejectedSourceSha256':m.base.sha(source),'vertices':len(after),'worstEdges':rows[:30],
        'edgesLongerThanOneMmAbove40Percent':sum(r['beforeMeters']>.001 and r['ratio']>1.4 for r in rows),
        'edgesLongerThanFiveMmAbove40Percent':sum(r['beforeMeters']>.005 and r['ratio']>1.4 for r in rows),
        'allEdges':len(rows),'maxAdditionalLength':max(r['afterMeters']-r['beforeMeters'] for r in rows)}
m.base.write(folder/'blouse-edge-diagnosis.json',report)
print(json.dumps({k:v for k,v in report.items() if k!='worstEdges'}))
print(json.dumps(rows[:8]))
