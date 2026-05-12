/**
 * 磁吸拆迁队 V3.0 - 完整重写
 * 玩法流程：点击抓取 → 滑动甩动 → 松手释放 → 砸中得分 → 建筑倒塌
 */

var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

// ===== 配色 =====
var C = {
  bg: '#080c1e', neonCyan: '#00f0ff', neonPurple: '#b44aff',
  neonGreen: '#00ff88', neonRed: '#ff3366', neonYellow: '#ffe033',
  neonOrange: '#ff8800', panelBg: 'rgba(10,14,40,0.88)',
  panelBorder: 'rgba(0,240,255,0.3)', textMain: '#e0e8ff', textDim: '#6b7db3',
  ground: '#0a1628', groundLine: 'rgba(0,240,255,0.12)',
  // 方块配色 - 鲜艳醒目
  wood: { fill: '#E8A838', stroke: '#B07818', glow: '#FFD060' },
  brick: { fill: '#E04030', stroke: '#A01810', glow: '#FF6050' },
  steel: { fill: '#8899AA', stroke: '#556677', glow: '#AACCDD' },
  ice: { fill: '#60C8F0', stroke: '#3090C0', glow: '#90E0FF' },
  rubber: { fill: '#E840A0', stroke: '#A82070', glow: '#FF70C0' },
  tnt: { fill: '#FF5020', stroke: '#CC3000', glow: '#FF8040' }
};

var CONFIG = { gravity: 0.5, ropeLength: 150, magnetRadius: 80, magnetPower: 0.8, craneSpeed: 5, damping: 0.99, bounceDamping: 0.5, friction: 0.8 };

var gs = {
  score: 0, timeLeft: 60, gameActive: false, gamePaused: false,
  currentLevel: 1, targetScore: 500, stars: 0, currentScene: 'menu',
  shake: 0, shakeX: 0, shakeY: 0, combo: 0, comboTimer: 0,
  flash: 0, pulse: 0, npcText: '', npcTimer: 0, npcQueue: []
};

var canvas, ctx, physics, crane, bg, audio;
var buildings = [], particles = [], floats = [], collapseQueue = [];
var gameTimer = null, running = false, frame = 0, lastT = 0;
var uiButtons = [];
var touch = { sx: 0, sy: 0, lx: 0, ly: 0, drag: false, dist: 0, st: 0, moved: false };

// ===== 屏幕适配 =====
var S = {
  w: 375, h: 667, pr: 1, sf: 1, st: 44, sb: 0,
  init: function() {
    try { var i = wx.getSystemInfoSync(); this.w=i.windowWidth||375; this.h=i.windowHeight||667; this.pr=i.pixelRatio||1; this.sf=this.w/375; this.st=i.statusBarHeight||44;
      if(i.safeArea){this.st=Math.max(this.st,i.safeArea.top||this.st);this.sb=this.h-(i.safeArea.bottom||this.h);}else{this.st=Math.max(this.st,44);if((i.model||'').indexOf('iphone')!==-1&&this.h>=812)this.sb=34;}
    } catch(e){this.st=44;}
  },
  sx: function(x){return x*this.sf}, sy: function(y){return y*this.sf}, s: function(v){return v*this.sf}, safY: function(y){return this.st+y*this.sf}
};

// ===== 工具 =====
function hex2rgba(h,a){if(!h||h[0]!=='#')return'rgba(0,0,0,'+a+')';var s=h.substring(1);if(s.length===3)s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2];return'rgba('+parseInt(s.substring(0,2),16)+','+parseInt(s.substring(2,4),16)+','+parseInt(s.substring(4,6),16)+','+a+')';}
function grad(ctx,x0,y0,x1,y1){try{if(x0===x1&&y0===y1)x1++;return ctx.createLinearGradient(x0,y0,x1,y1);}catch(e){return null;}}
function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function regBtn(x,y,w,h,fn){uiButtons.push({x:x,y:y,w:w,h:h,fn:fn});}
function findBtn(px,py){for(var i=0;i<uiButtons.length;i++){var b=uiButtons[i];if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h)return b;}return null;}

// ===== NPC =====
var NPC = {
  d: {
    welcome:['欢迎！我是小磁~','点方块抓取，甩出去砸建筑！'],
    grab:['抓住啦！甩一甩~','左右滑动蓄力！'],
    swing:['晃动起来！','找准角度释放！'],
    hit:['砸中了！继续！','漂亮！'],
    combo:['连击！太强了！','继续连击！'],
    miss:['没砸中，再来！','换个角度试试~'],
    lowtime:['时间不多了！','快冲！'],
    win:['通关啦！厉害！','你真棒！'],
    lose:['没关系再来~','下次一定行！'],
    idle:['试试抓一个方块~','点击建筑试试！'],
    step1:['第一步：点击一个方块抓取'],
    step2:['第二步：左右滑动甩动方块'],
    step3:['第三步：再次点击释放方块砸向建筑！']
  },
  say: function(k){var l=this.d[k];return l?l[Math.floor(Math.random()*l.length)]:'';},
  show: function(t,dur){gs.npcText=t;gs.npcTimer=dur||150;},
  queue: function(k){var l=this.d[k];if(l)for(var i=0;i<l.length;i++)gs.npcQueue.push(l[i]);}
};
function procNPC(){if(gs.npcTimer>0)gs.npcTimer--;if(gs.npcTimer<=0&&gs.npcQueue.length>0)NPC.show(gs.npcQueue.shift(),150);}

// ===== 初始化 =====
function init() {
  try {
    S.init(); canvas=wx.createCanvas(); ctx=canvas.getContext('2d');
    var info=wx.getSystemInfoSync(); canvas.width=info.windowWidth||375; canvas.height=info.windowHeight||667;
    physics=new PhysicsSystem(CONFIG); crane=new CraneController(canvas,CONFIG);
    bg=new BuildingGenerator(canvas,CONFIG); audio=new AudioManager();
    crane.setPhysicsSystem(physics); audio.init();

    // 起重机位置 - 顶部居中，绳长适中
    crane.crane.y = S.st + S.s(5);
    crane.crane.x = canvas.width / 2;
    crane.pendulum.ropeLength = Math.floor(S.h * 0.25);
    crane.magnet.y = crane.crane.y + crane.crane.height + crane.pendulum.ropeLength;
    crane.magnet.x = crane.crane.x;
    crane.magnet.attractRadius = S.h * 0.6; // 足够大的吸附范围

    gs.currentScene='menu'; NPC.queue('welcome'); procNPC();
    bindTouch(); running=true; lastT=Date.now(); gameLoop();
  } catch(e){console.error('init fail:',e);}
}

function nf(cb){if(typeof requestAnimationFrame==='function')requestAnimationFrame(cb);else setTimeout(cb,16);}

// ===== 游戏循环 =====
function gameLoop() {
  if(!running) return; frame++; lastT=Date.now();
  if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused) update();
  // 震动衰减
  if(gs.shake>0){gs.shake*=0.88;gs.shakeX=(Math.random()-.5)*gs.shake;gs.shakeY=(Math.random()-.5)*gs.shake;if(gs.shake<0.5)gs.shake=0;}
  updParticles(); updFloats(); procCollapse();
  gs.pulse=(gs.pulse+.05)%(Math.PI*2);
  if(gs.flash>0)gs.flash*=.85;
  if(gs.comboTimer>0){gs.comboTimer--;if(gs.comboTimer<=0)gs.combo=0;}
  procNPC();
  if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused&&frame%480===0)NPC.show(NPC.say('idle'),120);
  render(); nf(gameLoop);
}

// ===== 核心：每帧更新 =====
function update() {
  crane.update();
  bg.update(physics);

  // 检测飞行中的方块撞击建筑
  checkFlyingHits();

  // 级联：悬空方块下落
  checkFloatingBlocks();

  checkGameEnd();
}

// ===== 飞行方块撞击检测（核心得分逻辑）=====
function checkFlyingHits() {
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed||b.isGrabbed) continue;
    // 只有速度足够大的方块才算"飞行中"
    var spd=Math.sqrt(b.velocityX*b.velocityX+b.velocityY*b.velocityY);
    if(spd<2) continue;

    // 检测与其他静止方块的碰撞
    for(var j=0;j<buildings.length;j++){
      if(i===j) continue;
      var t=buildings[j];
      if(t.isDestroyed||t.isGrabbed) continue;
      var tSpd=Math.sqrt(t.velocityX*t.velocityX+t.velocityY*t.velocityY);
      if(tSpd>2) continue; // 两个都在飞，跳过

      // AABB碰撞
      if(b.x<t.x+t.width && b.x+b.width>t.x && b.y<t.y+t.height && b.y+b.height>t.y){
        // 撞击！
        var impactForce = spd * b.mass * 8;
        var dmg = impactForce / t.mass * 0.5;
        t.health -= dmg;

        // 撞击效果
        var cx=t.x+t.width/2, cy=t.y+t.height/2;
        gs.shake=Math.min(15,impactForce*0.2);
        audio.playSound(SoundNames.CRASH);
        spawnSparks(cx,cy,t.color||C.neonOrange,8);

        if(t.health<=0){
          t.health=0; t.isDestroyed=true;
          var pts=t.score||10;
          gs.combo++; gs.comboTimer=90;
          if(gs.combo>1) pts=Math.floor(pts*(1+gs.combo*0.15));
          gs.score+=pts;
          gs.flash=0.12;
          spawnDebris(cx,cy,t.color||C.neonOrange,12);
          spawnSparks(cx,cy,C.neonYellow,10);
          addFloat(cx,cy,'+'+pts,gs.combo>1?C.neonYellow:C.neonGreen);
          audio.playSound(SoundNames.DESTROY);
          NPC.show(NPC.say(gs.combo>2?'combo':'hit'),60);

          if(t.explosive){gs.shake=25;gs.flash=0.4;spawnDebris(cx,cy,C.neonRed,20);spawnSparks(cx,cy,C.neonYellow,15);
            // 爆炸波及
            for(var k=0;k<buildings.length;k++){var bk=buildings[k];if(bk.isDestroyed||bk===t)continue;
              var dx2=(bk.x+bk.width/2)-cx,dy2=(bk.y+bk.height/2)-cy;
              if(Math.sqrt(dx2*dx2+dy2*dy2)<120){bk.health-=40;if(bk.health<=0){bk.health=0;bk.isDestroyed=true;gs.score+=bk.score||10;spawnDebris(bk.x+bk.width/2,bk.y+bk.height/2,bk.color||C.neonRed,8);}}
            }
          }

          // 加入倒塌队列
          addCollapse(t);
        }

        // 反弹
        b.velocityX *= -0.3;
        b.velocityY *= -0.3;
        break;
      }
    }
  }
}

// ===== 悬空检测（级联倒塌）=====
function checkFloatingBlocks() {
  var groundY = canvas.height - S.s(50);
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed||b.isGrabbed) continue;
    if(b.velocityY>1) continue; // 已经在动了

    // 检查下方有没有支撑
    var supported = (b.y + b.height >= groundY - 2); // 在地面上
    if(!supported){
      for(var j=0;j<buildings.length;j++){
        if(i===j||buildings[j].isDestroyed||buildings[j].isGrabbed) continue;
        // b的底部是否在j的顶部上？
        if(b.x+b.width>buildings[j].x+2 && b.x<buildings[j].x+buildings[j].width-2){
          if(Math.abs((b.y+b.height)-buildings[j].y)<3){supported=true;break;}
        }
      }
    }
    if(!supported){
      // 没有支撑，开始下落
      b.velocityY = 1;
    }
  }
}

// ===== 倒塌动画 =====
function addCollapse(block){
  // 已在checkFloatingBlocks中通过失去支撑实现级联
  // 这里添加额外的破碎效果
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed) continue;
    var dx=(b.x+b.width/2)-(block.x+block.width/2);
    var dy=(b.y+b.height/2)-(block.y+block.height/2);
    if(Math.sqrt(dx*dx+dy*dy)<100 && !b.isGrabbed){
      b.velocityX += dx * 0.02;
      b.velocityY += dy * 0.02 - 0.5;
    }
  }
}

// ===== 触摸 =====
function bindTouch(){
  wx.onTouchStart(function(e){
    if(!e||!e.touches||!e.touches.length) return;
    var t=e.touches[0]; touch.sx=t.clientX;touch.sy=t.clientY;touch.lx=t.clientX;touch.ly=t.clientY;
    touch.drag=true;touch.dist=0;touch.st=Date.now();touch.moved=false;
  });
  wx.onTouchMove(function(e){
    if(!e||!e.touches||!e.touches.length) return;
    var t=e.touches[0],dx=t.clientX-touch.lx;
    touch.dist+=Math.abs(dx);if(touch.dist>8)touch.moved=true;
    if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused&&Math.abs(dx)>2){
      crane.move(dx>0?1:-1);
      if(crane.magnet.isGrabbing) crane.pendulum.angularVelocity+=dx*0.004;
    }
    touch.lx=t.clientX;touch.ly=t.clientY;
  });
  wx.onTouchEnd(function(e){
    var x=touch.lx,y=touch.ly,el=Date.now()-touch.st;
    var isTap=!touch.moved||el<250;
    // 按钮优先
    var btn=findBtn(x,y);
    if(btn){audio.playSound(SoundNames.BUTTON);btn.fn();touch.drag=false;touch.moved=false;return;}
    if(gs.currentScene==='game'&&gs.gameActive) handleGame(x,y,isTap);
    touch.drag=false;touch.moved=false;
  });
}

function handleGame(x,y,isTap){
  if(gs.gamePaused) return;
  if(isTap){
    if(crane.isGrabbing()){
      // === 释放 ===
      var block=crane.releaseMagnet();
      if(block){
        // 根据摆锤角速度给抛掷力
        var throwX=crane.pendulum.angularVelocity*100;
        var throwY=-10;
        block.velocityX=throwX/block.mass;
        block.velocityY=throwY/block.mass;
        block.isGrabbed=false;
        audio.playSound(SoundNames.RELEASE);
        spawnSparks(block.x+block.width/2,block.y,C.neonCyan,6);
        NPC.show(NPC.say('swing'),60);
      }
    } else {
      // === 抓取：找点击位置最近的方块 ===
      var best=null, bestD=crane.magnet.attractRadius*1.5;
      for(var i=0;i<buildings.length;i++){
        var b=buildings[i];
        if(b.isDestroyed||b.isGrabbed) continue;
        var bx=b.x+b.width/2,by=b.y+b.height/2;
        var d=Math.sqrt((x-bx)*(x-bx)+(y-by)*(y-by));
        if(d<bestD){bestD=d;best=b;}
      }
      if(best){
        crane.magnet.isActive=true;crane.magnet.isGrabbing=true;crane.magnet.grabbedBlock=best;
        best.isGrabbed=true;
        // 方块飞向磁铁
        best.x=crane.magnet.x-best.width/2;
        best.y=crane.magnet.y+crane.magnet.radius+4;
        crane.crane.x=crane.magnet.x;
        crane.pendulum.angle=0;crane.pendulum.angularVelocity=0;
        best.velocityX=0;best.velocityY=0;
        audio.playSound(SoundNames.GRAB);
        spawnSparks(crane.magnet.x,crane.magnet.y,C.neonPurple,8);
        NPC.show(NPC.say('grab'),60);
      } else {
        NPC.show('点击方块抓取，甩出去砸建筑！',100);
      }
    }
  }
}

// ===== 关卡加载 =====
function loadLevel(lv){
  clearTimer(); buildings=bg.generateLevel(lv);
  // 让建筑更明显：确保方块足够大
  buildings.forEach(function(b){
    b.width=Math.max(b.width,S.s(50));
    b.height=Math.max(b.height,S.s(50));
  });
  gs.targetScore=bg.getTargetScore(lv); gs.timeLeft=bg.getTimeLimit(lv);
  gs.score=0;gs.gameActive=true;gs.gamePaused=false;gs.currentScene='game';
  gs.combo=0;gs.comboTimer=0;particles=[];floats=[];
  crane.crane.x=canvas.width/2;crane.pendulum.ropeLength=Math.floor(S.h*0.25);
  crane.magnet.x=crane.crane.x;crane.magnet.y=crane.crane.y+crane.crane.height+crane.pendulum.ropeLength;
  crane.magnet.attractRadius=S.h*0.6;
  crane.magnet.isActive=false;crane.magnet.isGrabbing=false;crane.magnet.grabbedBlock=null;
  crane.pendulum.angle=0;crane.pendulum.angularVelocity=0;
  startTimer(); NPC.queue('step1');procNPC();
}
function clearTimer(){if(gameTimer){clearInterval(gameTimer);gameTimer=null;}}
function startTimer(){clearTimer();gameTimer=setInterval(function(){
  if(!gs.gameActive||gs.gamePaused)return;gs.timeLeft--;
  if(gs.timeLeft<=10&&gs.timeLeft>0){try{wx.vibrateShort();}catch(e){}audio.playSound(SoundNames.WARNING);if(gs.timeLeft<=5)NPC.show(NPC.say('lowtime'),60);}
  if(gs.timeLeft<=0){gs.timeLeft=0;endGame(false);}
},1000);}

function checkGameEnd(){if(gs.score>=gs.targetScore)endGame(true);}
function endGame(win){
  gs.gameActive=false;clearTimer();
  var pct=gs.targetScore>0?gs.score/gs.targetScore:0;
  gs.stars=pct>=1?3:pct>=.8?2:pct>=.5?1:0;
  if(win)saveLB(gs.currentLevel,gs.score);
  audio.playSound(win?SoundNames.WIN:SoundNames.LOSE);
  gs.currentScene='gameover';NPC.show(NPC.say(win?'win':'lose'),200);
}
function saveLB(lv,sc){try{var d=[];var r=wx.getStorageSync('leaderboard');if(r)d=JSON.parse(r);d.push({level:lv,score:sc,time:Date.now()});d.sort(function(a,b){return b.score-a.score;});if(d.length>20)d=d.slice(0,20);wx.setStorageSync('leaderboard',JSON.stringify(d));}catch(e){}}

// ===== 粒子 =====
function spawnSparks(x,y,color,n){for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,s=1+Math.random()*5;particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:25+Math.random()*20,ml:45,color:color,sz:2+Math.random()*3,t:'spark'});}}
function spawnDebris(x,y,color,n){for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,s=2+Math.random()*6;particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,life:35+Math.random()*25,ml:60,color:color,sz:4+Math.random()*8,t:'debris',rot:Math.random()*6.28,rs:(Math.random()-.5)*.3});}}
function updParticles(){for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.15;p.vx*=.98;p.life--;if(p.rot!==undefined)p.rot+=p.rs;if(p.life<=0)particles.splice(i,1);}}
function addFloat(x,y,t,c){floats.push({x:x,y:y,t:t,c:c,life:45,vy:-2});}
function updFloats(){for(var i=floats.length-1;i>=0;i--){var f=floats[i];f.y+=f.vy;f.vy*=.96;f.life--;if(f.life<=0)floats.splice(i,1);}}
function procCollapse(){}

// ===== 渲染 =====
function render(){
  uiButtons=[];
  ctx.save();
  if(gs.shake>0)ctx.translate(gs.shakeX,gs.shakeY);
  switch(gs.currentScene){
    case 'menu':renderMenu();break;
    case 'game':renderGame();break;
    case 'gameover':renderGame();renderGameOver();break;
    case 'levelselect':renderLevelSel();break;
    case 'leaderboard':renderLB();break;
    case 'instructions':renderHelp();break;
  }
  ctx.restore();
}

// ===== 主菜单 =====
function renderMenu(){
  var g=grad(ctx,0,0,0,canvas.height);
  if(g){g.addColorStop(0,'#020510');g.addColorStop(.5,'#0a1035');g.addColorStop(1,'#050a20');ctx.fillStyle=g;}else ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();

  // 标题
  ctx.save();ctx.shadowColor=C.neonCyan;ctx.shadowBlur=20;ctx.fillStyle=C.neonCyan;
  ctx.font='bold '+S.s(32)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('磁吸拆迁队',canvas.width/2,S.safY(80));ctx.restore();
  ctx.fillStyle=C.textDim;ctx.font=S.s(13)+'px Arial';ctx.textAlign='center';
  ctx.fillText('MAGNETIC DEMOLITION TEAM',canvas.width/2,S.safY(115));

  // NPC
  drawNPC(S.sx(20),S.safY(140),S.s(70));
  if(gs.npcText&&gs.npcTimer>0)drawBubble(S.sx(100),S.safY(135),S.s(240),gs.npcText);

  // 按钮
  var cx=canvas.width/2,bw=S.s(240),bh=S.s(54),sy=S.safY(220);
  var lb=['开始游戏','关卡选择','排行榜','玩法说明'];
  var cl=[C.neonGreen,C.neonCyan,C.neonYellow,C.neonPurple];
  var fn=[function(){loadLevel(gs.currentLevel);},function(){gs.currentScene='levelselect';},function(){gs.currentScene='leaderboard';},function(){gs.currentScene='instructions';}];
  for(var i=0;i<lb.length;i++){var by=sy+i*(bh+S.s(14));drawBtn(cx-bw/2,by,bw,bh,lb[i],cl[i]);regBtn(cx-bw/2,by,bw,bh,fn[i]);}
}

// ===== 游戏场景 =====
function renderGame(){
  // 背景
  var g=grad(ctx,0,0,0,canvas.height);
  if(g){g.addColorStop(0,'#020510');g.addColorStop(.6,'#0a1035');g.addColorStop(1,'#0d1540');ctx.fillStyle=g;}else ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();

  // 地面
  var gy=canvas.height-S.s(50);
  ctx.fillStyle=C.ground;ctx.fillRect(0,gy,canvas.width,S.s(50));
  ctx.strokeStyle=C.groundLine;ctx.lineWidth=S.s(1);ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(canvas.width,gy);ctx.stroke();

  // ===== 建筑（醒目！） =====
  drawBuildings();

  // 起重机+磁铁
  drawCrane();

  // 粒子+飘字
  drawParticles();drawFloats();

  // 闪光
  if(gs.flash>.01){ctx.fillStyle='rgba(255,255,255,'+gs.flash+')';ctx.fillRect(0,0,canvas.width,canvas.height);}

  // HUD
  drawHUD();

  // NPC
  if(gs.npcText&&gs.npcTimer>0){drawNPC(S.sx(5),canvas.height-S.s(75),S.s(45));drawBubble(S.sx(55),canvas.height-S.s(65),S.s(230),gs.npcText);}

  if(gs.gamePaused)drawPause();
}

// ===== 建筑（醒目渲染）=====
function drawBuildings(){
  buildings.forEach(function(b){
    if(b.isDestroyed)return;
    var hp=b.health/b.maxHealth;
    var bc=C[b.type]||C.wood;

    ctx.save();
    // 发光底色 - 让建筑在暗背景上极度醒目
    ctx.shadowColor=bc.glow;
    ctx.shadowBlur=hp>0.5?8:15;

    // 方块主体
    ctx.fillStyle=bc.fill;
    ctx.fillRect(b.x,b.y,b.width,b.height);

    // 边框
    ctx.shadowBlur=0;
    ctx.strokeStyle=bc.stroke;
    ctx.lineWidth=S.s(2);
    ctx.strokeRect(b.x,b.y,b.width,b.height);

    // 内部高光
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(b.x+2,b.y+2,b.width-4,S.s(4));

    // 类型标记
    ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.7)';
    var label=b.type==='wood'?'木':b.type==='brick'?'砖':b.type==='steel'?'钢':b.type==='ice'?'冰':b.type==='rubber'?'胶':b.type==='tnt'?'TNT':'?';
    ctx.fillText(label,b.x+b.width/2,b.y+b.height/2);

    // 裂纹
    if(hp<0.7){
      ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=S.s(1.5);
      var cn=hp<0.3?3:1;
      for(var ci=0;ci<cn;ci++){ctx.beginPath();ctx.moveTo(b.x+b.width*(0.3+ci*0.2),b.y);ctx.lineTo(b.x+b.width*(0.4+ci*0.15),b.y+b.height*0.5);ctx.lineTo(b.x+b.width*(0.2+ci*0.3),b.y+b.height);ctx.stroke();}
    }
    // 濒危闪烁
    if(hp<0.3&&frame%20<10){ctx.fillStyle='rgba(255,50,50,0.15)';ctx.fillRect(b.x,b.y,b.width,b.height);}

    // 血条
    if(hp<1){
      var bw2=b.width*.8,bh2=S.s(4),bx2=b.x+(b.width-bw2)/2,by2=b.y-S.s(8);
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bx2,by2,bw2,bh2);
      ctx.fillStyle=hp>.5?C.neonGreen:hp>.25?C.neonYellow:C.neonRed;
      ctx.fillRect(bx2,by2,bw2*hp,bh2);
    }
    ctx.restore();
  });
}

// ===== 起重机 =====
function drawCrane(){
  if(!crane)return;
  var cx=crane.crane.x,cy=crane.crane.y,cw=crane.crane.width,ch=crane.crane.height;
  ctx.save();
  // 轨道
  ctx.strokeStyle='rgba(0,240,255,0.1)';ctx.lineWidth=S.s(1);ctx.setLineDash&&ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(0,cy+ch);ctx.lineTo(canvas.width,cy+ch);ctx.stroke();
  ctx.setLineDash&&ctx.setLineDash([]);
  // 主体
  ctx.fillStyle='#2a3b5e';rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.fill();
  ctx.strokeStyle=C.neonCyan;ctx.lineWidth=S.s(1.5);ctx.shadowColor=C.neonCyan;ctx.shadowBlur=6;
  rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.stroke();ctx.shadowBlur=0;
  // 窗
  ctx.fillStyle=hex2rgba(C.neonCyan,.3);ctx.fillRect(cx-S.s(10),cy+S.s(10),S.s(20),S.s(14));
  // 绳索
  var px=cx,py=cy+ch,mx=crane.magnet.x,my=crane.magnet.y;
  ctx.strokeStyle='rgba(0,240,255,0.5)';ctx.lineWidth=S.s(2);
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(mx,my);ctx.stroke();
  // 磁铁
  drawMag(mx,my);
  ctx.restore();
}

function drawMag(mx,my){
  var grabbing=crane.isGrabbing(),r=crane.magnet.radius,ar=crane.magnet.attractRadius;
  var p=Math.sin(gs.pulse)*.3+.7;
  ctx.save();
  // 范围指示
  if(crane.magnet.isActive||grabbing){
    for(var i=3;i>=1;i--){ctx.strokeStyle=hex2rgba(C.neonCyan,.04*(4-i));ctx.lineWidth=S.s(1);ctx.beginPath();ctx.arc(mx,my,ar*(i/3)*p,0,Math.PI*2);ctx.stroke();}
  }
  // U形磁铁
  ctx.shadowColor=grabbing?C.neonGreen:C.neonCyan;ctx.shadowBlur=20*p;
  ctx.lineWidth=S.s(5);ctx.strokeStyle=grabbing?C.neonGreen:C.neonCyan;
  ctx.beginPath();ctx.arc(mx,my,r,0,Math.PI);ctx.stroke();
  ctx.beginPath();ctx.moveTo(mx-r,my);ctx.lineTo(mx-r,my-S.s(8));ctx.stroke();
  ctx.beginPath();ctx.moveTo(mx+r,my);ctx.lineTo(mx+r,my-S.s(8));ctx.stroke();
  // 核心
  ctx.beginPath();ctx.arc(mx,my,r*.7,0,Math.PI*2);ctx.fillStyle=hex2rgba(grabbing?C.neonGreen:C.neonCyan,.3*p);ctx.fill();
  ctx.shadowBlur=0;
  // 电弧
  if(grabbing&&crane.magnet.grabbedBlock){
    var blk=crane.magnet.grabbedBlock;
    ctx.strokeStyle=C.neonYellow;ctx.lineWidth=S.s(1.5);ctx.shadowColor=C.neonYellow;ctx.shadowBlur=8;
    for(var si=-1;si<=1;si++){ctx.beginPath();ctx.moveTo(mx+si*S.s(6),my+r);
      ctx.quadraticCurveTo(mx+si*S.s(6)+(Math.random()-.5)*S.s(12),(my+blk.y)/2,blk.x+blk.width/2+si*S.s(8),blk.y);ctx.stroke();}
    ctx.shadowBlur=0;
  }
  ctx.restore();
}

function drawParticles(){particles.forEach(function(p){var a=p.life/p.ml;ctx.save();if(p.t==='debris'){ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);ctx.fillStyle=hex2rgba(p.color,a);ctx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz);}else{ctx.fillStyle=hex2rgba(p.color,a);ctx.shadowColor=p.color;ctx.shadowBlur=4;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*a,0,Math.PI*2);ctx.fill();}ctx.restore();});}
function drawFloats(){floats.forEach(function(f){var a=f.life/45;ctx.save();ctx.globalAlpha=a;ctx.fillStyle=f.c;ctx.font='bold '+S.s(22)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=f.c;ctx.shadowBlur=10;ctx.fillText(f.t,f.x,f.y);if(gs.combo>1&&f.t[0]==='+'){ctx.font=S.s(13)+'px Arial';ctx.fillText(gs.combo+'x',f.x,f.y-S.s(16));}ctx.restore();});}

// ===== HUD =====
function drawHUD(){
  var th=S.s(38),ty=S.st;
  ctx.fillStyle=C.panelBg;ctx.fillRect(0,ty,canvas.width,th);
  ctx.strokeStyle=C.panelBorder;ctx.lineWidth=S.s(1);ctx.beginPath();ctx.moveTo(0,ty+th);ctx.lineTo(canvas.width,ty+th);ctx.stroke();
  var fs=S.s(15),my=ty+th/2;
  ctx.font='bold '+fs+'px Arial';ctx.textBaseline='middle';
  ctx.fillStyle=C.neonGreen;ctx.textAlign='left';ctx.fillText('分数:'+gs.score,S.sx(70),my);
  ctx.fillStyle=gs.timeLeft<=10?C.neonRed:C.neonCyan;ctx.textAlign='center';ctx.fillText(gs.timeLeft+'s',canvas.width/2,my);
  ctx.fillStyle=C.neonYellow;ctx.textAlign='right';ctx.fillText('L'+gs.currentLevel+' 目标'+gs.targetScore,canvas.width-S.sx(70),my);
  // 菜单按钮
  var bx=S.sx(5),by2=ty+S.s(3),bw=S.s(58),bh=S.s(32);
  ctx.fillStyle='rgba(0,240,255,0.1)';rr(ctx,bx,by2,bw,bh,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.4);ctx.lineWidth=S.s(.5);rr(ctx,bx,by2,bw,bh,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('菜单',bx+bw/2,by2+bh/2);
  regBtn(bx,by2,bw,bh,function(){gs.currentScene='menu';clearTimer();gs.gameActive=false;});
  // 暂停按钮
  var px=canvas.width-S.sx(58),py=ty+S.s(3),pw=S.s(50),ph=S.s(32);
  ctx.fillStyle='rgba(0,240,255,0.1)';rr(ctx,px,py,pw,ph,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.4);ctx.lineWidth=S.s(.5);rr(ctx,px,py,pw,ph,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';ctx.fillText(gs.gamePaused?'继续':'暂停',px+pw/2,py+ph/2);
  regBtn(px,py,pw,ph,function(){gs.gamePaused=!gs.gamePaused;});
  // 操作提示
  if(gs.gameActive&&!gs.gamePaused){var el=bg.getTimeLimit(gs.currentLevel)-gs.timeLeft;
    if(el<4){ctx.fillStyle=hex2rgba(C.neonCyan,Math.max(0,1-el/4));ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';ctx.fillText('点击方块抓取 → 滑动甩动 → 再点释放',canvas.width/2,canvas.height-S.s(20));}}
}

function drawPause(){ctx.fillStyle='rgba(5,10,30,0.85)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.shadowColor=C.neonCyan;ctx.shadowBlur=15;ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(32)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('游戏暂停',canvas.width/2,canvas.height/2);ctx.restore();}

// ===== 结算 =====
function renderGameOver(){
  ctx.fillStyle='rgba(5,10,30,0.9)';ctx.fillRect(0,0,canvas.width,canvas.height);
  var cx=canvas.width/2,bw=S.s(300),bh=S.s(300),bx=(canvas.width-bw)/2,by=(canvas.height-bh)/2;
  ctx.fillStyle=C.panelBg;ctx.strokeStyle=C.panelBorder;ctx.lineWidth=S.s(1.5);rr(ctx,bx,by,bw,bh,S.s(12));ctx.fill();rr(ctx,bx,by,bw,bh,S.s(12));ctx.stroke();
  var win=gs.score>=gs.targetScore;
  ctx.save();ctx.shadowColor=win?C.neonGreen:C.neonRed;ctx.shadowBlur=15;ctx.fillStyle=win?C.neonGreen:C.neonRed;
  ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(win?'关卡通过!':'时间到!',cx,by+S.s(45));ctx.restore();
  ctx.fillStyle=C.textMain;ctx.font=S.s(18)+'px Arial';ctx.textAlign='center';ctx.fillText('得分: '+gs.score,cx,by+S.s(110));ctx.fillStyle=C.textDim;ctx.fillText('目标: '+gs.targetScore,cx,by+S.s(140));
  var bw2=S.s(130),bh2=S.s(52),by2=by+bh-S.s(85);
  drawBtn(cx-bw2-S.s(10),by2,bw2,bh2,'重玩',C.neonRed);regBtn(cx-bw2-S.s(10),by2,bw2,bh2,function(){loadLevel(gs.currentLevel);});
  drawBtn(cx+S.s(10),by2,bw2,bh2,'下一关',C.neonGreen);regBtn(cx+S.s(10),by2,bw2,bh2,function(){gs.currentLevel++;loadLevel(gs.currentLevel);});
  drawBtn(cx-bw2/2,by2+bh2+S.s(12),bw2,bh2,'返回主菜单',C.textDim);regBtn(cx-bw2/2,by2+bh2+S.s(12),bw2,bh2,function(){gs.currentScene='menu';});
  drawNPC(bx+S.s(5),by+bh-S.s(60),S.s(50));
}

// ===== 关卡选择/排行榜/说明 =====
function renderLevelSel(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=C.neonCyan;ctx.shadowBlur=12;ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('关卡选择',canvas.width/2,S.safY(55));ctx.restore();
  var bw=S.s(280),bh=S.s(48),sx=(canvas.width-bw)/2,sy=S.safY(95);
  for(var i=0;i<5;i++){var by=sy+i*(bh+S.s(10));drawBtn(sx,by,bw,bh,'关卡 '+(i+1),C.neonCyan);(function(lv){regBtn(sx,by,bw,bh,function(){gs.currentLevel=lv;loadLevel(lv);});})(i+1);}
  var backY=canvas.height-S.sy(80);drawBtn((canvas.width-bw)/2,backY,bw,S.s(50),'返回主菜单',C.neonRed);regBtn((canvas.width-bw)/2,backY,bw,S.s(50),function(){gs.currentScene='menu';});
}
function renderLB(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=C.neonYellow;ctx.shadowBlur=12;ctx.fillStyle=C.neonYellow;ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('排行榜',canvas.width/2,S.safY(55));ctx.restore();
  var lb=[];try{var d=wx.getStorageSync('leaderboard');if(d)lb=JSON.parse(d);}catch(e){}
  if(!lb.length){ctx.fillStyle=C.textDim;ctx.font=S.s(15)+'px Arial';ctx.fillText('暂无记录',canvas.width/2,canvas.height/2);}
  else{var ms=[C.neonYellow,'#C0C0C0','#CD7F32'];for(var i=0;i<Math.min(lb.length,10);i++){ctx.fillStyle=i<3?ms[i]:C.textDim;ctx.font='bold '+S.s(16)+'px Arial';ctx.textAlign='left';ctx.fillText((i+1)+'. L'+(lb[i].level||'-')+' '+(lb[i].score||0)+'分',S.sx(40),S.safY(100)+i*S.s(36));}}
  var bw=S.s(280),backY=canvas.height-S.sy(80);drawBtn((canvas.width-bw)/2,backY,bw,S.s(50),'返回主菜单',C.neonRed);regBtn((canvas.width-bw)/2,backY,bw,S.s(50),function(){gs.currentScene='menu';});
}
function renderHelp(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=C.neonPurple;ctx.shadowBlur=12;ctx.fillStyle=C.neonPurple;ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('玩法说明',canvas.width/2,S.safY(55));ctx.restore();
  var t=['▸ 点击方块 → 磁铁抓住它','▸ 左右滑动 → 甩动方块','▸ 再次点击 → 释放砸向建筑','▸ 砸中建筑 → 得分！','▸ 连续破坏 → 连击加分','▸ TNT方块 → 爆炸范围伤害','▸ 摧毁支撑 → 建筑倒塌','▸ 达到目标分数 → 过关'];
  ctx.fillStyle=C.textMain;ctx.font=S.s(15)+'px Arial';ctx.textAlign='left';
  for(var i=0;i<t.length;i++)ctx.fillText(t[i],S.sx(30),S.safY(100)+i*S.s(34));
  drawNPC(canvas.width-S.s(80),S.safY(280),S.s(70));
  var bw=S.s(280),backY=canvas.height-S.sy(80);drawBtn((canvas.width-bw)/2,backY,bw,S.s(50),'返回主菜单',C.neonRed);regBtn((canvas.width-bw)/2,backY,bw,S.s(50),function(){gs.currentScene='menu';});
}

// ===== 通用绘制 =====
function drawBtn(x,y,w,h,t,c){ctx.save();ctx.fillStyle=hex2rgba(c,.08);rr(ctx,x,y,w,h,S.s(6));ctx.fill();ctx.shadowColor=c;ctx.shadowBlur=6;ctx.strokeStyle=hex2rgba(c,.6);ctx.lineWidth=S.s(1.5);rr(ctx,x,y,w,h,S.s(6));ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=c;ctx.font='bold '+S.s(17)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x+w/2,y+h/2);ctx.restore();}
function drawStars(){ctx.fillStyle='#fff';for(var i=0;i<50;i++){var x=(i*127+33)%canvas.width,y=(i*89+17)%canvas.height;ctx.globalAlpha=.3+Math.sin(frame*.02+i)*.2;ctx.fillRect(x,y,1,1);}ctx.globalAlpha=1;}

function drawNPC(x,y,sz){
  ctx.save();var cx=x+sz*.4,s=sz;
  // 头发
  ctx.fillStyle='#FF6B9D';ctx.beginPath();ctx.ellipse(cx,y+s*.22,s*.28,s*.28,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(cx-s*.25,y+s*.2);ctx.quadraticCurveTo(cx-s*.35,y+s*.55,cx-s*.2,y+s*.85);ctx.quadraticCurveTo(cx-s*.12,y+s*.85,cx-s*.15,y+s*.4);ctx.fill();
  ctx.beginPath();ctx.moveTo(cx+s*.25,y+s*.2);ctx.quadraticCurveTo(cx+s*.35,y+s*.55,cx+s*.2,y+s*.85);ctx.quadraticCurveTo(cx+s*.12,y+s*.85,cx+s*.15,y+s*.4);ctx.fill();
  // 脸
  ctx.fillStyle='#FFD5B8';ctx.beginPath();ctx.ellipse(cx,y+s*.28,s*.2,s*.2,0,0,Math.PI*2);ctx.fill();
  // 刘海
  ctx.fillStyle='#FF6B9D';ctx.beginPath();ctx.moveTo(cx-s*.22,y+s*.15);ctx.quadraticCurveTo(cx,y+s*.05,cx+s*.22,y+s*.15);ctx.quadraticCurveTo(cx+s*.18,y+s*.22,cx-s*.18,y+s*.22);ctx.fill();
  // 大眼
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.27,s*.06,s*.07,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4FC3F7';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.28,s*.04,s*.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.29,s*.02,s*.03,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx-s*.06,y+s*.26,s*.012,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.27,s*.06,s*.07,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4FC3F7';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.28,s*.04,s*.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.29,s*.02,s*.03,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx+s*.1,y+s*.26,s*.012,0,Math.PI*2);ctx.fill();
  // 嘴
  ctx.strokeStyle='#E88B8B';ctx.lineWidth=S.s(1.5);ctx.beginPath();ctx.arc(cx,y+s*.35,s*.035,0.1,Math.PI-.1);ctx.stroke();
  // 腮红
  ctx.fillStyle='rgba(255,150,150,0.25)';ctx.beginPath();ctx.ellipse(cx-s*.14,y+s*.32,s*.03,s*.018,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx+s*.14,y+s*.32,s*.03,s*.018,0,0,Math.PI*2);ctx.fill();
  // 身体
  ctx.fillStyle='#9B59B6';ctx.beginPath();ctx.moveTo(cx-s*.12,y+s*.42);ctx.quadraticCurveTo(cx-s*.2,y+s*.7,cx-s*.18,y+s*.95);ctx.lineTo(cx+s*.18,y+s*.95);ctx.quadraticCurveTo(cx+s*.2,y+s*.7,cx+s*.12,y+s*.42);ctx.fill();
  ctx.restore();
}

function drawBubble(x,y,mw,text){
  if(!text)return;ctx.save();var fs=S.s(13);ctx.font=fs+'px Arial';
  var lines=[],line='';
  for(var i=0;i<text.length;i++){var tl=line+text[i];if(ctx.measureText(tl).width>mw-S.s(20)){lines.push(line);line=text[i];}else line=tl;}
  if(line)lines.push(line);
  var lh=fs+S.s(4),bh=lines.length*lh+S.s(16),bw=mw;
  var a=Math.min(1,gs.npcTimer/30);
  ctx.fillStyle='rgba(20,15,50,'+(0.9*a)+')';rr(ctx,x,y,bw,bh,S.s(8));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonPurple,.6*a);ctx.lineWidth=S.s(1);rr(ctx,x,y,bw,bh,S.s(8));ctx.stroke();
  ctx.fillStyle=hex2rgba(C.textMain,a);ctx.font=fs+'px Arial';ctx.textAlign='left';ctx.textBaseline='top';
  for(var li=0;li<lines.length;li++)ctx.fillText(lines[li],x+S.s(10),y+S.s(8)+li*lh);
  ctx.restore();
}

init();
