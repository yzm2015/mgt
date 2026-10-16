/* Experimental chapter: deterministic polarity circuits and reusable scrap equipment. */
(function(root){
 'use strict';
 var list=[
 {name:'异极牵引',tip:'给两座塔设相反磁极，再点击共振。',links:1,hits:0,rule:'attract'},
 {name:'同极弹射',tip:'给两座塔设相同磁极，用排斥冲击拆承重点。',links:1,hits:0,rule:'repel'},
 {name:'废铁重锤',tip:'保留 4 件废铁，装配磁锤并靠近塔释放。',links:1,hits:1,weapon:'hammer'},
 {name:'装甲钻探',tip:'钻头专攻单个核心；共振后再集中突破。',links:2,hits:2,weapon:'drill',armor:2},
 {name:'风暴护航',tip:'护盾持续 5 秒，抵消风暴减速并切割附近核心。',links:2,hits:1,weapon:'shield',storm:true},
 {name:'连锁实验',tip:'任意磁极组合共振 3 次，再用两次武器完成拆解。',links:3,hits:2,armor:2},
 {name:'铁穹守卫',tip:'先拆两座护卫塔，再拆中央首领；红圈蓄力时离开。',links:2,hits:3,armor:2,boss:true},
 {name:'仓区初爆',tip:'靠近布设，启动后撤离，完成一次安全爆破。',links:0,hits:0,blast:1,safe:1},
 {name:'双区联拆',tip:'布设两个爆破点，撤离后同时起爆；也可分次完成。',links:0,hits:0,blast:2,safe:2,armor:1.5},
 {name:'重装清场',tip:'完成三个安全爆破点计数，再清除装甲与回收废料。',links:0,hits:0,blast:3,safe:3,armor:2}
 ];
 var layouts=[
 [[196,483,86,62,3],[100,345,76,60,4],[276,290,82,65,5]],
 [[130,470,72,60,3],[266,425,78,62,4],[196,285,84,65,4]],
 [[196,480,92,60,4],[90,330,64,62,3],[286,330,64,62,3]],
 [[100,465,70,60,4],[280,430,70,60,5],[190,280,86,64,5]],
 [[265,475,76,60,4],[110,365,72,62,4],[282,275,72,62,5]],
 [[130,480,76,62,4],[275,370,76,62,5],[110,270,76,62,4]],
 [[102,450,66,60,3],[290,450,66,60,3],[195,285,96,76,7]],
 [[120,485,76,60,3],[270,390,80,64,4],[125,275,74,58,4]],
 [[195,475,86,60,4],[95,325,70,60,4],[280,305,74,60,5]],
 [[110,460,72,64,5],[280,410,76,62,5],[190,265,88,60,6]]
 ];
 var weapons=[{id:'hammer',name:'磁锤',icon:'hammer'},{id:'drill',name:'钻头',icon:'drill'},{id:'shield',name:'护盾',icon:'shield'}];
 function init(g,id){var n=Math.max(1,Math.min(list.length,Math.floor(Number(id)||1))),def=list[n-1];g.lab={id:n,def:def,links:0,hits:0,cooldown:0,weapon:'hammer',weaponCooldown:0,shield:0,shot:null,attack:null,nextAttack:5};
 g.mission={kind:'lab',label:def.blast?'安全爆破 '+def.safe+' 处':'共振 '+def.links+' 次 / 武器命中 '+def.hits+' 次',help:def.tip+' 点建筑或塔图标切换关闭→红＋→蓝−；右下角按本关目标切换技能。留4件金属可释放武器，工具里可换装、回收和调镜头。拆完三塔并达到回收配额即可过关。',value:0,target:1,nodes:[],passenger:null};
 g.buildings.forEach(function(b){b.pole=0;b.accent='#65edff';b.bolts.forEach(function(a){a.hp=a.maxHp=(def.armor||1);});});
 if(def.boss){var b=g.buildings[2];b.floors=7;b.boss=true;b.bolts.forEach(function(a){a.hp=a.maxHp=4;});}
 g.dropScrap(g.car.x,g.car.y,6);g.total+=6;g.quota=Math.ceil(g.total*.7);
 }
 function ready(g){var l=g.lab;return l.links>=l.def.links&&l.hits>=l.def.hits&&(!l.def.blast||g.blast.detonated>=l.def.blast&&g.blast.safeDetonated>=l.def.safe);}
 function blocked(g,b){var l=g.lab;if(!l)return false;if(l.def.boss&&b.id===2&&g.buildings.some(function(o){return o!==b&&o.state==='standing';}))return true;return false;}
 function preserve(g,b){var l=g.lab;if(!l)return false;return l.links<l.def.links||(!ready(g)&&g.buildings.filter(function(o){return o.state==='standing';}).length===1);}
 function pole(g,id){var b=g.buildings[id];if(!g.lab||g.done||!b||b.state!=='standing')return false;b.pole=b.pole===0?1:b.pole===1?-1:0;return true;}
 function resonate(g){var l=g.lab;if(!l||g.done||l.cooldown>0)return false;var active=g.buildings.filter(function(b){return b.state==='standing'&&b.pole;});if(active.length<2)return false;
 var pairs=[];for(var i=0;i<active.length;i++)for(var j=i+1;j<active.length;j++){var a=active[i],b=active[j],kind=a.pole===b.pole?'repel':'attract';if(!l.def.rule||l.def.rule===kind)pairs.push({a:a,b:b,kind:kind});}if(!pairs.length)return false;
 l.cooldown=3;l.links++;pairs.forEach(function(p){p.a.tension={x:p.b.x,y:p.b.y,kind:p.kind,life:1};p.b.tension={x:p.a.x,y:p.a.y,kind:p.kind,life:1};[p.a,p.b].forEach(function(b){var other=b===p.a?p.b:p.a,dx=other.x-b.x,dy=other.y-b.y,d=Math.hypot(dx,dy)||1,sign=p.kind==='attract'?1:-1;b.fallVector={x:dx/d*sign,y:dy/d*sign};var bolts=b.bolts.filter(function(a){return !a.removed;});if(p.kind==='repel'){bolts.sort(function(a,c){return ((c.x-b.x)*dx+(c.y-b.y)*dy)-((a.x-b.x)*dx+(a.y-b.y)*dy);});bolts=bolts.slice(0,1);}bolts.forEach(function(a){g.damageAnchor(b,a,p.kind==='attract'?.38:1.15);});});g.emitFx('pulse',(p.a.x+p.b.x)/2,(p.a.y+p.b.y)/2);});g.effects.push({x:195,y:390,text:'磁极共振 ×'+pairs.length,life:1.4});return true;}
 function equip(g,id){if(!g.lab||g.done||!weapons.some(function(w){return w.id===id;}))return false;g.lab.weapon=id;return true;}
 function fire(g){var l=g.lab;if(!l||g.done||g.cargo.length<4||l.weaponCooldown>0)return false;var range=l.weapon==='drill'?115:l.weapon==='shield'?110:135,targets=[];g.buildings.forEach(function(b){if(b.state==='standing'&&!blocked(g,b))b.bolts.forEach(function(a){if(!a.removed&&Math.hypot(a.x-g.car.x,a.y-g.car.y)<range)targets.push({b:b,a:a,d:Math.hypot(a.x-g.car.x,a.y-g.car.y)});});});targets.sort(function(a,b){return a.d-b.d;});if(!targets.length)return false;
 l.weaponCooldown=l.weapon==='shield'?7:3;l.shot={kind:l.weapon,x:g.car.x,y:g.car.y,life:.65,target:{x:targets[0].a.x,y:targets[0].a.y}};
 if(!l.def.weapon||l.def.weapon===l.weapon)l.hits++;
 if(l.weapon==='shield')l.shield=5;
 (l.weapon==='drill'?targets.slice(0,1):targets).forEach(function(t){g.damageAnchor(t.b,t.a,l.weapon==='drill'?2.2:l.weapon==='hammer'?.8:.3);});g.emitFx('pulse',g.car.x,g.car.y);return true;
 }
 function update(g,dt){var l=g.lab;if(!l)return;l.cooldown=Math.max(0,l.cooldown-dt);l.weaponCooldown=Math.max(0,l.weaponCooldown-dt);l.shield=Math.max(0,l.shield-dt);if(l.shot)l.shot.life=Math.max(0,l.shot.life-dt);g.buildings.forEach(function(b){if(b.tension)b.tension.life=Math.max(0,b.tension.life-dt);});
 if(l.shield>0)g.buildings.forEach(function(b){b.bolts.forEach(function(a){if(Math.hypot(a.x-g.car.x,a.y-g.car.y)<110)g.damageAnchor(b,a,dt*.4);});});
 if(l.def.boss&&g.buildings[2].state==='standing'){if(!l.attack&&g.time>=l.nextAttack)l.attack={x:g.car.x,y:g.car.y,left:1.8};if(l.attack){l.attack.left-=dt;if(l.attack.left<=0){if(l.shield<=0&&Math.hypot(g.car.x-l.attack.x,g.car.y-l.attack.y)<48){g.energy=Math.max(0,g.energy-.4);g.effects.push({x:g.car.x,y:g.car.y,text:'磁场干扰 · 能量损失',life:1});}g.emitFx('pulse',l.attack.x,l.attack.y);l.attack=null;l.nextAttack=g.time+5;}}}
 g.mission.value=ready(g)?1:0;
 }
 var api={list:list,layouts:layouts,weapons:weapons,init:init,blocked:blocked,preserve:preserve,pole:pole,resonate:resonate,equip:equip,fire:fire,update:update,ready:ready};if(typeof module!=='undefined')module.exports=api;else root.MagnetLab=api;
})(typeof globalThis!=='undefined'?globalThis:this);
