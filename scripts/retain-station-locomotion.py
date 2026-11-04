"""Retain Idle/Walk in the saved file; keep the measured work action unchanged."""
from pathlib import Path
import importlib.util,json
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupations',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
OLD=w.PACKAGE/'resident-06/gesture-08';OUT=w.PACKAGE/'resident-06/gesture-09';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OLD/'occupation.blend'))
rig=bpy.data.objects['rb-gu-yuanshan_rig'];body=bpy.data.objects['rb-gu-yuanshan_skin']
mesh=w.hands.mesh_identity(body)
def capture():
    w.hands.bind_action(rig,bpy.data.actions['VerifyTimetable']);rows=[]
    for f in range(1,302,10):
        bpy.context.scene.frame_set(f);rows.append({b.name:[float(v) for row in b.matrix for v in row] for b in rig.pose.bones})
    return rows
before=capture()
source=ROOT/'docs/3d-town/classic-residents-v8/resident-06/rb-gu-yuanshan.blend'
with bpy.data.libraries.load(str(source),link=False) as (src,dst):dst.actions=['Idle','Walk']
w.correct_station_actions(rig)
assert capture()==before and w.hands.mesh_identity(body)==mesh
bpy.context.scene.frame_set(121);bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'occupation.blend'))
report=w.read(OLD/'authoring-review.json');report.update(sourceSha256=w.sha(OUT/'occupation.blend'),
    retainedSourceSha256=w.sha(OLD/'occupation.blend'),repairScriptSha256=w.sha(Path(__file__)),
    actionRetentionRepair='Idle and Walk saved with persistent users; their shoulder clearance is rebuilt from v8; sampled VerifyTimetable pose matrices unchanged.',renders=[])
w.write(OUT/'authoring-review.json',report)
(OUT/'builder.py').write_bytes((OLD/'builder.py').read_bytes());(OUT/'action-retention.py').write_bytes(Path(__file__).read_bytes())
bpy.ops.wm.open_mainfile(filepath=str(OUT/'occupation.blend'))
assert all(name in bpy.data.actions for name in ('Idle','Walk','VerifyTimetable'))
print(json.dumps({'sourceSha256':report['sourceSha256'],'retainedActions':list(bpy.data.actions.keys())}),flush=True)
