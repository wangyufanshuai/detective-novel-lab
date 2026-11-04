"""Render the saved inn candidate across the full required room coverage."""
from pathlib import Path
import argparse,importlib.util,json,sys,time
import bpy
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('occupation',ROOT/'scripts/build-blender-occupations.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
p=argparse.ArgumentParser();p.add_argument('--pilot',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=w.PACKAGE/'resident-08'/args.pilot;source=P/'occupation.blend'
author=w.read(P/'authoring-review.json');assert author['sourceSha256']==w.sha(source)
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
w.hands.bind_action(bpy.data.objects['rb-lin-ali_rig'],bpy.data.actions['ReconcileRegister'])
bpy.data.objects['occupation_pen_anchor'].animation_data.action=bpy.data.actions['WriteRegister_Prop']
scene.frame_set(151);devices=w.u.configure(48,1440)
views=['occupation-production','occupation-hands','occupation-side','interior-production','corner-sw','corner-se','corner-nw','corner-ne',
       'low-entry','ceiling-up','ceiling-oblique-a','ceiling-oblique-b','plan-floor','plan-ceiling']
out=P/'formal-renders';out.mkdir(parents=True,exist_ok=True)
report={'schema':'inn-occupation-renders.v1','sourceSha256':w.sha(source),'rendererSha256':w.sha(Path(__file__)),
        'width':1440,'height':scene.render.resolution_y,'samples':48,'devices':devices,'frame':151,'complete':False,'renders':[]}
for view in views:
    for o in scene.objects:
        if o.type not in ('MESH','CURVE','FONT'):continue
        o.visible_camera=True;layer=o.get('layer')
        if view in ('interior-production','occupation-production','occupation-hands','occupation-side') and layer in ('ceiling','inn_upper','inn_front','inn_side_cutaway'):o.visible_camera=False
        if view=='plan-floor' and layer in ('ceiling','inn_upper','inn_shell'):o.visible_camera=False
        if view=='plan-ceiling' and layer!='ceiling':o.visible_camera=False
    scene.camera=bpy.data.objects[view];file=out/(view+'.png');scene.render.filepath=str(file);started=time.perf_counter();bpy.ops.render.render(write_still=True)
    report['renders'].append({'view':view,'path':file.relative_to(P).as_posix(),'sha256':w.sha(file),'seconds':round(time.perf_counter()-started,2)})
    w.write(P/'render-review.json',report)
report['complete']=True;w.write(P/'render-review.json',report);(P/'renderer.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'renders':len(views),'complete':True,'sourceSha256':report['sourceSha256']}),flush=True)
