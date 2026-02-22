// @ts-check
/**
 * Model van een congestiepunt met hysteresegrenzen en onderliggende nodes.
 */
class CongestionPoint {
  /**
   * @param {string} id Unieke congestiepunt-id.
   * @param {number} level Niveau in de topologie.
   * @param {number} upperLimit Schakelgrens voor ingang congestie.
   * @param {number} releaseLimit Vrijgavegrens voor uitgang congestie.
   */
  constructor(id, level, upperLimit, releaseLimit) {
    this.id = id;
    this.level = level;
    this.upperLimit = upperLimit;     // congestiewaarde
    this.releaseLimit = releaseLimit; // vrijgavewaarde

    this.meting = 0;
    this.state = "FREE"; // FREE | CONGESTED
    this.children = [];
  }

  /**
   * Voegt een child-node toe (congestiepunt of deelnemer).
   * @param {CongestionPoint|import("./Participant")} node Child-node.
   * @returns {void}
   */
  addChild(node) {
    this.children.push(node);
  }
}

module.exports = CongestionPoint;
