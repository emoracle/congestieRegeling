# Congestie Simulatie

Een Node.js project voor het simuleren van congestieregeling met:
- congestiepunten (CP's) met schakelgrens en vrijgavegrens
- deelnemers met basiswaarde en C-flex
- cyclische metingen via JSON-input
- setpoint-events (in-process + optioneel UDP)

## Structuur

- `modules/core.js`: kernregeling (state-overgangen, beperken/vrijgeven, release-budget)
- `modules/sim.js`: opbouw van model + run-flow
- `modules/SimulationLogger.js`: console-logging van topologie en cycli
- `modules/SetpointEvents.js`: event-bus + UDP emit
- `config/topology.json`: topologie + vaste parameters
- `input/metingen.json`: metingen cyclus 1
- `input/metingen_cyclus2.json`: metingen cyclus 2
- `test/sim/`: unit-tests en scenario-tests
- `participantsListener.js`: eenvoudige listener voor setpoint-events

## Vereisten

- Node.js 18+ (bij voorkeur 20+)

## Starten

```bash
npm start
```

Dit toont:
1. de topologie
2. cyclus 1 (congestie)
3. cyclus 2 (vrijgave)

## Regelgedrag (kort)

- **Inklemmen:** deelnemers worden op basis gezet volgens prioriteitsvolgorde.
- **Vrijgeven:** gebeurt op basis van vrijgavebudget per cyclus:
  - `releaseBudget = upperLimit - meting` (minimaal 0)
  - deelnemers worden in volgorde vrijgegeven totdat budget op is.

## Testen

```bash
npm test
```

## Setpoint events beluisteren

Start listener en simulatie in twee terminals:

```bash
npm run listen:participants
npm start
```

Bij elke setpointwijziging wordt een event uitgezonden en door de listener gelogd.
Je kunt UDP-emissie uitschakelen met:

```bash
PARTICIPANT_EVENTS_UDP_DISABLED=1 npm start
```

## Configuratie aanpassen

1. Pas topologie en grenzen aan in `config/topology.json`.
2. Per deelnemer kun je optioneel `vrijgaveNaCycli` zetten (default `1`):

```json
{ "id": "P_201", "basis": 10, "flex": 5, "vrijgaveNaCycli": 3 }
```

Dit betekent: na inklemmen mag deze deelnemer pas na 3 regelcycli weer vrijgegeven worden.
3. Pas metingen aan in `input/metingen.json` en `input/metingen_cyclus2.json`.
4. Run opnieuw met `npm start`.

## Licentie

Dit project gebruikt de ISC-licentie. Zie `LICENSE`.
