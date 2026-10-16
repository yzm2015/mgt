'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../src/salvage-core');
const tick=(g,sec)=>{for(let i=0;i<Math.ceil(sec/.02);i++)g.update(.02);};
const make=id=>new core.Game(123,1,{}, {lab:id});
function pair(g,same=false){g.setPole(0);g.setPole(1);if(!same)g.setPole(1);}
test('twelve experiments use isolated objectives, fixed vehicles and real initial scrap',()=>{
 assert.equal(core.lab.list.length,12);for(let id=1;id<=core.lab.list.length;id++){const g=make(id);assert.equal(g.stage,null);assert.equal(g.lab.id,id);assert.equal(g.mission.kind,'lab');assert.equal(g.scrap.length,6);assert.equal(g.total,g.buildings.reduce((n,b)=>n+b.mass+3,6));assert.equal(g.mission.value,0);}
 assert.equal(new core.Game(1,1).lab,undefined);
});
test('polarity is deliberate, enforces teaching rule and cooldown; attraction differs from repulsion',()=>{
 let g=make(1);assert.equal(g.resonate(),false);pair(g,true);assert.equal(g.resonate(),false);g.setPole(1);assert.equal(g.resonate(),true);assert.equal(g.lab.links,1);assert.equal(g.resonate(),false);assert.ok(g.buildings[0].bolts.every(a=>a.hp<1));assert.equal(g.buildings[0].tension.kind,'attract');assert.ok(g.buildings[0].fallVector.y<0);assert.equal(g.setPole(99),false);
 g=make(2);pair(g);assert.equal(g.resonate(),false);g.setPole(1);g.setPole(1);assert.equal(g.resonate(),true);assert.equal(g.buildings[0].bolts.filter(a=>a.removed).length,1);assert.equal(g.buildings[0].tension.kind,'repel');
});
test('weapons need held metal, a live unshielded target and cooldown, and specific weapons advance only matching objectives',()=>{
 const g=make(4);const b=g.buildings[0];g.car={x:b.x,y:b.y+b.h/2+19};assert.equal(g.fireWeapon(),false);g.cargo=Array.from({length:4},()=>({x:g.car.x,y:g.car.y}));assert.equal(g.equipWeapon('unknown'),false);assert.equal(g.fireWeapon(),true);assert.equal(g.lab.hits,0);assert.equal(g.fireWeapon(),false);g.lab.weaponCooldown=0;g.equipWeapon('drill');assert.equal(g.fireWeapon(),true);assert.equal(g.lab.hits,1);assert.equal(g.cargo.length,4,'assembly reuses scrap, never silently destroys recoverable material');g.lab.weaponCooldown=0;g.car={x:20,y:620};assert.equal(g.fireWeapon(),false);
});
test('shield blocks storm slowdown and boss interference; boss shield falls only after both escorts',()=>{
 const g=make(7),boss=g.buildings[2],a=boss.bolts[0];g.damageAnchor(boss,a,100);assert.equal(a.hp,4);g.time=5;g.update(.02);assert.ok(g.lab.attack);const mark={...g.lab.attack};g.car={x:mark.x,y:mark.y};g.lab.shield=4;g.energy=1;tick(g,2);assert.equal(g.energy,1);g.time=g.lab.nextAttack;g.update(.02);g.energy=1;g.lab.shield=0;tick(g,2);assert.ok(g.energy<.7);g.lab.links=2;g.lab.hits=3;g.buildings.slice(0,2).forEach(b=>b.bolts.forEach(a=>g.damageAnchor(b,a,100)));g.damageAnchor(boss,a,1);assert.equal(a.hp,3);
 const storm=make(5);storm.storm.active=true;storm.car={x:storm.storm.x,y:storm.storm.y};assert.equal(storm.inStorm(),true);storm.lab.shield=1;assert.equal(storm.inStorm(),false);
});
test('unfinished experiments preserve targets and final four metal pieces against unload and drone softlocks',()=>{
 const g=make(6);g.buildings.forEach(b=>b.bolts.forEach(a=>g.damageAnchor(b,a,100)));assert.equal(g.demolished,0);assert.ok(g.buildings.every(b=>b.bolts.some(a=>!a.removed)));g.scrap=[];g.delivered=g.total-4;g.cargo=Array.from({length:4},()=>({x:67,y:584}));g.car={x:67,y:584};assert.equal(g.dispatch(),false);tick(g,1);assert.equal(g.cargo.length,4);g.lab.hits=2;assert.equal(g.dispatch(),true);assert.equal(g.cargo.length,0);
});
test('all twelve experiments finish with actual navigation and zero upgrades, preserving all metal',()=>{
 for(let id=1;id<=core.lab.list.length;id++){
  const g=make(id);pair(g,id===2);g.equipWeapon(g.lab.def.weapon||'hammer');
  for(let frame=0;frame<90000&&!g.done;frame++){
   if(g.lab.links<g.lab.def.links)g.resonate();
   if(g.lab.def.blast&&!core.lab.blastReady(g)){
    if(g.blast.timer>0){if(!g.navGoal){const p=require('../src/guidance')(g).target;g.navigate(p.x,p.y);}g.update(.02);continue;}
    if(g.blast.cooldown<=0&&g.plantBlast()){g.armBlast();const p=require('../src/guidance')(g).target;g.navigate(p.x,p.y);g.update(.02);continue;}
   }
   if(g.lab.def.ground&&g.groundDelivered<g.lab.def.ground&&g.cargo.length>=Math.min(6,g.lab.def.ground-g.groundDelivered)){
    if(!g.navGoal||Math.hypot(g.navGoal.x-67,g.navGoal.y-584)>15)g.navigate(67,584);g.update(.02);continue;
   }
   g.fireWeapon();
   if(g.cargo.length>=g.capacity()||g.demolished===3&&g.cargo.length){if(!g.dispatch()&&!g.navGoal)g.navigate(67,584);}
   if(!g.navGoal&&frame%10===0){let targets=[];
    if(g.cargo.length<4&&g.lab.hits<g.lab.def.hits&&g.scrap.length)targets=g.scrap;
    else {g.buildings.forEach(b=>{if(b.state==='standing'&&!core.lab.blocked(g,b))b.bolts.forEach(a=>{if(!a.removed)targets.push(a);});});if(!targets.length)targets=g.scrap;}
    targets.sort((a,b)=>Math.hypot(a.x-g.car.x,a.y-g.car.y)-Math.hypot(b.x-g.car.x,b.y-g.car.y));if(targets.length)g.navigate(targets[0].x,targets[0].y);
   }
   g.update(.02);
  }
  assert.equal(g.done,true,'experiment '+id+' must finish: '+JSON.stringify({links:g.lab.links,hits:g.lab.hits,demolished:g.demolished,delivered:g.delivered,cargo:g.cargo.length}));assert.equal(g.delivered+g.cargo.length+g.scrap.length,g.total,'no resource destroyed or generated');assert.equal(g.mission.value,1);
 }
});
test('experiment entrance, controls, help, reward and next mission do not change campaign or daily records',()=>{
 let input,frame,g,stored,now=1000,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...a){super(...a);g=this;}}
 require('../src/salvage-app')({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:s=>{stored=structuredClone(s);return true;},frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},{...core,Game});
 const draw=()=>{texts=[];frame(now+=16);},click=(x,y)=>{input('down',{x,y});input('up',{x,y});draw();};draw();click(100,400);assert.ok(texts.includes('工地实验室'));click(120,170);assert.equal(g.lab.id,1);click(65,474);click(151,474);click(151,474);click(323,474);assert.equal(g.lab.links,1);click(110,143);assert.ok(texts.includes('本关作战简报'));const before=g.time;draw();assert.equal(g.time,before);click(100,510);g.done=true;draw();assert.equal(stored.coins,40);assert.equal(stored.level,1);assert.deepEqual(stored.dailyBest,{});assert.deepEqual(stored.stageBest,{});assert.equal(stored.records.completed,0);draw();assert.equal(stored.coins,40);click(150,460);assert.equal(g.lab.id,2);
});

test('icon control edges select weapons without driving or firing, and missing cargo/cooldowns remain explicit',()=>{
 let input,frame,g,now=1000,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...a){super(...a);g=this;}}
 require('../src/salvage-app')({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:()=>true,frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},{...core,Game});
 const draw=()=>{texts=[];frame(now+=16);},click=(x,y)=>{input('down',{x,y});input('up',{x,y});draw();};draw();click(100,400);click(100,300);
 assert.equal(g.lab.id,3);click(323,546);assert.ok(texts.includes('保留至少 4 件货物组装武器'));assert.equal(g.lab.hits,0);
 click(186,577);assert.equal(g.lab.weapon,'drill');assert.equal(g.target,null);assert.equal(g.lab.hits,0);click(237,546);assert.equal(g.lab.weapon,'shield');click(65,546);assert.equal(g.lab.weapon,'hammer');
 const b=g.buildings[0];g.car={x:b.x,y:b.y+b.h/2+16};g.cargo=Array.from({length:4},()=>({x:g.car.x,y:g.car.y}));click(358,577);assert.equal(g.lab.hits,1);assert.equal(g.target,null);click(323,546);assert.equal(g.lab.hits,1);assert.ok(texts.includes('武器冷却中'));
 click(65,474);assert.equal(b.pole,1);click(65,474);assert.equal(b.pole,-1);click(65,474);assert.equal(b.pole,0);
});
test('haul contracts reserve ground materials against drone softlocks and reward clean work within a cap',()=>{
 for(const id of [11,12]){
  const g=make(id);g.blast.detonated=g.blast.safeDetonated=g.lab.def.safe;assert.equal(core.lab.blastReady(g),true);assert.equal(core.lab.ready(g),false);
  g.delivered=g.total-g.lab.def.ground-2;g.cargo=Array.from({length:g.lab.def.ground+2},()=>({x:67,y:584}));
  assert.equal(g.dispatch(),true);assert.equal(g.cargo.length,g.lab.def.ground);assert.equal(g.groundDelivered,0);g.dispatchCooldown=0;assert.equal(g.dispatch(),false);
  assert.equal(core.lab.reward(g).coins,60);g.scrap=[];g.car={x:67,y:584};tick(g,2);assert.equal(g.groundDelivered,g.lab.def.ground);assert.equal(core.lab.ready(g),true);assert.equal(core.lab.reward(g).coins,70);
  g.blast.detonated++;assert.equal(core.lab.reward(g).coins,50,'an unsafe blast loses only the clean-work bonus, never traps the player');
 }
});
