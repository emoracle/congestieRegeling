// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  restrictOnCp,
  releaseOnCp,
  runControlCycle,
} = require("../../modules/sim");

test("restrictOnCp limits participants by priority and reduces remaining", () => {
  const cp = new CongestionPoint("CP_X", 0, 50, 45);
  const pLow = new Participant("P_LOW", 10, 5);
  const pHigh = new Participant("P_HIGH", 10, 20);

  pLow.meting = 15;
  pHigh.meting = 25;
  cp.meting = 60;
  cp.addChild(pLow);
  cp.addChild(pHigh);

  const res = restrictOnCp(cp, 1000);

  assert.equal(res.remaining, 0);
  assert.equal(res.changed.length, 1);
  assert.equal(res.changed[0].id, "P_HIGH");
  assert.equal(pHigh.setpoint, pHigh.basis);
  assert.equal(pLow.setpoint, pLow.basis + pLow.flexContract);
});

test("releaseOnCp does not raise setpoint when another CP restriction remains", () => {
  const cpA = new CongestionPoint("CP_A", 0, 80, 70);
  const cpB = new CongestionPoint("CP_B", 0, 80, 70);
  const p = new Participant("P_1", 10, 10);
  cpA.addChild(p);

  p.activeRestrictions.add(cpA.id);
  p.activeRestrictions.add(cpB.id);
  p.recomputeSetpoint();
  assert.equal(p.setpoint, 10);

  const { changed } = releaseOnCp(cpA, 2000);
  assert.equal(changed.length, 0);
  assert.equal(p.setpoint, 10);
  assert.ok(p.activeRestrictions.has("CP_B"));
});

test("restriction uses measured flex reduction and release restores contracted flex setpoint", () => {
  const cp = new CongestionPoint("CP_ASYM", 0, 100, 90);
  const p = new Participant("P_ASYM", 10, 5);
  cp.addChild(p);

  p.meting = 30;
  cp.meting = 106;

  let events = runControlCycle([cp], 9000);
  const restrict = events.get("CP_ASYM");
  assert.equal(restrict.remaining, 0);
  assert.equal(restrict.changed.length, 1);
  assert.equal(restrict.changed[0].id, "P_ASYM");
  assert.equal(restrict.changed[0].flexReduced, 20);
  assert.equal(p.setpoint, p.basis);

  cp.meting = 80;
  events = runControlCycle([cp], 10000);
  const exit = events.get("CP_ASYM");

  assert.equal(exit.event, "EXIT_CONGESTION");
  assert.equal(p.setpoint, p.basis + p.flexContract);
});

test("releaseOnCp releases in order within budget and tracks remaining", () => {
  const cp = new CongestionPoint("CP_BUDGET", 0, 150, 100);
  const pA = new Participant("P_A", 10, 50);
  const pB = new Participant("P_B", 10, 40);
  const pC = new Participant("P_C", 10, 60);
  cp.addChild(pA);
  cp.addChild(pB);
  cp.addChild(pC);

  for (const p of [pA, pB, pC]) {
    p.activeRestrictions.add(cp.id);
    p.recomputeSetpoint();
  }

  // Volgorde via oudste interventie eerst.
  pA.lastInterventionAt = 1;
  pB.lastInterventionAt = 2;
  pC.lastInterventionAt = 3;

  const { changed, remaining } = releaseOnCp(cp, 11000, undefined, 80);

  assert.deepEqual(changed.map((c) => c.id), ["P_A", "P_B"]);
  assert.equal(remaining, 0);
  assert.equal(pA.setpoint, pA.basis + pA.flexContract);
  assert.equal(pB.setpoint, pB.basis + pB.flexContract);
  assert.equal(pC.setpoint, pC.basis);
});
