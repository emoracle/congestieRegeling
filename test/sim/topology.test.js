// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadTopologyConfig,
  buildNodeFromConfig,
  collectParticipants,
} = require("../../modules/sim");

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

test("buildNodeFromConfig reads releaseAfterCyclus and defaults to 1", () => {
  const nodeIndex = new Map();
  const cfg = {
    id: "CP_RELEASE_CFG",
    level: 0,
    schakelgrens: 100,
    vrijgavegrens: 90,
    children: [
      { id: "P_WITH_DELAY", basis: 10, flex: 5, releaseAfterCyclus: 1 },
      { id: "P_DEFAULT", basis: 10, flex: 5 },
    ],
  };

  buildNodeFromConfig(cfg, nodeIndex);
  assert.equal(nodeIndex.get("P_WITH_DELAY").releaseAfterCycles, 1);
  assert.equal(nodeIndex.get("P_DEFAULT").releaseAfterCycles, 1);
});

test("collectParticipants traverses CP and nested CP participants", () => {
  const topology = loadTopologyConfig();
  const nodeIndex = new Map();
  topology.congestionPoints.forEach((cpCfg) => buildNodeFromConfig(cpCfg, nodeIndex));
  const cp03 = nodeIndex.get("CP_03");

  const participants = collectParticipants(cp03).map((p) => p.id).sort();
  assert.deepEqual(participants, ["P_131", "P_132", "P_133", "P_301"]);
});
