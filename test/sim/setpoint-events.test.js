// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  restrictOnCp,
  releaseOnCp,
} = require("../../modules/sim");
const { onSetpointChanged } = require("../../modules/SetpointEvents");

test("restrictOnCp emits event when setpoint changes", () => {
  process.env.PARTICIPANT_EVENTS_UDP_DISABLED = "1";

  const cp = new CongestionPoint("CP_EVT_R", 0, 50, 40);
  const p = new Participant("P_EVT_R", 10, 5);
  cp.addChild(p);
  cp.meting = 55;
  p.meting = 16;

  /** @type {Array<any>} */
  const events = [];
  const unsubscribe = onSetpointChanged((event) => events.push(event));
  try {
    const result = restrictOnCp(cp, 1000);
    assert.equal(result.changed.length, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].participantId, "P_EVT_R");
    assert.equal(events[0].cpId, "CP_EVT_R");
    assert.equal(events[0].reason, "RESTRICT");
    assert.equal(events[0].oldSetpoint, 15);
    assert.equal(events[0].newSetpoint, 10);
  } finally {
    unsubscribe();
  }
});

test("releaseOnCp emits event when setpoint changes", () => {
  process.env.PARTICIPANT_EVENTS_UDP_DISABLED = "1";

  const cp = new CongestionPoint("CP_EVT_U", 0, 50, 40);
  const p = new Participant("P_EVT_U", 10, 5);
  cp.addChild(p);

  p.activeRestrictions.add(cp.id);
  p.releaseCountdownByCp.set(cp.id, 0);
  p.recomputeSetpoint();

  /** @type {Array<any>} */
  const events = [];
  const unsubscribe = onSetpointChanged((event) => events.push(event));
  try {
    const { changed } = releaseOnCp(cp, 2000);
    assert.equal(changed.length, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].participantId, "P_EVT_U");
    assert.equal(events[0].cpId, "CP_EVT_U");
    assert.equal(events[0].reason, "RELEASE");
    assert.equal(events[0].oldSetpoint, 10);
    assert.equal(events[0].newSetpoint, 15);
  } finally {
    unsubscribe();
  }
});
