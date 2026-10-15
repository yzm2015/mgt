const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/salvage-core');
function tick(g,seconds){for(let i=0;i<seconds*60;i++)g.update(1/60);}
function drive(g,x,y,seconds=4){g.move(x,y);tick(g,seconds);g.target=null;}
test('same daily seed reproduces salvage distribution; upgrades affect capacity and magnet',()=>{
  const a=new core.Game(core.hash('2026-10-15'),4),b=new core.Game(core.hash('2026-10-15'),4);
  a.dropScrap(100,400,20);b.dropScrap(100,400,20);assert.deepEqual(a.scrap,b.scrap);
  const c=new core.Game(1,1,{cargo:2,magnet:3});assert.equal(c.capacity(),22);assert.equal(c.radius(),93);
});
test('stationary magnet removes anchors then collapses building, conserving material',()=>{
  const g=new core.Game(1,1);const b=g.buildings[0];
  for(const bolt of b.bolts){g.car.x=bolt.x;g.car.y=bolt.y;tick(g,4);}
  tick(g,2);assert.equal(b.state,'cleared');assert.equal(g.demolished,1);
  assert.equal(g.scrap.length+g.cargo.length+g.delivered,g.extracted+b.mass);
});
test('cargo cannot exceed capacity; depot unloads without losing materials',()=>{
  const g=new core.Game(1,1);g.dropScrap(g.car.x,g.car.y,30);tick(g,5);assert.equal(g.cargo.length,g.capacity());
  const total=g.scrap.length+g.cargo.length;g.car={x:core.depot.x,y:core.depot.y};tick(g,4);
  assert.ok(g.delivered>0);assert.equal(g.scrap.length+g.cargo.length+g.delivered,total);
});
test('first yard can be cleared by driving around buildings and delivering salvage',()=>{
  const g=new core.Game(core.hash('yard-1'),1);
  // Real movement through reachable exterior positions (no teleporting).
  [[126,535],[193,564],[274,537],[280,410],[174,411],[100,417],[30,400],[30,350],[30,415],[175,415],[183,347],[199,348],[270,370],[349,365],[349,297]].forEach(p=>drive(g,...p,5));
  tick(g,2);assert.equal(g.demolished,3,'all anchor groups must be reachable');
  for(let trips=0;trips<150&&!g.done;trips++){
    if(g.cargo.length>=g.capacity()||(!g.scrap.length&&g.cargo.length)){drive(g,67,584,5);tick(g,2);}
    else if(g.scrap.length){const s=g.scrap[0];drive(g,s.x,s.y,5);tick(g,1);}
  }
  assert.equal(g.done,true);assert.ok(g.delivered>=g.quota);assert.ok(g.time<400,'first yard should not require excessive travel');
});
test('save validation and upgrade prices are bounded',()=>{
  const s=core.cleanSave({level:-100,coins:-1,upgrades:{magnet:99,cargo:-3}});assert.equal(s.level,1);assert.equal(s.coins,0);assert.equal(s.upgrades.magnet,5);assert.equal(s.upgrades.cargo,0);assert.equal(core.cost(5),Infinity);
});
test('magnet overdrive cannot be spammed and delivery recharges it',()=>{
  const g=new core.Game(1,1);const r=g.radius();assert.equal(g.activate(),true);assert.equal(g.activate(),false);assert.equal(g.radius(),r+38);tick(g,6);assert.equal(g.radius(),r);assert.equal(g.activate(),false);
  g.car={x:core.depot.x,y:core.depot.y};g.cargo=Array.from({length:20},()=>({x:67,y:584}));tick(g,3);assert.equal(g.energy,1);assert.equal(g.activate(),true);
});
test('app input completes a yard, awards once, persists upgrades and pauses in background',()=>{
  const start=require('../src/salvage-app');let frame,input,visibility,g,stored,now=1000;const events=[];
  const context=new Proxy({},{get:(obj,key)=>obj[key]||(()=>{}),set:(obj,key,value)=>{obj[key]=value;return true;}});
  class TrackedGame extends core.Game{constructor(...args){super(...args);g=this;}}
  start({canvas:{width:390,height:720,getContext:()=>context},load:()=>({}),save:d=>{stored=JSON.parse(JSON.stringify(d));},frame:fn=>{frame=fn;},input:fn=>{input=fn;},visibility:fn=>{visibility=fn;},event:(n,d)=>events.push([n,d]),share:()=>{}},Object.assign({},core,{Game:TrackedGame}));
  function frames(n){for(let i=0;i<n;i++){now+=1000/60;frame(now);}}
  function click(x,y){input('down',{x,y});input('up',{x,y});frames(2);}
  function move(x,y){input('down',{x,y});frames(300);input('up',{x,y});frames(120);}
  frames(1);click(100,578);assert.ok(g);frames(10);visibility(true);const time=g.time;frames(60);assert.equal(g.time,time);visibility(false);
  [[126,535],[193,564],[274,537],[280,410],[174,411],[100,417],[30,400],[30,350],[30,415],[175,415],[183,347],[199,348],[270,370],[349,365],[349,297]].forEach(p=>move(...p));
  assert.equal(g.demolished,3);
  for(let i=0;i<150&&!g.done;i++){if(g.cargo.length>=g.capacity()||(!g.scrap.length&&g.cargo.length))move(67,584);else if(g.scrap.length)move(g.scrap[0].x,g.scrap[0].y);}
  assert.ok(g.done);assert.equal(stored.level,2);assert.equal(stored.coins,g.delivered+30+g.contractBonus);assert.equal(stored.records.completed,1);assert.equal(stored.records.bestScore,g.score);assert.equal(stored.records.recent[0].level,1);const balance=stored.coins;frames(120);assert.equal(stored.coins,balance);assert.equal(stored.records.completed,1);assert.equal(events.filter(e=>e[0]==='yard_complete').length,1);
  click(100,517);click(100,637);click(100,380);assert.equal(stored.upgrades.magnet,1);assert.equal(stored.coins,balance-40);
  click(100,640);click(275,637);assert.equal(g.upgrades.magnet,0,'daily challenges use equal equipment');
});
test('WeChat entry registers lifecycle, touch, storage, sharing and canvas with mocked SDK',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
  const file=path.resolve(__dirname,'../game.js');let frame;const handlers={};
  const context=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
  const canvas={getContext:()=>context};const wx={createCanvas:()=>canvas,getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:2,safeArea:{top:44,bottom:810}}),getMenuButtonBoundingClientRect:()=>({bottom:76}),showShareMenu:()=>{},onShareAppMessage:fn=>{handlers.share=fn;},getLaunchOptionsSync:()=>({query:{}}),getStorageSync:()=>'',setStorageSync:()=>{},reportEvent:()=>{},vibrateShort:()=>{},shareAppMessage:()=>{}};
  for(const name of ['onHide','onShow','onTouchStart','onTouchMove','onTouchEnd','onTouchCancel'])wx[name]=fn=>{handlers[name]=fn;};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{wx,require:createRequire(file),requestAnimationFrame:fn=>{frame=fn;}});
  frame(1000);assert.equal(canvas.width,780);assert.equal(canvas.height,1688);assert.equal(handlers.share().query,'mode=daily');
  handlers.onTouchStart({touches:[{clientX:100,clientY:670}]});handlers.onTouchCancel({changedTouches:[{clientX:100,clientY:670}]});handlers.onHide();frame(2000);handlers.onShow();frame(3000);
  assert.ok(handlers.onTouchEnd);assert.ok(handlers.onTouchMove);
});
test('pulse pierces several nearby cores, allowing a quick collapse during overdrive',()=>{
  const g=new core.Game(1,1),b=g.buildings[0];g.car={x:b.x,y:b.y+75};
  assert.equal(g.activate(),true);assert.ok(b.bolts.every(a=>a.hp<.2));
  // Drive clockwise around the footprint while the pulse overclock is active.
  drive(g,140,535,1);drive(g,196,558,1);drive(g,260,535,2);tick(g,2);
  assert.equal(b.state,'cleared');assert.ok(g.maxCombo>=3);assert.ok(g.score>=1100);
  assert.ok(g.pulses.every(p=>p.life>0));
});
test('collapse shockwaves damage nearby towers without duplicating materials or collapse rewards',()=>{
  const g=new core.Game(1,1),first=g.buildings[0],second=g.buildings[1];
  first.bolts.forEach(a=>g.damageAnchor(first,a,2));
  assert.equal(g.demolished,1);assert.ok(second.bolts.some(a=>a.hp<1));
  const score=g.score,extracted=g.extracted;first.bolts.forEach(a=>g.damageAnchor(first,a,100));
  assert.equal(g.score,score);assert.equal(g.extracted,extracted);tick(g,1);
  assert.equal(g.scrap.length+g.cargo.length+g.delivered,g.extracted+first.mass);
});
test('drone delivery conserves cargo, recharges pulse and obeys cooldown',()=>{
  const g=new core.Game(1,1);g.energy=0;g.cargo=Array.from({length:12},()=>({x:70,y:530}));
  assert.equal(g.dispatch(),true);assert.equal(g.delivered,12);assert.equal(g.cargo.length,0);assert.ok(g.energy>.5);
  g.cargo=[{x:70,y:530}];assert.equal(g.dispatch(),false);assert.equal(g.delivered,12);
  tick(g,17);assert.equal(g.dispatch(),true);assert.equal(g.delivered,13);
});
test('each field module is gated, chosen once and changes its promised mechanics',()=>{
  for(const id of ['arc','swarm','drive']){
    const g=new core.Game(1,1);assert.equal(g.chooseModule(id),false);g.demolished=1;g.energy=0;
    assert.equal(g.chooseModule('invalid'),false);assert.equal(g.chooseModule(id),true);assert.equal(g.energy,1);assert.equal(g.chooseModule(id),false);
    if(id==='arc'){assert.equal(g.pulseRadius(),178);const b=g.buildings[0];g.damageAnchor(b,b.bolts[0],2);assert.equal(g.comboUntil,g.time+6);}
    if(id==='swarm'){assert.equal(g.capacity(),20);g.cargo=[{x:70,y:530}];g.dispatch();assert.equal(g.dispatchCooldown,8);}
    if(id==='drive'){assert.equal(g.radius(),84);g.activate();assert.equal(g.boost,8);}
  }
});
test('dash provides displacement without a held target, respects bounds and cannot cross buildings',()=>{
  const g=new core.Game(1,1);g.car={x:30,y:570};g.heading=0;assert.equal(g.dash(),true);assert.equal(g.dash(),false);tick(g,.4);assert.ok(g.car.y<450);assert.ok(g.trail.length>0);
  tick(g,4);g.car={x:196,y:590};g.heading=0;g.target=null;g.dash();tick(g,.4);
  assert.ok(g.car.y>=g.buildings[0].y+g.buildings[0].h/2+12,'dash stops at building footprint');
  tick(g,4);g.car={x:25,y:570};g.heading=-Math.PI/2;g.dash();tick(g,.4);assert.equal(g.car.x,22);
});
test('seeded map variants change routes and keep all cores within the playable arena',()=>{
  const variants=new Set();for(let seed=0;seed<30;seed++){const g=new core.Game(seed,4);variants.add(g.variant);for(const b of g.buildings)for(const a of b.bolts){assert.ok(a.x>=22&&a.x<=368);assert.ok(a.y>=240&&a.y<=620);}}
  assert.equal(variants.size,3);
});
test('field module selection pauses simulation, applies via card input and resumes only once',()=>{
  const start=require('../src/salvage-app');let frame,input,g,now=1000;const drawn=[];
  const context=new Proxy({fillText:t=>drawn.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
  class TrackedGame extends core.Game{constructor(...args){super(...args);g=this;}}
  start({canvas:{width:390,height:720,getContext:()=>context},load:()=>({}),save:()=>{},frame:fn=>{frame=fn;},input:fn=>{input=fn;},visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game:TrackedGame}));
  function frames(n){for(let i=0;i<n;i++){now+=1000/60;frame(now);}}
  function click(x,y){input('down',{x,y});input('up',{x,y});frames(2);}
  frames(1);click(100,578);g.buildings[0].bolts.forEach(a=>g.damageAnchor(g.buildings[0],a,2));frames(90);
  assert.equal(g.moduleOffered,true);assert.ok(drawn.includes('选择你的拆解流派'));const time=g.time;frames(60);assert.equal(g.time,time);
  click(80,290);assert.equal(g.moduleId,'arc');frames(60);assert.ok(g.time>time);assert.equal(g.chooseModule('swarm'),false);
});
test('icon navigation, skill hit areas and pause/resume work without matching button text',()=>{
 const start=require('../src/salvage-app');let input,frame,g,now=1000;let texts=[];
 const context=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
 class Tracked extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>context},load:()=>({}),save:()=>{},frame:fn=>{frame=fn;},input:fn=>{input=fn;},visibility:()=>{},event:()=>{},share:()=>{}},Object.assign({},core,{Game:Tracked}));
 function frames(n=2){texts=[];for(let i=0;i<n;i++){now+=1000/60;frame(now);}}
 function click(x,y){input('down',{x,y});input('up',{x,y});frames();}
 frames();click(79,485);assert.ok(texts.includes('驾驶手册'));click(100,650);
 click(195,485);assert.ok(texts.includes('任务档案'));assert.ok(texts.includes('完成第一场任务，点亮你的档案'));click(100,650);
 click(311,485);assert.ok(texts.includes('浏览器离线试玩'));assert.ok(texts.includes('云存档与排行榜尚未开放'));click(100,650);
 click(100,578);click(313,674);assert.ok(g.boost>0);assert.ok(g.extracted>0);
 g.cargo=[{x:g.car.x,y:g.car.y}];click(77,674);assert.equal(g.delivered,1);assert.equal(g.cargo.length,0);
 click(195,674);assert.ok(g.dashCooldown>0);click(346,30);const t=g.time;frames(60);assert.equal(g.time,t);click(100,376);frames(10);assert.ok(g.time>t);
});
test('old saves gain empty archives and malformed record fields are bounded',()=>{
 assert.equal(core.cleanSave({level:3}).records.completed,0);
 const r=core.cleanSave({records:{completed:-1,bestScore:Infinity,recent:Array(20).fill({score:-1,seconds:NaN,mode:'fake',level:999})}}).records;
 assert.equal(r.bestScore,0);assert.equal(r.completed,0);assert.equal(r.recent.length,6);assert.equal(r.recent[0].mode,'tour');assert.equal(r.recent[0].score,0);
});
test('cloud vault requires confirmation, protects conflicts, restores and supports undo',async()=>{
 const start=require('../src/salvage-app');let input,frame,now=1000,stored,backup,remote=null,revision=0;let texts=[];const events=[];
 const context=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}});
 const initial=core.cleanSave({level:3,coins:90});
 start({canvas:{width:390,height:720,getContext:()=>context},load:()=>initial,save:d=>{stored=structuredClone(d);return true;},frame:fn=>{frame=fn;},input:fn=>{input=fn;},visibility:()=>{},event:n=>events.push(n),share:()=>{},cloudStatus:()=> 'ready',cloudLoad:async()=>({ok:true,save:remote,revision,updatedAt:Date.now()}),cloudSave:async(data,expected)=>{if(expected!==revision)return{ok:false,code:'MGT_SAVE_CONFLICT',revision};remote=structuredClone(data);return{ok:true,revision:++revision,updatedAt:Date.now()};},backupLocal:data=>{backup=structuredClone(data);return true;}},core);
 function frames(){texts=[];for(let i=0;i<2;i++){now+=1000/60;frame(now);}}
 function click(x,y){input('down',{x,y});input('up',{x,y});frames();}
 async function settle(){await new Promise(setImmediate);frames();}
 frames();click(311,485);await settle();click(100,505);assert.ok(texts.includes('确认备份本机？'));assert.equal(revision,0);
 click(100,405);await settle();assert.equal(revision,1);assert.equal(remote.level,3);assert.equal(stored,undefined);
 remote=core.cleanSave({level:5,coins:150});revision=2;click(100,505);click(100,405);await settle();assert.equal(remote.level,5);assert.equal(stored,undefined);assert.ok(texts.includes('云存档已被其他设备更新，请刷新后再选择'));
 click(100,562);await settle();click(280,505);assert.ok(texts.includes('确认恢复云端？'));click(100,405);await settle();assert.equal(stored.level,5);assert.equal(backup.level,3);
 click(280,562);click(100,405);await settle();assert.equal(stored.level,3);assert.equal(events.filter(n=>n==='cloud_backup').length,1);assert.equal(events.filter(n=>n==='cloud_restored').length,1);
});
