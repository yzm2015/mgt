/**
 * 磁吸拆迁队 V3.1.4
 * 版本规则：每次+0.0.1，逢十进一
 *
 * V3.1.4 更新：
 * - 修复工具英文名→中文名（破坏球）
 * - 修复主菜单英文→中文（磁吸拆迁队）
 * - 全中文界面（连击/祝福语等）
 * - 实现每10关新增玩法机制：
 *   L1基础/L11TNT/L21冰块/L31橡胶/L41钢铁/L51连锁/L61侧风/L71限时/L81全灭/L91BOSS
 * - 高级关卡递增难度（L101+沙漠/L201+冰域/L301+钢域/L401+火山/L501+混合/L701+极难/L901+炼狱）
 * - BOSS建筑金色发光+血量显示
 * - 侧风指示器+机制提示HUD
 */

var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

var VERSION = '3.1.4';

// ===== 配色（统一管理）=====
var C = {
  bg: '#080c1e', neonCyan: '#00f0ff', neonPurple: '#b44aff',
  neonGreen: '#00ff88', neonRed: '#ff3366', neonYellow: '#ffe033',
  neonOrange: '#ff8800', panelBg: 'rgba(10,14,40,0.88)',
  panelBorder: 'rgba(0,240,255,0.3)', textMain: '#e0e8ff', textDim: '#6b7db3',
  ground: '#0a1628', groundLine: 'rgba(0,240,255,0.12)',
  wood: { fill: '#E8A838', stroke: '#B07818', glow: '#FFD060' },
  brick: { fill: '#E04030', stroke: '#A01810', glow: '#FF6050' },
  steel: { fill: '#8899AA', stroke: '#556677', glow: '#AACCDD' },
  ice: { fill: '#60C8F0', stroke: '#3090C0', glow: '#90E0FF' },
  rubber: { fill: '#E840A0', stroke: '#A82070', glow: '#FF70C0' },
  tnt: { fill: '#FF5020', stroke: '#CC3000', glow: '#FF8040' }
};

// 预解析颜色缓存（避免每帧字符串解析）
var _colorCache = {};
function hex2rgba(h,a){
  if(!h||h[0]!=='#')return'rgba(0,0,0,'+a+')';
  var key=h+'|'+a;
  if(_colorCache[key])return _colorCache[key];
  var s=h.substring(1);
  if(s.length===3)s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
  var r='rgba('+parseInt(s.substring(0,2),16)+','+parseInt(s.substring(2,4),16)+','+parseInt(s.substring(4,6),16)+','+a+')';
  _colorCache[key]=r;return r;
}

var CONFIG = { gravity: 0.5, ropeLength: 150, magnetRadius: 80, magnetPower: 0.8, craneSpeed: 5, damping: 0.99, bounceDamping: 0.5, friction: 0.8 };

var gs = {
  score: 0, timeLeft: 60, gameActive: false, gamePaused: false,
  currentLevel: 1, targetScore: 100, stars: 0, currentScene: 'menu',
  gameResult: null, // V3.1.4: 存储endGame传入的win参数
  shake: 0, shakeX: 0, shakeY: 0, combo: 0, comboTimer: 0,
  flash: 0, pulse: 0, npcText: '', npcTimer: 0, npcQueue: [],
  userInfo: null, loggedIn: false, loginRetries: 0,
  levelPage: 0, levelScrollX: 0,
  lbTab: 'friend', friendScores: [], worldScores: [],
  // 动画状态
  scanY: 0, pulseTime: 0, menuAnim: 0, slowMo: 0, slowMoFactor: 1,
  lbFriendLoaded: false,
  // 每日奖励
  dailyReward: false, loginStreak: 0, lastLoginDate: '',
  // 成就
  totalDestroys: 0, maxCombo: 0, totalScore: 0,
  // V3.1.0: 甩动加速系统
  peakSwingAV: 0,      // 本次抓取中的最大摆动角速度
  powerUpHardness: 0,   // 强化工具剩余次数
  // V3.1.0: 礼物系统
  gifts: [],             // 场景中的礼物对象
  // V3.1.3: 爆炸特效
  explosionEffects: []   // 爆炸波纹效果
};

// ===== 对象池（减少GC压力）=====
var Pool = {
  particles: [],
  floats: [],
  getParticle: function(){ return this.particles.length>0?this.particles.pop():{}; },
  recycleParticle: function(p){ p.x=0;p.y=0;p.vx=0;p.vy=0;p.life=0;p.color=null;p.sz=0;p.t=null;p.rot=null;p.rs=null;p.ml=0; this.particles.push(p); },
  getFloat: function(){ return this.floats.length>0?this.floats.pop():{}; },
  recycleFloat: function(f){ f.x=0;f.y=0;f.t='';f.c=null;f.life=0;f.vy=0; this.floats.push(f); }
};

// ===== 关卡进度 =====
var progress = {
  highestLevel: 1, levels: {},
  load: function() {
    try {
      var d = wx.getStorageSync('gameProgress');
      if (d) {
        var p = JSON.parse(d);
        this.highestLevel = p.highestLevel || 1;
        this.levels = p.levels || {};
      }
    } catch(e) {}
  },
  save: function() {
    try {
      wx.setStorageSync('gameProgress', JSON.stringify({
        highestLevel: this.highestLevel, levels: this.levels
      }));
    } catch(e) {}
  },
  getStars: function(lv) { return (this.levels[lv] && this.levels[lv].stars) || 0; },
  getScore: function(lv) { return (this.levels[lv] && this.levels[lv].score) || 0; },
  isUnlocked: function(lv) { return lv <= this.highestLevel; },
  complete: function(lv, stars, score) {
    if (!this.levels[lv] || this.levels[lv].stars < stars) {
      this.levels[lv] = { stars: stars, score: score };
    } else if (this.levels[lv].score < score) {
      this.levels[lv].score = score;
    }
    if (lv >= this.highestLevel && lv < 1000) {
      this.highestLevel = lv + 1;
    }
    this.save();
  }
};

// ===== 每日奖励系统 =====
var dailySystem = {
  check: function() {
    try {
      var today = new Date().toDateString();
      var saved = wx.getStorageSync('dailyData');
      if (saved) {
        var d = JSON.parse(saved);
        if (d.lastDate === today) {
          gs.dailyReward = d.claimed || false;
          gs.loginStreak = d.streak || 0;
        } else {
          // 新的一天
          var yesterday = new Date(Date.now() - 86400000).toDateString();
          gs.loginStreak = (d.lastDate === yesterday) ? (d.streak || 0) + 1 : 1;
          gs.dailyReward = false;
          this.save();
        }
      } else {
        gs.loginStreak = 1;
        gs.dailyReward = false;
        this.save();
      }
      gs.lastLoginDate = today;
    } catch(e) {}
  },
  save: function() {
    try {
      wx.setStorageSync('dailyData', JSON.stringify({
        lastDate: gs.lastLoginDate, streak: gs.loginStreak, claimed: gs.dailyReward
      }));
    } catch(e) {}
  },
  claim: function() {
    if (gs.dailyReward) return 0;
    var bonus = 100 + gs.loginStreak * 50;
    gs.dailyReward = true;
    this.save();
    return bonus;
  }
};

// ===== 玩法机制（V3.1.4: 全部已实现）=====
var MECHANICS = [
  { level:1, id:'basic', name:'基础', desc:'木质+砖块建筑', color:C.neonCyan },
  { level:11, id:'explosive', name:'爆破', desc:'解锁TNT炸药方块', color:C.neonRed },
  { level:21, id:'ice', name:'冰封', desc:'解锁冰块', color:C.ice.glow },
  { level:31, id:'rubber', name:'弹力', desc:'解锁橡胶块', color:C.rubber.glow },
  { level:41, id:'steel', name:'钢铁', desc:'钢铁比例提升', color:C.steel.glow },
  { level:51, id:'chain', name:'连锁', desc:'TNT连锁爆炸', color:C.neonOrange },
  { level:61, id:'wind', name:'风暴', desc:'侧风干扰飞行', color:'#88ddff' },
  { level:71, id:'timed', name:'限时', desc:'限时加分奖励', color:C.neonGreen },
  { level:81, id:'multi', name:'全灭', desc:'需摧毁所有建筑', color:C.neonYellow },
  { level:91, id:'boss', name:'首领', desc:'首领超高血量', color:C.neonPurple },
  { level:101, id:'desert', name:'沙漠', desc:'难度提升+更多建筑', color:'#F4A460' },
  { level:201, id:'snow', name:'雪地', desc:'冰块比例大增', color:'#F0F8FF' },
  { level:301, id:'space', name:'太空', desc:'钢铁比例极高', color:'#191970' },
  { level:401, id:'volcano', name:'火山', desc:'TNT比例大增', color:'#FF4500' },
  { level:501, id:'neon', name:'霓虹', desc:'全材质混合', color:C.neonCyan },
  { level:701, id:'extreme', name:'极难', desc:'侧风+连锁+BOSS', color:'#B0E0E6' },
  { level:901, id:'inferno', name:'炼狱', desc:'全机制融合', color:'#FF0000' }
];

function getMechanicForLevel(lv) {
  var r = MECHANICS[0];
  for (var i = 0; i < MECHANICS.length; i++) { if (lv >= MECHANICS[i].level) r = MECHANICS[i]; }
  return r;
}

// ===== V3.1.0: 礼物系统 =====
var GIFT_DEFS = [
  { id:'blessing', name:'祝福', emoji:'🎉', color:'#FFE033', weight:35,
    desc:['运气爆棚!','太棒了!','势如破竹!','拆迁之王!','无人能挡!'],
    apply:function(cx,cy){
      var msg=this.desc[Math.floor(Math.random()*this.desc.length)];
      addBigFloat(cx,cy-S.s(30),msg,this.color); // V3.1.3: 大号祝福文字
      gs.score+=5;addFloat(cx,cy-S.s(60),'+5',C.neonGreen);
      spawnSparks(cx,cy,this.color,6);
      try{wx.vibrateShort({type:'light'});}catch(e){}
    }
  },
  { id:'powerUp', name:'强化', emoji:'⚡', color:'#00FF88', weight:20,
    apply:function(cx,cy){
      gs.powerUpHardness+=3;
      addBigFloat(cx,cy-S.s(30),'⚡工具强化×3!','#00FF88');
      spawnSparks(cx,cy,C.neonGreen,8);
      gs.flash=0.05;
      try{wx.vibrateShort({type:'medium'});}catch(e){}
    }
  },
  { id:'extraTime', name:'加时', emoji:'⏰', color:'#00F0FF', weight:20,
    apply:function(cx,cy){
      gs.timeLeft+=8;
      addBigFloat(cx,cy-S.s(30),'⏰+8秒!','#00F0FF');
      spawnSparks(cx,cy,C.neonCyan,4);
    }
  },
  { id:'randomBoom', name:'爆破', emoji:'💥', color:'#FF3366', weight:15,
    apply:function(cx,cy){
      var alive=[];
      for(var i=0;i<buildings.length;i++){if(!buildings[i].isDestroyed)alive.push(buildings[i]);}
      if(alive.length>0){
        var target=alive[Math.floor(Math.random()*alive.length)];
        target.health=0;target.isDestroyed=true;
        var tx=target.x+target.width/2,ty2=target.y+target.height/2;
        spawnDebris(tx,ty2,target.color||C.neonRed,8);
        spawnSparks(tx,ty2,C.neonYellow,6);
        var bp=Math.max(1,target.score||10);
        gs.score+=bp;
        addFloat(tx,ty2,'💥+'+bp,C.neonRed);
        gs.shake=10;
        spawnExplosion(tx,ty2); // V3.1.3: 爆破也有爆炸特效
        addCollapse(target);
      }
      addBigFloat(cx,cy-S.s(30),'💥随机爆破!','#FF3366');
      gs.flash=0.08;
    }
  },
  { id:'addBuilding', name:'增建', emoji:'🏗️', color:'#B44AFF', weight:10,
    apply:function(cx,cy){
      var gy=canvas.height-S.s(50);
      var bw=S.s(45),bh=S.s(38);
      var nx=S.s(20)+Math.random()*(canvas.width-bw-S.s(40));
      var ny=gy-bh-S.s(2);
      var btypes=['wood','brick','ice'];
      var bt=btypes[Math.floor(Math.random()*btypes.length)];
      var bdef=bg.blockTypes[bt];
      buildings.push({
        x:nx,y:ny,width:bw,height:bh,type:bt,
        color:bdef.color,strokeColor:bdef.strokeColor,
        health:bdef.health,maxHealth:bdef.health,
        mass:bdef.mass,score:bdef.score+5,friction:bdef.friction,
        velocityX:0,velocityY:0,isGrabbed:false,isDestroyed:false,explosive:false
      });
      addBigFloat(cx,cy-S.s(30),'🏗️新增建筑!','#B44AFF');
      spawnSparks(nx+bw/2,ny+bh/2,C.neonPurple,6);
    }
  }
];

// 礼物掉落判定
function tryDropGift(cx,cy){
  var dropRate=0.45; // V3.1.2: 45%概率掉礼物（大幅提高可见性）
  if(Math.random()>dropRate) return;
  // 加权随机选择
  var totalW=0;for(var i=0;i<GIFT_DEFS.length;i++)totalW+=GIFT_DEFS[i].weight;
  var roll=Math.random()*totalW,acc=0;
  for(var j=0;j<GIFT_DEFS.length;j++){
    acc+=GIFT_DEFS[j].weight;
    if(roll<acc){
      var def=GIFT_DEFS[j];
      gs.gifts.push({x:cx,y:cy,def:def,life:90,vy:-3,collected:false});
      break;
    }
  }
}

// 礼物更新
function updGifts(){
  for(var i=gs.gifts.length-1;i>=0;i--){
    var g=gs.gifts[i];
    g.y+=g.vy;g.vy+=0.05; // 轻微上浮后下落
    g.life--;
    if(g.life<=0||g.collected){
      if(!g.collected&&g.life<=0){
        // 礼物消失未收集 - 不触发效果
      }
      gs.gifts.splice(i,1);
    }
  }
}

// 礼物碰撞检测（V3.1.3: 增大收集范围+收集特效）
function checkGiftCollect(){
  for(var i=0;i<gs.gifts.length;i++){
    var g=gs.gifts[i];
    if(g.collected) continue;
    for(var j=0;j<tools.length;j++){
      var t=tools[j];
      if(!t.isActive) continue;
      var dx=(t.x+t.width/2)-g.x,dy=(t.y+t.height/2)-g.y;
      if(Math.sqrt(dx*dx+dy*dy)<S.s(45)){
        g.collected=true;
        g.def.apply(g.x,g.y);
        try{audio.playSound(SoundNames.DESTROY);}catch(e){}
        spawnSparks(g.x,g.y,g.def.color,8);
        // V3.1.3: 收集特效 - 扩散光环
        gs.explosionEffects.push({x:g.x,y:g.y,radius:S.s(5),maxRadius:S.s(70),life:20,ml:20});
        gs.flash=0.06;
        try{wx.vibrateShort({type:'light'});}catch(e){}
      }
    }
  }
}

// 礼物渲染（V3.1.3: 大幅增强视觉感知）
function drawGifts(){
  for(var i=0;i<gs.gifts.length;i++){
    var g=gs.gifts[i];
    if(g.collected) continue;
    var alpha=g.life<20?g.life/20:1;
    var floatY=Math.sin(frame*0.1+i*1.5)*S.s(5); // V3.1.3: 浮动动画
    ctx.save();ctx.globalAlpha=alpha;
    // 大发光背景
    ctx.fillStyle=hex2rgba(g.def.color,0.2);
    ctx.beginPath();ctx.arc(g.x,g.y+floatY,S.s(30),0,Math.PI*2);ctx.fill();
    // 脉冲环
    var ringR=S.s(24)+Math.sin(gs.pulseTime*4)*S.s(5);
    ctx.strokeStyle=hex2rgba(g.def.color,0.5*alpha);
    ctx.lineWidth=S.s(2);
    ctx.beginPath();ctx.arc(g.x,g.y+floatY,ringR,0,Math.PI*2);ctx.stroke();
    // 外圈
    ctx.strokeStyle=hex2rgba(g.def.color,0.2*alpha);
    ctx.lineWidth=S.s(1);
    ctx.beginPath();ctx.arc(g.x,g.y+floatY,ringR+S.s(8),0,Math.PI*2);ctx.stroke();
    // 大emoji
    ctx.font=S.s(32)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(g.def.emoji,g.x,g.y+floatY);
    // 名称（发光）
    ctx.shadowColor=g.def.color;ctx.shadowBlur=8;
    ctx.fillStyle=g.def.color;ctx.font='bold '+S.s(12)+'px Arial';
    ctx.fillText(g.def.name,g.x,g.y+floatY+S.s(24));
    ctx.shadowBlur=0;
    ctx.restore();
  }
}

// V3.1.3: 爆炸特效
function spawnExplosion(x,y){
  gs.explosionEffects.push({x:x,y:y,radius:S.s(10),maxRadius:S.s(130),life:30,ml:30});
  for(var i=0;i<12;i++){
    var p=Pool.getParticle();
    var a=Math.random()*Math.PI*2,s=3+Math.random()*6;
    p.x=x;p.y=y;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s-3;
    p.life=20+Math.random()*15;p.ml=35;
    p.color=i%2===0?C.neonRed:C.neonOrange;p.sz=4+Math.random()*5;p.t='fire';
    particles.push(p);
  }
}
function updExplosionEffects(){
  for(var i=gs.explosionEffects.length-1;i>=0;i--){
    var e=gs.explosionEffects[i];
    e.radius+=(e.maxRadius-e.radius)*0.15;
    e.life--;
    if(e.life<=0)gs.explosionEffects.splice(i,1);
  }
}
function drawExplosionEffects(){
  for(var i=0;i<gs.explosionEffects.length;i++){
    var e=gs.explosionEffects[i];
    var a=e.life/e.ml;
    ctx.strokeStyle=hex2rgba(C.neonRed,a*0.6);
    ctx.lineWidth=S.s(3)*a;
    ctx.beginPath();ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=hex2rgba(C.neonYellow,a*0.3);
    ctx.lineWidth=S.s(1.5)*a;
    ctx.beginPath();ctx.arc(e.x,e.y,e.radius*0.6,0,Math.PI*2);ctx.stroke();
    // 爆炸光晕
    ctx.fillStyle=hex2rgba(C.neonOrange,a*0.08);
    ctx.beginPath();ctx.arc(e.x,e.y,e.radius*0.4,0,Math.PI*2);ctx.fill();
  }
}

// V3.1.3: 大号浮动文字（祝福语等）
function addBigFloat(x,y,t,c){
  var f=Pool.getFloat();f.x=x;f.y=y;f.t=t;f.c=c;f.life=75;f.vy=-1.2;f.big=true;floats.push(f);
}

var canvas, ctx, physics, crane, bg, audio;
var buildings = [], tools = [], particles = [], floats = [];
var gameTimer = null, running = false, frame = 0, lastT = 0;
var uiButtons = [];
var touch = { sx:0, sy:0, lx:0, ly:0, drag:false, dist:0, st:0, moved:false };
var openDataContext = null;

// ===== 离屏Canvas缓存 =====
var _offCanvas = null, _offCtx = null, _offDirty = true, _offFrame = 0;
function ensureOffCanvas() {
  if (!_offCanvas) {
    _offCanvas = wx.createCanvas();
    _offCanvas.width = canvas.width;
    _offCanvas.height = canvas.height;
    _offCtx = _offCanvas.getContext('2d');
  }
}

// ===== 星空背景缓存（每120帧刷新，减少CPU）=====
var _starCanvas = null, _starCtx = null, _starFrame = -999;
function drawCachedStars() {
  if (!_starCanvas) {
    _starCanvas = wx.createCanvas();
    _starCanvas.width = canvas.width;
    _starCanvas.height = canvas.height;
    _starCtx = _starCanvas.getContext('2d');
  }
  if (frame - _starFrame > 120) {
    _starFrame = frame;
    _starCtx.clearRect(0, 0, _starCanvas.width, _starCanvas.height);
    _starCtx.fillStyle = '#fff';
    for (var i = 0; i < 40; i++) {
      var x = (i * 127 + 33) % _starCanvas.width;
      var y = (i * 89 + 17) % _starCanvas.height;
      _starCtx.globalAlpha = 0.3 + Math.sin(frame * 0.01 + i) * 0.2;
      _starCtx.fillRect(x, y, 1, 1);
    }
    _starCtx.globalAlpha = 1;
  }
  ctx.drawImage(_starCanvas, 0, 0);
}

// ===== 屏幕适配 =====
var S = {
  w: 375, h: 667, pr: 1, sf: 1, st: 44, sb: 0,
  init: function() {
    try { var i=wx.getSystemInfoSync(); this.w=i.windowWidth||375; this.h=i.windowHeight||667; this.pr=i.pixelRatio||1; this.sf=this.w/375; this.st=i.statusBarHeight||44;
      if(i.safeArea){this.st=Math.max(this.st,i.safeArea.top||this.st);this.sb=this.h-(i.safeArea.bottom||this.h);}else{this.st=Math.max(this.st,44);if((i.model||'').indexOf('iphone')!==-1&&this.h>=812)this.sb=34;}
    } catch(e){this.st=44;}
  },
  sx: function(x){return x*this.sf}, sy: function(y){return y*this.sf}, s: function(v){return v*this.sf}, safY: function(y){return this.st+y*this.sf}
};

// ===== 工具 =====
function grad(ctx,x0,y0,x1,y1){try{if(x0===x1&&y0===y1)x1++;return ctx.createLinearGradient(x0,y0,x1,y1);}catch(e){return null;}}
function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function regBtn(x,y,w,h,fn){uiButtons.push({x:x,y:y,w:w,h:h,fn:fn});}
function findBtn(px,py){for(var i=0;i<uiButtons.length;i++){var b=uiButtons[i];if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h)return b;}return null;}

// ===== 微信登录（自动+授权回退）=====
function autoLogin() {
  try {
    // 先检查缓存
    var cached = wx.getStorageSync('wxLoginData');
    if (cached) {
      var ld = JSON.parse(cached);
      if (Date.now() - ld.time < 86400000) { // 24h内有效
        gs.loggedIn = true;
        gs.userInfo = ld.userInfo || { nickName: '拆迁队员' };
        return;
      }
    }
  } catch(e) {}

  // 第一步：wx.login 获取code
  try {
    wx.login({
      success: function(res) {
        if (res.code) {
          gs.loggedIn = true;
          // 尝试静默获取用户信息
          tryGetUserInfo(false);
        } else {
          // login返回了但没有code，尝试授权
          tryAuthorizeLogin();
        }
      },
      fail: function() {
        tryAuthorizeLogin();
      }
    });
  } catch(e) {
    tryAuthorizeLogin();
  }
}

function tryGetUserInfo(force) {
  try {
    var cached = wx.getStorageSync('wxUserInfo');
    if (cached && !force) {
      gs.userInfo = JSON.parse(cached);
      cacheLoginData();
      return;
    }
  } catch(e) {}

  // wx.getUserInfo 在新版基础库可能不可用，用wx.getUserProfile替代
  if (force) {
    tryUserProfile();
  } else {
    try {
      wx.getUserInfo({
        success: function(res) {
          if (res.userInfo) {
            gs.userInfo = res.userInfo;
            try { wx.setStorageSync('wxUserInfo', JSON.stringify(res.userInfo)); } catch(e) {}
            cacheLoginData();
          }
        },
        fail: function() { gs.userInfo = { nickName: '拆迁队员', avatarUrl: '' }; cacheLoginData(); }
      });
    } catch(e) { gs.userInfo = { nickName: '拆迁队员' }; cacheLoginData(); }
  }
}

function tryUserProfile() {
  try {
    wx.getUserProfile({
      desc: '用于排行榜显示昵称',
      success: function(res) {
        if (res.userInfo) {
          gs.userInfo = res.userInfo;
          gs.loggedIn = true;
          try { wx.setStorageSync('wxUserInfo', JSON.stringify(res.userInfo)); } catch(e) {}
          cacheLoginData();
          NPC.show('登录成功！欢迎 '+res.userInfo.nickName, 120);
        }
      },
      fail: function() {
        gs.userInfo = { nickName: '拆迁队员' };
        gs.loggedIn = true;
        cacheLoginData();
      }
    });
  } catch(e) {
    gs.userInfo = { nickName: '拆迁队员' };
    gs.loggedIn = true;
    cacheLoginData();
  }
}

function tryAuthorizeLogin() {
  if (gs.loginRetries >= 2) {
    gs.userInfo = { nickName: '拆迁队员' };
    gs.loggedIn = true;
    return;
  }
  gs.loginRetries++;
  // 先尝试wx.login
  try {
    wx.login({
      success: function(res) {
        if (res.code) { gs.loggedIn = true; tryUserProfile(); }
        else { gs.userInfo = { nickName: '拆迁队员' }; gs.loggedIn = true; }
      },
      fail: function() { gs.userInfo = { nickName: '拆迁队员' }; gs.loggedIn = true; }
    });
  } catch(e) { gs.userInfo = { nickName: '拆迁队员' }; gs.loggedIn = true; }
}

function cacheLoginData() {
  try {
    wx.setStorageSync('wxLoginData', JSON.stringify({
      time: Date.now(), userInfo: gs.userInfo
    }));
  } catch(e) {}
}

// ===== 云存储 =====
function saveToCloud(lv, score) {
  if (!gs.loggedIn) return;
  try {
    wx.setUserCloudStorage({
      KVDataList: [
        { key: 'best_score', value: JSON.stringify({ level: lv, score: score, ts: Date.now() }) },
        { key: 'level_progress', value: JSON.stringify({ highestLevel: progress.highestLevel, topScore: score }) }
      ],
      success: function() {},
      fail: function() {}
    });
  } catch(e) {}
}

function loadFriendScores() {
  gs.lbFriendLoaded = false;
  // 通过开放数据域获取好友排行
  if (openDataContext) {
    try { openDataContext.postMessage({ action: 'getFriendRank' }); } catch(e) {}
  }
  // V3.0.9: 同时从本地leaderboard读取（含自己历史记录）
  try {
    var d=[];var r=wx.getStorageSync('leaderboard');
    if(r)d=JSON.parse(r);
    // 把自己当前记录加入
    var uname=(gs.userInfo&&gs.userInfo.nickName)||'我';
    var myBest=0;
    for(var i=0;i<d.length;i++){if(d[i].score>myBest)myBest=d[i].score;}
    gs.friendScores=[{name:uname,score:myBest,level:progress.highestLevel,isMe:true}];
    // 合并其他记录
    for(var j=0;j<d.length;j++){
      gs.friendScores.push({name:d[j].name||uname,score:d[j].score||0,level:d[j].level||1});
    }
    gs.friendScores.sort(function(a,b){return b.score-a.score;});
  } catch(e) {}
  gs.lbFriendLoaded = true;
}

function loadWorldScores() {
  // V3.1.3: 我的排行 - 按关卡显示，包含人名，同一人同一关卡只保留最高分
  gs.worldScores = [];
  try {
    var all = [];
    var keys = Object.keys(progress.levels);
    var uname = (gs.userInfo && gs.userInfo.nickName) || '我';
    for (var i = 0; i < keys.length; i++) {
      var lv = keys[i];
      var data = progress.levels[lv];
      if (data && data.score > 0) {
        all.push({ name: uname, level: parseInt(lv), score: data.score, stars: data.stars || 0 });
      }
    }
    // 按人名+关卡去重（保留最高分）
    var seen = {};
    var deduped = [];
    for (var j = 0; j < all.length; j++) {
      var key = all[j].name + '_' + all[j].level;
      if (!seen[key]) {
        seen[key] = deduped.length;
        deduped.push(all[j]);
      } else if (all[j].score > deduped[seen[key]].score) {
        deduped[seen[key]] = all[j];
      }
    }
    deduped.sort(function(a, b) { return b.score - a.score; });
    for (var k = 0; k < Math.min(deduped.length, 20); k++) {
      gs.worldScores.push(deduped[k]);
    }
  } catch(e) {}
}

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
    step1:['第一步：点击拆迁工具抓取'],
    step2:['第二步：滑动甩动方块'],
    step3:['第三步：点击释放砸建筑！'],
    daily:['每日奖励已领取！','连续登录加成！']
  },
  say: function(k){var l=this.d[k];return l?l[Math.floor(Math.random()*l.length)]:'';},
  show: function(t,dur){gs.npcText=t;gs.npcTimer=dur||150;},
  queue: function(k){var l=this.d[k];if(l)for(var i=0;i<l.length;i++)gs.npcQueue.push(l[i]);}
};
function procNPC(){if(gs.npcTimer>0)gs.npcTimer--;if(gs.npcTimer<=0&&gs.npcQueue.length>0)NPC.show(gs.npcQueue.shift(),150);}

// ===== 初始化（首屏优化：延迟加载非核心模块）=====
function init() {
  try {
    S.init();
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');
    var info = wx.getSystemInfoSync();
    canvas.width = info.windowWidth || 375;
    canvas.height = info.windowHeight || 667;

    // 核心模块立即初始化
    physics = new PhysicsSystem(CONFIG);
    crane = new CraneController(canvas, CONFIG);
    bg = new BuildingGenerator(canvas, CONFIG);
    audio = new AudioManager();
    crane.setPhysicsSystem(physics);
    audio.init();

    crane.crane.y = S.st + S.s(5);
    crane.crane.x = canvas.width / 2;
    crane.pendulum.ropeLength = Math.floor(S.h * 0.25);
    crane.magnet.y = crane.crane.y + crane.crane.height + crane.pendulum.ropeLength;
    crane.magnet.x = crane.crane.x;
    crane.magnet.attractRadius = S.h * 0.6;

    progress.load();
    dailySystem.check();

    // 首屏渲染后再登录（减少主线程阻塞）
    gs.currentScene = 'menu';
    NPC.queue('welcome');
    procNPC();

    bindTouch();
    running = true;
    lastT = Date.now();

    // 延迟登录（不阻塞首帧）
    setTimeout(function() {
      autoLogin();
      try { openDataContext = wx.getOpenDataContext(); } catch(e) {}
    }, 300);

    gameLoop();
  } catch(e) {
    console.error('init fail:', e);
    // 降级：至少显示菜单
    try {
      gs.currentScene = 'menu';
      running = true;
      gameLoop();
    } catch(e2) {}
  }
}

function nf(cb){if(typeof requestAnimationFrame==='function')requestAnimationFrame(cb);else setTimeout(cb,16);}

// ===== 游戏循环 =====
function gameLoop() {
  if(!running) return;
  frame++;
  var now = Date.now();
  var dt = Math.min(now - lastT, 50); // 限制最大dt防卡顿
  lastT = now;

  // 慢动作
  if (gs.slowMo > 0) {
    gs.slowMo--;
    gs.slowMoFactor = 0.3;
  } else {
    gs.slowMoFactor = 1;
  }

  if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused) update();

  // 全局动画（不受游戏暂停影响）
  gs.pulse = (gs.pulse + 0.05) % (Math.PI * 2);
  gs.pulseTime += 0.02;
  gs.scanY = (gs.scanY + 1.5) % canvas.height;
  gs.menuAnim = Math.min(1, gs.menuAnim + 0.03);

  if(gs.shake>0){gs.shake*=0.88;gs.shakeX=(Math.random()-.5)*gs.shake;gs.shakeY=(Math.random()-.5)*gs.shake;if(gs.shake<0.5)gs.shake=0;}
  if(gs.flash>0)gs.flash*=.85;
  if(gs.comboTimer>0){gs.comboTimer--;if(gs.comboTimer<=0)gs.combo=0;}

  updParticles();
  updFloats();
  procNPC();

  if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused&&frame%600===0)NPC.show(NPC.say('idle'),120);

  render();
  nf(gameLoop);
}

// ===== 每帧更新（V3.1.4: 含机制系统）=====
function update() {
  crane.update();
  var gy=canvas.height-S.s(50);

  // V3.1.4: 获取当前关卡机制参数
  var lvlParams = bg.getParamsForLevel(gs.currentLevel);

  // 工具物理更新
  for(var i=0;i<tools.length;i++){
    var t=tools[i];
    if(t.isGrabbed||!t.isActive||!t._thrown) continue;
    // 限速
    t.velocityY = Math.max(-8, Math.min(8, t.velocityY + 0.4));
    t.velocityX = Math.max(-10, Math.min(10, t.velocityX));
    // V3.1.4: 侧风效果（L61+）
    if(lvlParams.windForce && !t.isGrabbed){
      t.velocityX += lvlParams.windForce * (frame % 240 < 120 ? 1 : -1);
    }
    t.x += t.velocityX;
    t.y += t.velocityY;

    // 与建筑碰撞（得分+物理推出 合一，修复V3.0.7计分失效Bug）
    for(var bi=0;bi<buildings.length;bi++){
      var bld=buildings[bi];
      if(bld.isDestroyed) continue;
      if(t.x<bld.x+bld.width && t.x+t.width>bld.x && t.y<bld.y+bld.height && t.y+t.height>bld.y){
        // === 得分判定（工具在建筑内时先算伤害，再推出）===
        var spd=Math.sqrt(t.velocityX*t.velocityX+t.velocityY*t.velocityY);
        if(spd>1.0&&(!t._hitCD||!t._hitCD[bi]||frame-t._hitCD[bi]>8)){
          if(!t._hitCD)t._hitCD={};
          t._hitCD[bi]=frame;
          var dx=(bld.x+bld.width/2)-(t.x+t.width/2);
          var dy=(bld.y+bld.height/2)-(t.y+t.height/2);
          var dist=Math.sqrt(dx*dx+dy*dy);
          var angleFactor=dist>0?Math.max(0.4,Math.abs(-dy)/(dist+1)):1;
          // V3.1.0: 甩动加速加成
          var swingBonus=t._swingBonus||1;
          var effectiveHardness=t.hardness*swingBonus;
          var impactForce=spd*effectiveHardness;
          var dmg=Math.max(1,impactForce*angleFactor/(bld.mass||1));
          var actualDmg=Math.min(dmg,bld.health);
          bld.health-=actualDmg;
          var cx=bld.x+bld.width/2,cy=bld.y+bld.height/2;
          gs.shake=Math.min(8,impactForce*0.05);
          try{audio.playSound(SoundNames.CRASH);}catch(e){}
          spawnSparks(cx,cy,bld.color||C.neonOrange,4);
          addFloat(cx,cy-S.s(10),Math.floor(actualDmg)+'伤害',C.neonOrange);
          // V3.1.3: 每次碰撞也有小概率掉祝福语（更大更醒目）
          if(Math.random()<0.15){
            var msgs=['加油!','漂亮!','继续!','好球!','超赞!','再来!','厉害!'];
            addBigFloat(cx,cy-S.s(25),msgs[Math.floor(Math.random()*msgs.length)],C.neonYellow);
          }
          if(bld.health<=0){
            bld.health=0;bld.isDestroyed=true;
            var pts=Math.max(1,Math.floor((bld.score||10)*effectiveHardness*angleFactor));
            gs.combo++;gs.comboTimer=150;
            if(gs.combo>1)pts=Math.floor(pts*(1+gs.combo*0.25));
            pts=Math.max(1,pts);gs.score+=pts;gs.totalDestroys++;
            if(gs.combo>gs.maxCombo)gs.maxCombo=gs.combo;
            gs.totalScore+=pts;gs.flash=0.1;
            if(gs.combo>=5)gs.slowMo=6;
            // V3.1.0: 甩动加成提示
            if(swingBonus>1.3){
              addFloat(cx,cy-S.s(15),'甩动×'+swingBonus.toFixed(1)+'!',C.neonCyan);
            }
            // V3.1.0: 强化工具消耗
            if(t._enhanced&&gs.powerUpHardness>0){
              gs.powerUpHardness--;
              if(gs.powerUpHardness<=0){
                t.hardness=t._origHardness||t.hardness;
                t._enhanced=false;
                addFloat(cx,cy-S.s(40),'强化结束',C.textDim);
              }
            }
            spawnDebris(cx,cy,bld.color||C.neonOrange,6);
            spawnSparks(cx,cy,C.neonYellow,4);
            addFloat(cx,cy,'+'+pts,gs.combo>1?C.neonYellow:C.neonGreen);
            if(gs.combo>=3){addFloat(cx,cy-S.s(25),gs.combo+'x 连击!',C.neonPurple);gs.shake=Math.min(12,gs.combo*2);}
            try{audio.playSound(SoundNames.DESTROY);}catch(e){}
            NPC.show(NPC.say(gs.combo>2?'combo':'hit'),60);
            // V3.1.0: 礼物掉落
            tryDropGift(cx,cy);
            if(bld.explosive){
              // V3.1.3: TNT炸1个最近建筑 + 爆炸特效
              // V3.1.4: 连锁爆炸（L51+）- 被炸的建筑如果是TNT也会再炸
              gs.shake=15;gs.flash=0.3;
              spawnDebris(cx,cy,C.neonRed,10);spawnSparks(cx,cy,C.neonYellow,8);
              var chainQueue=[bld]; // V3.1.4: 连锁队列
              var chainCount=0;
              while(chainQueue.length>0 && chainCount<5){
                var curExplosive=chainQueue.shift();
                var ecx=curExplosive.x+curExplosive.width/2,ecy=curExplosive.y+curExplosive.height/2;
                // 找最近1个存活建筑
                var nearestBld2=null,nearestDist2=999;
                for(var k=0;k<buildings.length;k++){
                  var bk=buildings[k];if(bk.isDestroyed||bk===curExplosive)continue;
                  var dx2=(bk.x+bk.width/2)-ecx,dy2=(bk.y+bk.height/2)-ecy;
                  var d2=Math.sqrt(dx2*dx2+dy2*dy2);
                  if(d2<nearestDist2){nearestDist2=d2;nearestBld2=bk;}
                }
                if(nearestBld2){
                  nearestBld2.health=0;nearestBld2.isDestroyed=true;
                  var nx=nearestBld2.x+nearestBld2.width/2,ny2=nearestBld2.y+nearestBld2.height/2;
                  spawnDebris(nx,ny2,nearestBld2.color||C.neonRed,8);
                  spawnSparks(nx,ny2,C.neonYellow,6);
                  var bp=Math.max(1,nearestBld2.score||10);
                  gs.score+=bp;
                  addFloat(nx,ny2,'💥+'+bp,C.neonRed);
                  addCollapse(nearestBld2);
                  spawnExplosion(nx,ny2);
                  // V3.1.4: 连锁 - 如果被炸的建筑也是TNT，加入队列
                  if(nearestBld2.explosive && lvlParams && lvlParams.chainExplosion){
                    chainQueue.push(nearestBld2);
                    addBigFloat(nx,ny2-S.s(30),'🔥连锁爆炸!',C.neonOrange);
                    chainCount++;
                  }
                }
                spawnExplosion(ecx,ecy);
              }
              if(chainCount>0) addFloat(cx,cy-S.s(50),'🔥×'+(chainCount+1)+'连锁!',C.neonOrange);
              addFloat(cx,cy-S.s(35),'💣TNT爆炸!',C.neonRed);
            }
            addCollapse(bld);
          }
        }
        // === 物理推出 ===
        if(!bld.isDestroyed){
          var overlapLeft=(t.x+t.width)-bld.x;
          var overlapRight=(bld.x+bld.width)-t.x;
          var overlapTop=(t.y+t.height)-bld.y;
          var overlapBottom=(bld.y+bld.height)-t.y;
          var minOverlap=Math.min(overlapLeft,overlapRight,overlapTop,overlapBottom);
          if(minOverlap===overlapTop){
            t.y=bld.y-t.height;t.velocityY=Math.abs(t.velocityY)>1.5?t.velocityY*-0.3:0;t.velocityX*=0.7;
          }else if(minOverlap===overlapBottom){
            t.y=bld.y+bld.height;t.velocityY=Math.abs(t.velocityY)*0.3;
          }else if(minOverlap===overlapLeft){
            t.x=bld.x-t.width;t.velocityX=Math.abs(t.velocityX)>1?t.velocityX*-0.4:0;
          }else{
            t.x=bld.x+bld.width;t.velocityX=Math.abs(t.velocityX)>1?t.velocityX*-0.4:0;
          }
        }else{
          // 建筑已摧毁：工具减速穿过
          t.velocityX*=0.8;t.velocityY*=0.8;
        }
      }
    }

    // 地面碰撞
    if(t.y+t.height>gy){
      t.y=gy-t.height;
      t.velocityY=Math.abs(t.velocityY)>1 ? t.velocityY*-0.3 : 0;
      t.velocityX*=0.85;
    }
    // 左右墙
    if(t.x<0){t.x=0;t.velocityX*=-0.5;}
    if(t.x+t.width>canvas.width){t.x=canvas.width-t.width;t.velocityX*=-0.5;}
    // 顶部
    if(t.y<0){t.y=0;t.velocityY=Math.abs(t.velocityY)*0.3;}
    // 摩擦
    if(Math.abs(t.velocityX)<0.1) t.velocityX=0;
  }
  // 建筑悬空检测
  checkFloatingBlocks();
  // V3.1.1: 工具重生逻辑（从drawTools移到update中，渲染不应修改状态）
  var groundY2=canvas.height-S.s(50);
  for(var ri=0;ri<tools.length;ri++){
    var rt=tools[ri];
    if(rt.isActive && !rt.isGrabbed){
      var rspd=Math.abs(rt.velocityX)+Math.abs(rt.velocityY);
      if(rspd < 0.5){ // V3.1.4: 不再要求在地面上，停在建筑顶部也重生
        if(!rt._stillTimer) rt._stillTimer = 0;
        rt._stillTimer++;
        if(rt._stillTimer > 60){
          rt.x = rt.respawnX; rt.y = rt.respawnY;
          rt.velocityX = 0; rt.velocityY = 0;
          rt._stillTimer = 0;
          rt._thrown=false; // V3.1.3: 重置投掷状态
          rt._swingBonus = undefined; // V3.1.1: 重置甩动加成
          rt._hitCD = undefined; // 重置碰撞CD
        }
      } else {
        rt._stillTimer = 0;
      }
    }
  }
  // V3.1.0: 礼物系统更新
  updGifts();
  checkGiftCollect();
  // V3.1.3: 爆炸特效更新
  updExplosionEffects();
  // （得分已合并到上面碰撞处理中，不再单独调用checkToolHits）
  checkGameEnd();
}

// ===== 悬空检测（仅让悬空方块缓慢下落，不触发伤害）=====
function checkFloatingBlocks() {
  var groundY = canvas.height - S.s(50);
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed) continue;
    // 被工具带走的建筑方块不做悬空检测
    var supported = (b.y + b.height >= groundY - 2);
    if(!supported){
      for(var j=0;j<buildings.length;j++){
        if(i===j||buildings[j].isDestroyed) continue;
        if(b.x+b.width>buildings[j].x+2 && b.x<buildings[j].x+buildings[j].width-2){
          if(Math.abs((b.y+b.height)-buildings[j].y)<3){supported=true;break;}
        }
      }
    }
    if(!supported) b.velocityY = Math.min((b.velocityY||0)+0.3, 3);
    else b.velocityY = 0;
    if(b.velocityY>0){
      b.y += b.velocityY;
      if(b.y+b.height>=groundY){b.y=groundY-b.height;b.velocityY=0;}
    }
  }
}

function addCollapse(block){
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
      if(crane.magnet.isGrabbing){
        crane.pendulum.angularVelocity+=dx*0.004;
        // V3.1.0: 记录最大摆动速度
        var absAV=Math.abs(crane.pendulum.angularVelocity);
        if(absAV>gs.peakSwingAV) gs.peakSwingAV=absAV;
      }
    }
    touch.lx=t.clientX;touch.ly=t.clientY;
  });
  wx.onTouchEnd(function(e){
    var x=touch.lx,y=touch.ly,el=Date.now()-touch.st;
    var isTap=!touch.moved||el<250;
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
      // === 释放工具 ===
      var savedAV=crane.pendulum.angularVelocity;
      var swingDir=savedAV>0.01?1:(savedAV<-0.01?-1:1);
      // V3.1.0: 甩动加速度加分 — 摆动越快投掷越猛
      var peakAV=gs.peakSwingAV||0;
      var swingPower=Math.max(8, 5+Math.abs(savedAV)*80 + peakAV*30); // 加速度贡献额外投掷力
      var swingBonus=1+peakAV*3; // 甩动速度乘数：peakAV=0.1→1.3x, 0.3→1.9x, 0.5→2.5x
      var block=crane.releaseMagnet();
      if(block){
        block.velocityX=swingDir*swingPower;
        block.velocityY=-8;
        block._thrown=true; // V3.1.3: 标记已投掷
        block.isGrabbed=false;
        block._swingBonus=swingBonus; // V3.1.0: 记录甩动加成，碰撞时使用
        gs.peakSwingAV=0; // 重置
        audio.playSound(SoundNames.RELEASE);
        spawnSparks(block.x+block.width/2,block.y,C.neonCyan,4);
        NPC.show(NPC.say('swing'),60);
      }
    } else {
      // === 抓取：只抓拆迁工具，不抓建筑 ===
      var best=null, bestD=crane.magnet.attractRadius*1.5;
      // 优先从工具中找
      for(var i=0;i<tools.length;i++){
        var t=tools[i];
        if(!t.isActive) continue;
        var tx=t.x+t.width/2,ty=t.y+t.height/2;
        var d=Math.sqrt((x-tx)*(x-tx)+(y-ty)*(y-ty));
        if(d<bestD){bestD=d;best=t;}
      }
      if(best){
        crane.magnet.isActive=true;crane.magnet.isGrabbing=true;crane.magnet.grabbedBlock=best;
        best.isGrabbed=true;
        best.x=crane.magnet.x-best.width/2;
        best.y=crane.magnet.y+crane.magnet.radius+4;
        crane.crane.x=crane.magnet.x;
        crane.pendulum.angle=0;crane.pendulum.angularVelocity=0;
        gs.peakSwingAV=0; // V3.1.0: 重置甩动记录
        // V3.1.0: 强化工具效果
        if(gs.powerUpHardness>0){
          best._origHardness=best.hardness;
          best.hardness+=1;
          best._enhanced=true;
          addFloat(best.x+best.width/2,best.y-S.s(10),'⚡强化!',C.neonGreen);
        }
        best.velocityX=0;best.velocityY=0;
        audio.playSound(SoundNames.GRAB);
        spawnSparks(crane.magnet.x,crane.magnet.y,C.neonPurple,5);
        NPC.show(NPC.say('grab'),60);
      } else {
        NPC.show('点击拆迁工具抓取！',100);
      }
    }
  }
}

// ===== 关卡加载 =====
// ===== 拆迁工具定义 =====
var TOOL_TYPES = {
  steelBall: { name: '钢球', hardness: 3.0, mass: 4.0, fill: '#8899AA', stroke: '#556677', glow: '#AACCDD', emoji: '⚫', desc: '硬·重' },
  ironHammer: { name: '铁锤', hardness: 2.5, mass: 3.0, fill: '#7788AA', stroke: '#445566', glow: '#99BBDD', emoji: '🔨', desc: '硬·中' },
  wreckBall: { name: '破坏球', hardness: 2.0, mass: 3.5, fill: '#555566', stroke: '#333344', glow: '#888899', emoji: '⚽', desc: '中·重' },
  rubberBall: { name: '橡皮球', hardness: 0.8, mass: 1.0, fill: '#E840A0', stroke: '#A82070', glow: '#FF70C0', emoji: '🏀', desc: '弹·轻' },
  bomb: { name: '炸弹', hardness: 1.5, mass: 2.0, fill: '#FF5020', stroke: '#CC3000', glow: '#FF8040', emoji: '💣', desc: '爆·中' }
};

function generateTools(lv) {
  tools = [];
  var tw = S.s(40), th = S.s(40);

  // V3.1.2: 每关只给1个当前最强工具，避免画面混乱
  var typeId = 'steelBall';
  if (lv >= 35) typeId = 'bomb';
  else if (lv >= 25) typeId = 'rubberBall';
  else if (lv >= 15) typeId = 'wreckBall';
  else if (lv >= 5) typeId = 'ironHammer';

  var td = TOOL_TYPES[typeId];

  // V3.1.3: 工具放在建筑上方，不放在地面
  var startX, startY;
  if (buildings.length > 0) {
    var topY = canvas.height, topX = canvas.width / 2;
    for (var bi = 0; bi < buildings.length; bi++) {
      if (buildings[bi].y < topY) {
        topY = buildings[bi].y;
        topX = buildings[bi].x + buildings[bi].width / 2;
      }
    }
    startX = topX - tw / 2;
    startY = topY - th - S.s(8);
  } else {
    var groundY = canvas.height - S.s(50);
    startX = S.sx(15);
    startY = groundY - th - S.s(5);
  }

  tools.push({
    type: typeId,
    name: td.name,
    hardness: td.hardness,
    mass: td.mass,
    fill: td.fill,
    stroke: td.stroke,
    glow: td.glow,
    emoji: td.emoji,
    desc: td.desc,
    x: startX,
    y: startY,
    width: tw,
    height: th,
    velocityX: 0,
    velocityY: 0,
    isGrabbed: false,
    isActive: true,
    respawnX: startX,
    respawnY: startY,
    _thrown: false  // V3.1.3: 未投掷不参与碰撞计分
  });
}

function loadLevel(lv){
  if(lv<1)lv=1;if(lv>1000)lv=1000;
  if(!progress.isUnlocked(lv)){NPC.show('关卡未解锁！',90);return;}
  clearTimer();
  // 生成建筑
  buildings=bg.generateLevel(lv);
  buildings.forEach(function(b){if(b.width<20)b.width=20;if(b.height<20)b.height=20;});

  // 生成拆迁工具
  tools=[];
  generateTools(lv);

  gs.currentLevel=lv;
  gs.targetScore=bg.getTargetScore(lv);gs.timeLeft=bg.getTimeLimit(lv);
  gs.score=0;gs.gameActive=true;gs.gamePaused=false;gs.currentScene='game';gs.gameResult=null;
  gs.combo=0;gs.comboTimer=0;gs.slowMo=0;
  gs.gifts=[];gs.peakSwingAV=0;gs.powerUpHardness=0;gs.explosionEffects=[]; // V3.1.3: 重置爆炸特效
  particles.length=0;floats.length=0;
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
  // V3.1.4: 限时奖励（L71+）- 剩余时间>50%时每次+1分
  var lvlParams=bg.getParamsForLevel(gs.currentLevel);
  if(lvlParams.timeBonus&&gs.timeLeft>bg.getTimeLimit(gs.currentLevel)*0.5){
    gs.score+=1;
  }
  if(gs.timeLeft<=3&&gs.timeLeft>0){try{wx.vibrateShort({type:'light'});}catch(e){}audio.playSound(SoundNames.WARNING);if(gs.timeLeft<=3)NPC.show(NPC.say('lowtime'),60);}
  if(gs.timeLeft<=0){gs.timeLeft=0;endGame(false);}
},1000);}

function checkGameEnd(){
  var lvlParams=bg.getParamsForLevel(gs.currentLevel);
  // V3.1.4: 多目标模式 - 必须摧毁所有建筑
  if(lvlParams.multiTarget){
    var allDead=true;
    for(var i=0;i<buildings.length;i++){if(!buildings[i].isDestroyed){allDead=false;break;}}
    if(allDead) endGame(true);
    return;
  }
  if(gs.score>=gs.targetScore)endGame(true);
}
function endGame(win){
  gs.gameActive=false;gs.gameResult=win; // V3.1.4: 存储胜负结果
  var pct=gs.targetScore>0?gs.score/gs.targetScore:0;
  gs.stars=pct>=1?3:pct>=.8?2:pct>=.5?1:0;
  // V3.0.9: 只要得分>0就保存进度，通关自动解锁下一关
  if(gs.score>0){
    progress.complete(gs.currentLevel,gs.stars,gs.score);
    saveToCloud(gs.currentLevel,gs.score);
    saveLB(gs.currentLevel,gs.score);
  }
  audio.playSound(win?SoundNames.WIN:SoundNames.LOSE);
  if(win) gs.slowMo = 15; // 胜利慢动作
  gs.currentScene='gameover';NPC.show(NPC.say(win?'win':'lose'),200);
}
function saveLB(lv,sc){try{var d=[];var r=wx.getStorageSync('leaderboard');if(r)d=JSON.parse(r);d.push({level:lv,score:sc,time:Date.now(),name:gs.userInfo?gs.userInfo.nickName:'拆迁队员'});d.sort(function(a,b){return b.score-a.score;});if(d.length>50)d=d.slice(0,50);wx.setStorageSync('leaderboard',JSON.stringify(d));}catch(e){}}

// ===== 粒子系统（对象池优化）=====
function spawnSparks(x,y,color,n){
  n=Math.min(n,6); // 限制粒子数量
  for(var i=0;i<n;i++){
    var p=Pool.getParticle();
    var a=Math.random()*Math.PI*2,s=1+Math.random()*4;
    p.x=x;p.y=y;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s-1;
    p.life=20+Math.random()*15;p.ml=35;p.color=color;p.sz=2+Math.random()*2;p.t='spark';
    particles.push(p);
  }
}
function spawnDebris(x,y,color,n){
  n=Math.min(n,8);
  for(var i=0;i<n;i++){
    var p=Pool.getParticle();
    var a=Math.random()*Math.PI*2,s=2+Math.random()*5;
    p.x=x;p.y=y;p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s-2;
    p.life=25+Math.random()*20;p.ml=45;p.color=color;p.sz=4+Math.random()*6;p.t='debris';
    p.rot=Math.random()*6.28;p.rs=(Math.random()-.5)*.3;
    particles.push(p);
  }
}
function updParticles(){
  for(var i=particles.length-1;i>=0;i--){
    var p=particles[i];
    p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.vx*=.98;p.life--;
    if(p.rot!==undefined)p.rot+=p.rs;
    if(p.life<=0){Pool.recycleParticle(p);particles.splice(i,1);}
  }
}
function addFloat(x,y,t,c){var f=Pool.getFloat();f.x=x;f.y=y;f.t=t;f.c=c;f.life=45;f.vy=-2;floats.push(f);}
function updFloats(){for(var i=floats.length-1;i>=0;i--){var f=floats[i];f.y+=f.vy;f.vy*=.96;f.life--;if(f.life<=0){Pool.recycleFloat(f);floats.splice(i,1);}}}

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
    case 'dailyreward':renderDailyReward();break;
  }
  ctx.restore();
}

// ===== 科技感动画层 =====
function drawScanLine(alpha) {
  // 极轻量扫描线，不干扰视觉
  var a = alpha || 0.015;
  ctx.fillStyle = hex2rgba(C.neonCyan, a);
  ctx.fillRect(0, gs.scanY, canvas.width, 1);
}

function drawPulseRing(x, y, maxR, color, alpha) {
  var r = (Math.sin(gs.pulseTime * 2) * 0.3 + 0.7) * maxR;
  ctx.strokeStyle = hex2rgba(color, alpha);
  ctx.lineWidth = S.s(1);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawGridLines(alpha) {
  // 网格线只在菜单页绘制，游戏中不画（节省性能）
  if (gs.currentScene !== 'menu') return;
  var a = alpha || 0.02;
  ctx.strokeStyle = hex2rgba(C.neonCyan, a);
  ctx.lineWidth = S.s(0.5);
  var spacing = S.s(50);
  for (var x = 0; x < canvas.width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (var y = 0; y < canvas.height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function drawNeonBorder() {
  // 边框只在菜单页绘制，游戏中不画
  if (gs.currentScene !== 'menu') return;
  ctx.strokeStyle = hex2rgba(C.neonCyan, 0.1 + Math.sin(gs.pulseTime) * 0.03);
  ctx.lineWidth = S.s(1);
  ctx.strokeRect(S.s(2), S.st, canvas.width - S.s(4), canvas.height - S.st - S.s(2));
}

// ===== 主菜单 =====
function renderMenu(){
  // 背景
  var g=grad(ctx,0,0,0,canvas.height);
  if(g){g.addColorStop(0,'#020510');g.addColorStop(.5,'#0a1035');g.addColorStop(1,'#050a20');ctx.fillStyle=g;}else ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // 科技感网格
  drawGridLines(0.03);
  drawScanLine(0.04);
  drawCachedStars();
  drawNeonBorder();

  // 入场动画
  var anim = gs.menuAnim;
  var titleY = S.safY(65) - (1 - anim) * S.s(30);

  // 标题发光
  ctx.save();
  ctx.globalAlpha = anim;
  ctx.shadowColor=C.neonCyan;ctx.shadowBlur=25*anim;
  ctx.fillStyle=C.neonCyan;
  ctx.font='bold '+S.s(34)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('磁吸拆迁队',canvas.width/2,titleY);
  ctx.restore();

  // 副标题
  ctx.save();ctx.globalAlpha=anim;
  ctx.fillStyle=C.textDim;ctx.font=S.s(10)+'px Arial';ctx.textAlign='center';
  ctx.fillText('磁吸拆迁队  V'+VERSION,canvas.width/2,titleY+S.s(30));
  ctx.restore();

  // 脉冲环装饰
  drawPulseRing(canvas.width/2, titleY, S.s(120), C.neonCyan, 0.06);

  // 用户信息
  ctx.save();ctx.globalAlpha=anim;
  var uname = (gs.userInfo && gs.userInfo.nickName) || '点击登录';
  ctx.fillStyle=gs.loggedIn?C.neonGreen:C.neonYellow;
  ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';
  ctx.fillText((gs.loggedIn?'● ':'○ ')+uname,canvas.width/2,S.safY(115));
  if(!gs.loggedIn){
    regBtn(canvas.width/2-S.s(60),S.safY(100),S.s(120),S.s(25),function(){tryAuthorizeLogin();});
  }
  ctx.restore();

  // 每日奖励提示
  if(!gs.dailyReward){
    ctx.save();ctx.globalAlpha=anim;
    ctx.fillStyle=C.neonYellow;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';
    var pulse=Math.sin(gs.pulseTime*3)*0.3+0.7;
    ctx.globalAlpha=anim*pulse;
    ctx.fillText('🎁 每日奖励待领取 (连续'+gs.loginStreak+'天)',canvas.width/2,S.safY(132));
    regBtn(canvas.width/2-S.s(80),S.safY(118),S.s(160),S.s(25),function(){
      var bonus=dailySystem.claim();
      if(bonus>0){gs.score+=bonus;NPC.show('领取 '+bonus+' 分奖励！连续登录'+gs.loginStreak+'天',120);}
    });
    ctx.restore();
  }

  // NPC
  ctx.save();ctx.globalAlpha=anim;
  drawNPC(S.sx(15),S.safY(148),S.s(65));
  if(gs.npcText&&gs.npcTimer>0)drawBubble(S.sx(85),S.safY(143),S.s(240),gs.npcText);
  ctx.restore();

  // 按钮 - 科技感风格
  var cx=canvas.width/2,bw=S.s(250),bh=S.s(52),sy=S.safY(230);
  var lb=['开始游戏','关卡选择','排行榜','玩法说明'];
  var cl=[C.neonGreen,C.neonCyan,C.neonYellow,C.neonPurple];
  var fn=[
    function(){loadLevel(progress.highestLevel);},
    function(){gs.levelPage=Math.floor((progress.highestLevel-1)/20);gs.currentScene='levelselect';},
    function(){gs.lbTab='friend';loadFriendScores();loadWorldScores();gs.currentScene='leaderboard';},
    function(){gs.currentScene='instructions';}
  ];
  for(var i=0;i<lb.length;i++){
    var by=sy+i*(bh+S.s(12));
    var btnAnim = Math.max(0, Math.min(1, (anim - i*0.1) * 2));
    ctx.save();ctx.globalAlpha=btnAnim;
    drawNeonBtn(cx-bw/2,by,bw,bh,lb[i],cl[i]);
    regBtn(cx-bw/2,by,bw,bh,fn[i]);
    ctx.restore();
  }

  // 底部统计
  ctx.save();ctx.globalAlpha=anim*0.6;
  ctx.fillStyle=C.textDim;ctx.font=S.s(10)+'px Arial';ctx.textAlign='center';
  ctx.fillText('最高L'+progress.highestLevel+' | 总分'+gs.totalScore+' | 最高连击'+gs.maxCombo,canvas.width/2,canvas.height-S.sb-S.s(15));
  ctx.restore();
}

// 科技感按钮
function drawNeonBtn(x,y,w,h,t,c){
  // 填充
  ctx.fillStyle=hex2rgba(c,.06);
  rr(ctx,x,y,w,h,S.s(8));ctx.fill();
  // 内发光边框
  ctx.strokeStyle=hex2rgba(c,.5+Math.sin(gs.pulseTime*2)*0.15);
  ctx.lineWidth=S.s(1.5);
  rr(ctx,x,y,w,h,S.s(8));ctx.stroke();
  // 顶部高光线
  ctx.fillStyle=hex2rgba(c,.15);
  rr(ctx,x+S.s(2),y+S.s(1),w-S.s(4),S.s(3),S.s(2));ctx.fill();
  // 文字
  ctx.fillStyle=c;ctx.font='bold '+S.s(17)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(t,x+w/2,y+h/2);
}

// ===== 游戏场景 =====
function renderGame(){
  var g=grad(ctx,0,0,0,canvas.height);
  if(g){g.addColorStop(0,'#020510');g.addColorStop(.6,'#0a1035');g.addColorStop(1,'#0d1540');ctx.fillStyle=g;}else ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // 游戏场景不画网格和扫描线，节省GPU
  drawCachedStars();

  // V3.1.3: 大气雾效 - 底部渐变
  var fogG=grad(ctx,0,canvas.height-S.s(120),0,canvas.height);
  if(fogG){fogG.addColorStop(0,'rgba(10,20,50,0)');fogG.addColorStop(0.6,'rgba(10,20,50,0.15)');fogG.addColorStop(1,'rgba(10,20,50,0.3)');ctx.fillStyle=fogG;ctx.fillRect(0,canvas.height-S.s(120),canvas.width,S.s(120));}

  // 地面 - V3.1.3: 渐变地面更真实
  var gy=canvas.height-S.s(50);
  var gndG=grad(ctx,0,gy,0,canvas.height);
  if(gndG){gndG.addColorStop(0,'#0a1830');gndG.addColorStop(0.3,'#0a1628');gndG.addColorStop(1,'#060e1c');ctx.fillStyle=gndG;}else ctx.fillStyle=C.ground;
  ctx.fillRect(0,gy,canvas.width,S.s(50));
  // 地面顶部发光线
  ctx.strokeStyle=C.groundLine;ctx.lineWidth=S.s(1.5);ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(canvas.width,gy);ctx.stroke();
  // V3.1.3: 地面网格线
  ctx.strokeStyle='rgba(0,240,255,0.04)';ctx.lineWidth=S.s(0.5);
  for(var gi=0;gi<canvas.width;gi+=S.s(30)){ctx.beginPath();ctx.moveTo(gi,gy);ctx.lineTo(gi,canvas.height);ctx.stroke();}
  for(var gj=gy+S.s(15);gj<canvas.height;gj+=S.s(15)){ctx.beginPath();ctx.moveTo(0,gj);ctx.lineTo(canvas.width,gj);ctx.stroke();}

  drawBuildings();
  drawTools();
  drawCrane();
  drawParticles();drawFloats();drawGifts();drawExplosionEffects(); // V3.1.3: 爆炸特效

  // V3.1.3: 顶部氛围光
  var topG=grad(ctx,0,S.st,0,S.st+S.s(60));
  if(topG){topG.addColorStop(0,'rgba(0,240,255,0.03)');topG.addColorStop(1,'rgba(0,240,255,0)');ctx.fillStyle=topG;ctx.fillRect(0,S.st,canvas.width,S.s(60));}

  if(gs.flash>.01){ctx.fillStyle='rgba(255,255,255,'+gs.flash+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
  drawHUD();
  if(gs.npcText&&gs.npcTimer>0){drawNPC(S.sx(5),canvas.height-S.s(75),S.s(45));drawBubble(S.sx(55),canvas.height-S.s(65),S.s(230),gs.npcText);}
  if(gs.gamePaused)drawPause();
}

// ===== 建筑（V3.1.3: 增强纹理+科技感）=====
function drawBuildings(){
  // 先画建筑群整体阴影/地基，让建筑更醒目
  var groundY = canvas.height - S.s(50);
  
  // 计算每栋建筑的范围
  var buildingGroups = [];
  var visited = {};
  for(var bi=0;bi<buildings.length;bi++){
    if(buildings[bi].isDestroyed||visited[bi])continue;
    var group={minX:9999,maxX:0,minY:9999,maxY:0};
    for(var bj=bi;bj<buildings.length;bj++){
      if(buildings[bj].isDestroyed||visited[bj])continue;
      if(Math.abs(buildings[bj].x-group.minX)<S.s(80)||Math.abs(buildings[bj].x-group.maxX)<S.s(80)||
         (buildings[bj].x>=group.minX-S.s(10)&&buildings[bj].x<=group.maxX+S.s(10))){
        group.minX=Math.min(group.minX,buildings[bj].x);
        group.maxX=Math.max(group.maxX,buildings[bj].x+buildings[bj].width);
        group.minY=Math.min(group.minY,buildings[bj].y);
        group.maxY=Math.max(group.maxY,buildings[bj].y+buildings[bj].height);
        visited[bj]=true;
      }
    }
    if(group.minX<9999)buildingGroups.push(group);
  }

  // 画建筑底部阴影/地基
  buildingGroups.forEach(function(g){
    var pad=S.s(6);
    // V3.1.3: 地基发光更亮
    ctx.fillStyle='rgba(0,240,255,0.06)';
    ctx.fillRect(g.minX-pad,groundY-S.s(4),g.maxX-g.minX+pad*2,S.s(4));
    // 建筑整体背景暗色衬底
    ctx.fillStyle='rgba(10,20,50,0.35)';
    ctx.fillRect(g.minX-pad,g.minY-pad,g.maxX-g.minX+pad*2,g.maxY-g.minY+pad*2);
    // V3.1.3: 建筑标签更小
    ctx.fillStyle=hex2rgba(C.neonCyan,0.5);ctx.font=S.s(8)+'px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText('▼ 建筑',g.minX+(g.maxX-g.minX)/2,g.minY-pad-S.s(1));
  });

  // 画每个方块
  buildings.forEach(function(b){
    if(b.isDestroyed)return;
    var hp=b.health/b.maxHealth;
    var bc=C[b.type]||C.wood;

    // V3.1.3: 方块主体带内发光
    ctx.fillStyle=bc.fill;ctx.fillRect(b.x,b.y,b.width,b.height);
    // 内部渐变高光
    var bG=grad(ctx,b.x,b.y,b.x,b.y+b.height);
    if(bG){bG.addColorStop(0,'rgba(255,255,255,0.1)');bG.addColorStop(0.4,'rgba(255,255,255,0)');bG.addColorStop(1,'rgba(0,0,0,0.1)');ctx.fillStyle=bG;ctx.fillRect(b.x,b.y,b.width,b.height);}

    // V3.1.3: 纹理效果
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=S.s(0.5);
    if(b.type==='wood'){
      // 木纹
      for(var wi=1;wi<4;wi++){ctx.beginPath();ctx.moveTo(b.x+S.s(3),b.y+b.height*wi/4);ctx.lineTo(b.x+b.width-S.s(3),b.y+b.height*wi/4);ctx.stroke();}
    }else if(b.type==='brick'){
      // 砖纹
      for(var bri=1;bri<3;bri++){ctx.beginPath();ctx.moveTo(b.x,b.y+b.height*bri/3);ctx.lineTo(b.x+b.width,b.y+b.height*bri/3);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(b.x+b.width/2,b.y);ctx.lineTo(b.x+b.width/2,b.y+b.height/3);ctx.stroke();
      ctx.beginPath();ctx.moveTo(b.x+b.width*0.25,b.y+b.height/3);ctx.lineTo(b.x+b.width*0.25,b.y+b.height*2/3);ctx.stroke();
    }else if(b.type==='steel'){
      // 钢铁铆钉
      ctx.fillStyle='rgba(200,210,230,0.2)';
      var rivets=[[0.15,0.15],[0.85,0.15],[0.15,0.85],[0.85,0.85]];
      for(var ri2=0;ri2<rivets.length;ri2++){ctx.beginPath();ctx.arc(b.x+b.width*rivets[ri2][0],b.y+b.height*rivets[ri2][1],S.s(2),0,Math.PI*2);ctx.fill();}
    }else if(b.type==='ice'){
      // 冰晶闪光
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.fillRect(b.x+b.width*0.1,b.y+b.height*0.2,b.width*0.3,S.s(2));
      ctx.fillRect(b.x+b.width*0.5,b.y+b.height*0.6,b.width*0.25,S.s(1.5));
    }

    // 边框 - V3.1.3: 更鲜明
    ctx.strokeStyle=bc.stroke;ctx.lineWidth=S.s(1.5);ctx.strokeRect(b.x,b.y,b.width,b.height);
    // V3.1.4: BOSS建筑金色发光边框
    if(b.isBoss){
      ctx.save();ctx.shadowColor='#FFD700';ctx.shadowBlur=10;
      ctx.strokeStyle='#FFD700';ctx.lineWidth=S.s(2.5);ctx.strokeRect(b.x,b.y,b.width,b.height);
      ctx.restore();
    }

    // 高光
    ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(b.x+2,b.y+2,b.width-4,S.s(3));

    // 类型标记
    ctx.font='bold '+S.s(12)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.65)';
    var label=b.type==='wood'?'木':b.type==='brick'?'砖':b.type==='steel'?'钢':b.type==='ice'?'冰':b.type==='rubber'?'胶':b.type==='tnt'?'💣':'?';
    // V3.1.4: BOSS建筑特殊标记
    if(b.isBoss){
      ctx.fillStyle=C.neonRed;
      ctx.font='bold '+S.s(14)+'px Arial';
      ctx.fillText('👑首领',b.x+b.width/2,b.y+b.height/2-S.s(4));
      ctx.font=S.s(9)+'px Arial';ctx.fillStyle=C.neonYellow;
      ctx.fillText(Math.ceil(b.health)+'血',b.x+b.width/2,b.y+b.height/2+S.s(10));
    }else{
      ctx.fillText(label,b.x+b.width/2,b.y+b.height/2);
    }

    // 低血量发光
    if(hp<0.3){
      ctx.save();ctx.shadowColor=bc.glow;ctx.shadowBlur=10;
      ctx.strokeStyle=bc.glow;ctx.lineWidth=S.s(1.5);ctx.strokeRect(b.x,b.y,b.width,b.height);
      ctx.restore();
    }

    // 裂纹 - V3.1.3: 更明显
    if(hp<0.7){
      ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=S.s(1.2);
      var cn=hp<0.3?3:1;
      for(var ci=0;ci<cn;ci++){ctx.beginPath();ctx.moveTo(b.x+b.width*(0.2+ci*0.25),b.y);ctx.lineTo(b.x+b.width*(0.35+ci*0.15),b.y+b.height*0.5);ctx.lineTo(b.x+b.width*(0.15+ci*0.3),b.y+b.height);ctx.stroke();}
    }

    // 濒危闪烁
    if(hp<0.3&&frame%6<3){ctx.fillStyle='rgba(255,50,50,0.15)';ctx.fillRect(b.x,b.y,b.width,b.height);}

    // 血条 - V3.1.3: 发光血条
    if(hp<1){
      var bw2=b.width*.85,bh2=S.s(4),bx2=b.x+(b.width-bw2)/2,by2=b.y-S.s(7);
      ctx.fillStyle='rgba(0,0,0,0.5)';rr(ctx,bx2,by2,bw2,bh2,S.s(2));ctx.fill();
      var hpColor=hp>.5?C.neonGreen:hp>.25?C.neonYellow:C.neonRed;
      ctx.fillStyle=hpColor;
      rr(ctx,bx2,by2,Math.max(S.s(2),bw2*hp),bh2,S.s(2));ctx.fill();
      // V3.1.3: 血条发光
      ctx.save();ctx.shadowColor=hpColor;ctx.shadowBlur=4;
      rr(ctx,bx2,by2,Math.max(S.s(2),bw2*hp),bh2,S.s(2));ctx.fill();
      ctx.restore();
    }
  });
}

// ===== 拆迁工具绘制（V3.1.3: 增强视觉）=====
function drawTools(){
  // V3.1.3: 工具区域提示
  tools.forEach(function(t){
    if(!t.isActive) return;
    ctx.save();
    // V3.1.3: 未投掷时的提示标记
    if(!t._thrown&&!t.isGrabbed){
      // 可抓取脉冲高亮 - 更醒目
      var pa=0.35+Math.sin(gs.pulseTime*3)*0.25;
      ctx.strokeStyle=hex2rgba(C.neonGreen,pa);ctx.lineWidth=S.s(3);
      rr(ctx,t.x-S.s(4),t.y-S.s(4),t.width+S.s(8),t.height+S.s(8),S.s(10));ctx.stroke();
      // V3.1.3: 提示文字
      ctx.fillStyle=hex2rgba(C.neonGreen,pa);ctx.font='bold '+S.s(8)+'px Arial';ctx.textAlign='center';
      ctx.fillText('▼ 点击抓取',t.x+t.width/2,t.y-S.s(10));
    }
    // 工具底色 - 更亮的圆角
    ctx.fillStyle=hex2rgba(t.fill,0.9);
    rr(ctx,t.x,t.y,t.width,t.height,S.s(6));ctx.fill();
    // 工具边框 - 绿色
    ctx.strokeStyle=C.neonGreen;ctx.lineWidth=S.s(2);
    rr(ctx,t.x,t.y,t.width,t.height,S.s(6));ctx.stroke();
    // V3.1.3: 内发光
    var tG=grad(ctx,t.x,t.y,t.x,t.y+t.height);
    if(tG){tG.addColorStop(0,'rgba(255,255,255,0.15)');tG.addColorStop(0.4,'rgba(255,255,255,0)');ctx.fillStyle=tG;rr(ctx,t.x,t.y,t.width,t.height,S.s(6));ctx.fill();}
    // 工具emoji
    ctx.font=S.s(20)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(t.emoji,t.x+t.width/2,t.y+t.height/2-S.s(3));
    // 工具名
    ctx.fillStyle='#fff';ctx.font='bold '+S.s(9)+'px Arial';
    ctx.fillText(t.name,t.x+t.width/2,t.y+t.height-S.s(8));
    // 硬度/属性
    ctx.fillStyle=C.neonYellow;ctx.font=S.s(8)+'px Arial';
    ctx.fillText(t.desc,t.x+t.width/2,t.y-S.s(16));
    ctx.restore();
  });
}

// ===== 起重机（优化shadow使用）=====
function drawCrane(){
  if(!crane)return;
  var cx=crane.crane.x,cy=crane.crane.y,cw=crane.crane.width,ch=crane.crane.height;
  // 轨道
  ctx.strokeStyle='rgba(0,240,255,0.08)';ctx.lineWidth=S.s(1);
  ctx.setLineDash&&ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(0,cy+ch);ctx.lineTo(canvas.width,cy+ch);ctx.stroke();
  ctx.setLineDash&&ctx.setLineDash([]);

  // 主体
  ctx.fillStyle='#2a3b5e';rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.fill();
  ctx.strokeStyle=C.neonCyan;ctx.lineWidth=S.s(1.5);
  rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.stroke();

  // 工具标签
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(9)+'px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('🧲 拆迁工具',cx,cy-S.s(2));

  // 窗
  ctx.fillStyle=hex2rgba(C.neonCyan,.3);ctx.fillRect(cx-S.s(10),cy+S.s(10),S.s(20),S.s(14));

  // 绳索
  var px=cx,py=cy+ch,mx=crane.magnet.x,my=crane.magnet.y;
  ctx.strokeStyle='rgba(0,240,255,0.4)';ctx.lineWidth=S.s(2);
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(mx,my);ctx.stroke();

  // 磁铁
  drawMag(mx,my);
}

function drawMag(mx,my){
  var grabbing=crane.isGrabbing(),r=crane.magnet.radius,ar=crane.magnet.attractRadius;
  var p=Math.sin(gs.pulse)*.3+.7;
  // 范围指示（简化：只画1圈）
  if(crane.magnet.isActive||grabbing){
    ctx.strokeStyle=hex2rgba(C.neonCyan,.08*p);ctx.lineWidth=S.s(1);
    ctx.beginPath();ctx.arc(mx,my,ar*p,0,Math.PI*2);ctx.stroke();
  }
  // U形磁铁（仅抓取时发光）
  if(grabbing){
    ctx.save();ctx.shadowColor=C.neonGreen;ctx.shadowBlur=12;
    ctx.lineWidth=S.s(5);ctx.strokeStyle=C.neonGreen;
    ctx.beginPath();ctx.arc(mx,my,r,0,Math.PI);ctx.stroke();
    ctx.beginPath();ctx.moveTo(mx-r,my);ctx.lineTo(mx-r,my-S.s(8));ctx.stroke();
    ctx.beginPath();ctx.moveTo(mx+r,my);ctx.lineTo(mx+r,my-S.s(8));ctx.stroke();
    ctx.restore();
  } else {
    ctx.lineWidth=S.s(5);ctx.strokeStyle=C.neonCyan;
    ctx.beginPath();ctx.arc(mx,my,r,0,Math.PI);ctx.stroke();
    ctx.beginPath();ctx.moveTo(mx-r,my);ctx.lineTo(mx-r,my-S.s(8));ctx.stroke();
    ctx.beginPath();ctx.moveTo(mx+r,my);ctx.lineTo(mx+r,my-S.s(8));ctx.stroke();
  }
  // 核心
  ctx.beginPath();ctx.arc(mx,my,r*.7,0,Math.PI*2);ctx.fillStyle=hex2rgba(grabbing?C.neonGreen:C.neonCyan,.2*p);ctx.fill();
  // 电弧（简化：只画1条）
  if(grabbing&&crane.magnet.grabbedBlock){
    var blk=crane.magnet.grabbedBlock;
    ctx.strokeStyle=C.neonYellow;ctx.lineWidth=S.s(1.5);
    ctx.beginPath();ctx.moveTo(mx,my+r);
    ctx.quadraticCurveTo(mx+(Math.random()-.5)*S.s(10),(my+blk.y)/2,blk.x+blk.width/2,blk.y);
    ctx.stroke();
  }
  // 抛掷轨迹预览（V3.0.8新增）
  if(grabbing){
    var av=crane.pendulum.angularVelocity;
    var tdir=av>0.01?1:(av<-0.01?-1:1);
    var tpower=Math.max(8,5+Math.abs(av)*80);
    var tvx=tdir*tpower,tvy=-8;
    var tpx=mx,tpy=my+r+S.s(4);
    ctx.fillStyle=hex2rgba(C.neonGreen,0.3);
    for(var ti=1;ti<=7;ti++){
      var dt2=ti*3;
      var px2=tpx+tvx*dt2;
      var py2=tpy+tvy*dt2+0.5*0.4*dt2*dt2;
      ctx.beginPath();ctx.arc(px2,py2,S.s(2),0,Math.PI*2);ctx.fill();
    }
  }
}

function drawParticles(){
  for(var i=0;i<particles.length;i++){
    var p=particles[i],a=p.life/p.ml;
    if(p.t==='fire'){
      // V3.1.3: 火焰粒子 - 发光方块
      ctx.save();ctx.globalAlpha=a;
      ctx.shadowColor=p.color;ctx.shadowBlur=6;
      ctx.fillStyle=hex2rgba(p.color,a);
      ctx.fillRect(p.x-p.sz*a/2,p.y-p.sz*a/2,p.sz*a,p.sz*a);
      ctx.restore();
    }else if(p.t==='debris'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot||0);
      ctx.fillStyle=hex2rgba(p.color,a);ctx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz);
      ctx.restore();
    }else{
      ctx.fillStyle=hex2rgba(p.color,a);
      ctx.beginPath();ctx.arc(p.x,p.y,p.sz*a,0,Math.PI*2);ctx.fill();
    }
  }
}

function drawFloats(){
  for(var i=0;i<floats.length;i++){
    var f=floats[i],a=f.life/(f.big?75:45);
    ctx.save();ctx.globalAlpha=Math.min(1,a*1.2);
    if(f.big){
      // V3.1.3: 大号发光文字
      ctx.shadowColor=f.c;ctx.shadowBlur=12;
      ctx.fillStyle=f.c;ctx.font='bold '+S.s(28)+'px Arial';
    }else{
      ctx.fillStyle=f.c;ctx.font='bold '+S.s(22)+'px Arial';
    }
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(f.t,f.x,f.y);
    ctx.restore();
  }
}

// ===== HUD =====
function drawHUD(){
  var th=S.s(36),ty=S.st;
  ctx.fillStyle=C.panelBg;ctx.fillRect(0,ty,canvas.width,th);
  ctx.strokeStyle=C.panelBorder;ctx.lineWidth=S.s(1);ctx.beginPath();ctx.moveTo(0,ty+th);ctx.lineTo(canvas.width,ty+th);ctx.stroke();
  var fs=S.s(14),my=ty+th/2;
  ctx.font='bold '+fs+'px Arial';ctx.textBaseline='middle';
  ctx.fillStyle=C.neonGreen;ctx.textAlign='left';ctx.fillText('分数:'+gs.score,S.sx(70),my);
  ctx.fillStyle=gs.timeLeft<=10?C.neonRed:C.neonCyan;ctx.textAlign='center';ctx.fillText(gs.timeLeft+'s',canvas.width/2,my);
  ctx.fillStyle=C.neonYellow;ctx.textAlign='right';ctx.fillText('L'+gs.currentLevel+' 目标'+gs.targetScore,canvas.width-S.sx(70),my);

  // 菜单
  var bx=S.sx(5),by2=ty+S.s(2),bw=S.s(56),bh=S.s(30);
  ctx.fillStyle='rgba(0,240,255,0.08)';rr(ctx,bx,by2,bw,bh,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.3);ctx.lineWidth=S.s(.5);rr(ctx,bx,by2,bw,bh,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('菜单',bx+bw/2,by2+bh/2);
  regBtn(bx,by2,bw,bh,function(){gs.currentScene='menu';clearTimer();gs.gameActive=false;});

  // 暂停
  var px=canvas.width-S.sx(56),py=ty+S.s(2),pw=S.s(48),ph=S.s(30);
  ctx.fillStyle='rgba(0,240,255,0.08)';rr(ctx,px,py,pw,ph,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.3);ctx.lineWidth=S.s(.5);rr(ctx,px,py,pw,ph,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';ctx.fillText(gs.gamePaused?'继续':'暂停',px+pw/2,py+ph/2);
  regBtn(px,py,pw,ph,function(){gs.gamePaused=!gs.gamePaused;});

  // 当前工具信息 + V3.1.0: 甩动/强化状态
  if(crane.isGrabbing() && crane.magnet.grabbedBlock){
    var curTool = crane.magnet.grabbedBlock;
    var toolInfo='🧲 '+curTool.name+' 硬度:'+curTool.hardness.toFixed(1);
    if(curTool._enhanced) toolInfo+=' ⚡强化';
    ctx.fillStyle=C.neonGreen;ctx.font='bold '+S.s(12)+'px Arial';ctx.textAlign='center';
    ctx.fillText(toolInfo,canvas.width/2,ty+th+S.s(14));
    // 甩动加成条
    var swBarW=S.s(120),swBarH=S.s(4),swBarX=canvas.width/2-swBarW/2,swBarY=ty+th+S.s(22);
    var swPct=Math.min(1,gs.peakSwingAV/0.5);
    ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(swBarX,swBarY,swBarW,swBarH);
    ctx.fillStyle=swPct>0.6?C.neonGreen:swPct>0.3?C.neonCyan:C.textDim;
    ctx.fillRect(swBarX,swBarY,swBarW*swPct,swBarH);
    if(swPct>0.1){ctx.fillStyle=hex2rgba(C.neonCyan,0.7);ctx.font=S.s(7)+'px Arial';ctx.textAlign='right';ctx.fillText('甩力×'+(1+gs.peakSwingAV*3).toFixed(1),swBarX+swBarW,swBarY-S.s(1));}
  }
  // V3.1.0: 强化剩余次数
  if(gs.powerUpHardness>0){
    ctx.fillStyle=C.neonGreen;ctx.font='bold '+S.s(10)+'px Arial';ctx.textAlign='left';
    ctx.fillText('⚡强化×'+gs.powerUpHardness,S.sx(10),ty+th+S.s(14));
  }

  // V3.1.4: 侧风指示器
  var lvlParams2=bg.getParamsForLevel(gs.currentLevel);
  if(lvlParams2.windForce>0){
    var windDir=frame%240<120?'→':'←';
    var windStr=windDir+(lvlParams2.windForce>0.1?'强风':'微风');
    ctx.fillStyle='#88ddff';ctx.font=S.s(10)+'px Arial';ctx.textAlign='right';
    ctx.fillText('🌬 '+windStr,canvas.width-S.sx(10),ty+th+S.s(14));
  }
  // V3.1.4: 多目标/限时机制提示
  if(lvlParams2.multiTarget){
    var aliveCount=0;for(var ai=0;ai<buildings.length;ai++){if(!buildings[ai].isDestroyed)aliveCount++;}
    ctx.fillStyle=C.neonYellow;ctx.font=S.s(9)+'px Arial';ctx.textAlign='right';
    ctx.fillText('全灭模式 剩余:'+aliveCount,canvas.width-S.sx(10),ty+th+S.s(24));
  }
  if(lvlParams2.timeBonus&&gs.timeLeft>bg.getTimeLimit(gs.currentLevel)*0.5){
    ctx.fillStyle=C.neonGreen;ctx.font=S.s(9)+'px Arial';ctx.textAlign='left';
    ctx.fillText('⏱ 限时加分中',S.sx(10),ty+th+S.s(24));
  }

  // 连击显示（V3.0.9增强）
  if(gs.combo>=2){
    var comboAlpha=0.6+Math.sin(gs.pulseTime*6)*0.4;
    ctx.save();
    ctx.fillStyle=hex2rgba(C.neonPurple,comboAlpha);ctx.font='bold '+S.s(20)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(gs.combo+'x 连击!',canvas.width/2,ty+th+S.s(26));
    // 连击倍率提示
    var comboMult=(1+gs.combo*0.25).toFixed(2);
    ctx.fillStyle=hex2rgba(C.neonYellow,comboAlpha*0.7);ctx.font=S.s(10)+'px Arial';
    ctx.fillText('×'+comboMult+' 倍率',canvas.width/2,ty+th+S.s(42));
    ctx.restore();
  }

  // 得分进度条（V3.0.9: 调整位置避免与连击重叠）
  var pbOffset=gs.combo>=2?S.s(52):S.s(30);
  var pbW=canvas.width-S.sx(20),pbH=S.s(4),pbX=S.sx(10),pbY=ty+th+pbOffset;
  var pct=gs.targetScore>0?Math.min(1,gs.score/gs.targetScore):0;
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(pbX,pbY,pbW,pbH);
  ctx.fillStyle=pct>=1?C.neonGreen:pct>=0.5?C.neonCyan:C.neonRed;
  ctx.fillRect(pbX,pbY,pbW*pct,pbH);
  if(pct<1){ctx.fillStyle=C.textDim;ctx.font=S.s(8)+'px Arial';ctx.textAlign='right';ctx.fillText(Math.floor(pct*100)+'%',pbX+pbW-S.s(3),pbY+pbH-S.s(0.5));}

  if(gs.gameActive&&!gs.gamePaused){
    var el=bg.getTimeLimit(gs.currentLevel)-gs.timeLeft;
    if(el<4){ctx.fillStyle=hex2rgba(C.neonCyan,Math.max(0,1-el/4));ctx.font=S.s(13)+'px Arial';ctx.textAlign='center';ctx.fillText('点击工具抓取 → 滑动甩动 → 释放砸向建筑！',canvas.width/2,canvas.height-S.s(18));}
  }
}

function drawPause(){
  ctx.fillStyle='rgba(5,10,30,0.85)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(32)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('游戏暂停',canvas.width/2,canvas.height/2-S.s(20));
  ctx.fillStyle=C.textDim;ctx.font=S.s(14)+'px Arial';
  ctx.fillText('点击「继续」恢复游戏',canvas.width/2,canvas.height/2+S.s(20));
}

// ===== 结算 =====
function renderGameOver(){
  ctx.fillStyle='rgba(5,10,30,0.92)';ctx.fillRect(0,0,canvas.width,canvas.height);
  var win=gs.gameResult!==null?gs.gameResult:(gs.score>=gs.targetScore); // V3.1.4: 优先用endGame传入的结果
  var cx=canvas.width/2;
  // V3.1.2: 面板高度加大到500，确保所有按钮都在框内
  var pw=S.s(310),ph=S.s(500);
  var px=(canvas.width-pw)/2,py=(canvas.height-ph)/2;
  ctx.fillStyle=C.panelBg;ctx.strokeStyle=C.panelBorder;ctx.lineWidth=S.s(1.5);
  rr(ctx,px,py,pw,ph,S.s(12));ctx.fill();rr(ctx,px,py,pw,ph,S.s(12));ctx.stroke();

  // 标题
  ctx.fillStyle=win?C.neonGreen:C.neonRed;ctx.font='bold '+S.s(28)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(win?'关卡通过!':'时间到!',cx,py+S.s(40));

  // 星级
  var starY=py+S.s(80);
  for(var si=0;si<3;si++){
    ctx.font=S.s(36)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=si<gs.stars?C.neonYellow:C.textDim;
    ctx.fillText(si<gs.stars?'★':'☆',cx-S.s(36)+si*S.s(36),starY);
  }

  // 得分信息
  var infoY=py+S.s(120);
  ctx.fillStyle=C.textMain;ctx.font='bold '+S.s(22)+'px Arial';ctx.textAlign='center';
  ctx.fillText('得分: '+gs.score,cx,infoY);
  ctx.fillStyle=C.textDim;ctx.font=S.s(15)+'px Arial';
  ctx.fillText('目标: '+gs.targetScore,cx,infoY+S.s(28));

  // 进度条
  var barY=infoY+S.s(46),barW=S.s(220),barH=S.s(10);
  var barX=cx-barW/2;
  var pct=gs.targetScore>0?Math.min(1.5,gs.score/gs.targetScore):0;
  ctx.fillStyle='rgba(0,0,0,0.4)';rr(ctx,barX,barY,barW,barH,S.s(5));ctx.fill();
  ctx.fillStyle=pct>=1?C.neonGreen:pct>=0.7?C.neonCyan:C.neonRed;
  rr(ctx,barX,barY,Math.min(barW,barW*pct),barH,S.s(5));ctx.fill();

  // 关卡+连击
  var mc=getMechanicForLevel(gs.currentLevel);
  ctx.fillStyle=mc.color;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';
  ctx.fillText('L'+gs.currentLevel+' ['+mc.name+'] '+mc.desc,cx,infoY+S.s(68));
  if(gs.maxCombo>0){
    ctx.fillStyle=C.neonPurple;ctx.font='bold '+S.s(14)+'px Arial';
    ctx.fillText('最高连击: '+gs.maxCombo+'x',cx,infoY+S.s(90));
  }

  // 按钮区 — 紧凑布局，3行按钮
  var btnBaseY=py+ph-S.s(175);
  var bw2=S.s(130),bh2=S.s(44);

  // 第1行：重玩 + 下一关/再试
  drawNeonBtn(cx-bw2-S.s(6),btnBaseY,bw2,bh2,'重玩',C.neonOrange);
  regBtn(cx-bw2-S.s(6),btnBaseY,bw2,bh2,function(){loadLevel(gs.currentLevel);});
  if(win&&gs.currentLevel<1000){
    drawNeonBtn(cx+S.s(6),btnBaseY,bw2,bh2,'下一关 ▶',C.neonGreen);
    regBtn(cx+S.s(6),btnBaseY,bw2,bh2,function(){gs.currentLevel++;loadLevel(gs.currentLevel);});
  }else{
    drawNeonBtn(cx+S.s(6),btnBaseY,bw2,bh2,'再试',C.neonRed);
    regBtn(cx+S.s(6),btnBaseY,bw2,bh2,function(){loadLevel(gs.currentLevel);});
  }

  // 第2行：返回主菜单
  var row2Y=btnBaseY+bh2+S.s(10);
  drawNeonBtn(cx-bw2/2,row2Y,bw2,bh2,'返回主菜单',C.textDim);
  regBtn(cx-bw2/2,row2Y,bw2,bh2,function(){gs.currentScene='menu';});

  // 第3行：关卡选择
  var row3Y=row2Y+bh2+S.s(10);
  drawNeonBtn(cx-bw2/2,row3Y,bw2,bh2,'关卡选择',C.neonCyan);
  regBtn(cx-bw2/2,row3Y,bw2,bh2,function(){gs.levelPage=Math.floor((progress.highestLevel-1)/20);gs.currentScene='levelselect';});

  // NPC
  drawNPC(px+S.s(5),py+S.s(5),S.s(40));
}

// ===== 关卡选择（全新UI）=====
function renderLevelSel(){
  // 背景
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  drawGridLines(0.02);
  drawCachedStars();
  drawScanLine(0.03);
  drawNeonBorder();

  // 标题
  ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(24)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('关卡选择',canvas.width/2,S.safY(35));

  // 版本
  ctx.fillStyle=C.textDim;ctx.font=S.s(9)+'px Arial';ctx.textAlign='right';
  ctx.fillText('V'+VERSION,canvas.width-S.sx(8),S.safY(8));

  // 当前机制
  var curMc=getMechanicForLevel(progress.highestLevel);
  ctx.fillStyle=curMc.color;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';
  ctx.fillText('已解锁: L'+progress.highestLevel+' ['+curMc.name+'] '+curMc.desc,canvas.width/2,S.safY(58));

  // 关卡网格 - 5列4行
  var cols=5,rows=4,perPage=cols*rows;
  var totalPage=Math.ceil(1000/perPage);
  var page=gs.levelPage;
  if(page<0)page=0;if(page>=totalPage)page=totalPage-1;gs.levelPage=page;

  // V3.0.9: 自适应格子大小，确保网格不超出屏幕
  var availW=canvas.width-S.sx(20); // 两侧各留10
  var cellW=Math.min(S.s(58),Math.floor((availW-(cols-1)*S.s(6))/cols));
  var cellH=cellW; // 正方形格子
  var gapX=Math.max(S.s(4),Math.floor((availW-cols*cellW)/(cols-1)));
  var gapY=S.s(6);
  var gridW=cols*cellW+(cols-1)*gapX;
  var startX=(canvas.width-gridW)/2;
  var startY=S.safY(78);

  for(var r=0;r<rows;r++){
    for(var c=0;c<cols;c++){
      var idx=r*cols+c;
      var lv=page*perPage+idx+1;
      if(lv>1000)continue;

      var x=startX+c*(cellW+gapX);
      var y=startY+r*(cellH+gapY);
      var unlocked=progress.isUnlocked(lv);
      var stars=progress.getStars(lv);
      var mc=getMechanicForLevel(lv);

      if(unlocked){
        // 科技感卡片
        ctx.fillStyle=hex2rgba(mc.color,0.08);
        rr(ctx,x,y,cellW,cellH,S.s(8));ctx.fill();

        // 新玩法标记 - 顶部彩条
        if(lv===mc.level){
          ctx.fillStyle=mc.color;
          rr(ctx,x,y,cellW,S.s(4),S.s(3));ctx.fill();
        }

        // 边框
        ctx.strokeStyle=hex2rgba(mc.color,0.4+Math.sin(gs.pulseTime*2)*0.1);
        ctx.lineWidth=S.s(1);
        rr(ctx,x,y,cellW,cellH,S.s(8));ctx.stroke();

        // 关卡号
        ctx.fillStyle=C.textMain;ctx.font='bold '+S.s(17)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(lv,x+cellW/2,y+cellH/2-S.s(3));

        // 星级
        if(stars>0){
          ctx.fillStyle=C.neonYellow;ctx.font=S.s(9)+'px Arial';ctx.textAlign='center';
          var starStr='';for(var si=0;si<stars;si++)starStr+='★';
          ctx.fillText(starStr,x+cellW/2,y+cellH-S.s(6));
        }else{
          // 未通关但已解锁 - 小点
          ctx.fillStyle=C.textDim;ctx.font=S.s(8)+'px Arial';ctx.textAlign='center';
          ctx.fillText('●',x+cellW/2,y+cellH-S.s(6));
        }

        (function(lvNum){regBtn(x,y,cellW,cellH,function(){gs.currentLevel=lvNum;loadLevel(lvNum);});})(lv);
      } else {
        // 锁定
        ctx.fillStyle='rgba(20,25,45,0.6)';
        rr(ctx,x,y,cellW,cellH,S.s(8));ctx.fill();
        ctx.strokeStyle='rgba(60,70,100,0.2)';
        ctx.lineWidth=S.s(1);
        rr(ctx,x,y,cellW,cellH,S.s(8));ctx.stroke();
        ctx.fillStyle='rgba(100,110,140,0.4)';ctx.font=S.s(16)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('🔒',x+cellW/2,y+cellH/2);
      }
    }
  }

  // 页码 + 翻页
  var navY=startY+rows*(cellH+gapY)+S.s(6);

  // 翻页 - 紧凑居中排列 ◀ 页码 ▶
  var navY=startY+rows*(cellH+gapY)+S.s(8);
  var navBtnSize=S.s(42);
  var pageW=S.s(100);
  var totalNavW=navBtnSize+pageW+navBtnSize;
  var navStartX=(canvas.width-totalNavW)/2;

  // 页码背景
  ctx.fillStyle='rgba(20,25,45,0.5)';
  rr(ctx,navStartX+navBtnSize,navY,pageW,S.s(36),S.s(4));ctx.fill();
  ctx.fillStyle=C.textMain;ctx.font=S.s(13)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText((page+1)+' / '+totalPage,navStartX+navBtnSize+pageW/2,navY+S.s(18));

  if(page>0){
    drawNeonBtn(navStartX,navY,navBtnSize,S.s(36),'◀',C.neonCyan);
    regBtn(navStartX,navY,navBtnSize,S.s(36),function(){gs.levelPage--;});
  }
  if(page<totalPage-1){
    drawNeonBtn(navStartX+navBtnSize+pageW,navY,navBtnSize,S.s(36),'▶',C.neonCyan);
    regBtn(navStartX+navBtnSize+pageW,navY,navBtnSize,S.s(36),function(){gs.levelPage++;});
  }

  // 快捷跳转
  var jumpY=navY+S.s(36)+S.s(10);
  var jumpW=S.s(180),jumpH=S.s(34);
  drawNeonBtn((canvas.width-jumpW)/2,jumpY,jumpW,jumpH,'跳到最新 L'+progress.highestLevel,C.neonGreen);
  regBtn((canvas.width-jumpW)/2,jumpY,jumpW,jumpH,function(){gs.levelPage=Math.floor((progress.highestLevel-1)/perPage);});

  // 返回
  var backY=canvas.height-S.sb-S.s(55);
  var backW=S.s(250);
  drawNeonBtn((canvas.width-backW)/2,backY,backW,S.s(46),'返回主菜单',C.neonRed);
  regBtn((canvas.width-backW)/2,backY,backW,S.s(46),function(){gs.currentScene='menu';});
}

// ===== 排行榜 =====
function renderLB(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  drawCachedStars();drawNeonBorder();

  ctx.fillStyle=C.neonYellow;ctx.font='bold '+S.s(24)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('排行榜',canvas.width/2,S.safY(35));

  // Tab: 好友排行 | 我的排行
  var tabW=S.s(120),tabH=S.s(36),tabY=S.safY(60),tabCx=canvas.width/2;
  // 好友
  ctx.fillStyle=gs.lbTab==='friend'?hex2rgba(C.neonCyan,0.15):'rgba(20,25,45,0.5)';
  rr(ctx,tabCx-tabW-S.s(3),tabY,tabW,tabH,S.s(6));ctx.fill();
  ctx.strokeStyle=gs.lbTab==='friend'?C.neonCyan:'rgba(60,70,100,0.3)';
  ctx.lineWidth=gs.lbTab==='friend'?S.s(1.5):S.s(1);
  rr(ctx,tabCx-tabW-S.s(3),tabY,tabW,tabH,S.s(6));ctx.stroke();
  ctx.fillStyle=gs.lbTab==='friend'?C.neonCyan:C.textDim;
  ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('好友排行',tabCx-tabW/2-S.s(3),tabY+tabH/2);
  regBtn(tabCx-tabW-S.s(3),tabY,tabW,tabH,function(){gs.lbTab='friend';loadFriendScores();});

  // 我的排行
  ctx.fillStyle=gs.lbTab==='world'?hex2rgba(C.neonYellow,0.15):'rgba(20,25,45,0.5)';
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.fill();
  ctx.strokeStyle=gs.lbTab==='world'?C.neonYellow:'rgba(60,70,100,0.3)';
  ctx.lineWidth=gs.lbTab==='world'?S.s(1.5):S.s(1);
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.stroke();
  ctx.fillStyle=gs.lbTab==='world'?C.neonYellow:C.textDim;
  ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='center';
  ctx.fillText('我的排行',tabCx+tabW/2+S.s(3),tabY+tabH/2);
  regBtn(tabCx+S.s(3),tabY,tabW,tabH,function(){gs.lbTab='world';loadWorldScores();});

  var listY=tabY+tabH+S.s(12),itemH=S.s(40);

  if(gs.lbTab==='friend'){
    // 好友排行 - V3.0.9: 优先显示本地历史记录+开放数据域
    var hasLocalData = gs.friendScores && gs.friendScores.length > 0 && gs.friendScores[0].score > 0;

    if(hasLocalData){
      // 表头 — V3.1.3: 排名/名称/关卡/得分
      ctx.fillStyle=C.textDim;ctx.font='bold '+S.s(11)+'px Arial';ctx.textAlign='left';
      ctx.fillText('排名',S.sx(18),listY);
      ctx.fillText('名称',S.sx(55),listY);
      ctx.textAlign='center';
      ctx.fillText('关卡',canvas.width-S.sx(85),listY);
      ctx.textAlign='right';
      ctx.fillText('得分',canvas.width-S.sx(12),listY);

      var medals = ['🥇','🥈','🥉'];
      // V3.1.3: 按人名+关卡去重，保留最高分
      var uniqueScores=[];
      var seenKey={};
      for(var fi=0;fi<gs.friendScores.length;fi++){
        var key=(gs.friendScores[fi].name||'')+'_'+gs.friendScores[fi].level;
        if(!seenKey[key]){
          seenKey[key]=uniqueScores.length;
          uniqueScores.push(gs.friendScores[fi]);
        }else{
          // 已有此人此关卡记录，保留高分
          if(gs.friendScores[fi].score>uniqueScores[seenKey[key]].score){
            uniqueScores[seenKey[key]]=gs.friendScores[fi];
          }
        }
      }
      uniqueScores.sort(function(a,b){return b.score-a.score;});

      for(var i=0;i<Math.min(uniqueScores.length,15);i++){
        var iy=listY+S.s(16)+i*itemH;
        var d=uniqueScores[i];
        // 行背景
        ctx.fillStyle=d.isMe?'rgba(0,255,136,0.06)':(i%2===0?'rgba(20,25,45,0.3)':'rgba(10,15,35,0.2)');
        ctx.fillRect(S.sx(15),iy,canvas.width-S.sx(30),itemH-S.s(4));

        // 排名
        ctx.fillStyle=i<3?['#FFD700','#C0C0C0','#CD7F32'][i]:C.textDim;
        ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(i<3?medals[i]:(i+1)+'.',S.sx(18),iy+itemH/2-S.s(2));

        // V3.1.3: 名称
        ctx.fillStyle=d.isMe?C.neonGreen:C.textMain;ctx.font=S.s(13)+'px Arial';ctx.textAlign='left';
        var dispName=(d.name||'?');
        if(dispName.length>5)dispName=dispName.substring(0,5)+'..';
        ctx.fillText(dispName,S.sx(55),iy+itemH/2-S.s(2));

        // 关卡
        ctx.fillStyle=C.textMain;ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';
        ctx.fillText('L'+(d.level||'?'),canvas.width-S.sx(85),iy+itemH/2-S.s(2));

        // 分数
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';ctx.font='bold '+S.s(14)+'px Arial';
        ctx.fillText((d.score||0)+'分',canvas.width-S.sx(12),iy+itemH/2-S.s(2));
      }
    }

    // 尝试绘制开放数据域画布（覆盖在本地数据之上）
    if(openDataContext){
      try{
        var sharedCanvas=openDataContext.canvas;
        if(sharedCanvas){
          ctx.drawImage(sharedCanvas,0,listY,canvas.width,canvas.height-listY-S.s(80));
        }
      }catch(e){}
    }

    // 如果没有本地数据也没有开放数据域数据
    if(!hasLocalData&&(!openDataContext||!openDataContext.canvas)){
      ctx.fillStyle=C.textDim;ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';
      ctx.fillText('还没有分数记录',canvas.width/2,listY+S.s(40));
      ctx.fillText('完成关卡后分数将自动上传',canvas.width/2,listY+S.s(65));
      ctx.fillStyle=hex2rgba(C.neonCyan,0.3);ctx.font=S.s(12)+'px Arial';
      ctx.fillText('邀请好友一起玩，排名更精彩！',canvas.width/2,listY+S.s(95));
    }
  }else{
    // 我的排行 - V3.1.3: 显示真实历史数据（含人名）
    if(!gs.worldScores||!gs.worldScores.length)loadWorldScores();
    if(gs.worldScores.length>0){
      // 表头
      ctx.fillStyle=C.textDim;ctx.font='bold '+S.s(11)+'px Arial';ctx.textAlign='left';
      ctx.fillText('排名',S.sx(18),listY);
      ctx.fillText('名称',S.sx(55),listY);
      ctx.textAlign='center';
      ctx.fillText('关卡',canvas.width-S.sx(100),listY);
      ctx.fillText('星级',canvas.width-S.sx(55),listY);
      ctx.textAlign='right';
      ctx.fillText('得分',canvas.width-S.sx(12),listY);

      for(var i=0;i<Math.min(gs.worldScores.length,15);i++){
        var iy=listY+S.s(16)+i*itemH;
        var d=gs.worldScores[i];
        // 行背景
        ctx.fillStyle=i%2===0?'rgba(20,25,45,0.3)':'rgba(10,15,35,0.2)';
        ctx.fillRect(S.sx(15),iy,canvas.width-S.sx(30),itemH-S.s(4));

        // 排名
        ctx.fillStyle=C.textDim;ctx.font='bold '+S.s(13)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText((i+1)+'.',S.sx(18),iy+itemH/2-S.s(2));

        // V3.1.3: 名称
        ctx.fillStyle=C.neonGreen;ctx.font=S.s(13)+'px Arial';ctx.textAlign='left';
        var wName=(d.name||'我');
        if(wName.length>5)wName=wName.substring(0,5)+'..';
        ctx.fillText(wName,S.sx(55),iy+itemH/2-S.s(2));

        // 关卡
        ctx.fillStyle=C.textMain;ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';
        ctx.fillText('L'+(d.level||'?'),canvas.width-S.sx(100),iy+itemH/2-S.s(2));

        // 星级
        var starStr='';
        for(var si=0;si<(d.stars||0);si++)starStr+='★';
        ctx.fillStyle=C.neonYellow;ctx.font=S.s(12)+'px Arial';
        ctx.fillText(starStr||'—',canvas.width-S.sx(55),iy+itemH/2-S.s(2));

        // 分数
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';ctx.font='bold '+S.s(14)+'px Arial';
        ctx.fillText((d.score||0)+'分',canvas.width-S.sx(12),iy+itemH/2-S.s(2));
      }
    }else{
      ctx.fillStyle=C.textDim;ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';
      ctx.fillText('还没有通关记录',canvas.width/2,listY+S.s(60));
      ctx.fillStyle=hex2rgba(C.neonGreen,0.3);ctx.font=S.s(12)+'px Arial';
      ctx.fillText('去打几关再来查看吧！',canvas.width/2,listY+S.s(85));
    }
  }

  var bw=S.s(250),backY=canvas.height-S.sb-S.s(55);
  drawNeonBtn((canvas.width-bw)/2,backY,bw,S.s(46),'返回主菜单',C.neonRed);
  regBtn((canvas.width-bw)/2,backY,bw,S.s(46),function(){gs.currentScene='menu';});
}

// ===== 玩法说明 =====
function renderHelp(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  drawCachedStars();drawScanLine(0.02);drawNeonBorder();

  ctx.fillStyle=C.neonPurple;ctx.font='bold '+S.s(24)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('玩法说明',canvas.width/2,S.safY(35));

  var t=['▸ 点击拆迁工具 → 磁铁抓住','▸ 左右滑动 → 甩动蓄力','▸ 再次点击 → 释放砸向建筑','▸ 不同工具硬度不同，得分不同','▸ 正面撞击比侧面得分更高','▸ 连续破坏 → 连击加成！','▸ 建筑下方支撑被毁 → 倒塌','▸ 工具落地后自动回到原位'];
  ctx.fillStyle=C.textMain;ctx.font=S.s(13)+'px Arial';ctx.textAlign='left';
  for(var i=0;i<t.length;i++)ctx.fillText(t[i],S.sx(25),S.safY(70)+i*S.s(26));

  var mcY=S.safY(70)+t.length*S.s(26)+S.s(8);
  ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(13)+'px Arial';ctx.textAlign='left';
  ctx.fillText('【每10关解锁新玩法】',S.sx(25),mcY);
  mcY+=S.s(22);
  var showCount=Math.min(MECHANICS.length,8);
  for(var mi=0;mi<showCount;mi++){
    var m=MECHANICS[mi];
    ctx.fillStyle=m.color;ctx.font=S.s(11)+'px Arial';ctx.textAlign='left';
    ctx.fillText('L'+m.level+': '+m.name+' — '+m.desc,S.sx(30),mcY+mi*S.s(18));
  }

  drawNPC(canvas.width-S.s(60),mcY+S.s(20),S.s(50));

  var bw=S.s(250),backY=canvas.height-S.sb-S.s(55);
  drawNeonBtn((canvas.width-bw)/2,backY,bw,S.s(46),'返回主菜单',C.neonRed);
  regBtn((canvas.width-bw)/2,backY,bw,S.s(46),function(){gs.currentScene='menu';});
}

// ===== NPC绘制 =====
function drawNPC(x,y,sz){
  ctx.save();var cx=x+sz*.4,s=sz;
  ctx.fillStyle='#FF6B9D';ctx.beginPath();ctx.ellipse(cx,y+s*.22,s*.28,s*.28,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(cx-s*.25,y+s*.2);ctx.quadraticCurveTo(cx-s*.35,y+s*.55,cx-s*.2,y+s*.85);ctx.quadraticCurveTo(cx-s*.12,y+s*.85,cx-s*.15,y+s*.4);ctx.fill();
  ctx.beginPath();ctx.moveTo(cx+s*.25,y+s*.2);ctx.quadraticCurveTo(cx+s*.35,y+s*.55,cx+s*.2,y+s*.85);ctx.quadraticCurveTo(cx+s*.12,y+s*.85,cx+s*.15,y+s*.4);ctx.fill();
  ctx.fillStyle='#FFD5B8';ctx.beginPath();ctx.ellipse(cx,y+s*.28,s*.2,s*.2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FF6B9D';ctx.beginPath();ctx.moveTo(cx-s*.22,y+s*.15);ctx.quadraticCurveTo(cx,y+s*.05,cx+s*.22,y+s*.15);ctx.quadraticCurveTo(cx+s*.18,y+s*.22,cx-s*.18,y+s*.22);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.27,s*.06,s*.07,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4FC3F7';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.28,s*.04,s*.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(cx-s*.08,y+s*.29,s*.02,s*.03,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx-s*.06,y+s*.26,s*.012,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.27,s*.06,s*.07,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4FC3F7';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.28,s*.04,s*.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(cx+s*.08,y+s*.29,s*.02,s*.03,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx+s*.1,y+s*.26,s*.012,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#E88B8B';ctx.lineWidth=S.s(1.5);ctx.beginPath();ctx.arc(cx,y+s*.35,s*.035,0.1,Math.PI-.1);ctx.stroke();
  ctx.fillStyle='rgba(255,150,150,0.25)';ctx.beginPath();ctx.ellipse(cx-s*.14,y+s*.32,s*.03,s*.018,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx+s*.14,y+s*.32,s*.03,s*.018,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9B59B6';ctx.beginPath();ctx.moveTo(cx-s*.12,y+s*.42);ctx.quadraticCurveTo(cx-s*.2,y+s*.7,cx-s*.18,y+s*.95);ctx.lineTo(cx+s*.18,y+s*.95);ctx.quadraticCurveTo(cx+s*.2,y+s*.7,cx+s*.12,y+s*.42);ctx.fill();
  ctx.restore();
}

function drawBubble(x,y,mw,text){
  if(!text)return;ctx.save();var fs=S.s(12);ctx.font=fs+'px Arial';
  var lines=[],line='';
  for(var i=0;i<text.length;i++){var tl=line+text[i];if(ctx.measureText(tl).width>mw-S.s(20)){lines.push(line);line=text[i];}else line=tl;}
  if(line)lines.push(line);
  var lh=fs+S.s(4),bh=lines.length*lh+S.s(14),bw=mw;
  var a=Math.min(1,gs.npcTimer/30);
  ctx.fillStyle='rgba(20,15,50,'+(0.9*a)+')';rr(ctx,x,y,bw,bh,S.s(8));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonPurple,.5*a);ctx.lineWidth=S.s(1);rr(ctx,x,y,bw,bh,S.s(8));ctx.stroke();
  ctx.fillStyle=hex2rgba(C.textMain,a);ctx.font=fs+'px Arial';ctx.textAlign='left';ctx.textBaseline='top';
  for(var li=0;li<lines.length;li++)ctx.fillText(lines[li],x+S.s(10),y+S.s(7)+li*lh);
  ctx.restore();
}

init();
