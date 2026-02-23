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

  const changed = releaseOnCp(cpA, 2000);
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
