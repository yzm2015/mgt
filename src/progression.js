(function(root){
 'use strict';
 var gear=[
  {id:'magnet',name:'磁力线圈',icon:'magnet',desc:'每级磁吸范围 +9，拆芯效率提升',parts:0},
  {id:'cargo',name:'牵引拖链',icon:'cargo',desc:'每级载重 +5，减少卸货往返',parts:0},
  {id:'engine',name:'矢量引擎',icon:'dash',desc:'每级移速 +8，推进冷却 -0.2 秒',parts:1},
  {id:'reactor',name:'脉冲反应堆',icon:'pulse',desc:'每级脉冲范围 +6，自动充能 +10%',parts:1},
  {id:'drone',name:'空运协议',icon:'drone',desc:'每级无人机冷却 -1.2 秒',parts:1}
 ];
 var rigs=[{id:'balanced',name:'先锋底盘',icon:'shield',level:1,desc:'标准配置，适合均衡拆解'}, {id:'hauler',name:'蜂群底盘',icon:'cargo',level:2,desc:'载重 +6，移动速度 -12'}, {id:'striker',name:'闪电底盘',icon:'bolt',level:4,desc:'移速 +18，推进冷却 -0.6 秒，载重 -2'}];
 var tasks=[{id:'yards',name:'出勤工程师',desc:'完成 2 场普通工地',target:2,coins:80,parts:1}, {id:'recycle',name:'城市清道夫',desc:'累计回收 120 件金属',target:120,coins:100,parts:2}, {id:'chain',name:'连锁专家',desc:'在普通工地达成 6 连击',target:6,coins:80,parts:1}];
 function num(v,max){return Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;}
 function clean(raw){raw=raw&&typeof raw==='object'?raw:{};var d=raw.daily&&typeof raw.daily==='object'?raw.daily:{};return{xp:num(raw.xp,1000000),parts:num(raw.parts,99999),rig:rigs.some(function(r){return r.id===raw.rig&&level(num(raw.xp,1000000))>=r.level;})?raw.rig:'balanced',daily:{date:/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')?d.date:'',yards:num(d.yards,9999),recycle:num(d.recycle,999999),chain:num(d.chain,999),claimed:Array.isArray(d.claimed)?tasks.filter(function(t){return d.claimed.indexOf(t.id)>=0;}).map(function(t){return t.id;}):[]}};}
 function level(xp){var l=1;while(l<20&&xp>=60*l*(l+1))l++;return l;}
 function meter(xp){var l=level(xp),base=60*(l-1)*l,next=60*l*(l+1);return{level:l,current:xp-base,needed:next-base,progress:l===20?1:(xp-base)/(next-base)};}
 function daily(save,date){if(save.progression.daily.date!==date)save.progression.daily={date:date,yards:0,recycle:0,chain:0,claimed:[]};return save.progression.daily;}
 function cost(id,rank){return rank>=5?Infinity:(id==='magnet'||id==='cargo'?40+rank*35:70+rank*55);}
 function upgrade(save,id){var def=gear.find(function(g){return g.id===id;});if(!def)return{ok:false,code:'UNKNOWN_GEAR'};var rank=save.upgrades[id]||0,coins=cost(id,rank);if(rank>=5)return{ok:false,code:'MAX_LEVEL'};if(save.coins<coins)return{ok:false,code:'NEED_COINS'};if(save.progression.parts<def.parts)return{ok:false,code:'NEED_PARTS'};save.coins-=coins;save.progression.parts-=def.parts;save.upgrades[id]=rank+1;return{ok:true};}
 function equip(save,id){var rig=rigs.find(function(r){return r.id===id;});if(!rig||level(save.progression.xp)<rig.level)return false;save.progression.rig=id;return true;}
 function settle(save,game,stars,date){
  if(!game.stage||!game.done||game.growthPaid)return null;game.growthPaid=true;
  var previous=save.stageBest[game.level],first=!previous,newStars=Math.max(0,stars-(previous?previous.stars:0)),oldLevel=level(save.progression.xp);
  var base=game.delivered+30+game.contractBonus,coins=Math.floor(base*(game.risk?1.5:1))+(first?60:0)+newStars*15,xp=30+stars*5+(first?60:0)+(game.risk?25:0),parts=(first?2:0)+newStars+(game.risk?1:0);
  save.progression.xp=num(save.progression.xp+xp,1000000);var levels=level(save.progression.xp)-oldLevel;parts+=levels*2;save.progression.parts=num(save.progression.parts+parts,99999);save.coins=num(save.coins+coins,9999999);
  var d=daily(save,date);d.yards=Math.min(9999,d.yards+1);d.recycle=Math.min(999999,d.recycle+game.delivered);d.chain=Math.min(999,Math.max(d.chain,game.maxCombo));
  return{coins:coins,xp:xp,parts:parts,first:first,newStars:newStars,levels:levels,level:level(save.progression.xp)};
 }
 function claim(save,id,date){var t=tasks.find(function(t){return t.id===id;}),d=daily(save,date);if(!t||d.claimed.indexOf(id)>=0||d[id]<t.target)return false;d.claimed.push(id);save.coins=num(save.coins+t.coins,9999999);save.progression.parts=num(save.progression.parts+t.parts,99999);return true;}
 var api={gear:gear,rigs:rigs,tasks:tasks,clean:clean,level:level,meter:meter,daily:daily,cost:cost,upgrade:upgrade,equip:equip,settle:settle,claim:claim};if(typeof module!=='undefined')module.exports=api;else root.MagnetGrowth=api;
})(typeof globalThis!=='undefined'?globalThis:this);
