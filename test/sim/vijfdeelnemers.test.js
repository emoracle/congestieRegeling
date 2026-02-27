// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

const { Participant, CongestionPoint, updateCpState } = require("../../modules/sim");

test("5 deelnemers", () => {
  const cp = new CongestionPoint("CP_R", 0, 50, 40);   //Boven de 50 is congestie
  const p1 = new Participant("P_R1", 10, 10); 
  const p2 = new Participant("P_R2", 11, 5);
  const p3 = new Participant("P_R3", 12, 10);
  const p4 = new Participant("P_R4", 13, 5);  
  const p5 = new Participant("P_R5", 14, 5);

  cp.addChild(p1);
  cp.addChild(p2);
  cp.addChild(p3);
  cp.addChild(p4);
  cp.addChild(p5);
 
  cp.meting = 56;   // congestie van 6   

  p1.meting = 18;  // flexusage van 8, pakt alles dus al weg
  p2.meting = 6;   // onder de basis
  p3.meting = 6;   // onder de basis
  p4.meting = 14;  // Deze heeft flex van 1, maar congestie is al weg, geen actie nodig
  p5.meting = 6;   // onder de basis wordeen geklemt

  const first = updateCpState(cp, 7000);
  assert.equal(first.event, "ENTER_CONGESTION");
  // p1 neemt alle remaining weg, p2/p3/p5 (flexUse=0) worden alsnog ingeklemd.
  // p4 heeft nog flexUse>0 en blijft na remaining=0 met rust.
  assert.equal(p1.setpoint, p1.basis);
  assert.equal(p2.setpoint, p2.basis);
  assert.equal(p3.setpoint, p3.basis);
  assert.equal(p4.setpoint, p4.basis + p4.flexContract);
  assert.equal(p5.setpoint, p5.basis);
});
