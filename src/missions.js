(function(root){
 'use strict';
 var definitions={
  1:{kind:'ground',label:'地面交付 12 件金属',help:'将货物送到回收中枢，累计地面交付 12 件。',target:12,nodes:[]},
  2:{kind:'switch',label:'启动双闸控制台',help:'靠近两座紫色控制台各停留 1.5 秒，解除北塔屏障。',target:2,nodes:[[38,445],[346,265]]},
  3:{kind:'collect',label:'收集 3 枚能源核心',help:'驶近青色能源核心收集，三枚缺一不可。',target:3,nodes:[[36,485],[340,400],[340,250]]},
  4:{kind:'charge',label:'脉冲激活 3 座电容',help:'在电容附近释放脉冲，脉冲圈覆盖即可激活。',target:3,nodes:[[38,290],[190,550],[346,415]]},
  5:{kind:'airlift',label:'无人机空运 36 件金属',help:'用无人机实际交付 36 件；空载呼叫不计数。',target:36,nodes:[]},
  6:{kind:'dash',label:'依序推进穿过 3 个航标',help:'按 1→2→3 顺序，在推进期间进入航标圈。',target:3,nodes:[[340,550],[38,430],[340,250]]},
  7:{kind:'power',label:'关闭 3 座护盾电站',help:'每座电站需靠近停留 2 秒，关闭后才能拆对应塔。',target:3,nodes:[[38,510],[348,395],[190,240]]},
  8:{kind:'rescue',label:'接回 2 位被困工程师',help:'靠近橙色救援舱接人，再驶回回收中枢；一次载 1 人。',target:2,nodes:[[38,290],[345,480]]}
 };
 function create(stage){var d=stage&&definitions[stage.id];return d?{kind:d.kind,label:d.label,help:d.help,target:d.target,value:0,passenger:null,nodes:d.nodes.map(function(p,i){return{x:p[0],y:p[1],id:i,active:false,charge:0};})}:null;}
 function shielded(game,b){var m=game.mission;return!!(m&&(m.kind==='switch'&&b.id===2&&m.value<2||m.kind==='power'&&!m.nodes[b.id].active));}
 function update(game,dt){var m=game.mission;if(!m)return;
  if(m.kind==='ground')m.value=Math.min(m.target,game.groundDelivered);
  if(m.kind==='airlift')m.value=Math.min(m.target,game.airDelivered);
  m.nodes.forEach(function(n){if(n.active)return;var near=Math.hypot(n.x-game.car.x,n.y-game.car.y)<=32;
   if(m.kind==='switch'||m.kind==='power'){if(near)n.charge=Math.min(1,n.charge+dt/(m.kind==='power'?2:1.5));if(n.charge>=1){n.active=true;m.value++;game.energy=1;game.effects.push({x:n.x,y:n.y,text:'屏障已解除',life:1.5});}}
   if(m.kind==='collect'&&near){n.active=true;m.value++;game.energy=Math.min(1,game.energy+.35);}
   if(m.kind==='dash'&&n.id===m.value&&near&&game.dashTime>0){n.active=true;m.value++;game.effects.push({x:n.x,y:n.y,text:'航标 '+m.value+' 已通过',life:1});}
   if(m.kind==='rescue'&&near&&m.passenger===null&&!(incident(game)&&incident(game).state==='aboard')){n.active=true;m.passenger=n.id;game.effects.push({x:n.x,y:n.y,text:'工程师已上车，返回中枢',life:2});}
  });
  if(m.kind==='rescue'&&m.passenger!==null&&game.atDepot()){m.passenger=null;m.value++;game.effects.push({x:67,y:560,text:'工程师已安全送达',life:2});}
 }
 function pulse(game){var m=game.mission;if(!m||m.kind!=='charge')return;m.nodes.forEach(function(n){if(!n.active&&Math.hypot(n.x-game.car.x,n.y-game.car.y)<game.pulseRadius()){n.active=true;n.charge=1;m.value++;game.effects.push({x:n.x,y:n.y,text:'电容充能完成',life:1.5});}});}
 function initEmergency(g){g.incidents=[];if(!g.stage||g.stage.id<5||g.stage.id===6)return;var id=g.stage.id;g.incidents.push({kind:id===7?'fire':'person',x:38,y:id===7?300:440,start:8,state:'pending',progress:0});if(id===8)g.incidents.push({kind:'fire',x:340,y:550,start:18,state:'pending',progress:0});}
 function incident(g){var selected=(g.incidents||[])[g.incidentFocus];if(selected&&(selected.state==='active'||selected.state==='aboard'))return selected;return(g.incidents||[]).find(function(e){return e.state==='active'||e.state==='aboard';})||null;}
 function updateEmergency(g,dt){(g.incidents||[]).forEach(function(e){if(e.state==='pending'&&g.time>=e.start){e.state='active';g.stop();g.blast.timer=0;g.effects.push({x:e.x,y:e.y,text:e.kind==='fire'?'发现火情 / 暂停拆除':'行人进入作业区 / 先救援',life:3});g.emitFx('objective',e.x,e.y);}if(e.state==='active'&&e.kind==='person'){e.y=440+Math.sin(g.time*.6)*16;if(Math.hypot(e.x-g.car.x,e.y-g.car.y)<34&&(!g.mission||g.mission.passenger===null)){e.state='aboard';g.effects.push({x:e.x,y:e.y,text:'已上车 / 返回中枢',life:2});}}if(e.state==='aboard'&&g.atDepot()){e.state='resolved';g.emitFx('objective',67,584);}if(e.state==='active'&&e.kind==='fire'&&e.responding){if(Math.hypot(e.x-g.car.x,e.y-g.car.y)>70){e.responding=false;return;}e.progress=Math.min(1,e.progress+dt/(g.rig==='rescue'?3:6));if(e.progress>=1){e.state='resolved';g.emitFx('objective',e.x,e.y);g.effects.push({x:e.x,y:e.y,text:'火情已解除 / 可以施工',life:2});}}});}
 function respond(g){var e=incident(g);if(!e)return false;if(e.kind==='person'&&g.mission&&g.mission.passenger!==null)return g.navigate(67,584);if(e.state==='aboard')return g.navigate(67,584);if(e.kind==='fire'&&Math.hypot(e.x-g.car.x,e.y-g.car.y)<=70){e.responding=true;g.stop();return true;}return g.navigate(e.x,e.y);}
 function emergencyHint(g){var e=incident(g);if(!e)return null;if(e.kind==='person'&&g.mission&&g.mission.passenger!==null)return{label:'已有乘客 / 先送回中枢再救援行人',target:{x:67,y:584},icon:'home'};return{label:e.state==='aboard'?'行人已上车 / 点击送回中枢':e.kind==='person'?'先救援行人 / 点击靠近接人':e.responding?'灭火中 '+Math.round(e.progress*100)+'% / 保持靠近':Math.hypot(e.x-g.car.x,e.y-g.car.y)<=70?'点击右下角救援启动灭火':'发现火情 / 点击靠近灭火',target:e.state==='aboard'?{x:67,y:584}:e,icon:'user'};}
 function feedback(game){var m=game.mission;if(!m||!m.nodes.length)return null;var nodes=m.nodes.slice().sort(function(a,b){return Math.hypot(a.x-game.car.x,a.y-game.car.y)-Math.hypot(b.x-game.car.x,b.y-game.car.y);}),n=nodes[0];if(Math.hypot(n.x-game.car.x,n.y-game.car.y)>48)return null;var prefix=(n.id+1)+' 号 / ',inside=Math.hypot(n.x-game.car.x,n.y-game.car.y)<=32;
  if(n.active)return{node:n,label:prefix+(m.kind==='rescue'&&m.passenger===n.id?'工程师已上车，请返回中枢':'已完成，请前往下一目标')};
  if(!inside)return{node:n,label:prefix+'再靠近一点，驶入目标圈'};
  if(m.kind==='switch'||m.kind==='power')return{node:n,label:prefix+'保持停留，启动 '+Math.round(n.charge*100)+'%'};
  if(m.kind==='charge')return{node:n,label:prefix+(game.energy>=1?'点击右下角脉冲激活':'脉冲充能 '+Math.floor(game.energy*100)+'% / 回收可加速'),action:'pulse'};
  if(m.kind==='dash')return{node:n,label:prefix+(n.id!==m.value?'顺序未到，请先通过 '+(m.value+1)+' 号':game.dashCooldown>0?'推进冷却 '+Math.ceil(game.dashCooldown)+' 秒':'点击右下角推进通过'),action:n.id===m.value?'dash':null};
  if(m.kind==='rescue'&&m.passenger!==null)return{node:n,label:prefix+'座位已满，请先返回中枢送人'};
  return{node:n,label:prefix+'驶入目标圈自动收集'};
 }
 var api={initEmergency:initEmergency,updateEmergency:updateEmergency,incident:incident,respond:respond,emergencyHint:emergencyHint,feedback:feedback,definitions:definitions,create:create,shielded:shielded,update:update,pulse:pulse,complete:function(game){return!game.mission||game.mission.value>=game.mission.target;}};if(typeof module!=='undefined')module.exports=api;else root.MagnetMissions=api;
})(typeof globalThis!=='undefined'?globalThis:this);
