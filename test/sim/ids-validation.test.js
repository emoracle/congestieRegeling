// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const { buildNodeFromConfig } = require("../../modules/sim");

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
