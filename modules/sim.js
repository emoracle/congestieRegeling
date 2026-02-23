// @ts-check
// sim.js  (Node 18+ / 20+)
const fs = require("fs");
const path = require("path");
const Participant = require("./Participant");
const CongestionPoint = require("./CongestionPoint");
const { logCycle, logTopology } = require("./SimulationLogger");
const {
  collectParticipants,
  sortForRestriction,
  restrictOnCp,
  releaseOnCp,
  updateCpState,
  runControlCycle,
} = require("./core");

/**
 * Laadt de topologieconfiguratie vanaf schijf.
 * @param {string} [configPath] Pad naar topology JSON.
 * @returns {{congestionPoints:Array}} Ingelezen topologie-object.
 */
function loadTopologyConfig(configPath = path.join(__dirname, "..", "config", "topology.json")) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

/**
 * Laadt een metingen-inputbestand vanaf schijf.
 * @param {string} [inputPath] Pad naar metingen JSON.
 * @returns {{congestionPoints:Object<string, number>,participants:Object<string, number>}}
 * Metingen voor CP's en deelnemers.
 */
function loadMeasurementsInput(inputPath = path.join(__dirname, "..", "input", "metingen.json")) {
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

/**
 * Past metingen toe op nodes die in de index bekend zijn.
 * @param {Map<string, CongestionPoint|Participant>} nodeIndex Lookup van id naar node.
 * @param {{congestionPoints?:Object<string, number>,participants?:Object<string, number>}} measurements
 * Metingen die toegepast moeten worden.
 * @returns {void}
 */
function applyMeasurements(nodeIndex, measurements) {
  for (const [cpId, meting] of Object.entries(measurements.congestionPoints || {})) {
    const cp = nodeIndex.get(cpId);
    if (cp instanceof CongestionPoint) cp.meting = meting;
  }

  for (const [participantId, meting] of Object.entries(measurements.participants || {})) {
    const participant = nodeIndex.get(participantId);
    if (participant instanceof Participant) participant.meting = meting;
  }
}

/**
 * Registreert een node-id en faalt bij dubbele IDs in de topologie.
 * @param {Map<string, CongestionPoint|Participant>} nodeIndex Lookup waarin nodes worden geregistreerd.
 * @param {string} nodeId Node-id die geregistreerd moet worden.
 * @param {CongestionPoint|Participant} node Node-instantie.
 * @returns {void}
 */
function registerNode(nodeIndex, nodeId, node) {
  if (nodeIndex.has(nodeId)) {
    throw new Error(`Duplicate topology node id: ${nodeId}`);
  }
  nodeIndex.set(nodeId, node);
}

/**
 * Bouwt recursief een node (CP of deelnemer) vanuit config en registreert die in de index.
 * @param {Object} nodeConfig Configfragment van CP of deelnemer.
 * @param {Map<string, CongestionPoint|Participant>} nodeIndex Lookup waarin nodes worden geregistreerd.
 * @returns {CongestionPoint|Participant} Aangemaakte node.
 */
function buildNodeFromConfig(nodeConfig, nodeIndex) {
  const isCpNode = Object.prototype.hasOwnProperty.call(nodeConfig, "schakelgrens");

  if (isCpNode) {
    const cp = new CongestionPoint(
      nodeConfig.id,
      nodeConfig.level,
      nodeConfig.schakelgrens,
      nodeConfig.vrijgavegrens
    );
    registerNode(nodeIndex, cp.id, cp);

    for (const child of nodeConfig.children || []) {
      cp.addChild(buildNodeFromConfig(child, nodeIndex));
    }
    return cp;
  }

  const releaseAfterCycles = nodeConfig.vrijgaveNaCycli
    ?? nodeConfig.releaseAfterCycles
    ?? nodeConfig.releaseAfterCyclus
    ?? 1;
  const participant = new Participant(
    nodeConfig.id,
    nodeConfig.basis,
    nodeConfig.flex,
    releaseAfterCycles
  );
  registerNode(nodeIndex, participant.id, participant);
  return participant;
}

/**
 * Draait een voorbeeldsimulatie met twee meetcycli en logt de resultaten.
 * @returns {void}
 */
function runDemo() {
  const topology = loadTopologyConfig();
  const cycle1Measurements = loadMeasurementsInput(path.join(__dirname, "..", "input", "metingen.json"));
  const cycle2Measurements = loadMeasurementsInput(path.join(__dirname, "..", "input", "metingen_cyclus2.json"));
  const nodeIndex = new Map();
  topology.congestionPoints.forEach((cpCfg) => buildNodeFromConfig(cpCfg, nodeIndex));

  const congestionPoints = Array.from(nodeIndex.values())
    .filter((node) => node instanceof CongestionPoint)
    .sort((a, b) => a.id.localeCompare(b.id));
  const participants = Array.from(nodeIndex.values())
    .filter((node) => node instanceof Participant)
    .sort((a, b) => a.id.localeCompare(b.id));

  /**
   * Draait één cyclus: metingen toepassen, regeling uitvoeren en resultaten loggen.
   * @param {string} title Titel voor de output van de cyclus.
   * @param {{congestionPoints?:Object<string, number>,participants?:Object<string, number>}} measurements
   * Metingen voor deze cyclus.
   * @returns {void}
   */
  function runCycle(title, measurements) {
    applyMeasurements(nodeIndex, measurements);
    const cpEvents = runControlCycle(congestionPoints);
    logCycle(title, congestionPoints, participants, cpEvents);
  }

  logTopology(topology);
  runCycle("Cyclus 1 (metingenset 1):", cycle1Measurements);
  console.log("---");
  runCycle("Cyclus 2 (metingenset 2 - vrijgave):", cycle2Measurements);
}

module.exports = {
  Participant,
  CongestionPoint,
  loadTopologyConfig,
  loadMeasurementsInput,
  applyMeasurements,
  buildNodeFromConfig,
  logTopology,
  collectParticipants,
  sortForRestriction,
  restrictOnCp,
  releaseOnCp,
  updateCpState,
  runControlCycle,
  runDemo,
};

if (require.main === module) {
  runDemo();
}
