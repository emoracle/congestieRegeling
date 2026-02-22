// @ts-check
/**
 * Model van een deelnemer met basisvermogen, flexcontract en actuele toestand.
 */
class Participant {
  /**
   * @param {string} id Unieke deelnemer-id.
   * @param {number} basis Basiswaarde (niet-flexibel deel).
   * @param {number} flexContract Contractuele flexwaarde.
   */
  constructor(id, basis, flexContract) {
    this.id = id;
    this.basis = basis;
    this.flexContract = flexContract;

    this.meting = 0;
    this.setpoint = basis + flexContract;

    this.lastInterventionAt = null; // epoch ms
    this.activeRestrictions = new Set(); // CP ids
  }

  /**
   * Bepaalt hoeveel flex op dit moment wordt gebruikt boven de basis.
   * @returns {number} Actuele flexafnamepotentie (minimaal 0).
   */
  flexUse() {
    return Math.max(0, this.meting - this.basis);
  }

  /**
   * Herberekent setpoint op basis van actieve restricties.
   * @returns {void}
   */
  recomputeSetpoint() {
    this.setpoint = (this.activeRestrictions.size > 0)
      ? this.basis
      : (this.basis + this.flexContract);
  }
}

module.exports = Participant;
