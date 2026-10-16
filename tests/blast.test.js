'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../src/salvage-core'),effects=require('../src/effects'),hint=require('../src/guidance');
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/.02);i++)g.update(.02);};
function inventory(g){return g.delivered+g.cargo.length+g.scrap.length+g.buildings.reduce((n,b)=>n+(b.state==='cleared'?0:b.mass)+b.bolts.filter(a=>!a.removed).length,0);}
test('blast kits require proximity, one placement per tower and at most three armed sites',()=>{
 const g=new core.Game(1,1);g.car={x:22,y:620};assert.equal(g.plantBlast(),false);assert.equal(g.armBlast(),false);for(const b of g.buildings){g.car={x:b.bolts[0].x,y:b.bolts[0].y};assert.equal(g.plantBlast(),true);assert.equal(g.plantBlast(),false);}assert.equal(g.blast.charges.length,3);assert.equal(g.armBlast(),true);assert.equal(g.armBlast(),false);assert.equal(g.plantBlast(),false);g.done=true;assert.equal(g.armBlast(),false);
});
test('detonation waits three simulation seconds, preserves material throughout collapse and cannot duplicate drops',()=>{
 const g=new core.Game(1,1);assert.equal(g.plantBlast(),true);assert.equal(g.armBlast(),true);g.car={x:22,y:620};tick(g,2.8);assert.equal(g.blast.detonated,0);assert.equal(g.buildings[0].state,'standing');assert.equal(inventory(g),g.total);tick(g,.3);assert.equal(g.blast.detonated,1);assert.equal(g.buildings[0].state,'falling');assert.equal(g.buildings[0].fallDuration,2.6);assert.equal(g.fxEvents.filter(e=>e.type==='explosion').length,1);assert.equal(inventory(g),g.total);tick(g,2.7);assert.equal(g.buildings[0].state,'cleared');assert.equal(inventory(g),g.total);const count=g.fxEvents.filter(e=>e.type==='impact').length;tick(g,1);assert.equal(inventory(g),g.total);assert.equal(g.fxEvents.filter(e=>e.type==='impact').length,count);assert.equal(g.plantBlast(),false,'resupply must cool down');
});
test('early evacuation avoids energy interference and guidance selects a reachable safe destination',()=>{
 for(const evacuate of [false,true]){const g=new core.Game(1,1);g.plantBlast();g.armBlast();const target=hint(g).target;assert.ok(target);assert.ok(g.blast.charges.every(c=>Math.hypot(c.x-target.x,c.y-target.y)>125));if(evacuate){g.navigate(target.x,target.y);}tick(g,3.1);assert.ok(evacuate?g.energy>.95:g.energy<.8);}
});
test('explosives cannot bypass mission shields or laboratory objectives',()=>{
 let g=new core.Game(1,7,{}, {stage:7});g.car={x:g.buildings[0].bolts[0].x,y:g.buildings[0].bolts[0].y};assert.equal(g.plantBlast(),false);
 g=new core.Game(1,1,{}, {lab:3});assert.equal(g.plantBlast(),true);g.armBlast();g.car={x:22,y:620};tick(g,3.2);assert.equal(g.lab.links,0);assert.equal(g.lab.hits,0);assert.equal(g.demolished,0);assert.equal(g.mission.value,0);assert.equal(inventory(g),g.total);
});
test('explosion dust is bounded, does not replay old events and reduces with lightweight effects',()=>{
 const g=new core.Game(1,1),fx=effects(false);for(let i=0;i<200;i++)g.emitFx('explosion',190,400);fx.update(g,.02);assert.ok(fx.dust().length<=24);const count=fx.dust().length;fx.update(g,.02);assert.equal(fx.dust().length,count);fx.setReduced(true);assert.ok(fx.dust().length<=4);for(let i=0;i<160;i++)fx.update(g,.02);assert.equal(fx.dust().length,0);
});
