// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  releaseOnCp,
  getReleaseBudget,
} = require("../../modules/sim");

test("release scenario: budget 130 is consumed in participant order", () => {
  const cp = new CongestionPoint("CP_RELEASE_CASE", 0, 150, 100);
  cp.meting = 20; // vrijgavebudget = 150 - 20 = 130

  const p1 = new Participant("P1", 10, 50);
  const p2 = new Participant("P2", 10, 40);
  const p3 = new Participant("P3", 10, 40);
  const p4 = new Participant("P4", 10, 30);
  cp.addChild(p1);
  cp.addChild(p2);
  cp.addChild(p3);
  cp.addChild(p4);

  // Alle deelnemers zijn vooraf door dit CP beperkt.
  for (const p of [p1, p2, p3, p4]) {
    p.activeRestrictions.add(cp.id);
    p.releaseCountdownByCp.set(cp.id, 0);
    p.recomputeSetpoint();
  }

  // Vrijgavevolgorde: p1 -> p2 -> p3 -> p4
  p1.lastInterventionAt = 1;
  p2.lastInterventionAt = 2;
  p3.lastInterventionAt = 3;
  p4.lastInterventionAt = 4;

  const budget = getReleaseBudget(cp);
  assert.equal(budget, 130);

  const { changed, remaining } = releaseOnCp(cp, 12000, undefined, budget);

  // p1 (50) + p2 (40) + p3 (40) = 130, budget op.
  assert.deepEqual(changed.map((c) => c.id), ["P1", "P2", "P3"]);
  assert.equal(remaining, 0);

  assert.equal(p1.setpoint, p1.basis + p1.flexContract);
  assert.equal(p2.setpoint, p2.basis + p2.flexContract);
  assert.equal(p3.setpoint, p3.basis + p3.flexContract);
  assert.equal(p4.setpoint, p4.basis);

  assert.equal(p1.activeRestrictions.has(cp.id), false);
  assert.equal(p2.activeRestrictions.has(cp.id), false);
  assert.equal(p3.activeRestrictions.has(cp.id), false);
  assert.equal(p4.activeRestrictions.has(cp.id), true);
});
