// @ts-check
const Participant = require("./Participant");
const CongestionPoint = require("./CongestionPoint");
const { emitSetpointChanged } = require("./SetpointEvents");

const isCP = (n) => n instanceof CongestionPoint;
const isP = (n) => n instanceof Participant;

/**
 * Verzamelt alle deelnemers onder een node (recursief door CP-kinderen heen).
 * @param {CongestionPoint|Participant} node Startnode in de topologie.
 * @param {Participant[]} [out=[]] Accumulator met gevonden deelnemers.
 * @returns {Participant[]} Lijst met alle deelnemers onder de opgegeven node.
 */
function collectParticipants(node, out = []) {
  if (isP(node)) out.push(node);
  else if (isCP(node)) node.children.forEach((ch) => collectParticipants(ch, out));
  return out;
}

/**
 * Sorteervolgorde voor beperken/vrijgeven: oudste interventie eerst,
 * daarna hoogste flexcontract.
 * @param {Participant} a Eerste deelnemer.
 * @param {Participant} b Tweede deelnemer.
 * @returns {number} Negatief/positief/0 volgens standaard sort-vergelijking.
 */
function sortForRestriction(a, b) {
  const ta = a.lastInterventionAt == null ? -Infinity : a.lastInterventionAt;
  const tb = b.lastInterventionAt == null ? -Infinity : b.lastInterventionAt;
  if (ta !== tb) return ta - tb;
  return b.flexContract - a.flexContract;
}

/**
 * Beperkt deelnemers onder een congestiepunt tot hun basissetpoint totdat
 * de congestiehoeveelheid is weggewerkt of er geen kandidaten meer zijn.
 * @param {CongestionPoint} cp Congestiepunt waarop beperkt wordt.
 * @param {number} nowMs Tijdstempel (ms) van de huidige regelcyclus.
 * @returns {{remaining:number, changed:Array<{id:string,newSp:number,flexReduced:number}>}}
 * Resterende congestie en deelnemers waarvan setpoint is gewijzigd.
 */
function restrictOnCp(cp, nowMs) {
  let remaining = cp.meting - cp.upperLimit;
  if (remaining <= 0) return { remaining: 0, changed: [] };

  const participants = collectParticipants(cp).sort(sortForRestriction);
  const changed = [];

  for (const p of participants) {
    if (p.activeRestrictions.has(cp.id)) continue;

    const flexUse = p.flexUse();
    const clampedByOtherCp = p.activeRestrictions.size > 0 && p.setpoint === p.basis;
    if (remaining <= 0 && flexUse > 0 && !clampedByOtherCp) continue;

    p.activeRestrictions.add(cp.id);
    p.onRestrictedBy(cp.id);
    const oldSp = p.setpoint;
    p.recomputeSetpoint();
    p.lastInterventionAt = nowMs;

    if (p.setpoint !== oldSp) {
      changed.push({ id: p.id, newSp: p.setpoint, flexReduced: flexUse });
      emitSetpointChanged({
        participantId: p.id,
        cpId: cp.id,
        reason: "RESTRICT",
        oldSetpoint: oldSp,
        newSetpoint: p.setpoint,
        flexReduced: flexUse,
        cycleTs: nowMs,
      });
    }

    remaining = Math.max(0, remaining - flexUse);
  }

  return { remaining, changed };
}

/**
 * Berekent hoeveel ruimte er op dit moment maximaal vrijgegeven kan worden.
 * @param {CongestionPoint} cp Congestiepunt.
 * @returns {number} Vrijgavebudget voor deze cyclus.
 */
function getReleaseBudget(cp) {
  return Math.max(0, cp.upperLimit - cp.meting);
}

/**
 * Geeft deelnemers vrij voor een specifiek congestiepunt door die restrictie te verwijderen.
 * Een deelnemer komt alleen echt omhoog als er geen andere actieve restricties meer zijn.
 * @param {CongestionPoint} cp Congestiepunt waarvoor vrijgave wordt uitgevoerd.
 * @param {number} nowMs Tijdstempel (ms) van de huidige regelcyclus.
 * @param {(a: Participant, b: Participant) => number} [orderFn=sortForRestriction]
 * Sorteerfunctie voor vrijgavevolgorde.
 * @param {number} [releaseBudget=Number.POSITIVE_INFINITY] Maximaal vrij te geven hoeveelheid.
 * @returns {{changed:Array<{id:string,newSp:number}>, remaining:number}}
 * Deelnemers met gewijzigd setpoint en resterend vrijgavebudget.
 */
function releaseOnCp(
  cp,
  nowMs,
  orderFn = sortForRestriction,
  releaseBudget = Number.POSITIVE_INFINITY
) {
  let remaining = Math.max(0, releaseBudget);
  const participants = collectParticipants(cp).sort(orderFn);
  const changed = [];

  for (const p of participants) {
    if (remaining <= 0) break;
    if (!p.activeRestrictions.has(cp.id)) continue;
    if (!p.canReleaseFrom(cp.id)) continue;

    const oldSp = p.setpoint;
    p.activeRestrictions.delete(cp.id);
    p.onReleasedBy(cp.id);
    p.recomputeSetpoint();

    if (p.setpoint !== oldSp) {
      p.lastInterventionAt = nowMs;
      changed.push({ id: p.id, newSp: p.setpoint });
      remaining = Math.max(0, remaining - p.flexContract);
      emitSetpointChanged({
        participantId: p.id,
        cpId: cp.id,
        reason: "RELEASE",
        oldSetpoint: oldSp,
        newSetpoint: p.setpoint,
        cycleTs: nowMs,
      });
    }
  }

  return { changed, remaining };
}

/**
 * Geeft aan of er onder dit congestiepunt nog actieve restricties zijn.
 * @param {CongestionPoint} cp Congestiepunt.
 * @returns {boolean}
 */
function hasPendingRestrictionsOnCp(cp) {
  const participants = collectParticipants(cp);
  return participants.some((p) => p.activeRestrictions.has(cp.id));
}

/**
 * Laat voor alle unieke deelnemers in deze cyclus de vrijgave-tellers tikken.
 * @param {CongestionPoint[]} congestionPoints Geordende lijst van congestiepunten.
 * @returns {void}
 */
function tickReleaseCountdowns(congestionPoints) {
  const seen = new Set();
  for (const cp of congestionPoints) {
    for (const p of collectParticipants(cp)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      p.tickReleaseCountdowns();
    }
  }
}

/**
 * Werkt de toestand van één congestiepunt bij op basis van meting, grenswaarde en vrijgavewaarde.
 * - FREE + meting > grenswaarde => ENTER_CONGESTION
 * - CONGESTED + meting < vrijgavewaarde => EXIT_CONGESTION
 * - CONGESTED + meting > grenswaarde => ADJUST_CONGESTION (bijregelen)
 * @param {CongestionPoint} cp Congestiepunt dat geüpdatet wordt.
 * @param {number} nowMs Tijdstempel (ms) van de huidige regelcyclus.
 * @returns {{event:string, changed?:Array, remaining?:number}}
 * Eventresultaat met optionele details over wijzigingen/restcongestie.
 */
function updateCpState(cp, nowMs) {
  if (cp.state === "FREE" && cp.meting > cp.upperLimit) {
    cp.state = "CONGESTED";
    const res = restrictOnCp(cp, nowMs);
    return { event: "ENTER_CONGESTION", ...res };
  }

  if (cp.state === "FREE") {
    const budget = getReleaseBudget(cp);
    const { changed } = releaseOnCp(cp, nowMs, sortForRestriction, budget);
    if (changed.length > 0) {
      return { event: "RELEASE_PROGRESS", changed };
    }
    if (hasPendingRestrictionsOnCp(cp)) {
      return { event: "RELEASE_WAIT", changed: [] };
    }
  }

  if (cp.state === "CONGESTED" && cp.meting < cp.releaseLimit) {
    cp.state = "FREE";
    const budget = getReleaseBudget(cp);
    const { changed } = releaseOnCp(cp, nowMs, sortForRestriction, budget);
    return { event: "EXIT_CONGESTION", changed };
  }

  // Bij aanhoudende congestie blijven we bijregelen zolang de meting boven
  // de grenswaarde zit en er nog niet-beperkte deelnemers zijn.
  if (cp.state === "CONGESTED" && cp.meting > cp.upperLimit) {
    const res = restrictOnCp(cp, nowMs);
    if (res.changed.length > 0) {
      return { event: "ADJUST_CONGESTION", ...res };
    }
    return { event: "NO_CHANGE", changed: [], remaining: res.remaining };
  }

  return { event: "NO_CHANGE", changed: [] };
}

/**
 * Draait één regelcyclus over alle opgegeven congestiepunten en verzamelt events per CP.
 * @param {CongestionPoint[]} congestionPoints Geordende lijst van congestiepunten.
 * @param {number} [nowMs=Date.now()] Tijdstempel (ms) voor deze cyclus.
 * @returns {Map<string, {event:string, changed?:Array, remaining?:number}>}
 * Map van CP-id naar resultaat van updateCpState.
 */
function runControlCycle(congestionPoints, nowMs = Date.now()) {
  tickReleaseCountdowns(congestionPoints);
  const cpEvents = new Map();
  for (const cp of congestionPoints) {
    cpEvents.set(cp.id, updateCpState(cp, nowMs));
  }
  return cpEvents;
}

module.exports = {
  collectParticipants,
  sortForRestriction,
  restrictOnCp,
  releaseOnCp,
  getReleaseBudget,
  updateCpState,
  runControlCycle,
};
