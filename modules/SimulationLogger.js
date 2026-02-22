// @ts-check
/**
 * Logt de uitkomst van één simulatiecyclus in leesbaar Nederlands.
 * @param {string} title Titel van de cyclus.
 * @param {Array<{id:string,meting:number,upperLimit:number,releaseLimit:number,state:string}>} congestionPoints
 * Geordende lijst met congestiepunten.
 * @param {Array<{id:string,basis:number,flexContract:number,meting:number,setpoint:number,activeRestrictions:Set<string>}>} participants
 * Geordende lijst met deelnemers.
 * @param {Map<string, {event:string}>} cpEvents Event-resultaten per congestiepunt.
 * @returns {void}
 */
function logCycle(title, congestionPoints, participants, cpEvents) {
  /**
   * Formatteert getallen op vaste breedte van 3 tekens.
   * @param {number} value Numerieke waarde.
   * @returns {string} Rechts uitgelijnde tekst.
   */
  const fmt3 = (value) => String(value).padStart(3, " ");
  const EVENT_WIDTH = 16;

  console.log(title);
  console.log("Overzicht congestiepunten:");
  for (const cp of congestionPoints) {
    const congestionAmount = Math.max(0, cp.meting - cp.upperLimit);
    const congestionText = cp.state === "CONGESTED" ? " wel" : "geen";
    const event = cpEvents.get(cp.id)?.event || "NO_CHANGE";
    const releaseModeText = cp.state === "FREE"
      ? `is in vrijgavemodus`
      : `in congestiemodus`;

    console.log(
      `${cp.id} heeft meting: ${fmt3(cp.meting)} - ${event.padStart(EVENT_WIDTH, " ")}; ${congestionText} congestie (${fmt3(congestionAmount)}) grenswaarde: ${fmt3(cp.upperLimit)}, vrijgavewaarde ${fmt3(cp.releaseLimit)}; ${releaseModeText}`
    );
  }

  console.log("\nOverzicht deelnemers:");
  for (const participant of participants) {
    const responsibleCps = participant.activeRestrictions.size > 0
      ? Array.from(participant.activeRestrictions).sort().join(", ")
      : "";
    const setpointLabel = participant.setpoint === participant.basis
      ? "(    basis)"
      : (participant.setpoint === participant.basis + participant.flexContract ? "(inc. flex)" : "(afwijkend)");

    console.log(
      `Deelnemer ${participant.id} basis ${fmt3(participant.basis)}, C-flex ${fmt3(participant.flexContract)}, meting ${fmt3(participant.meting)}, setpoint ${fmt3(participant.setpoint)} ${setpointLabel}; verantwoordelijke CPs: ${responsibleCps}`
    );
  }
}

/**
 * Logt de topologieboom vanuit configuratie, voorafgaand aan de simulatiecycli.
 * @param {{congestionPoints:Array}} topology Topologieconfiguratie.
 * @returns {void}
 */
function logTopology(topology) {
  /**
   * Recursieve formatter voor een CP/deelnemer node.
   * @param {Object} node Node uit de topologieconfiguratie.
   * @param {string} indent Inspringing voor boomweergave.
   * @returns {void}
   */
  function printNode(node, indent) {
    if (Object.prototype.hasOwnProperty.call(node, "schakelgrens")) {
      console.log(
        `${indent}- ${node.id} (level ${node.level}, grens ${node.schakelgrens}, vrijgave ${node.vrijgavegrens})`
      );
      for (const child of node.children || []) {
        printNode(child, `${indent}  `);
      }
      return;
    }

    console.log(
      `${indent}- ${node.id} (basis ${node.basis}, C-flex ${node.flex})`
    );
  }

  console.log("Topologie:");
  for (const cp of topology.congestionPoints) {
    printNode(cp, "");
  }
  console.log("---");
}

module.exports = { logCycle, logTopology };
