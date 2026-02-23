// @ts-check
/**
 * Unit-tests voor topologie-opbouw en kernlogica van congestieregeling.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  Participant,
  CongestionPoint,
  loadTopologyConfig,
  buildNodeFromConfig,
  collectParticipants,
  restrictOnCp,
  releaseOnCp,
  updateCpState,
  runControlCycle,
} = require("../modules/sim");

test("loadTopologyConfig loads 3 level-0 congestion points", () => {
  const topology = loadTopologyConfig();
  const ids = topology.congestionPoints.map((cp) => cp.id);
  assert.deepEqual(ids, ["CP_01", "CP_02", "CP_03"]);
});

test("buildNodeFromConfig builds nested CP tree and participant index", () => {
  const topology = loadTopologyConfig();
  const nodeIndex = new Map();
  const root = buildNodeFromConfig(topology.congestionPoints[0], nodeIndex);

  assert.equal(root.id, "CP_01");
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].id, "CP_11");
  assert.equal(root.children[0].children.length, 3);
  assert.ok(nodeIndex.get("CP_11"));
  assert.ok(nodeIndex.get("P_111"));
});

test("buildNodeFromConfig throws on duplicate participant id", () => {
  const nodeIndex = new Map();
  const cfg = {
    id: "CP_DUP_P",
    level: 0,
    schakelgrens: 50,
    vrijgavegrens: 40,
    children: [
      { id: "P_DUP", basis: 10, flex: 5 },
      { id: "P_DUP", basis: 10, flex: 8 },
    ],
  };

  assert.throws(
    () => buildNodeFromConfig(cfg, nodeIndex),
    /Duplicate topology node id: P_DUP/
  );
});

test("buildNodeFromConfig throws on duplicate congestion point id", () => {
  const nodeIndex = new Map();
  const rootCfg = {
    id: "CP_SAME",
    level: 0,
    schakelgrens: 100,
    vrijgavegrens: 90,
    children: [],
  };
  const duplicateCfg = {
    id: "CP_SAME",
    level: 0,
    schakelgrens: 120,
    vrijgavegrens: 110,
    children: [],
  };

  buildNodeFromConfig(rootCfg, nodeIndex);
  assert.throws(
    () => buildNodeFromConfig(duplicateCfg, nodeIndex),
    /Duplicate topology node id: CP_SAME/
  );
});

test("collectParticipants traverses CP and nested CP participants", () => {
  const topology = loadTopologyConfig();
  const nodeIndex = new Map();
  topology.congestionPoints.forEach((cpCfg) => buildNodeFromConfig(cpCfg, nodeIndex));
  const cp03 = nodeIndex.get("CP_03");

  const participants = collectParticipants(cp03).map((p) => p.id).sort();
  assert.deepEqual(participants, ["P_131", "P_132", "P_133", "P_301"]);
});

test("restrictOnCp limits participants by priority and reduces remaining", () => {
  const cp = new CongestionPoint("CP_X", 0, 50, 45);
  const pLow = new Participant("P_LOW", 10, 5);
  const pHigh = new Participant("P_HIGH", 10, 20);

  pLow.meting = 15;  // flexUse 5
  pHigh.meting = 25; // flexUse 15
  cp.meting = 60;    // remaining 10
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

test("updateCpState transitions FREE -> CONGESTED -> FREE", () => {
  const cp = new CongestionPoint("CP_T", 0, 50, 40);
  const p = new Participant("P_T", 10, 10);
  cp.addChild(p);
  p.meting = 22; // flexUse 12

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

  cp.meting = 45; // onder upperLimit(50), maar niet onder releaseLimit(40)
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

  p1.meting = 18; // flexUse 8
  p2.meting = 17; // flexUse 7

  cp.meting = 56; // remaining 6, eerst p1 beperkt
  const first = updateCpState(cp, 7000);
  assert.equal(first.event, "ENTER_CONGESTION");
  assert.equal(p1.setpoint, p1.basis);
  assert.equal(p2.setpoint, p2.basis + p2.flexContract);

  cp.meting = 58; // blijft congested, p1 al beperkt -> p2 moet nu worden beperkt
  const second = updateCpState(cp, 8000);
  assert.equal(second.event, "ADJUST_CONGESTION");
  assert.equal(p2.setpoint, p2.basis);
});

test("restriction uses measured flex reduction and release restores contracted flex setpoint", () => {
  const cp = new CongestionPoint("CP_ASYM", 0, 100, 90);
  const p = new Participant("P_ASYM", 10, 5);
  cp.addChild(p);

  // Gemeten flex (30 - 10 = 20) is groter dan gecontracteerde flex (5).
  p.meting = 30;
  cp.meting = 106; // congestie = 6

  let events = runControlCycle([cp], 9000);
  const restrict = events.get("CP_ASYM");
  assert.equal(restrict.remaining, 0);
  assert.equal(restrict.changed.length, 1);
  assert.equal(restrict.changed[0].id, "P_ASYM");
  assert.equal(restrict.changed[0].flexReduced, 20);
  assert.equal(p.setpoint, p.basis);

  cp.meting = 80; // onder releaseLimit -> vrijgeven
  events = runControlCycle([cp], 10000);
  const exit = events.get("CP_ASYM");

  assert.equal(exit.event, "EXIT_CONGESTION");
  assert.equal(p.setpoint, p.basis + p.flexContract);
});

test("participant release can be delayed for configurable number of cycles", () => {
  const cp = new CongestionPoint("CP_DELAY", 0, 50, 40);
  const p = new Participant("P_DELAY", 10, 5, 3);
  cp.addChild(p);

  p.meting = 20;
  cp.meting = 60; // trigger congestie
  let events = runControlCycle([cp], 11000);
  assert.equal(events.get("CP_DELAY").event, "ENTER_CONGESTION");
  assert.equal(cp.state, "CONGESTED");
  assert.equal(p.setpoint, p.basis);

  cp.meting = 35; // vrijgavegebied

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
