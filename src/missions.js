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
  m.nodes.forEach(function(n){if(n.active)return;var near=Math.hypot(n.x-game.car.x,n.y-game.car.y)<27;
   if(m.kind==='switch'||m.kind==='power'){if(near)n.charge=Math.min(1,n.charge+dt/(m.kind==='power'?2:1.5));if(n.charge>=1){n.active=true;m.value++;game.energy=1;game.effects.push({x:n.x,y:n.y,text:'屏障已解除',life:1.5});}}
   if(m.kind==='collect'&&near){n.active=true;m.value++;game.energy=Math.min(1,game.energy+.35);}
   if(m.kind==='dash'&&n.id===m.value&&near&&game.dashTime>0){n.active=true;m.value++;game.effects.push({x:n.x,y:n.y,text:'航标 '+m.value+' 已通过',life:1});}
   if(m.kind==='rescue'&&near&&m.passenger===null){n.active=true;m.passenger=n.id;game.effects.push({x:n.x,y:n.y,text:'工程师已上车，返回中枢',life:2});}
  });
  if(m.kind==='rescue'&&m.passenger!==null&&game.atDepot()){m.passenger=null;m.value++;game.effects.push({x:67,y:560,text:'工程师已安全送达',life:2});}
 }
 function pulse(game){var m=game.mission;if(!m||m.kind!=='charge')return;m.nodes.forEach(function(n){if(!n.active&&Math.hypot(n.x-game.car.x,n.y-game.car.y)<game.pulseRadius()){n.active=true;n.charge=1;m.value++;game.effects.push({x:n.x,y:n.y,text:'电容充能完成',life:1.5});}});}
 var api={definitions:definitions,create:create,shielded:shielded,update:update,pulse:pulse,complete:function(game){return!game.mission||game.mission.value>=game.mission.target;}};if(typeof module!=='undefined')module.exports=api;else root.MagnetMissions=api;
})(typeof globalThis!=='undefined'?globalThis:this);
