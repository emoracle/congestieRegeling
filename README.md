# Congestie Simulatie

Een Node.js project voor het simuleren van congestieregeling met:
- congestiepunten (CP's) met schakelgrens en vrijgavegrens
- deelnemers met basiswaarde en C-flex
- cyclische metingen via JSON-input

## Structuur

- `modules/core.js`: kernregeling (state-overgangen, beperken/vrijgeven)
- `modules/sim.js`: opbouw van model + run-flow
- `modules/SimulationLogger.js`: console-logging van topologie en cycli
- `config/topology.json`: topologie + vaste parameters
- `input/metingen.json`: metingen cyclus 1
- `input/metingen_cyclus2.json`: metingen cyclus 2
- `test/sim.test.js`: unit-tests

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

## Testen

```bash
npm test
```

## Configuratie aanpassen

1. Pas topologie en grenzen aan in `config/topology.json`.
2. Pas metingen aan in `input/metingen.json` en `input/metingen_cyclus2.json`.
3. Run opnieuw met `npm start`.

## Licentie

Dit project gebruikt de ISC-licentie. Zie `LICENSE`.
