// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  runControlCycle,
} = require("../../modules/sim");

test("participant release can be delayed for configurable number of cycles", () => {
  const cp = new CongestionPoint("CP_DELAY", 0, 50, 40);
  const p = new Participant("P_DELAY", 10, 5, 3);
  cp.addChild(p);

  p.meting = 20;
  cp.meting = 60;
  let events = runControlCycle([cp], 11000);
  assert.equal(events.get("CP_DELAY").event, "ENTER_CONGESTION");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(p.setpoint, p.basis);

  cp.meting = 35;

  events = runControlCycle([cp], 12000);
  assert.equal(events.get("CP_DELAY").event, "EXIT_CONGESTION");
  assert.equal(cp.state, "FREE");
  assert.equal(p.setpoint, p.basis);

  events = runControlCycle([cp], 13000);
  assert.equal(events.get("CP_DELAY").event, "RELEASE_WAIT");
  assert.equal(p.setpoint, p.basis);

  events = runControlCycle([cp], 14000);
  assert.equal(events.get("CP_DELAY").event, "RELEASE_PROGRESS");
  assert.equal(p.setpoint, p.basis + p.flexContract);
});
