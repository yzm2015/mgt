'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../src/salvage-core');
const step=(g,s)=>{for(let i=0;i<Math.ceil(s/.04);i++)g.update(.04);};
function yard(id){return new core.Game(1,id,{}, {stage:id});}
test('each authored stage has a distinct mandatory mission; demolition and quota alone cannot finish',()=>{
 const kinds=new Set();for(let id=1;id<=8;id++){const g=yard(id);kinds.add(g.mission.kind);g.demolished=3;g.delivered=g.quota;g.buildings.forEach(b=>b.state='cleared');g.car={x:70,y:610};g.update(.04);assert.equal(g.done,false,'stage '+id+' requires its main objective');}assert.equal(kinds.size,8);
 const daily=new core.Game(1,4);assert.equal(daily.mission,null);
});
test('control pads require proximity and time, open only their corresponding shields and ignore pulse spam',()=>{
 for(const id of [2,7]){const g=yard(id),b=g.buildings[id===2?2:0],a=b.bolts[0],hp=a.hp;g.damageAnchor(b,a,100);assert.equal(a.hp,hp);g.car={x:g.mission.nodes[0].x,y:g.mission.nodes[0].y};step(g,.5);assert.equal(g.mission.value,0);step(g,2);assert.equal(g.mission.nodes[0].active,true);
  if(id===2){assert.equal(core.missions.shielded(g,b),true);g.car={x:g.mission.nodes[1].x,y:g.mission.nodes[1].y};step(g,2);}
  assert.equal(core.missions.shielded(g,b),false);g.damageAnchor(b,a,100);assert.equal(a.removed,true);
 }
});
test('energy pickups, pulse capacitors and dash checkpoints use the promised actions exactly once',()=>{
 let g=yard(3),n=g.mission.nodes[0];g.car={x:n.x,y:n.y};step(g,1);assert.equal(g.mission.value,1);step(g,1);assert.equal(g.mission.value,1);
 g=yard(4);n=g.mission.nodes[0];g.car={x:n.x,y:n.y};step(g,1);assert.equal(g.mission.value,0);g.activate();assert.equal(n.active,true);const value=g.mission.value;g.energy=1;g.activate();assert.equal(g.mission.value,value);
 g=yard(6);n=g.mission.nodes[1];g.car={x:n.x,y:n.y};g.dash();step(g,.04);assert.equal(g.mission.value,0,'out of order');n=g.mission.nodes[0];g.car={x:n.x,y:n.y};g.dashTime=0;step(g,.04);assert.equal(g.mission.value,0,'ordinary driving is insufficient');g.dashCooldown=0;g.dash();step(g,.04);assert.equal(g.mission.value,1);
});
test('rescue has one seat, requires return to depot, and remains possible through periodic storms',()=>{
 const g=yard(8),nodes=g.mission.nodes;g.car={x:nodes[0].x,y:nodes[0].y};step(g,.04);assert.equal(g.mission.passenger,0);assert.equal(g.mission.value,0);g.car={x:nodes[1].x,y:nodes[1].y};step(g,.04);assert.equal(nodes[1].active,false);g.car={x:67,y:584};step(g,.04);assert.equal(g.mission.value,1);assert.equal(g.mission.passenger,null);g.car={x:nodes[1].x,y:nodes[1].y};step(g,.04);g.car={x:67,y:584};step(g,.04);assert.equal(g.mission.value,2);g.time=5;step(g,.04);assert.equal(g.storm.active,true);assert.equal(g.risk,false);
});
test('ground and airlift missions reserve enough remaining metal to prevent softlocks',()=>{
 const ground=yard(1);ground.delivered=ground.total-12;ground.airDelivered=ground.delivered;ground.cargo=Array.from({length:12},()=>({x:67,y:584}));assert.equal(ground.dispatch(),false);assert.equal(ground.cargo.length,12);ground.car={x:67,y:584};step(ground,1);assert.equal(ground.groundDelivered,12);assert.equal(ground.mission.value,12);
 const air=yard(5);air.delivered=air.total-36;air.groundDelivered=air.delivered;air.cargo=Array.from({length:12},()=>({x:67,y:584}));air.car={x:67,y:584};const before=air.delivered;step(air,1);assert.equal(air.delivered,before);assert.equal(air.cargo.length,12);air.dispatch();assert.equal(air.airDelivered,12);assert.equal(air.cargo.length,0);assert.equal(air.delivered,before+12);
});

test('main objective opens a readable briefing and pauses simulation until the player returns',()=>{
 const start=require('../src/salvage-app');let input,frame,g,now=1000,texts=[];const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:()=>true,frame:f=>frame=f,input:f=>input=f,visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game}));function draw(){texts=[];frame(now+=30);}function click(x,y){input('down',{x,y});input('up',{x,y});draw();}draw();click(100,578);click(195,144);assert.ok(texts.includes('本关作战简报'));const before=g.time;for(let i=0;i<10;i++)draw();assert.equal(g.time,before);click(195,512);draw();assert.ok(g.time>before);
});
