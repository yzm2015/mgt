(function(root){
 'use strict';
 function nearest(game,points){return points.slice().sort(function(a,b){return Math.hypot(a.x-game.car.x,a.y-game.car.y)-Math.hypot(b.x-game.car.x,b.y-game.car.y);})[0];}
 function hint(game){var m=game.mission,p;
  function result(label,target,icon){return{label:label,target:target||null,icon:icon||'route'};}
  if(game.blast&&game.blast.timer>0){var exits=[{x:22,y:240},{x:368,y:240},{x:22,y:620},{x:368,y:620}].filter(function(p){return game.blast.charges.every(function(c){return Math.hypot(c.x-p.x,c.y-p.y)>125;});});return result('撤离警戒圈 / 点击前往安全位置',nearest(game,exits),'home');}
  if(game.lab){var l=game.lab;
   if(l.def.blast&&(game.blast.detonated<l.def.blast||game.blast.safeDetonated<l.def.safe))return result('靠近建筑布设爆破，启动后撤离警戒圈',nearest(game,game.buildings.filter(function(b){return b.state==='standing';}).reduce(function(a,b){return a.concat(b.bolts.filter(function(v){return !v.removed;}));},[])),'bomb');
   if(l.def.ground&&game.groundDelivered<l.def.ground){if(game.cargo.length>=Math.min(6,l.def.ground-game.groundDelivered))return result('地面清运 '+game.groundDelivered+'/'+l.def.ground+' / 点击返回中枢',{x:67,y:584},'home');p=nearest(game,game.scrap);if(p)return result('收集散落材料，运回中枢完成地面清运',p,'cargo');}
   if(l.links<l.def.links)return result(l.def.rule==='repel'?'开启两座同色磁极，再点击共振':'开启两座磁极，再点击共振按钮',null,'magnet');
   if(l.hits<l.def.hits){if(game.cargo.length<4){p=nearest(game,game.scrap);if(p)return result('先收集 4 件金属，组装废铁武器',p,'cargo');}else{
    var bolts=[];game.buildings.forEach(function(b){if(b.state==='standing'&&!(l.def.boss&&b.id===2&&game.demolished<2))b.bolts.forEach(function(a){if(!a.removed)bolts.push(a);});});p=nearest(game,bolts);return result('靠近核心，选择所需武器并点击释放',p,'pulse');
   }}
  }
  if(m&&m.value<m.target){
   if(m.kind==='ground'&&game.cargo.length>=Math.min(6,m.target-game.groundDelivered))return result('送回绿色中枢，完成地面交付',{x:67,y:584},'cargo');
   if(m.kind==='airlift'&&game.cargo.length>0&&game.dispatchCooldown<=0)return result('点击无人机，货物计入空运配额',null,'drone');
   if(m.kind==='rescue'&&m.passenger!==null)return result('工程师已上车，送回绿色中枢',{x:67,y:584},'home');
   if(['switch','power','collect','charge','dash','rescue'].indexOf(m.kind)>=0){p=m.kind==='dash'?m.nodes[m.value]:nearest(game,m.nodes.filter(function(n){return!n.active;}));if(p){
    if(m.kind==='charge'&&game.energy<1)return result('回收可加快脉冲充能，充满后激活电容',null,'pulse');
    var labels={switch:'前往控制台，停留启动双闸',power:'前往电站，停留解除对应护盾',collect:'收集发光的能源核心',charge:'靠近电容，再释放脉冲',dash:'前往第 '+(m.value+1)+' 号航标，推进穿过',rescue:'接走工程师，再送回绿色中枢'};return result(labels[m.kind],p,m.kind==='dash'?'dash':m.kind==='charge'?'pulse':'route');
   }}
  }
  if(game.cargo.length>=game.capacity())return result(game.dispatchCooldown<=0?'货舱已满，可用无人机或送回中枢':'货舱已满，送回绿色回收中枢',{x:67,y:584},'cargo');
  var anchors=[];game.buildings.forEach(function(b){var shield=m&&(m.kind==='switch'&&b.id===2&&m.value<2||m.kind==='power'&&!m.nodes[b.id].active);if(b.state==='standing'&&!shield)b.bolts.forEach(function(a){if(!a.removed)anchors.push(a);});});
  p=nearest(game,anchors);if(p)return result(game.energy>=1?'靠近橙色核心，脉冲可一次击穿多处':'靠近橙色核心，磁力自动拆解',p,'magnet');
  if(game.cargo.length)return result('将已回收的金属送回中枢',{x:67,y:584},'cargo');
  p=nearest(game,game.scrap);if(p)return result('收集散落金属，完成回收配额',p,'cargo');
  return result('检查顶部主线，点击可查看详细说明',null,'help');
 }
 if(typeof module!=='undefined')module.exports=hint;else root.getMagnetHint=hint;
})(typeof globalThis!=='undefined'?globalThis:this);
