// @ts-check
/**
 * Model van een deelnemer met basisvermogen, flexcontract en actuele toestand.
 */
class Participant {
  /**
   * @param {string} id Unieke deelnemer-id.
   * @param {number} basis Basiswaarde (niet-flexibel deel).
   * @param {number} flexContract Contractuele flexwaarde.
   * @param {number} [releaseAfterCycles=1] Aantal regelcycli dat minimaal moet
   * verlopen na inklemmen voordat vrijgave op een CP mag.
   */
  constructor(id, basis, flexContract, releaseAfterCycles = 1) {
    this.id = id;
    this.basis = basis;
    this.flexContract = flexContract;
    this.releaseAfterCycles = Math.max(1, Math.trunc(releaseAfterCycles));

    this.meting = 0;
    this.setpoint = basis + flexContract;

    this.lastInterventionAt = null; // epoch ms
    this.activeRestrictions = new Set(); // CP ids
    this.releaseCountdownByCp = new Map(); // CP id -> resterende cycli
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

  /**
   * Markeert dat deze deelnemer net beperkt is door een congestiepunt.
   * @param {string} cpId Congestiepunt-id.
   * @returns {void}
   */
  onRestrictedBy(cpId) {
    this.releaseCountdownByCp.set(cpId, this.releaseAfterCycles);
  }

  /**
   * Laat de wachttijd per actieve restrictie 1 cyclus dalen.
   * @returns {void}
   */
  tickReleaseCountdowns() {
    for (const cpId of this.activeRestrictions) {
      const remaining = this.releaseCountdownByCp.get(cpId);
      if (remaining == null) continue;
      if (remaining > 0) {
        this.releaseCountdownByCp.set(cpId, remaining - 1);
      }
    }
  }

  /**
   * Checkt of vrijgave voor dit congestiepunt is toegestaan.
   * @param {string} cpId Congestiepunt-id.
   * @returns {boolean}
   */
  canReleaseFrom(cpId) {
    const remaining = this.releaseCountdownByCp.get(cpId);
    return remaining == null || remaining <= 0;
  }

  /**
   * Ruimt vrijgavestatus op na het verwijderen van een restrictie.
   * @param {string} cpId Congestiepunt-id.
   * @returns {void}
   */
  onReleasedBy(cpId) {
    this.releaseCountdownByCp.delete(cpId);
  }
}

module.exports = Participant;
