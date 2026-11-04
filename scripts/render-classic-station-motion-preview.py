"""Render a short native Blender clip; this is not runtime animation playback."""
from pathlib import Path
import bpy,hashlib,importlib.util,json,subprocess
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'docs/3d-town/classic-motion-v2/step-10';OUT=P/'motion-preview';OUT.mkdir(exist_ok=True);assert not any(OUT.iterdir())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def bind(o,a):
 o.animation_data_create();o.animation_data.action=a
 if a.slots:o.animation_data.action_slot=a.slots[0]
source=P/'renders/composed.blend';review=read(P/'renders/render-review.json');assert sha(source)==review['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;home=bpy.data.objects['resident-06_home'];phase=bpy.data.objects['resident-06_phase'];rig=next(o for o in home.children_recursive if o.type=='ARMATURE');root=rig.parent
resident_source=P/'resident-06/resident.blend';assert sha(resident_source)==read(resident_source.parent/'authoring-review.json')['sourceSha256']
# The still composition was saved before unused imported actions had users.
# Load this clip from its pinned resident source and retain it explicitly.
with bpy.data.libraries.load(str(resident_source),link=False)as(available,loaded):loaded.actions=['BackAway','BackAway_Origin']
action,origin=loaded.actions
for a in loaded.actions:a.use_fake_user=True
bind(rig,action);bind(root,origin);phase.location=(0,0,0);phase.rotation_euler=(0,0,0);scene.frame_set(1);bpy.context.view_layer.update();start=root.matrix_world.translation.copy();scene.frame_set(61);bpy.context.view_layer.update();end=root.matrix_world.translation.copy();assert abs(end.y-start.y-.45)<1e-5
entry=next(e for e in read(P.parent/'layout-01/cast-candidate.json')['entries']if e['actorId']=='resident-06');interior=next(r for r in read(P.parent/'layout-01/navigation-candidate.json')['interiors']if r['id']==entry['roomId'])
for obj in scene.objects:
 if obj.type in ('MESH','CURVE','FONT'):obj.visible_camera=obj.get('layer')not in interior['cutawayLayers']
view=next(r for r in review['renders']if r['actorId']=='resident-06'and r['phase']=='ready');camera=scene.camera;camera.location=view['camera'];camera.rotation_euler=(Vector(view['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
spec=importlib.util.spec_from_file_location('room',ROOT/'scripts/build-blender-classic-railway.py');room=importlib.util.module_from_spec(spec);spec.loader.exec_module(room);devices=room.configure(12,800);scene.render.resolution_y=666;scene.render.image_settings.file_format='PNG';frames=[]
scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;replay=OUT/'scene.blend';bpy.ops.wm.save_as_mainfile(filepath=str(replay),compress=True)
for n in range(31):
 f=1+2*n;scene.frame_set(f);bpy.context.view_layer.update();file=OUT/f'{n:03d}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True);frames.append({'sourceFrame':f,'file':file.name,'sha256':sha(file)})
video=OUT/'station-back-away.mp4';ffmpeg=Path('D:/ffmpeg-2026-02-09-git-9bfa1635ae-full_build/ffmpeg-2026-02-09-git-9bfa1635ae-full_build/bin/ffmpeg.exe');assert ffmpeg.exists()
subprocess.run([str(ffmpeg),'-v','error','-n','-framerate','15','-i',str(OUT/'%03d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True,creationflags=0x08000000)
report={'complete':True,'sourceSha256':sha(source),'residentSourceSha256':sha(resident_source),'replaySceneSha256':sha(replay),'clip':'BackAway','sourceFrameRange':[1,61],'previewFrameRate':15,'frames':frames,'video':video.name,'videoSha256':sha(video),'camera':view['camera'],'target':view['target'],'devices':devices,'rendererSha256':sha(Path(__file__)),'scope':'Native Blender pose sequence in the retained scene. Not GLB/browser playback, blend transitions or a performance measurement.','humanApproved':False}
(OUT/'review.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');(OUT/'renderer.py').write_bytes(Path(__file__).read_bytes());print(json.dumps({'complete':True,'frames':len(frames),'video':str(video)}),flush=True)
