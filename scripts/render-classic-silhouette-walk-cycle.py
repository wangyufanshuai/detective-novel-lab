"""Render the saved comparison actions as a 24-frame review loop."""
from pathlib import Path
import hashlib
import json
import bpy

ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'docs/3d-town/classic-residents-v7'
SOURCE=PACKAGE/'walk-comparison.blend'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
assert scene.camera.name=='walk-comparison'
scene.cycles.samples=24
scene.render.resolution_x=960;scene.render.resolution_y=660
scene.render.resolution_percentage=100;scene.render.fps=30
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
folder=PACKAGE/'animation-review';frames=folder/'frames'
frames.mkdir(parents=True,exist_ok=True)
scene.frame_start=1;scene.frame_end=24;scene.frame_set(1)
scene.render.filepath=str(frames)+'/'
stage=folder/'walk-cycle-preview.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
entries=[]
for frame in range(1,25):
    scene.frame_set(frame);scene.render.filepath=str(frames/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    path=Path(scene.render.filepath)
    entries.append({'frame':frame,'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)})
(folder/'render-review.json').write_text(json.dumps({'schema':'classic-silhouette-walk-cycle.v7',
    'source':SOURCE.relative_to(ROOT).as_posix(),'sourceSha256':sha(SOURCE),
    'builderSha256':sha(Path(__file__)),'stageSourceSha256':sha(stage),
    'renderer':'Cycles','samples':24,'size':[960,660],'framesPerSecond':30,
    'durationSeconds':.8,'frames':entries,'left':'retained v6','right':'v7 candidate',
    'scope':'Actual saved art actions rendered in Blender; no image retouching, frame synthesis, Agent simulation or runtime capture.',
    'humanArtApproved':False},indent=2)+'\n',encoding='utf-8')
