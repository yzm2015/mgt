/**
 * 磁吸拆迁队 V3.0.2
 * 版本规则：每次+0.0.1，逢十进一
 *
 * V3.0.2 更新：
 * - 微信自动登录 + 授权回退
 * - 性能全面优化（对象池/shadowBlur/离屏Canvas/首屏加速）
 * - 科技感动画（扫描线/脉冲/磁力场/拖尾）
 * - 关卡选择UI重做（圆角卡片/滑动翻页/兼容刘海屏）
 * - 玩法效果增强（慢动作/震屏升级/连击特效）
 * - 用户粘性（每日奖励/成就系统/连续登录）
 */

var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

var VERSION = '3.0.3';

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
  currentLevel: 1, targetScore: 500, stars: 0, currentScene: 'menu',
  shake: 0, shakeX: 0, shakeY: 0, combo: 0, comboTimer: 0,
  flash: 0, pulse: 0, npcText: '', npcTimer: 0, npcQueue: [],
  userInfo: null, loggedIn: false, loginRetries: 0,
  levelPage: 0, levelScrollX: 0,
  lbTab: 'friend', friendScores: [], worldScores: [],
  // 动画状态
  scanY: 0, pulseTime: 0, menuAnim: 0, slowMo: 0, slowMoFactor: 1,
  // 每日奖励
  dailyReward: false, loginStreak: 0, lastLoginDate: '',
  // 成就
  totalDestroys: 0, maxCombo: 0, totalScore: 0
};

// ===== 对象池（减少GC压力）=====
var Pool = {
  particles: [],
  floats: [],
  getParticle: function(){ return this.particles.length>0?this.particles.pop():{}; },
  recycleParticle: function(p){ p.x=0;p.y=0;p.vx=0;p.vy=0;p.life=0;p.color=null; this.particles.push(p); },
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

// ===== 玩法机制 =====
var MECHANICS = [
  { level:1, id:'basic', name:'基础', desc:'木质+砖块建筑', color:C.neonCyan },
  { level:11, id:'explosive', name:'爆破', desc:'解锁TNT炸药方块', color:C.neonRed },
  { level:21, id:'ice', name:'冰封', desc:'解锁冰块', color:C.ice.glow },
  { level:31, id:'rubber', name:'弹力', desc:'解锁橡胶块', color:C.rubber.glow },
  { level:41, id:'steel', name:'钢铁', desc:'解锁钢块', color:C.steel.glow },
  { level:51, id:'chain', name:'连锁', desc:'连锁爆炸', color:C.neonOrange },
  { level:61, id:'wind', name:'风暴', desc:'侧风干扰', color:'#88ddff' },
  { level:71, id:'timed', name:'限时', desc:'时间奖励', color:C.neonGreen },
  { level:81, id:'multi', name:'多目标', desc:'多建筑摧毁', color:C.neonYellow },
  { level:91, id:'boss', name:'BOSS', desc:'超级BOSS', color:C.neonPurple },
  { level:101, id:'desert', name:'沙漠', desc:'沙漠主题', color:'#F4A460' },
  { level:151, id:'pyramid', name:'金字塔', desc:'金字塔BOSS', color:'#DAA520' },
  { level:201, id:'snow', name:'雪地', desc:'雪地主题', color:'#F0F8FF' },
  { level:251, id:'frost', name:'霜冻', desc:'霜冻BOSS', color:'#00CED1' },
  { level:301, id:'space', name:'太空', desc:'太空主题', color:'#191970' },
  { level:351, id:'blackhole', name:'黑洞', desc:'黑洞BOSS', color:'#483D8B' },
  { level:401, id:'volcano', name:'火山', desc:'火山主题', color:'#FF4500' },
  { level:451, id:'magma', name:'岩浆', desc:'岩浆BOSS', color:'#DC143C' },
  { level:501, id:'neon', name:'霓虹', desc:'霓虹主题', color:C.neonCyan },
  { level:551, id:'virus', name:'病毒', desc:'病毒扩散', color:'#32CD32' },
  { level:601, id:'ruins', name:'废墟', desc:'废墟高级', color:'#8B7355' },
  { level:701, id:'permafrost', name:'永冻', desc:'永冻高级', color:'#B0E0E6' },
  { level:801, id:'wormhole', name:'虫洞', desc:'虫洞高级', color:'#4169E1' },
  { level:901, id:'inferno', name:'炼狱', desc:'全机制融合', color:'#FF0000' }
];

function getMechanicForLevel(lv) {
  var r = MECHANICS[0];
  for (var i = 0; i < MECHANICS.length; i++) { if (lv >= MECHANICS[i].level) r = MECHANICS[i]; }
  return r;
}

var canvas, ctx, physics, crane, bg, audio;
var buildings = [], particles = [], floats = [];
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
  if (openDataContext) {
    try { openDataContext.postMessage({ action: 'getFriendRank' }); } catch(e) {}
  }
  try { var d=wx.getStorageSync('leaderboard'); if(d)gs.friendScores=JSON.parse(d); } catch(e) {}
}

function loadWorldScores() {
  try { var d=wx.getStorageSync('worldLeaderboard'); if(d){gs.worldScores=JSON.parse(d);return;} } catch(e) {}
  var names=['拆迁大王','破坏神','磁力大师','建筑克星','闪电手','拆迁新人','铁锤达人','爆破专家','拆迁队长','重力使者',
             '连锁反应','甩飞高手','连击之王','精准打击','速通达人','磁铁之心','钢铁破坏','冰封拆迁','弹力天王','火焰终结'];
  gs.worldScores=[];
  for(var i=0;i<20;i++){gs.worldScores.push({name:names[i],score:Math.floor(10000-i*400+Math.random()*200),level:Math.min(1000,900-i*40)});}
  gs.worldScores.sort(function(a,b){return b.score-a.score;});
  try{wx.setStorageSync('worldLeaderboard',JSON.stringify(gs.worldScores));}catch(e){}
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
    step1:['第一步：点击方块抓取'],
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

// ===== 每帧更新 =====
function update() {
  crane.update();
  bg.update(physics);
  checkFlyingHits();
  checkFloatingBlocks();
  checkGameEnd();
}

// ===== 飞行撞击检测 =====
function checkFlyingHits() {
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed||b.isGrabbed) continue;
    var spd=Math.sqrt(b.velocityX*b.velocityX+b.velocityY*b.velocityY);
    if(spd<2) continue;
    for(var j=0;j<buildings.length;j++){
      if(i===j) continue;
      var t=buildings[j];
      if(t.isDestroyed||t.isGrabbed) continue;
      var tSpd=Math.sqrt(t.velocityX*t.velocityX+t.velocityY*t.velocityY);
      if(tSpd>2) continue;
      if(b.x<t.x+t.width && b.x+b.width>t.x && b.y<t.y+t.height && b.y+b.height>t.y){
        var impactForce = spd * b.mass * 8;
        var dmg = impactForce / t.mass * 0.5;
        t.health -= dmg;
        var cx=t.x+t.width/2, cy=t.y+t.height/2;
        gs.shake=Math.min(20,impactForce*0.25);
        audio.playSound(SoundNames.CRASH);
        spawnSparks(cx,cy,t.color||C.neonOrange,6);
        if(t.health<=0){
          t.health=0; t.isDestroyed=true;
          var pts=t.score||10;
          gs.combo++; gs.comboTimer=90;
          if(gs.combo>1) pts=Math.floor(pts*(1+gs.combo*0.15));
          gs.score+=pts;
          gs.totalDestroys++;
          if(gs.combo>gs.maxCombo) gs.maxCombo=gs.combo;
          gs.totalScore+=pts;
          gs.flash=0.15;

          // 慢动作（高连击时触发）
          if(gs.combo>=3) gs.slowMo=8;

          spawnDebris(cx,cy,t.color||C.neonOrange,8);
          spawnSparks(cx,cy,C.neonYellow,6);
          addFloat(cx,cy,'+'+pts,gs.combo>1?C.neonYellow:C.neonGreen);

          // 连击特效
          if(gs.combo>=3){
            addFloat(cx,cy-S.s(25),gs.combo+'x COMBO!',C.neonPurple);
            gs.shake=Math.min(30,gs.combo*5);
          }

          audio.playSound(SoundNames.DESTROY);
          NPC.show(NPC.say(gs.combo>2?'combo':'hit'),60);

          if(t.explosive){
            gs.shake=30;gs.flash=0.4;
            spawnDebris(cx,cy,C.neonRed,12);spawnSparks(cx,cy,C.neonYellow,10);
            for(var k=0;k<buildings.length;k++){var bk=buildings[k];if(bk.isDestroyed||bk===t)continue;
              var dx2=(bk.x+bk.width/2)-cx,dy2=(bk.y+bk.height/2)-cy;
              if(Math.sqrt(dx2*dx2+dy2*dy2)<120){bk.health-=40;if(bk.health<=0){bk.health=0;bk.isDestroyed=true;gs.score+=bk.score||10;spawnDebris(bk.x+bk.width/2,bk.y+bk.height/2,bk.color||C.neonRed,4);}}
            }
          }
          addCollapse(t);
        }
        b.velocityX *= -0.3;
        b.velocityY *= -0.3;
        break;
      }
    }
  }
}

// ===== 悬空检测 =====
function checkFloatingBlocks() {
  var groundY = canvas.height - S.s(50);
  for(var i=0;i<buildings.length;i++){
    var b=buildings[i];
    if(b.isDestroyed||b.isGrabbed) continue;
    if(b.velocityY>1) continue;
    var supported = (b.y + b.height >= groundY - 2);
    if(!supported){
      for(var j=0;j<buildings.length;j++){
        if(i===j||buildings[j].isDestroyed||buildings[j].isGrabbed) continue;
        if(b.x+b.width>buildings[j].x+2 && b.x<buildings[j].x+buildings[j].width-2){
          if(Math.abs((b.y+b.height)-buildings[j].y)<3){supported=true;break;}
        }
      }
    }
    if(!supported) b.velocityY = 1;
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
      if(crane.magnet.isGrabbing) crane.pendulum.angularVelocity+=dx*0.004;
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
      var block=crane.releaseMagnet();
      if(block){
        var throwX=crane.pendulum.angularVelocity*100;
        var throwY=-10;
        block.velocityX=throwX/block.mass;
        block.velocityY=throwY/block.mass;
        block.isGrabbed=false;
        audio.playSound(SoundNames.RELEASE);
        spawnSparks(block.x+block.width/2,block.y,C.neonCyan,4);
        NPC.show(NPC.say('swing'),60);
      }
    } else {
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
        best.x=crane.magnet.x-best.width/2;
        best.y=crane.magnet.y+crane.magnet.radius+4;
        crane.crane.x=crane.magnet.x;
        crane.pendulum.angle=0;crane.pendulum.angularVelocity=0;
        best.velocityX=0;best.velocityY=0;
        audio.playSound(SoundNames.GRAB);
        spawnSparks(crane.magnet.x,crane.magnet.y,C.neonPurple,5);
        NPC.show(NPC.say('grab'),60);
      } else {
        NPC.show('点击方块抓取，甩出去砸建筑！',100);
      }
    }
  }
}

// ===== 关卡加载 =====
function loadLevel(lv){
  if(lv<1)lv=1;if(lv>1000)lv=1000;
  if(!progress.isUnlocked(lv)){NPC.show('关卡未解锁！',90);return;}
  clearTimer();
  buildings=bg.generateLevel(lv);
  // 方块尺寸由BuildingGenerator控制，不再强制放大
  // 确保方块有合理的最小尺寸
  buildings.forEach(function(b){
    if(b.width<20)b.width=20;
    if(b.height<20)b.height=20;
  });
  gs.currentLevel=lv;
  gs.targetScore=bg.getTargetScore(lv);gs.timeLeft=bg.getTimeLimit(lv);
  gs.score=0;gs.gameActive=true;gs.gamePaused=false;gs.currentScene='game';
  gs.combo=0;gs.comboTimer=0;gs.slowMo=0;
  // 清空粒子（复用对象池）
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
  if(gs.timeLeft<=10&&gs.timeLeft>0){try{wx.vibrateShort();}catch(e){}audio.playSound(SoundNames.WARNING);if(gs.timeLeft<=5)NPC.show(NPC.say('lowtime'),60);}
  if(gs.timeLeft<=0){gs.timeLeft=0;endGame(false);}
},1000);}

function checkGameEnd(){if(gs.score>=gs.targetScore)endGame(true);}
function endGame(win){
  gs.gameActive=false;clearTimer();
  var pct=gs.targetScore>0?gs.score/gs.targetScore:0;
  gs.stars=pct>=1?3:pct>=.8?2:pct>=.5?1:0;
  if(win||gs.stars>0){
    progress.complete(gs.currentLevel,gs.stars,gs.score);
    saveToCloud(gs.currentLevel,gs.score);
  }
  if(win)saveLB(gs.currentLevel,gs.score);
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
  ctx.fillStyle = hex2rgba(C.neonCyan, alpha || 0.03);
  ctx.fillRect(0, gs.scanY, canvas.width, 2);
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
  ctx.strokeStyle = hex2rgba(C.neonCyan, alpha || 0.04);
  ctx.lineWidth = S.s(0.5);
  var spacing = S.s(40);
  for (var x = 0; x < canvas.width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (var y = 0; y < canvas.height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function drawNeonBorder() {
  ctx.strokeStyle = hex2rgba(C.neonCyan, 0.15 + Math.sin(gs.pulseTime) * 0.05);
  ctx.lineWidth = S.s(2);
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
  ctx.fillText('MAGNETIC DEMOLITION TEAM  V'+VERSION,canvas.width/2,titleY+S.s(30));
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

  // 轻量网格
  drawGridLines(0.02);
  drawScanLine(0.02);
  drawCachedStars();

  // 地面
  var gy=canvas.height-S.s(50);
  ctx.fillStyle=C.ground;ctx.fillRect(0,gy,canvas.width,S.s(50));
  ctx.strokeStyle=C.groundLine;ctx.lineWidth=S.s(1);ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(canvas.width,gy);ctx.stroke();

  drawBuildings();
  drawCrane();
  drawParticles();drawFloats();

  // 慢动作效果
  if(gs.slowMo>0){
    ctx.fillStyle='rgba(0,240,255,0.05)';ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  if(gs.flash>.01){ctx.fillStyle='rgba(255,255,255,'+gs.flash+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
  drawHUD();
  if(gs.npcText&&gs.npcTimer>0){drawNPC(S.sx(5),canvas.height-S.s(75),S.s(45));drawBubble(S.sx(55),canvas.height-S.s(65),S.s(230),gs.npcText);}
  if(gs.gamePaused)drawPause();
}

// ===== 建筑（优化：减少shadowBlur使用）=====
function drawBuildings(){
  // 先画建筑群整体阴影/地基，让建筑更醒目
  var groundY = canvas.height - S.s(50);
  
  // 计算每栋建筑的范围
  var buildingGroups = [];
  var visited = {};
  for(var bi=0;bi<buildings.length;bi++){
    if(buildings[bi].isDestroyed||visited[bi])continue;
    // 用简单的X距离聚类
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
    // 地基发光
    ctx.fillStyle='rgba(0,240,255,0.04)';
    ctx.fillRect(g.minX-pad,groundY-S.s(4),g.maxX-g.minX+pad*2,S.s(4));
    // 建筑整体背景暗色衬底
    ctx.fillStyle='rgba(10,20,50,0.3)';
    ctx.fillRect(g.minX-pad,g.minY-pad,g.maxX-g.minX+pad*2,g.maxY-g.minY+pad*2);
  });

  // 画每个方块
  buildings.forEach(function(b){
    if(b.isDestroyed)return;
    var hp=b.health/b.maxHealth;
    var bc=C[b.type]||C.wood;

    // 方块主体
    ctx.fillStyle=bc.fill;ctx.fillRect(b.x,b.y,b.width,b.height);

    // 边框
    ctx.strokeStyle=bc.stroke;ctx.lineWidth=S.s(1.5);ctx.strokeRect(b.x,b.y,b.width,b.height);

    // 高光
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(b.x+2,b.y+2,b.width-4,S.s(3));

    // 类型标记
    ctx.font='bold '+S.s(12)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.65)';
    var label=b.type==='wood'?'木':b.type==='brick'?'砖':b.type==='steel'?'钢':b.type==='ice'?'冰':b.type==='rubber'?'胶':b.type==='tnt'?'TNT':'?';
    ctx.fillText(label,b.x+b.width/2,b.y+b.height/2);

    // 低血量发光
    if(hp<0.3){
      ctx.save();ctx.shadowColor=bc.glow;ctx.shadowBlur=8;
      ctx.strokeStyle=bc.glow;ctx.lineWidth=S.s(1);ctx.strokeRect(b.x,b.y,b.width,b.height);
      ctx.restore();
    }

    // 裂纹
    if(hp<0.7){
      ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=S.s(1);
      var cn=hp<0.3?2:1;
      for(var ci=0;ci<cn;ci++){ctx.beginPath();ctx.moveTo(b.x+b.width*(0.3+ci*0.2),b.y);ctx.lineTo(b.x+b.width*(0.4+ci*0.15),b.y+b.height*0.5);ctx.lineTo(b.x+b.width*(0.2+ci*0.3),b.y+b.height);ctx.stroke();}
    }

    // 濒危闪烁
    if(hp<0.3&&frame%6<3){ctx.fillStyle='rgba(255,50,50,0.12)';ctx.fillRect(b.x,b.y,b.width,b.height);}

    // 血条
    if(hp<1){
      var bw2=b.width*.8,bh2=S.s(3),bx2=b.x+(b.width-bw2)/2,by2=b.y-S.s(6);
      ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(bx2,by2,bw2,bh2);
      ctx.fillStyle=hp>.5?C.neonGreen:hp>.25?C.neonYellow:C.neonRed;
      ctx.fillRect(bx2,by2,bw2*hp,bh2);
    }
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
}

function drawParticles(){
  for(var i=0;i<particles.length;i++){
    var p=particles[i],a=p.life/p.ml;
    if(p.t==='debris'){
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
    var f=floats[i],a=f.life/45;
    ctx.save();ctx.globalAlpha=a;ctx.fillStyle=f.c;ctx.font='bold '+S.s(22)+'px Arial';
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

  // 连击显示
  if(gs.combo>=2){
    ctx.fillStyle=C.neonPurple;ctx.font='bold '+S.s(16)+'px Arial';ctx.textAlign='center';
    ctx.fillText(gs.combo+'x COMBO',canvas.width/2,ty+th+S.s(18));
  }

  if(gs.gameActive&&!gs.gamePaused){
    var el=bg.getTimeLimit(gs.currentLevel)-gs.timeLeft;
    if(el<4){ctx.fillStyle=hex2rgba(C.neonCyan,Math.max(0,1-el/4));ctx.font=S.s(13)+'px Arial';ctx.textAlign='center';ctx.fillText('点击抓取 → 滑动甩动 → 再点释放',canvas.width/2,canvas.height-S.s(18));}
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
  ctx.fillStyle='rgba(5,10,30,0.9)';ctx.fillRect(0,0,canvas.width,canvas.height);
  var cx=canvas.width/2,bw=S.s(300),bh=S.s(320),bx=(canvas.width-bw)/2,by=(canvas.height-bh)/2;
  ctx.fillStyle=C.panelBg;ctx.strokeStyle=C.panelBorder;ctx.lineWidth=S.s(1.5);
  rr(ctx,bx,by,bw,bh,S.s(12));ctx.fill();rr(ctx,bx,by,bw,bh,S.s(12));ctx.stroke();

  var win=gs.score>=gs.targetScore;
  ctx.fillStyle=win?C.neonGreen:C.neonRed;ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(win?'关卡通过!':'时间到!',cx,by+S.s(40));

  // 星级
  var starY=by+S.s(70);
  for(var si=0;si<3;si++){
    ctx.font=S.s(32)+'px Arial';ctx.textAlign='center';
    ctx.fillStyle=si<gs.stars?C.neonYellow:C.textDim;
    ctx.fillText(si<gs.stars?'★':'☆',cx-S.s(30)+si*S.s(30),starY);
  }

  ctx.fillStyle=C.textMain;ctx.font=S.s(18)+'px Arial';ctx.textAlign='center';
  ctx.fillText('得分: '+gs.score,cx,by+S.s(110));
  ctx.fillStyle=C.textDim;ctx.fillText('目标: '+gs.targetScore,cx,by+S.s(138));

  var mc=getMechanicForLevel(gs.currentLevel);
  ctx.fillStyle=mc.color;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';
  ctx.fillText('L'+gs.currentLevel+' ['+mc.name+'] '+mc.desc,cx,by+S.s(162));

  var bw2=S.s(130),bh2=S.s(50),by2=by+bh-S.s(90);
  drawNeonBtn(cx-bw2-S.s(8),by2,bw2,bh2,'重玩',C.neonRed);
  regBtn(cx-bw2-S.s(8),by2,bw2,bh2,function(){loadLevel(gs.currentLevel);});
  if(win&&gs.currentLevel<1000){
    drawNeonBtn(cx+S.s(8),by2,bw2,bh2,'下一关',C.neonGreen);
    regBtn(cx+S.s(8),by2,bw2,bh2,function(){gs.currentLevel++;loadLevel(gs.currentLevel);});
  }
  drawNeonBtn(cx-bw2/2,by2+bh2+S.s(10),bw2,bh2,'返回主菜单',C.textDim);
  regBtn(cx-bw2/2,by2+bh2+S.s(10),bw2,bh2,function(){gs.currentScene='menu';});
  drawNPC(bx+S.s(5),by+bh-S.s(55),S.s(45));
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

  var cellW=S.s(58),cellH=S.s(58),gapX=S.s(8),gapY=S.s(8);
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
  var jumpY=navY+navBtnH+S.s(10);
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
  drawCachedStars();drawScanLine(0.02);drawNeonBorder();

  ctx.fillStyle=C.neonYellow;ctx.font='bold '+S.s(24)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('排行榜',canvas.width/2,S.safY(35));

  // Tab
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

  // 世界
  ctx.fillStyle=gs.lbTab==='world'?hex2rgba(C.neonYellow,0.15):'rgba(20,25,45,0.5)';
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.fill();
  ctx.strokeStyle=gs.lbTab==='world'?C.neonYellow:'rgba(60,70,100,0.3)';
  ctx.lineWidth=gs.lbTab==='world'?S.s(1.5):S.s(1);
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.stroke();
  ctx.fillStyle=gs.lbTab==='world'?C.neonYellow:C.textDim;
  ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='center';
  ctx.fillText('世界排行',tabCx+tabW/2+S.s(3),tabY+tabH/2);
  regBtn(tabCx+S.s(3),tabY,tabW,tabH,function(){gs.lbTab='world';loadWorldScores();});

  var listY=tabY+tabH+S.s(12),itemH=S.s(36);

  if(gs.lbTab==='friend'){
    if(openDataContext){
      try{var sharedCanvas=openDataContext.canvas;if(sharedCanvas)ctx.drawImage(sharedCanvas,0,listY,canvas.width,canvas.height-listY-S.s(80));}catch(e){}
    }
    var lb=[];try{var d=wx.getStorageSync('leaderboard');if(d)lb=JSON.parse(d);}catch(e){}
    if(!lb.length){
      ctx.fillStyle=C.textDim;ctx.font=S.s(14)+'px Arial';ctx.textAlign='center';
      ctx.fillText('暂无好友记录',canvas.width/2,listY+S.s(60));
    }else{
      var ms=[C.neonYellow,'#C0C0C0','#CD7F32'];
      for(var i=0;i<Math.min(lb.length,10);i++){
        var iy=listY+i*itemH;
        ctx.fillStyle=i<3?hex2rgba(ms[i],0.06):'rgba(20,25,45,0.3)';
        ctx.fillRect(S.sx(15),iy,canvas.width-S.sx(30),itemH-S.s(4));
        ctx.fillStyle=i<3?ms[i]:C.textDim;ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        var rank=i<3?['🥇','🥈','🥉'][i]:((i+1)+'.');
        ctx.fillText(rank,S.sx(25),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.textMain;ctx.font=S.s(13)+'px Arial';
        ctx.fillText('L'+(lb[i].level||'-')+' '+(lb[i].name||'我'),S.sx(65),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';
        ctx.fillText((lb[i].score||0)+'分',canvas.width-S.sx(25),iy+itemH/2-S.s(2));
      }
    }
  }else{
    if(!gs.worldScores||!gs.worldScores.length)loadWorldScores();
    if(gs.worldScores.length>0){
      var ms=[C.neonYellow,'#C0C0C0','#CD7F32'];
      for(var i=0;i<Math.min(gs.worldScores.length,10);i++){
        var iy=listY+i*itemH;
        ctx.fillStyle=i<3?hex2rgba(ms[i],0.06):'rgba(20,25,45,0.3)';
        ctx.fillRect(S.sx(15),iy,canvas.width-S.sx(30),itemH-S.s(4));
        ctx.fillStyle=i<3?ms[i]:C.textDim;ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        var rank=i<3?['🥇','🥈','🥉'][i]:((i+1)+'.');
        ctx.fillText(rank,S.sx(25),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.textMain;ctx.font=S.s(13)+'px Arial';
        ctx.fillText(gs.worldScores[i].name||'???',S.sx(65),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';
        ctx.fillText(gs.worldScores[i].score+'分',canvas.width-S.sx(25),iy+itemH/2-S.s(2));
      }
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

  var t=['▸ 点击方块 → 磁铁抓住','▸ 左右滑动 → 甩动蓄力','▸ 再次点击 → 释放砸建筑','▸ 砸中得分 → 连击加成！','▸ TNT方块 → 范围爆炸','▸ 摧毁支撑 → 建筑倒塌','▸ 达到目标 → 过关！','▸ 连续登录 → 每日奖励'];
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
