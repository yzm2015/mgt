'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../src/salvage-core');
function tick(g,s){for(let i=0;i<Math.ceil(s/.04);i++){if(g.cargo.length>=g.capacity()&&!(g.mission&&g.mission.kind==='ground'&&g.mission.value<g.mission.target))g.dispatch();g.update(.04);}}
function route(g,target){
 const nodes=[];for(let y=240;y<=620;y+=10)for(let x=22;x<=362;x+=10){const blocked=g.buildings.some(b=>b.state==='standing'&&x>b.x-b.w/2-14&&x<b.x+b.w/2+14&&y>b.y-b.h/2-10&&y<b.y+b.h/2+13);if(!blocked)nodes.push({x,y});}
 const nearest=p=>nodes.reduce((best,n,i)=>Math.hypot(n.x-p.x,n.y-p.y)<Math.hypot(nodes[best].x-p.x,nodes[best].y-p.y)?i:best,0);
 const start=nearest(g.car),goal=nearest(target),lookup=new Map(nodes.map((n,i)=>[n.x+':'+n.y,i])),queue=[start],parents=new Map([[start,null]]);
 for(let h=0;h<queue.length&&!parents.has(goal);h++){const i=queue[h],n=nodes[i];for(const [dx,dy]of [[10,0],[-10,0],[0,10],[0,-10]]){const next=lookup.get((n.x+dx)+':'+(n.y+dy));if(next!==undefined&&!parents.has(next)){parents.set(next,i);queue.push(next);}}}
 assert.ok(parents.has(goal),'route to target must remain reachable');let i=goal,path=[];while(i!==null){path.unshift(nodes[i]);i=parents.get(i);}for(const p of path){g.move(p.x,p.y);tick(g,.12);}g.target=null;tick(g,.3);
}
test('all eight standard and storm contracts can be completed with real movement and zero upgrades',()=>{
 for(const risk of [false,true])for(const stage of core.stages){const g=new core.Game(core.hash('yard-'+stage.id),stage.id,{magnet:0,cargo:0},{stage:stage.id,risk});
  assert.equal(g.stage.name,stage.name);
  if(g.incidents.length){tick(g,19);for(const e of g.incidents){route(g,e);if(e.kind==='fire'){core.missions.respond(g);tick(g,7);}else{tick(g,.3);route(g,core.depot);tick(g,1);}assert.equal(e.state,'resolved');}}

  if(['switch','power','collect','rescue','charge','dash'].includes(g.mission.kind))for(const n of g.mission.nodes){
   route(g,n);
   if(g.mission.kind==='switch'||g.mission.kind==='power')tick(g,2.2);
   if(g.mission.kind==='rescue'){assert.notEqual(g.mission.passenger,null,'engineer must board');route(g,core.depot);tick(g,1);}
   if(g.mission.kind==='charge'){tick(g,30);g.activate();tick(g,1);}
   if(g.mission.kind==='dash'){tick(g,4);g.dash();tick(g,.08);g.target=null;}
  }
  for(let attempts=0;g.demolished<3&&attempts<20;attempts++){const b=g.buildings.find(b=>b.state==='standing'),a=b.bolts.find(a=>!a.removed);route(g,a);g.activate();tick(g,4);}
  assert.equal(g.demolished,3,stage.name+' must allow all anchors to be reached');tick(g,2);
  for(let trips=0;!g.done&&trips<180;trips++){if(g.cargo.length>=g.capacity()){if(g.mission.kind==='ground'&&g.mission.value<g.mission.target){route(g,core.depot);tick(g,2);}else{g.dispatch();tick(g,17);}}else if(g.scrap.length)route(g,g.scrap[0]);else{g.dispatch();tick(g,17);}}
  assert.equal(g.mission.value,g.mission.target,stage.name+' mandatory condition');assert.equal(g.done,true,stage.name+' must meet recovery and mission conditions');assert.ok(g.time<1800);assert.equal(g.scrap.length+g.cargo.length+g.delivered,g.total);assert.ok(core.stageStars(g)>=1);
 }
});
test('campaign stars and action goals are independent of daily equipment and save validation is bounded',()=>{
 const g=new core.Game(1,2,{}, {stage:2});g.done=true;g.time=core.stages[1].par+1;assert.equal(core.stageStars(g),1);g.actions.dash=3;assert.equal(core.stageStars(g),2);g.time=100;assert.equal(core.stageStars(g),3);
 const s=core.cleanSave({stageBest:{1:{stars:3,seconds:45},2:{stars:9,seconds:-1},100:{stars:3,seconds:1}}});assert.deepEqual(s.stageBest,{'1':{stars:3,seconds:45}});assert.deepEqual(core.cleanSave({}).stageBest,{});
 const validate=require('../cloudfunctions/mgt_gateway/save-schema').validate;assert.deepEqual(validate(s).stageBest,s.stageBest);assert.throws(()=>validate(Object.assign({},s,{stageBest:{1:{stars:4,seconds:1}}})),/MGT_BAD_SAVE/);
 const daily=new core.Game(core.hash(core.day()),4,{magnet:0,cargo:0});assert.equal(daily.stage,null);assert.equal(daily.capacity(),12);
});
