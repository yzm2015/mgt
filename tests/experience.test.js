'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),core=require('../src/salvage-core'),effects=require('../src/effects'),hint=require('../src/guidance');
function tick(g,seconds){for(let i=0;i<Math.ceil(seconds/.02);i++)g.update(.02);}
function arrive(g){for(let i=0;i<20000&&g.navGoal;i++)g.update(.02);assert.equal(g.navGoal,null,'navigation must terminate');}
test('click navigation reaches reachable ground without teleporting through standing towers and manual moves cancel it',()=>{
 for(const stage of core.stages){const g=new core.Game(1,stage.id,{}, {stage:stage.id});assert.equal(g.navigate(340,250),true);for(let i=0;i<15000&&g.navGoal;i++){const prev={...g.car};g.update(.02);assert.ok(Math.hypot(g.car.x-prev.x,g.car.y-prev.y)<=g.speed()*.02+1);for(const b of g.buildings.filter(b=>b.state==='standing'))assert.ok(!(g.car.x>b.x-b.w/2-12.9&&g.car.x<b.x+b.w/2+12.9&&g.car.y>b.y-b.h/2-8.9&&g.car.y<b.y+b.h/2+11.9));}assert.equal(g.navGoal,null);assert.ok(Math.hypot(g.car.x-340,g.car.y-250)<15);g.navigate(70,580);g.move(100,550);assert.equal(g.navGoal,null);assert.equal(g.route.length,0);g.stop();assert.equal(g.target,null);}
});
test('navigation resolves a tap on a tower to accessible ground and can approach power consoles',()=>{
 const g=new core.Game(1,7,{}, {stage:7}),b=g.buildings[0];assert.equal(g.navigate(b.x,b.y),true);arrive(g);assert.ok(Math.hypot(g.car.x-b.x,g.car.y-b.y)>b.h/2);
 for(const n of g.mission.nodes){g.navigate(n.x,n.y);arrive(g);tick(g,2.2);}assert.equal(g.mission.value,3);
});
test('visual events do not consume gameplay randomness and particle/event storage remains bounded',()=>{
 const a=new core.Game(123,1),b=new core.Game(123,1);for(let i=0;i<1000;i++)a.emitFx('collapse',100,300,i);assert.equal(a.fxEvents.length,64);assert.equal(a.random(),b.random());
 const fx=effects(false);fx.update(a,.016);assert.ok(fx.particles().length<=128);assert.ok(fx.bursts().length<=12);assert.ok(fx.texts().length<=7);const count=fx.particles().length;fx.update(a,.016);assert.equal(fx.particles().length,count,'same event must not be replayed every frame');fx.setReduced(true);assert.ok(fx.particles().length<=24);assert.equal(fx.reduced(),true);for(let i=0;i<100;i++)fx.update(a,.04);assert.equal(fx.particles().length,0);assert.equal(fx.texts().length,0);
});
test('core, collapse, delivery, pulse and objective events correspond to actual gameplay changes',()=>{
 const g=new core.Game(1,1,{}, {stage:1});const b=g.buildings[0];b.bolts.forEach(a=>g.damageAnchor(b,a,100));assert.ok(g.fxEvents.some(e=>e.type==='core'));assert.equal(g.fxEvents.filter(e=>e.type==='collapse').length,1);g.damageAnchor(b,b.bolts[0],100);assert.equal(g.fxEvents.filter(e=>e.type==='collapse').length,1);g.activate();assert.ok(g.fxEvents.some(e=>e.type==='pulse'));g.car={x:67,y:584};g.cargo=Array.from({length:12},()=>({x:67,y:584}));tick(g,1);assert.ok(g.fxEvents.some(e=>e.type==='delivery'));assert.equal(g.fxEvents.filter(e=>e.type==='objective').length,1);
});
test('next-action hints prioritize the current mission and full cargo without inventing unavailable actions',()=>{
 let g=new core.Game(1,1,{}, {stage:1});g.cargo=Array.from({length:8},()=>({}));assert.equal(hint(g).target.x,67);
 g=new core.Game(1,7,{}, {stage:7});const h=hint(g);assert.ok(g.mission.nodes.some(n=>n.x===h.target.x&&n.y===h.target.y));
 g=new core.Game(1,8,{}, {stage:8});g.mission.passenger=0;assert.equal(hint(g).target.y,584);
 g=new core.Game(1,5,{}, {stage:5});g.cargo=[{}];assert.equal(hint(g).icon,'drone');assert.equal(hint(g).target,null);g.dispatchCooldown=5;assert.notEqual(hint(g).icon,'drone');
 g=new core.Game(1,4,{}, {stage:4});g.energy=0;assert.equal(hint(g).icon,'pulse');
});
test('short taps navigate, dragged release stops, hiding cancels navigation and lightweight effects persist',()=>{
 const start=require('../src/salvage-app');let frame,input,visibility,g,now=1000,preference,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:()=>true,frame:f=>frame=f,input:f=>input=f,visibility:f=>visibility=f,event:()=>{},share:()=>{},rememberEffects:v=>preference=v},Object.assign({},core,{Game}));function draw(){texts=[];frame(now+=16);}function click(x,y){input('down',{x,y});input('up',{x,y});draw();}draw();click(100,578);click(340,250);assert.ok(g.navGoal);visibility(true);assert.equal(g.navGoal,null);visibility(false);input('down',{x:40,y:540});input('move',{x:70,y:550});input('up',{x:70,y:550});assert.equal(g.target,null);draw();click(346,30);click(120,505);assert.equal(preference,true);assert.ok(texts.includes('动效 / 轻量'));click(100,377);draw();assert.ok(g.time>0);
});

test('reward count-up can be skipped without delaying or duplicating actual progression rewards',()=>{
 const start=require('../src/salvage-app');let frame,input,g,stored,now=1000,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:s=>{stored=structuredClone(s);return true;},frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game}));function draw(){texts=[];frame(now+=16);}function click(x,y){input('down',{x,y});input('up',{x,y});draw();}draw();click(100,578);g.done=true;g.delivered=60;g.time=200;g.maxCombo=1;draw();assert.equal(stored.coins,165);assert.ok(texts.includes('+0'));click(100,370);assert.ok(texts.includes('+165'));assert.ok(texts.includes('+95'));assert.equal(stored.coins,165);assert.equal(stored.records.completed,1);
});
