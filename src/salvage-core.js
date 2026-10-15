/* Pure simulation shared by WeChat and the browser. World: 390 x 720. */
(function(root){
  'use strict';
  var DEPOT={x:67,y:584,r:48};
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
  function hash(s){var h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
  function day(){return new Date(Date.now()+8*3600000).toISOString().slice(0,10);}
  function Game(seed,level,upgrades){
    this.level=clamp(level||1,1,99);this.random=rng(seed);this.upgrades=upgrades||{magnet:0,cargo:0};
    this.car={x:70,y:530};this.target=null;this.cargo=[];this.scrap=[];this.buildings=[];this.effects=[];this.heading=0;this.trail=[];this.lastTrail=-1;
    this.delivered=0;this.demolished=0;this.time=0;this.done=false;this.unloadClock=0;this.extracted=0;this.total=0;this.energy=1;this.boost=0;
    var layouts=[{x:196,y:483,w:96,h:67,floors:3},{x:96,y:343,w:82,h:66,floors:4},{x:270,y:284,w:98,h:73,floors:5}];
    this.variant=this.level===1?0:Math.floor(this.random()*3);
    if(this.variant===1)layouts=[{x:210,y:480,w:88,h:60,floors:4},{x:95,y:320,w:84,h:64,floors:5},{x:290,y:340,w:74,h:62,floors:4}];
    if(this.variant===2)layouts=[{x:120,y:470,w:80,h:60,floors:3},{x:285,y:430,w:78,h:62,floors:5},{x:200,y:285,w:90,h:65,floors:5}];
    for(var i=0;i<layouts.length;i++){
      var p=layouts[i],shiftX=this.level>1?Math.round((this.random()-.5)*20):0,shiftY=this.level>1?Math.round((this.random()-.5)*12):0,b={id:i,x:p.x+shiftX,y:p.y+shiftY,w:p.w,h:p.h,floors:p.floors+Math.min(3,Math.floor(this.level/3)),state:'standing',fall:0,bolts:[],color:i};
      var points=[[-p.w/2-8,15],[p.w/2+8,15],[0,p.h/2+7]];
      for(var j=0;j<points.length;j++)b.bolts.push({x:b.x+points[j][0],y:b.y+points[j][1],hp:1,removed:false});
      b.mass=12+b.floors*3;this.total+=b.mass+3;this.buildings.push(b);
    }
    this.quota=Math.ceil(this.total*.75);this.pulses=[];this.dispatchCooldown=0;this.combo=0;this.comboUntil=0;this.maxCombo=0;this.score=0;this.moduleId='';this.moduleOffered=false;this.dashCooldown=0;this.dashTime=0;this.contractBonus=0;
  }
  Game.prototype.capacity=function(){return 12+clamp(Number(this.upgrades.cargo)||0,0,5)*5+(this.moduleId==='swarm'?8:0);};
  Game.prototype.radius=function(){return 66+clamp(Number(this.upgrades.magnet)||0,0,5)*9+(this.boost>0?38:0)+(this.moduleId==='drive'?18:0);};
  Game.prototype.pulseRadius=function(){return this.moduleId==='arc'?178:148;};
  Game.prototype.chooseModule=function(id){
    if(this.done||this.moduleId||this.demolished<1||['arc','swarm','drive'].indexOf(id)<0)return false;
    this.moduleId=id;this.energy=1;this.dispatchCooldown=0;this.effects.push({x:this.car.x,y:this.car.y-30,text:'模组装载 · 脉冲充满',life:1.6});return true;
  };
  Game.prototype.dash=function(){if(this.done||this.dashCooldown>0)return false;this.dashCooldown=4;this.dashTime=.4;return true;};
  Game.prototype.activate=function(){
    if(this.done||this.energy<1||this.boost>0)return false;
    this.energy=0;this.boost=this.moduleId==='drive'?8:5;this.pulses.push({x:this.car.x,y:this.car.y,r:this.pulseRadius(),life:.7,max:.7});
    this.effects.push({x:this.car.x,y:this.car.y-24,text:'电磁脉冲',life:1});
    this.buildings.forEach(function(b){if(b.state==='standing')b.bolts.forEach(function(a){if(!a.removed&&Math.hypot(a.x-this.car.x,a.y-this.car.y)<this.pulseRadius())this.damageAnchor(b,a,1.05);},this);},this);
    return true;
  };
  Game.prototype.deliver=function(count){this.delivered+=count;this.energy=Math.min(1,this.energy+count*.05);};
  Game.prototype.dispatch=function(){
    if(this.done||this.dispatchCooldown>0||!this.cargo.length)return false;
    var count=this.cargo.length;this.cargo=[];this.deliver(count);this.dispatchCooldown=this.moduleId==='swarm'?8:16;
    this.effects.push({x:this.car.x,y:this.car.y,text:'无人机回收 +'+count,life:1.4});this.airlift={x:this.car.x,y:this.car.y,life:1.2};return true;
  };
  Game.prototype.damageAnchor=function(b,a,damage){
    if(b.state!=='standing'||a.removed)return;a.hp-=damage;
    if(a.hp>0)return;a.removed=true;this.extracted++;this.dropScrap(a.x,a.y,1);
    this.combo=this.time<this.comboUntil?this.combo+1:1;this.comboUntil=this.time+(this.moduleId==='arc'?6:4);this.maxCombo=Math.max(this.maxCombo,this.combo);this.score+=100*this.combo;
    this.effects.push({x:a.x,y:a.y,text:'核心击破 ×'+this.combo,life:1});
    if(b.bolts.every(function(bolt){return bolt.removed;})){
      b.state='falling';this.demolished++;this.score+=500;this.pulses.push({x:b.x,y:b.y,r:this.moduleId==='arc'?205:170,life:.9,max:.9});
      this.effects.push({x:b.x,y:b.y,text:'链式坍塌 +500',life:1.6});
      this.buildings.forEach(function(other){if(other!==b&&other.state==='standing')other.bolts.forEach(function(anchor){if(Math.hypot(anchor.x-b.x,anchor.y-b.y)<(this.moduleId==='arc'?205:170))this.damageAnchor(other,anchor,this.moduleId==='arc'?.8:.55);},this);},this);
    }
  };
  Game.prototype.atDepot=function(){return Math.hypot(this.car.x-DEPOT.x,this.car.y-DEPOT.y)<DEPOT.r;};
  Game.prototype.move=function(x,y){if(!this.done)this.target={x:clamp(x,22,368),y:clamp(y,240,620)};};
  Game.prototype.dropScrap=function(x,y,count){for(var i=0;i<count;i++){var angle=this.random()*Math.PI*2,d=18+this.random()*48;this.scrap.push({x:clamp(x+Math.cos(angle)*d,22,368),y:clamp(y+Math.sin(angle)*d,242,620),vx:Math.cos(angle)*40,vy:Math.sin(angle)*40,rot:this.random()*6,kind:i%3});}};
  Game.prototype.update=function(dt){
    if(this.done)return;dt=clamp(dt,0,.04);this.time+=dt;this.boost=Math.max(0,this.boost-dt);this.dispatchCooldown=Math.max(0,this.dispatchCooldown-dt);this.energy=Math.min(1,this.energy+dt*(this.moduleId==='drive'?.055:.035));this.dashCooldown=Math.max(0,this.dashCooldown-dt);this.dashTime=Math.max(0,this.dashTime-dt);
    this.trail.forEach(function(t){t.life-=dt;});this.trail=this.trail.filter(function(t){return t.life>0;});
    if(this.airlift)this.airlift.life=Math.max(0,this.airlift.life-dt);
    this.pulses.forEach(function(p){p.life-=dt;});this.pulses=this.pulses.filter(function(p){return p.life>0;});
    this.effects.forEach(function(e){e.life-=dt;});this.effects=this.effects.filter(function(e){return e.life>0;});
    if(this.target||this.dashTime>0){var dx=this.target?this.target.x-this.car.x:Math.sin(this.heading)*1000,dy=this.target?this.target.y-this.car.y:-Math.cos(this.heading)*1000,d=Math.hypot(dx,dy),speed=this.moduleId==='drive'?205:170,step=Math.min(d,speed*(this.dashTime>0?2.6:1)*dt);if(d>1){this.heading=Math.atan2(dy,dx)+Math.PI/2;if(this.dashTime>0&&this.time-this.lastTrail>.035){this.trail.push({x:this.car.x,y:this.car.y,heading:this.heading,life:.25});this.lastTrail=this.time;}this.car.x=clamp(this.car.x+dx/d*step,22,368);this.car.y=clamp(this.car.y+dy/d*step,240,620);}}
    // Resolve the vehicle against standing building footprints.
    for(var bi=0;bi<this.buildings.length;bi++){
      var b=this.buildings[bi];if(b.state!=='standing')continue;
      var left=b.x-b.w/2-13,right=b.x+b.w/2+13,top=b.y-b.h/2-9,bottom=b.y+b.h/2+12;
      if(this.car.x>left&&this.car.x<right&&this.car.y>top&&this.car.y<bottom){var ds=[this.car.x-left,right-this.car.x,this.car.y-top,bottom-this.car.y],min=Math.min.apply(null,ds);if(min===ds[0])this.car.x=left;else if(min===ds[1])this.car.x=right;else if(min===ds[2])this.car.y=top;else this.car.y=bottom;}
    }
    if(this.atDepot()&&this.cargo.length){this.unloadClock+=dt;while(this.unloadClock>=.055&&this.cargo.length){this.unloadClock-=.055;this.cargo.pop();this.deliver(1);this.effects.push({x:DEPOT.x,y:DEPOT.y-15,text:'+1',life:.65});}}else this.unloadClock=0;
    this.activeBolt=null;var candidates=[];
    this.buildings.forEach(function(b){if(b.state==='standing')b.bolts.forEach(function(a){if(!a.removed)candidates.push({bolt:a,building:b,d:Math.hypot(a.x-this.car.x,a.y-this.car.y)});},this);},this);
    candidates.sort(function(a,b){return a.d-b.d;});
    if(candidates.length&&candidates[0].d<this.radius()){
      var c=candidates[0];this.activeBolt=c.bolt;this.damageAnchor(c.building,c.bolt,dt*(.7+clamp(Number(this.upgrades.magnet)||0,0,5)*.12)*(this.boost>0?2.1:1)/(1+Math.min(.55,(this.level-1)*.025)));
    }
    this.buildings.forEach(function(b){if(b.state==='falling'){b.fall+=dt;if(b.fall>=.85){b.state='cleared';this.dropScrap(b.x,b.y,b.mass);}}},this);
    for(var i=this.scrap.length-1;i>=0;i--){var s=this.scrap[i],sx=this.car.x-s.x,sy=this.car.y-s.y,dist=Math.hypot(sx,sy);s.x=clamp(s.x+s.vx*dt,20,370);s.y=clamp(s.y+s.vy*dt,240,625);s.vx*=Math.exp(-4*dt);s.vy*=Math.exp(-4*dt);
      if(this.cargo.length<this.capacity()&&dist<this.radius()){var pull=Math.min(dist,240*dt);if(dist>0){s.x+=sx/dist*pull;s.y+=sy/dist*pull;}if(dist<19){this.cargo.push(s);this.scrap.splice(i,1);}}
    }
    this.cargo.forEach(function(s,i){var prev=i?this.cargo[i-1]:this.car,dx=prev.x-s.x,dy=prev.y-s.y,d=Math.hypot(dx,dy);if(d>12){var t=Math.min(1,dt*12);s.x+=dx*(d-12)/d*t;s.y+=dy*(d-12)/d*t;}},this);
    if(this.demolished===this.buildings.length&&this.delivered>=this.quota){this.done=true;this.contractBonus=this.maxCombo>=6?25:0;}
  };
  function cleanSave(data){data=data&&typeof data==='object'?data:{};var u=data.upgrades||{},r=data.records||{};function n(value,max){return Number.isFinite(Number(value))?clamp(Math.floor(Number(value)),0,max):0;}return{level:clamp(Math.floor(Number(data.level)||1),1,99),coins:clamp(Math.floor(Number(data.coins)||0),0,9999999),upgrades:{magnet:clamp(Math.floor(Number(u.magnet)||0),0,5),cargo:clamp(Math.floor(Number(u.cargo)||0),0,5)},dailyBest:data.dailyBest&&typeof data.dailyBest==='object'?data.dailyBest:{},records:{completed:n(r.completed,9999999),bestScore:n(r.bestScore,999999999),maxCombo:n(r.maxCombo,999),recovered:n(r.recovered,999999999),recent:Array.isArray(r.recent)?r.recent.slice(0,6).filter(function(item){return item&&typeof item==='object';}).map(function(item){return{mode:item.mode==='daily'?'daily':'tour',level:clamp(n(item.level,99),1,99),score:n(item.score,999999999),seconds:n(item.seconds,999999),combo:n(item.combo,999)};}):[]}};}
  function cost(rank){return rank>=5?Infinity:40+rank*35;}
  var api={Game:Game,hash:hash,day:day,depot:DEPOT,cleanSave:cleanSave,cost:cost};if(typeof module!=='undefined')module.exports=api;else root.MagnetCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
