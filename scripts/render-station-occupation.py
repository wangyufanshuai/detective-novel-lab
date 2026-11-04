"""Reopen the saved station candidate and render the required room coverage."""
from pathlib import Path
import importlib.util
import json
import time
import bpy

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation_authoring',ROOT/'scripts/build-blender-occupations.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
FOLDER=w.PACKAGE/'resident-06/gesture-09'
SOURCE=FOLDER/'occupation.blend'
author=w.read(FOLDER/'authoring-review.json');assert w.sha(SOURCE)==author['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
w.hands.bind_action(bpy.data.objects['rb-gu-yuanshan_rig'],bpy.data.actions['VerifyTimetable'])
scene=bpy.context.scene;scene.frame_set(121);devices=w.u.configure(48,1440)
views=['occupation-production','occupation-hands','occupation-side','station-production',
       'station-corner-sw','station-corner-se','station-corner-nw','station-corner-ne',
       'station-low-entry','station-ceiling-up','station-ceiling-oblique-a','station-ceiling-oblique-b',
       'station-plan-floor','station-plan-ceiling']
cut=['station_front','station_side_cutaway','station_ceiling','station_roof','shop_neighbor_cutaway','shop_neighbor_furniture']
out=FOLDER/'formal-renders-02';out.mkdir(parents=True,exist_ok=True)
report={'schema':'station-occupation-renders.v1','sourceSha256':w.sha(SOURCE),'rendererSha256':w.sha(Path(__file__)),
        'width':1440,'height':scene.render.resolution_y,'samples':48,'devices':devices,'frame':121,'complete':False,'renders':[]}
for view in views:
    for obj in scene.objects:
        if obj.type not in ('MESH','CURVE','FONT'):continue
        obj.visible_camera=True
        if view=='station-production' and obj.get('layer') in cut:obj.visible_camera=False
        if view.startswith('occupation-') and obj.get('layer') in ('station_front','station_side_cutaway','station_ceiling','station_roof','shop_neighbor_cutaway','shop_neighbor_furniture'):
            obj.visible_camera=False
        if view=='station-plan-floor' and obj.get('layer') in ('station_roof','station_ceiling','station_shell'):
            obj.visible_camera=False
        if view=='station-plan-ceiling' and obj.get('layer')!='station_ceiling':
            obj.visible_camera=False
    scene.camera=bpy.data.objects[view];image=out/(view+'.png');scene.render.filepath=str(image)
    start=time.perf_counter();bpy.ops.render.render(write_still=True)
    report['renders'].append({'view':view,'path':image.relative_to(FOLDER).as_posix(),'sha256':w.sha(image),'seconds':round(time.perf_counter()-start,2)})
    w.write(FOLDER/'render-review-02.json',report)
report['complete']=True;w.write(FOLDER/'render-review-02.json',report)
(FOLDER/'renderer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'complete':True,'sourceSha256':report['sourceSha256'],'renders':len(report['renders'])}),flush=True)
