import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createNoirTestLoader } from './noir-player-test-loader.mjs';

const { createMotionPreviewPlayback } = createNoirTestLoader().load('app/town-play/art-sample/motion-preview.ts');
const file = 'public/assets/classic-motion/v2-step15/motion.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.throws(() => createMotionPreviewPlayback(data, 'stale-scene'));
assert.throws(() => createMotionPreviewPlayback({ ...data, worldBound: true }, data.sceneAssetSha256));
const rows = [];
for (const actorId of ['resident-03', 'resident-06', 'resident-08']) for (const frequency of [30, 60, 120]) {
  const player = createMotionPreviewPlayback(data, data.sceneAssetSha256);
  player.start(actorId);
  const home = data.routes.find(r => r.actorId === actorId && r.kind === 'departure').samples[0].slice(3, 5);
  const clips = new Set(); let last = null, maximumSpeed = 0, maximumAngularSpeed = 0, samples = 0;
  while (player.actorId && samples < 6000) {
    const pose = player.update(1 / frequency); samples++; clips.add(pose.clip);
    assert([...pose.position, pose.yaw, pose.seconds].every(Number.isFinite));
    if (last) {
      maximumSpeed = Math.max(maximumSpeed, Math.hypot(...pose.position.map((x, i) => x - last.position[i])) * frequency);
      const delta = Math.atan2(Math.sin(pose.yaw - last.yaw), Math.cos(pose.yaw - last.yaw));
      maximumAngularSpeed = Math.max(maximumAngularSpeed, Math.abs(delta) * frequency);
    }
    last = pose;
  }
  assert.equal(player.actorId, null, 'The route must terminate');
  assert.equal(player.diagnostics().completed, 1);
  assert(Math.hypot(...last.position.map((x, i) => x - home[i])) < .000001, 'Return to the same workplace');
  assert(maximumSpeed <= 1.05001, `No route teleport or double root motion: ${actorId} ${frequency} Hz ${maximumSpeed} m/s`);
  assert.deepEqual([...clips].sort(), ['ApproachWork', 'BackAway', 'Idle', 'TurnLeft', 'Walk']);
  player.start(actorId); player.update(.1); player.stop(); assert.equal(player.update(.1), null);
  rows.push({ actorId, frequency, samples, maximumSpeed, maximumAngularSpeedRadians: maximumAngularSpeed });
}
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { complete: true, passed: true, rows, motionSha256: hash(file),
  controllerSha256: hash('app/town-play/art-sample/motion-preview.ts'),
  remaining: ['Large route-corner heading changes still need authored curved or planted turns; this check establishes position continuity and lifecycle, not natural motion.'],
  humanApproved: false };
fs.writeFileSync('docs/3d-town/classic-motion-v2/step-15/preview-playback-diagnostic.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, runs: rows.length, maxLinearSpeed: Math.max(...rows.map(r => r.maximumSpeed)), maxAngularSpeed: Math.max(...rows.map(r => r.maximumAngularSpeedRadians)) }));
