import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const expected = [100, 1000, 5000];

for (const ticks of expected) {
  const file = path.join(root, 'outputs', `population-flow-fairness-${ticks}.json`);
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(receipt.schema, 'population-flow-fairness.v1', `${ticks} schema`);
  assert.equal(receipt.evidenceClass, 'local-synthetic-source-fixture', `${ticks} evidence class`);
  assert.equal(receipt.status, 'candidate', `${ticks} status`);
  assert.equal(receipt.ticks, ticks, `${ticks} tick count`);
  assert.equal(receipt.policy.maxResidents, 18, `${ticks} resident cap`);
  assert.equal(receipt.policy.cadenceTicks, 5, `${ticks} cadence`);
  assert.equal(receipt.deterministicRepeat, true, `${ticks} deterministic repeat`);
  assert.equal(receipt.structuralPass, true, `${ticks} structural pass`);
  const expectedCases = ticks === 100 ? 6 : 20;
  for (const lane of [receipt.baseline, receipt.enabled]) {
    assert.equal(lane.ticks, ticks, `${ticks} lane ticks`);
    assert.ok(lane.runtimeMs > 0, `${ticks} runtime receipt`);
    assert.equal(lane.structural.duplicateNewcomerIds, 0, `${ticks} duplicate newcomer ids`);
    assert.equal(lane.structural.duplicateArrivalIds, 0, `${ticks} duplicate arrival ids`);
    assert.equal(lane.structural.duplicateSourceIds, 0, `${ticks} duplicate source ids`);
    assert.equal(lane.structural.missingSourceEvents, 0, `${ticks} missing source events`);
    assert.equal(lane.structural.missingArrivalEvents, 0, `${ticks} missing arrival events`);
    assert.equal(lane.structural.overResidentCap, false, `${ticks} resident cap`);
    assert.equal(lane.triggeredCaseCount, expectedCases, `${ticks} triggered case count`);
    assert.equal(lane.nonfatalCaseCount, expectedCases, `${ticks} nonfatal case count`);
  }
  assert.equal(receipt.baseline.enabled, false, `${ticks} baseline disabled`);
  assert.equal(receipt.enabled.enabled, true, `${ticks} enabled lane`);
  assert.equal(receipt.baseline.population, 10, `${ticks} baseline population`);
  assert.equal(receipt.enabled.population, 18, `${ticks} enabled population cap`);
  assert.equal(receipt.enabled.newcomerCount, 8, `${ticks} newcomer count`);
  assert.notEqual(receipt.baseline.digest, receipt.enabled.digest, `${ticks} policy lanes have distinct state digests`);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'population-flow-fairness-receipts',
  ticks: expected,
  evidenceClass: 'local-synthetic-source-fixture',
  status: 'candidate'
}));
