'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),core=require('../src/salvage-core'),growth=core.growth;
function completed(stars=1,risk=false){const g=new core.Game(1,1,{}, {stage:1,risk});g.done=true;g.time=stars>=2?100:200;g.delivered=60;g.maxCombo=stars===3?3:1;return g;}
test('first clear and new stars reward once, repeats retain income but never repeat milestones',()=>{
 const s=core.cleanSave({}),g=completed(),a=growth.settle(s,g,1,'2026-10-15');assert.deepEqual(a,{coins:165,xp:95,parts:3,first:true,newStars:1,levels:0,level:1});const before=structuredClone(s);assert.equal(growth.settle(s,g,1,'2026-10-15'),null);assert.deepEqual(s,before);
 s.stageBest[1]={stars:1,seconds:200};const repeat=growth.settle(s,completed(),1,'2026-10-15');assert.equal(repeat.coins,90);assert.equal(repeat.first,false);assert.equal(repeat.parts,2,'one-time level-up grants two parts');assert.equal(growth.level(s.progression.xp),2);
 const better=growth.settle(s,completed(3),3,'2026-10-15');assert.equal(better.newStars,2);assert.equal(better.coins,120);assert.equal(better.parts,2);s.stageBest[1]={stars:3,seconds:100};assert.equal(growth.settle(s,completed(3),3,'2026-10-15').newStars,0);
});
test('expert contracts add repeatable parts, daily competition does not inherit growth rewards',()=>{
 const s=core.cleanSave({stageBest:{1:{stars:3,seconds:100}}}),r=growth.settle(s,completed(3,true),3,'2026-10-15');assert.equal(r.coins,135);assert.equal(r.parts,1);assert.equal(r.xp,70);
 const old=structuredClone(s),daily=new core.Game(1,4);daily.done=true;assert.equal(growth.settle(s,daily,3,'2026-10-15'),null);assert.deepEqual(s,old);
});
test('five gear tracks spend exact resources, fail atomically, cap at five and change actual capabilities',()=>{
 const s=core.cleanSave({coins:10000,progression:{parts:30}});for(const def of growth.gear){for(let i=0;i<5;i++)assert.equal(growth.upgrade(s,def.id).ok,true);const old=structuredClone(s);assert.equal(growth.upgrade(s,def.id).code,'MAX_LEVEL');assert.deepEqual(s,old);}
 const base=new core.Game(1,1,{}, {stage:1}),g=new core.Game(1,1,s.upgrades,{stage:1});assert.equal(g.capacity(),37);assert.equal(g.radius(),111);assert.equal(g.pulseRadius(),178);assert.equal(g.speed(),210);assert.equal(g.dashDelay(),3);assert.equal(g.droneDelay(),10);
 g.energy=0;base.energy=0;g.update(.04);base.update(.04);assert.ok(g.energy>base.energy);
 const poor=core.cleanSave({coins:100});assert.equal(growth.upgrade(poor,'engine').code,'NEED_PARTS');assert.equal(poor.coins,100);assert.equal(growth.upgrade(core.cleanSave({}),'magnet').code,'NEED_COINS');assert.equal(growth.upgrade(poor,'unknown').ok,false);
});
test('rigs unlock through experience, persist safely and remain separate from competition',()=>{
 const s=core.cleanSave({});assert.equal(growth.equip(s,'hauler'),false);s.progression.xp=120;assert.equal(growth.equip(s,'hauler'),true);assert.equal(growth.equip(s,'striker'),false);s.progression.xp=720;assert.equal(growth.equip(s,'striker'),true);
 const hauler=new core.Game(1,1,{}, {stage:1,rig:'hauler'}),striker=new core.Game(1,1,{}, {stage:1,rig:'striker'});assert.equal(hauler.capacity(),18);assert.equal(hauler.speed(),158);assert.equal(striker.capacity(),10);assert.equal(striker.dashDelay(),3.4);
 assert.equal(new core.Game(1,4,{}, {rig:'striker',risk:true}).rig,'balanced');assert.equal(new core.Game(1,4,{}, {rig:'striker',risk:true}).risk,false);assert.equal(core.cleanSave({progression:{rig:'striker',xp:0}}).progression.rig,'balanced');
});
test('daily contracts require real progress, claim once, reset by date and remain bounded',()=>{
 const s=core.cleanSave({});assert.equal(growth.claim(s,'yards','2026-10-15'),false);growth.settle(s,completed(),1,'2026-10-15');s.stageBest[1]={stars:1,seconds:200};growth.settle(s,completed(3),3,'2026-10-15');let d=growth.daily(s,'2026-10-15');assert.equal(d.yards,2);assert.equal(d.recycle,120);assert.equal(growth.claim(s,'yards','2026-10-15'),true);const coin=s.coins;assert.equal(growth.claim(s,'yards','2026-10-15'),false);assert.equal(s.coins,coin);assert.equal(growth.claim(s,'recycle','2026-10-15'),true);assert.equal(growth.claim(s,'chain','2026-10-15'),false);
 assert.equal(growth.daily(s,'2026-10-16').yards,0);assert.deepEqual(s.progression.daily.claimed,[]);assert.equal(growth.claim(s,'yards','2026-10-16'),false);
});
test('storm windows change movement and magnetic radius without changing ordinary or daily yards',()=>{
 const g=new core.Game(1,1,{}, {stage:1,risk:true}),base=new core.Game(1,1,{}, {stage:1});assert.equal(g.buildings[0].bolts[0].hp,1.4);g.time=5;g.update(.01);g.car={x:g.storm.x,y:g.storm.y};assert.equal(g.inStorm(),true);assert.equal(g.radius(),base.radius()-18);const x=g.car.x;g.move(x+40,g.car.y);g.update(.04);assert.ok(g.car.x-x<170*.04);g.time=9;g.update(.01);assert.equal(g.inStorm(),false);assert.equal(g.radius(),66);
});
test('new progression and upgrades survive strict cloud roundtrip; malformed fields are rejected',()=>{
 const validate=require('../cloudfunctions/mgt_gateway/save-schema').validate,s=core.cleanSave({coins:400,upgrades:{engine:2,reactor:3,drone:4},progression:{xp:720,parts:15,rig:'striker',daily:{date:'2026-10-15',yards:2,recycle:150,chain:6,claimed:['yards']}}});assert.deepEqual(core.cleanSave(validate(s)),s);
 const old={level:1,coins:0,upgrades:{magnet:0,cargo:0},dailyBest:{},records:{}};assert.equal(validate(old).progression.xp,0);assert.equal(validate(old).upgrades.engine,0);
 for(const progression of [null,{xp:-1},{parts:100000},{rig:'striker',xp:0},{daily:{claimed:['yards','yards']}},{daily:{claimed:['anything']}},{daily:{date:7}}])assert.throws(()=>validate(Object.assign({},s,{progression})),/MGT_BAD_SAVE/);
 assert.throws(()=>validate(Object.assign({},s,{upgrades:{magnet:0,cargo:0,engine:6}})),/MGT_BAD_SAVE/);
});
test('reward claims, advanced gear and contract choices work through the UI with write-failure rollback',()=>{
 const start=require('../src/salvage-app');let frame,input,g,stored,fail=false,now=1000,texts=[];const initial=core.cleanSave({coins:1000,stageBest:{1:{stars:1,seconds:200}},progression:{xp:720,parts:10,daily:{date:core.day(),yards:2,recycle:120,chain:6,claimed:[]}}});
 const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>initial,save:s=>{if(fail)return false;stored=structuredClone(s);return true;},frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game}));
 function draw(){texts=[];frame(now+=17);}function click(x,y){input('down',{x,y});input('up',{x,y});draw();}draw();click(290,390);assert.ok(texts.includes('工程师委托'));fail=true;click(300,280);assert.ok(texts.includes('领取奖励'));fail=false;click(300,280);assert.equal(stored.coins,1080);assert.deepEqual(stored.progression.daily.claimed,['yards']);click(300,280);assert.equal(stored.coins,1080);
 click(100,600);click(195,276);click(180,436);assert.equal(stored.upgrades.engine,1);assert.equal(stored.progression.parts,10);click(280,214);click(180,488);assert.equal(stored.progression.rig,'striker');click(100,660);click(195,485);click(100,190);assert.ok(texts.includes('标准工地 / 稳定回收'));click(100,499);assert.equal(g.risk,true);assert.equal(g.rig,'striker');click(346,30);click(100,434);click(275,637);assert.equal(g.risk,false);assert.equal(g.rig,'balanced');assert.equal(g.speed(),170);assert.equal(g.capacity(),12);assert.equal(g.pulseRadius(),148);
});

test('completion rewards remain once-only while a failed local save is retried from the result screen',()=>{
 const start=require('../src/salvage-app');let frame,input,g,stored,fail=true,now=1000,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:s=>{if(fail)return false;stored=structuredClone(s);return true;},frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game}));function draw(){texts=[];frame(now+=17);}function click(x,y){input('down',{x,y});input('up',{x,y});draw();}draw();click(100,578);g.done=true;g.delivered=60;g.time=200;g.maxCombo=1;draw();assert.ok(texts.includes('存档写入失败 / 点击此处重试保存'));draw();fail=false;click(150,561);assert.equal(stored.coins,165);assert.equal(stored.progression.xp,95);assert.equal(stored.records.completed,1);draw();assert.equal(stored.progression.xp,95);
});
