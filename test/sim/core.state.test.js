// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  updateCpState,
  runControlCycle,
} = require("../../modules/sim");

test("updateCpState transitions FREE -> CONGESTED -> FREE", () => {
  const cp = new CongestionPoint("CP_T", 0, 50, 40);
  const p = new Participant("P_T", 10, 10);
  cp.addChild(p);
  p.meting = 22;

  cp.meting = 62;
  let events = runControlCycle([cp], 3000);
  const enter = events.get("CP_T");
  assert.equal(enter.event, "ENTER_CONGESTION");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(p.setpoint, p.basis);

  cp.meting = 35;
  events = runControlCycle([cp], 4000);
  const exit = events.get("CP_T");
  assert.equal(exit.event, "EXIT_CONGESTION");
  assert.equal(cp.state, "FREE");
  assert.equal(p.setpoint, p.basis + p.flexContract);
});

test("updateCpState keeps CONGESTED when meting is below upperLimit but not below releaseLimit", () => {
  const cp = new CongestionPoint("CP_H", 0, 50, 40);
  const p = new Participant("P_H", 10, 10);
  cp.addChild(p);
  p.meting = 25;

  cp.meting = 60;
  const enter = updateCpState(cp, 5000);
  assert.equal(enter.event, "ENTER_CONGESTION");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(p.setpoint, p.basis);

  cp.meting = 45;
  const noRelease = updateCpState(cp, 6000);
  assert.equal(noRelease.event, "NO_CHANGE");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(p.setpoint, p.basis);
});

test("updateCpState adjusts again when CP stays congested in next cycle", () => {
  const cp = new CongestionPoint("CP_R", 0, 50, 40);
  const p1 = new Participant("P_R1", 10, 10);
  const p2 = new Participant("P_R2", 10, 5);
  cp.addChild(p1);
  cp.addChild(p2);

  p1.meting = 18;
  p2.meting = 17;

  cp.meting = 56;
  const first = updateCpState(cp, 7000);
  assert.equal(first.event, "ENTER_CONGESTION");
  assert.equal(p1.setpoint, p1.basis);
  assert.equal(p2.setpoint, p2.basis + p2.flexContract);

  cp.meting = 58;
  const second = updateCpState(cp, 8000);
  assert.equal(second.event, "ADJUST_CONGESTION");
  assert.equal(p2.setpoint, p2.basis);
});

test("ENTER_CONGESTION can clamp both flex and non-flex participants to basis", () => {
  const cp = new CongestionPoint("CP_MIX", 0, 50, 40);
  const pFlex = new Participant("P_FLEX", 10, 10);
  const pNoFlex = new Participant("P_NO_FLEX", 10, 5);
  cp.addChild(pFlex);
  cp.addChild(pNoFlex);

  pFlex.meting = 15;   // flexUse = 5
  pNoFlex.meting = 10; // flexUse = 0
  cp.meting = 60;      // remaining = 10

  const enter = updateCpState(cp, 9000);
  assert.equal(enter.event, "ENTER_CONGESTION");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(pFlex.setpoint, pFlex.basis);
  assert.equal(pNoFlex.setpoint, pNoFlex.basis);
});
