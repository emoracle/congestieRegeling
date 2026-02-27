// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  updateCpState,
} = require("../../modules/sim");

test("scenario_arbo1: nested CP congestion flow", () => {
  const cp01 = new CongestionPoint("CP_01", 0, 150, 130);
  const cp11 = new CongestionPoint("CP_11", 1, 60, 50);

  const p111 = new Participant("P_111", 10, 5);
  const p112 = new Participant("P_112", 10, 10);
  const p113 = new Participant("P_113", 10, 15);

  cp11.addChild(p111);
  cp11.addChild(p112);
  cp11.addChild(p113);
  cp01.addChild(cp11);

  // Cycle 1: CP_11 congested, CP_01 not congested.
  cp01.meting = 140;
  cp11.meting = 77;

  p111.meting = 12;
  p112.meting = 16;
  p113.meting = 25;

  let eventResult = updateCpState(cp01, 7000);
  assert.equal(eventResult.event, "NO_CHANGE");

  eventResult = updateCpState(cp11, 8000);
  assert.equal(eventResult.event, "ENTER_CONGESTION");

  // p111 blijft ongewijzigd in deze cyclus, p112/p113 worden beperkt door CP_11.
  assert.equal(p111.setpoint, p111.basis + p111.flexContract);
  assert.equal(p112.setpoint, p112.basis);
  assert.equal(p113.setpoint, p113.basis);
  assert.equal(p112.activeRestrictions.has("CP_11"), true);
  assert.equal(p113.activeRestrictions.has("CP_11"), true);

  // Cycle 2: CP_01 congested, CP_11 below releaseLimit.
  cp01.meting = 152;
  cp11.meting = 45;

  p111.meting = 13;
  p112.meting = 12;
  p113.meting = 14;

  eventResult = updateCpState(cp01, 9000);
  assert.equal(eventResult.event, "ENTER_CONGESTION");

  // p111 wordt door CP_01 beperkt en maakt de remaining direct 0.
  // Deelnemers die al op basis staan door CP_11 krijgen CP_01 ook als actieve inklemmer.
  assert.equal(p111.setpoint, p111.basis);
  assert.equal(p112.setpoint, p112.basis);
  assert.equal(p113.setpoint, p113.basis);

  assert.equal(p111.activeRestrictions.has("CP_11"), false);    
  assert.equal(p112.activeRestrictions.has("CP_11"), true );  
  assert.equal(p113.activeRestrictions.has("CP_11"), true);

  assert.equal(p111.activeRestrictions.has("CP_01"), true);
  assert.equal(p112.activeRestrictions.has("CP_01"), true);
  assert.equal(p113.activeRestrictions.has("CP_01"), true);
});
