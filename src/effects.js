(function(root){
 'use strict';
 function create(reduced){var source=null,lastId=0,seed=1,particles=[],bursts=[],texts=[];
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function emit(e){seed=e.id*7919+17;var count=e.type==='collapse'?28:e.type==='core'?9:e.type==='pickup'?2:e.type==='pulse'?16:6,color=e.type==='collapse'?'#ffbd72':e.type==='objective'?'#96ffd4':'#65edff';if(reduced)count=Math.min(count,3);
   for(var i=0;i<count;i++){var angle=random()*Math.PI*2,speed=(e.type==='collapse'?50:24)+random()*40,life=.3+random()*.7;particles.push({x:e.x,y:8+random()*15,z:e.y,vx:Math.cos(angle)*speed,vy:30+random()*55,vz:Math.sin(angle)*speed,life:life,max:life,size:2+random()*3,color:color});}
   if(['core','collapse','objective','pulse'].indexOf(e.type)>=0)bursts.push({x:e.x,z:e.y,life:.65,max:.65,r:e.type==='collapse'?75:35,color:color});
   if(e.type==='core')texts.push({x:e.x,z:e.y,text:'核心击破 ×'+e.value,life:1.05,max:1.05,color:'#ffbd72'});
   if(e.type==='collapse')texts.push({x:e.x,z:e.y,text:'链式坍塌 +500',life:1.4,max:1.4,color:'#ffbd72'});
   if(e.type==='delivery')texts.push({x:e.x,z:e.y,text:'回收 +'+e.value,life:.85,max:.85,color:'#96ffd4'});
   if(e.type==='objective')texts.push({x:e.x,z:e.y,text:'主线完成',life:1.6,max:1.6,color:'#96ffd4'});
   particles=particles.slice(-(reduced?24:128));bursts=bursts.slice(-12);texts=texts.slice(-7);
  }
  return{update:function(game,dt){dt=Math.max(0,Math.min(.05,dt));if(game!==source){source=game;lastId=0;particles=[];bursts=[];texts=[];}if(!game)return;
    particles.forEach(function(p){p.life-=dt;p.x+=p.vx*dt;p.y=Math.max(1,p.y+p.vy*dt);p.z+=p.vz*dt;p.vy-=130*dt;});particles=particles.filter(function(p){return p.life>0;});bursts.forEach(function(p){p.life-=dt;});bursts=bursts.filter(function(p){return p.life>0;});texts.forEach(function(p){p.life-=dt;});texts=texts.filter(function(p){return p.life>0;});
    (game.fxEvents||[]).forEach(function(e){if(e.id>lastId){lastId=e.id;emit(e);}});
   },setReduced:function(value){reduced=!!value;particles=particles.slice(-(reduced?24:128));},reduced:function(){return reduced;},particles:function(){return particles;},bursts:function(){return bursts;},texts:function(){return texts;}};
 }
 if(typeof module!=='undefined')module.exports=create;else root.createMagnetEffects=create;
})(typeof globalThis!=='undefined'?globalThis:this);
