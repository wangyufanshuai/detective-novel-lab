"""Render the actual saved Walk cloth cycle as an in-place Blender preview."""
from pathlib import Path
import argparse,bpy,hashlib,importlib.util,json,subprocess,sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/3d-town/classic-motion-v2'
p=argparse.ArgumentParser();p.add_argument('--pilot',default='step-12');p.add_argument('--actor',required=True,choices=['resident-03','resident-08']);args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
P=BASE/args.pilot;OUT=P/'motion-previews'/args.actor;OUT.mkdir(parents=True,exist_ok=True);assert not any(OUT.iterdir())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def bind(o,a):
 o.animation_data_create();o.animation_data.action=a
 if a and a.slots:o.animation_data.action_slot=a.slots[0]
source=P/'renders/composed.blend';review=read(P/'renders/render-review.json');assert review['complete']and sha(source)==review['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;home=bpy.data.objects[args.actor+'_home'];phase=bpy.data.objects[args.actor+'_phase'];rig=next(o for o in home.children_recursive if o.type=='ARMATURE');root=rig.parent
resident=P/args.actor/'resident.blend';assert sha(resident)==read(resident.parent/'authoring-review.json')['sourceSha256']
with bpy.data.libraries.load(str(resident),link=False)as(available,loaded):loaded.actions=['Walk']
action=loaded.actions[0];action.use_fake_user=True;bind(rig,action);bind(root,None);root.location=(0,0,0);root.rotation_euler=(0,0,0)
entry=next(e for e in read(BASE/'layout-01/cast-candidate.json')['entries']if e['actorId']==args.actor);interior=next(r for r in read(BASE/'layout-01/navigation-candidate.json')['interiors']if r['id']==entry['roomId']);phase.location=(-.55,entry['retreatMeters'],0);phase.rotation_euler=(0,0,0)
for o in scene.objects:
 if o.type in ('MESH','CURVE','FONT'):o.visible_camera=o.get('layer')not in interior['cutawayLayers']
view=next(r for r in review['renders']if r['actorId']==args.actor and r['phase']=='walk-first');camera=scene.camera;camera.location=view['camera'];camera.rotation_euler=(Vector(view['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
spec=importlib.util.spec_from_file_location('room',ROOT/'scripts/build-blender-classic-railway.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room);devices=room.configure(16,960);scene.render.resolution_y=800;scene.render.image_settings.file_format='PNG';scene.render.fps=30;scene.frame_start=1;scene.frame_end=24
scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;replay=OUT/'scene.blend';bpy.ops.wm.save_as_mainfile(filepath=str(replay),compress=True);frames=[]
for n in range(24):
 scene.frame_set(n+1);bpy.context.view_layer.update();file=OUT/f'{n:03d}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True);frames.append({'sourceFrame':n+1,'file':file.name,'sha256':sha(file)})
video=OUT/'skirt-walk-cycle.mp4';ffmpeg=Path('D:/ffmpeg-2026-02-09-git-9bfa1635ae-full_build/ffmpeg-2026-02-09-git-9bfa1635ae-full_build/bin/ffmpeg.exe');assert ffmpeg.exists()
subprocess.run([str(ffmpeg),'-v','error','-n','-stream_loop','2','-framerate','30','-i',str(OUT/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True,creationflags=0x08000000)
report={'complete':True,'actorId':args.actor,'clip':'Walk','sourceSha256':sha(source),'residentSourceSha256':sha(resident),'replaySceneSha256':sha(replay),'previewFrameRate':30,'uniqueFrames':24,'repetitions':3,'frames':frames,'video':video.name,'videoSha256':sha(video),'camera':view['camera'],'target':view['target'],'devices':devices,'rendererSha256':sha(Path(__file__)),'scope':'Three repeats of one native Blender in-place gait cycle. Root translation is held fixed to isolate the authored cloth. Not actual locomotion, transition blending, GLB/browser playback or performance measurement.','humanApproved':False}
(OUT/'review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(OUT/'renderer.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'complete':True,'actor':args.actor,'frames':len(frames),'video':str(video)}),flush=True)
