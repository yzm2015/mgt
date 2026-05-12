/**
 * 磁吸拆迁队 V3.0.1
 * 版本规则：每次+0.0.1，逢十进一（3.0.1→3.0.9→3.1.0）
 *
 * V3.0.1 更新：
 * - 微信自动登录
 * - 好友排行 + 世界排行
 * - 1000关关卡选择（分页+每10关新玩法）
 * - 云存储保存进度
 * - 开放数据域好友排行榜
 */

var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

// ===== 版本 =====
var VERSION = '3.0.1';

// ===== 配色 =====
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

var CONFIG = { gravity: 0.5, ropeLength: 150, magnetRadius: 80, magnetPower: 0.8, craneSpeed: 5, damping: 0.99, bounceDamping: 0.5, friction: 0.8 };

var gs = {
  score: 0, timeLeft: 60, gameActive: false, gamePaused: false,
  currentLevel: 1, targetScore: 500, stars: 0, currentScene: 'menu',
  shake: 0, shakeX: 0, shakeY: 0, combo: 0, comboTimer: 0,
  flash: 0, pulse: 0, npcText: '', npcTimer: 0, npcQueue: [],
  // V3.0.1 新增
  userInfo: null, loggedIn: false,
  levelPage: 0,  // 关卡选择当前页
  lbTab: 'friend',  // 排行榜Tab: friend / world
  friendScores: [],  // 好友排行数据
  worldScores: [],   // 世界排行数据
};

// ===== 关卡进度 =====
var progress = {
  highestLevel: 1,  // 已解锁最高关卡
  levels: {},       // {1: {stars:3, score:500}, 2: {stars:2, score:300}, ...}
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
        highestLevel: this.highestLevel,
        levels: this.levels
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

// ===== 玩法机制定义（每10关一种）=====
var MECHANICS = [
  { level: 1,   id: 'basic',     name: '基础', desc: '木质+砖块建筑', color: C.neonCyan },
  { level: 11,  id: 'explosive', name: '爆破', desc: '解锁TNT炸药方块', color: C.neonRed },
  { level: 21,  id: 'ice',       name: '冰封', desc: '解锁冰块（易碎滑溜）', color: C.ice.glow },
  { level: 31,  id: 'rubber',    name: '弹力', desc: '解锁橡胶块（弹飞！）', color: C.rubber.glow },
  { level: 41,  id: 'steel',     name: '钢铁', desc: '解锁钢块（超级坚固）', color: C.steel.glow },
  { level: 51,  id: 'chain',     name: '连锁', desc: '连锁爆炸机关', color: C.neonOrange },
  { level: 61,  id: 'wind',      name: '风暴', desc: '侧风影响轨迹', color: '#88ddff' },
  { level: 71,  id: 'timed',     name: '限时', desc: '时间奖励拾取', color: C.neonGreen },
  { level: 81,  id: 'multi',     name: '多目标', desc: '多个建筑需摧毁', color: C.neonYellow },
  { level: 91,  id: 'boss',      name: 'BOSS', desc: '超级坚固BOSS建筑', color: C.neonPurple },
  { level: 101, id: 'desert',    name: '沙漠', desc: '沙漠主题+沙暴', color: '#F4A460' },
  { level: 111, id: 'quicksand', name: '流沙', desc: '流沙吞噬方块', color: '#DAA520' },
  { level: 121, id: 'mirage',    name: '幻影', desc: '建筑会移动位置', color: '#FFD700' },
  { level: 131, id: 'sandworm',  name: '沙虫', desc: '沙虫吞噬建筑底部', color: '#CD853F' },
  { level: 141, id: 'oasis',     name: '绿洲', desc: '恢复时间的水源', color: '#2E8B57' },
  { level: 151, id: 'pyramid',   name: '金字塔', desc: '金字塔形BOSS', color: '#DAA520' },
  { level: 161, id: 'pharaoh',   name: '法老', desc: '法老诅咒减速', color: '#9966CC' },
  { level: 171, id: 'scarab',    name: '圣甲', desc: '甲虫方块自动修复', color: '#228B22' },
  { level: 181, id: 'sandstorm', name: '沙暴', desc: '强风+低可见度', color: '#D2691E' },
  { level: 191, id: 'sphinx',    name: '狮身', desc: '狮身人面BOSS', color: '#B8860B' },
  { level: 201, id: 'snow',      name: '雪地', desc: '雪地主题+打滑', color: '#F0F8FF' },
  { level: 211, id: 'avalanche', name: '雪崩', desc: '雪崩掩埋建筑', color: '#B0C4DE' },
  { level: 221, id: 'freeze',    name: '冰冻', desc: '方块随机冰冻', color: '#ADD8E6' },
  { level: 231, id: 'igloo',     name: '冰屋', desc: '圆形冰屋建筑', color: '#E0FFFF' },
  { level: 241, id: 'blizzard',  name: '暴雪', desc: '暴雪低可见度', color: '#87CEEB' },
  { level: 251, id: 'frost',     name: '霜冻', desc: '霜冻BOSS建筑', color: '#00CED1' },
  { level: 261, id: 'iceskate',  name: '溜冰', desc: '方块极度打滑', color: '#48D1CC' },
  { level: 271, id: 'snowman',   name: '雪人', desc: '雪人方块会再生', color: '#FFFAFA' },
  { level: 281, id: 'glacier',   name: '冰川', desc: '冰川缓慢移动', color: '#5F9EA0' },
  { level: 291, id: 'yeti',      name: '雪人BOSS', desc: '雪人BOSS', color: '#6495ED' },
  { level: 301, id: 'space',     name: '太空', desc: '太空主题+低重力', color: '#191970' },
  { level: 311, id: 'meteor',    name: '流星', desc: '流星雨攻击', color: '#4169E1' },
  { level: 321, id: 'antigrav',  name: '反重力', desc: '方块向上飘', color: '#7B68EE' },
  { level: 331, id: 'ufo',       name: 'UFO', desc: 'UFO吸走方块', color: '#9370DB' },
  { level: 341, id: 'asteroid',  name: '小行星', desc: '小行星撞击', color: '#6A5ACD' },
  { level: 351, id: 'blackhole', name: '黑洞', desc: '黑洞BOSS', color: '#483D8B' },
  { level: 361, id: 'satellite', name: '卫星', desc: '卫星激光', color: '#778899' },
  { level: 371, id: 'comet',     name: '彗星', desc: '彗星尾迹燃烧', color: '#B0C4DE' },
  { level: 381, id: 'nebula',    name: '星云', desc: '星云迷雾', color: '#6A5ACD' },
  { level: 391, id: 'alien',     name: '外星BOSS', desc: '外星母舰', color: '#8A2BE2' },
  { level: 401, id: 'volcano',   name: '火山', desc: '火山主题+熔岩', color: '#FF4500' },
  { level: 411, id: 'lava',      name: '熔岩', desc: '熔岩上升吞方块', color: '#FF6347' },
  { level: 421, id: 'eruption',  name: '喷发', desc: '火山喷发砸方块', color: '#FF7F50' },
  { level: 431, id: 'geyser',    name: '间歇泉', desc: '间歇泉喷发', color: '#FFA07A' },
  { level: 441, id: 'ash',       name: '火山灰', desc: '火山灰降低可见度', color: '#696969' },
  { level: 451, id: 'magma',     name: '岩浆BOSS', desc: '岩浆巨兽', color: '#DC143C' },
  { level: 461, id: 'obsidian',  name: '黑曜石', desc: '黑曜石超硬方块', color: '#2F4F4F' },
  { level: 471, id: 'sulfur',    name: '硫磺', desc: '毒气持续伤害', color: '#9ACD32' },
  { level: 481, id: 'crystal',   name: '水晶', desc: '水晶折射分裂', color: '#E0E0E0' },
  { level: 491, id: 'dragon',    name: '火龙BOSS', desc: '火龙喷火', color: '#B22222' },
  { level: 501, id: 'neon',      name: '霓虹', desc: '城市霓虹主题', color: C.neonCyan },
  { level: 511, id: 'hologram',  name: '全息', desc: '全息方块虚实切换', color: '#00FFFF' },
  { level: 521, id: 'drone',     name: '无人机', desc: '无人机干扰', color: '#00CED1' },
  { level: 531, id: 'cyber',     name: '赛博', desc: '赛博朋克陷阱', color: '#FF1493' },
  { level: 541, id: 'matrix',    name: '矩阵', desc: '矩阵方块排列', color: '#00FF00' },
  { level: 551, id: 'virus',     name: '病毒', desc: '病毒方块感染扩散', color: '#32CD32' },
  { level: 561, id: 'quantum',   name: '量子', desc: '量子方块瞬移', color: '#9400D3' },
  { level: 571, id: 'nano',      name: '纳米', desc: '纳米方块自组装', color: '#4B0082' },
  { level: 581, id: 'ai',        name: 'AI', desc: 'AI自动防御', color: '#8B008B' },
  { level: 591, id: 'singularity', name: '奇点BOSS', desc: '奇点吞噬一切', color: '#800080' },
  { level: 601, id: 'ruins',     name: '废墟', desc: '沙漠废墟高级', color: '#8B7355' },
  { level: 701, id: 'permafrost',name: '永冻', desc: '雪地高级', color: '#B0E0E6' },
  { level: 801, id: 'wormhole',  name: '虫洞', desc: '太空高级', color: '#4169E1' },
  { level: 901, id: 'inferno',   name: '炼狱', desc: '火山高级+全机制', color: '#FF0000' },
];

function getMechanicForLevel(lv) {
  var result = MECHANICS[0];
  for (var i = 0; i < MECHANICS.length; i++) {
    if (lv >= MECHANICS[i].level) result = MECHANICS[i];
  }
  return result;
}

function getMechanicIndex(lv) {
  var idx = 0;
  for (var i = 0; i < MECHANICS.length; i++) {
    if (lv >= MECHANICS[i].level) idx = i;
  }
  return idx;
}

var canvas, ctx, physics, crane, bg, audio;
var buildings = [], particles = [], floats = [], collapseQueue = [];
var gameTimer = null, running = false, frame = 0, lastT = 0;
var uiButtons = [];
var touch = { sx: 0, sy: 0, lx: 0, ly: 0, drag: false, dist: 0, st: 0, moved: false };
var openDataContext = null; // 开放数据域

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

// ===== 微信自动登录 =====
function autoLogin() {
  try {
    wx.login({
      success: function(res) {
        if (res.code) {
          console.log('微信登录成功 code:', res.code);
          gs.loggedIn = true;
          // 尝试获取用户信息
          tryGetUserInfo();
        }
      },
      fail: function() {
        console.log('微信登录失败，使用离线模式');
        gs.loggedIn = false;
      }
    });
  } catch(e) {
    console.log('wx.login 不可用:', e);
    gs.loggedIn = false;
  }
}

function tryGetUserInfo() {
  try {
    // 优先从缓存读取
    var cached = wx.getStorageSync('wxUserInfo');
    if (cached) {
      gs.userInfo = JSON.parse(cached);
      return;
    }
  } catch(e) {}

  try {
    wx.getUserInfo({
      success: function(res) {
        if (res.userInfo) {
          gs.userInfo = res.userInfo;
          try { wx.setStorageSync('wxUserInfo', JSON.stringify(res.userInfo)); } catch(e) {}
        }
      },
      fail: function() {
        // 用户拒绝授权，使用默认信息
        gs.userInfo = { nickName: '拆迁队员', avatarUrl: '' };
      }
    });
  } catch(e) {
    gs.userInfo = { nickName: '拆迁队员', avatarUrl: '' };
  }
}

// ===== 云存储 =====
function saveToCloud(lv, score) {
  if (!gs.loggedIn) return;
  try {
    // 保存最高分到微信云存储
    var kvData = {
      key: 'best_score',
      value: JSON.stringify({ level: lv, score: score, timestamp: Date.now() })
    };
    // 同时保存关卡进度
    var progressData = {
      key: 'level_progress',
      value: JSON.stringify({ highestLevel: progress.highestLevel, topScore: score })
    };
    wx.setUserCloudStorage({
      KVDataList: [kvData, progressData],
      success: function() { console.log('云存储保存成功'); },
      fail: function() { console.log('云存储保存失败'); }
    });
  } catch(e) {
    console.log('云存储不可用:', e);
  }
}

function loadFriendScores() {
  // 通过开放数据域获取好友排行
  if (openDataContext) {
    try {
      openDataContext.postMessage({ action: 'getFriendRank' });
    } catch(e) {}
  }
  // 同时尝试直接获取本地缓存的排行榜
  try {
    var d = wx.getStorageSync('leaderboard');
    if (d) gs.friendScores = JSON.parse(d);
  } catch(e) {}
}

function loadWorldScores() {
  // 世界排行 - 使用本地数据+随机生成模拟数据
  gs.worldScores = [];
  try {
    var d = wx.getStorageSync('worldLeaderboard');
    if (d) gs.worldScores = JSON.parse(d);
  } catch(e) {}

  // 如果没有数据，生成一些模拟数据
  if (!gs.worldScores || gs.worldScores.length === 0) {
    var names = ['拆迁大王','破坏神','磁力大师','建筑克星','闪电手',
                 '拆迁新人','铁锤达人','爆破专家','拆迁队长','重力使者',
                 '连锁反应','甩飞高手','连击之王','精准打击','速通达人',
                 '磁铁之心','钢铁破坏','冰封拆迁','弹力天王','火焰终结'];
    for (var i = 0; i < 20; i++) {
      gs.worldScores.push({
        name: names[i],
        score: Math.floor(10000 - i * 400 + Math.random() * 200),
        level: Math.min(1000, 900 - i * 40 + Math.floor(Math.random() * 20))
      });
    }
    gs.worldScores.sort(function(a, b) { return b.score - a.score; });
    try { wx.setStorageSync('worldLeaderboard', JSON.stringify(gs.worldScores)); } catch(e) {}
  }
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

    // 起重机位置
    crane.crane.y = S.st + S.s(5);
    crane.crane.x = canvas.width / 2;
    crane.pendulum.ropeLength = Math.floor(S.h * 0.25);
    crane.magnet.y = crane.crane.y + crane.crane.height + crane.pendulum.ropeLength;
    crane.magnet.x = crane.crane.x;
    crane.magnet.attractRadius = S.h * 0.6;

    // 加载关卡进度
    progress.load();

    // 自动登录
    autoLogin();

    // 开放数据域
    try {
      openDataContext = wx.getOpenDataContext();
    } catch(e) {
      console.log('开放数据域不可用');
    }

    gs.currentScene='menu'; NPC.queue('welcome'); procNPC();
    bindTouch(); running=true; lastT=Date.now(); gameLoop();
  } catch(e){console.error('init fail:',e);}
}

function nf(cb){if(typeof requestAnimationFrame==='function')requestAnimationFrame(cb);else setTimeout(cb,16);}

// ===== 游戏循环 =====
function gameLoop() {
  if(!running) return; frame++; lastT=Date.now();
  if(gs.currentScene==='game'&&gs.gameActive&&!gs.gamePaused) update();
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
  checkFlyingHits();
  checkFloatingBlocks();
  checkGameEnd();
}

// ===== 飞行方块撞击检测 =====
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
            for(var k=0;k<buildings.length;k++){var bk=buildings[k];if(bk.isDestroyed||bk===t)continue;
              var dx2=(bk.x+bk.width/2)-cx,dy2=(bk.y+bk.height/2)-cy;
              if(Math.sqrt(dx2*dx2+dy2*dy2)<120){bk.health-=40;if(bk.health<=0){bk.health=0;bk.isDestroyed=true;gs.score+=bk.score||10;spawnDebris(bk.x+bk.width/2,bk.y+bk.height/2,bk.color||C.neonRed,8);}}
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

// ===== 倒塌动画 =====
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

    // 关卡选择页面滑动翻页
    if(gs.currentScene==='levelselect'){
      if(touch.dist > S.s(60) && !touch.moved) return;
      if(Math.abs(dx) > S.s(30)) {
        // 滑动翻页由touchEnd处理
      }
    }

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
        spawnSparks(block.x+block.width/2,block.y,C.neonCyan,6);
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
  if(lv<1)lv=1;if(lv>1000)lv=1000;
  if(!progress.isUnlocked(lv)){
    NPC.show('关卡未解锁！',90);
    return;
  }
  clearTimer(); buildings=bg.generateLevel(lv);
  buildings.forEach(function(b){
    b.width=Math.max(b.width,S.s(50));
    b.height=Math.max(b.height,S.s(50));
  });
  gs.currentLevel=lv;
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
  if(win||gs.stars>0){
    progress.complete(gs.currentLevel, gs.stars, gs.score);
    saveToCloud(gs.currentLevel, gs.score);
  }
  if(win)saveLB(gs.currentLevel,gs.score);
  audio.playSound(win?SoundNames.WIN:SoundNames.LOSE);
  gs.currentScene='gameover';NPC.show(NPC.say(win?'win':'lose'),200);
}
function saveLB(lv,sc){try{var d=[];var r=wx.getStorageSync('leaderboard');if(r)d=JSON.parse(r);d.push({level:lv,score:sc,time:Date.now(),name:gs.userInfo?gs.userInfo.nickName:'拆迁队员'});d.sort(function(a,b){return b.score-a.score;});if(d.length>50)d=d.slice(0,50);wx.setStorageSync('leaderboard',JSON.stringify(d));}catch(e){}}

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
  ctx.fillText('磁吸拆迁队',canvas.width/2,S.safY(70));ctx.restore();
  ctx.fillStyle=C.textDim;ctx.font=S.s(11)+'px Arial';ctx.textAlign='center';
  ctx.fillText('MAGNETIC DEMOLITION TEAM  V'+VERSION,canvas.width/2,S.safY(100));

  // 用户信息
  if(gs.userInfo || gs.loggedIn){
    var uname = (gs.userInfo && gs.userInfo.nickName) || '拆迁队员';
    ctx.fillStyle=C.neonGreen;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';
    ctx.fillText('👤 '+uname,canvas.width/2,S.safY(120));
  }

  // NPC
  drawNPC(S.sx(20),S.safY(140),S.s(70));
  if(gs.npcText&&gs.npcTimer>0)drawBubble(S.sx(100),S.safY(135),S.s(240),gs.npcText);

  // 按钮
  var cx=canvas.width/2,bw=S.s(240),bh=S.s(54),sy=S.safY(220);
  var lb=['开始游戏','关卡选择','排行榜','玩法说明'];
  var cl=[C.neonGreen,C.neonCyan,C.neonYellow,C.neonPurple];
  var fn=[
    function(){loadLevel(progress.highestLevel);},
    function(){gs.levelPage=Math.floor((progress.highestLevel-1)/20);gs.currentScene='levelselect';},
    function(){gs.lbTab='friend';loadFriendScores();loadWorldScores();gs.currentScene='leaderboard';},
    function(){gs.currentScene='instructions';}
  ];
  for(var i=0;i<lb.length;i++){var by=sy+i*(bh+S.s(14));drawBtn(cx-bw/2,by,bw,bh,lb[i],cl[i]);regBtn(cx-bw/2,by,bw,bh,fn[i]);}
}

// ===== 游戏场景 =====
function renderGame(){
  var g=grad(ctx,0,0,0,canvas.height);
  if(g){g.addColorStop(0,'#020510');g.addColorStop(.6,'#0a1035');g.addColorStop(1,'#0d1540');ctx.fillStyle=g;}else ctx.fillStyle=C.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  var gy=canvas.height-S.s(50);
  ctx.fillStyle=C.ground;ctx.fillRect(0,gy,canvas.width,S.s(50));
  ctx.strokeStyle=C.groundLine;ctx.lineWidth=S.s(1);ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(canvas.width,gy);ctx.stroke();
  drawBuildings();
  drawCrane();
  drawParticles();drawFloats();
  if(gs.flash>.01){ctx.fillStyle='rgba(255,255,255,'+gs.flash+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
  drawHUD();
  if(gs.npcText&&gs.npcTimer>0){drawNPC(S.sx(5),canvas.height-S.s(75),S.s(45));drawBubble(S.sx(55),canvas.height-S.s(65),S.s(230),gs.npcText);}
  if(gs.gamePaused)drawPause();
}

// ===== 建筑 =====
function drawBuildings(){
  buildings.forEach(function(b){
    if(b.isDestroyed)return;
    var hp=b.health/b.maxHealth;
    var bc=C[b.type]||C.wood;
    ctx.save();
    ctx.shadowColor=bc.glow;
    ctx.shadowBlur=hp>0.5?8:15;
    ctx.fillStyle=bc.fill;
    ctx.fillRect(b.x,b.y,b.width,b.height);
    ctx.shadowBlur=0;
    ctx.strokeStyle=bc.stroke;
    ctx.lineWidth=S.s(2);
    ctx.strokeRect(b.x,b.y,b.width,b.height);
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(b.x+2,b.y+2,b.width-4,S.s(4));
    ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.7)';
    var label=b.type==='wood'?'木':b.type==='brick'?'砖':b.type==='steel'?'钢':b.type==='ice'?'冰':b.type==='rubber'?'胶':b.type==='tnt'?'TNT':'?';
    ctx.fillText(label,b.x+b.width/2,b.y+b.height/2);
    if(hp<0.7){
      ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=S.s(1.5);
      var cn=hp<0.3?3:1;
      for(var ci=0;ci<cn;ci++){ctx.beginPath();ctx.moveTo(b.x+b.width*(0.3+ci*0.2),b.y);ctx.lineTo(b.x+b.width*(0.4+ci*0.15),b.y+b.height*0.5);ctx.lineTo(b.x+b.width*(0.2+ci*0.3),b.y+b.height);ctx.stroke();}
    }
    if(hp<0.3&&frame%20<10){ctx.fillStyle='rgba(255,50,50,0.15)';ctx.fillRect(b.x,b.y,b.width,b.height);}
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
  ctx.strokeStyle='rgba(0,240,255,0.1)';ctx.lineWidth=S.s(1);ctx.setLineDash&&ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(0,cy+ch);ctx.lineTo(canvas.width,cy+ch);ctx.stroke();
  ctx.setLineDash&&ctx.setLineDash([]);
  ctx.fillStyle='#2a3b5e';rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.fill();
  ctx.strokeStyle=C.neonCyan;ctx.lineWidth=S.s(1.5);ctx.shadowColor=C.neonCyan;ctx.shadowBlur=6;
  rr(ctx,cx-cw/2,cy,cw,ch,S.s(4));ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle=hex2rgba(C.neonCyan,.3);ctx.fillRect(cx-S.s(10),cy+S.s(10),S.s(20),S.s(14));
  var px=cx,py=cy+ch,mx=crane.magnet.x,my=crane.magnet.y;
  ctx.strokeStyle='rgba(0,240,255,0.5)';ctx.lineWidth=S.s(2);
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(mx,my);ctx.stroke();
  drawMag(mx,my);
  ctx.restore();
}

function drawMag(mx,my){
  var grabbing=crane.isGrabbing(),r=crane.magnet.radius,ar=crane.magnet.attractRadius;
  var p=Math.sin(gs.pulse)*.3+.7;
  ctx.save();
  if(crane.magnet.isActive||grabbing){
    for(var i=3;i>=1;i--){ctx.strokeStyle=hex2rgba(C.neonCyan,.04*(4-i));ctx.lineWidth=S.s(1);ctx.beginPath();ctx.arc(mx,my,ar*(i/3)*p,0,Math.PI*2);ctx.stroke();}
  }
  ctx.shadowColor=grabbing?C.neonGreen:C.neonCyan;ctx.shadowBlur=20*p;
  ctx.lineWidth=S.s(5);ctx.strokeStyle=grabbing?C.neonGreen:C.neonCyan;
  ctx.beginPath();ctx.arc(mx,my,r,0,Math.PI);ctx.stroke();
  ctx.beginPath();ctx.moveTo(mx-r,my);ctx.lineTo(mx-r,my-S.s(8));ctx.stroke();
  ctx.beginPath();ctx.moveTo(mx+r,my);ctx.lineTo(mx+r,my-S.s(8));ctx.stroke();
  ctx.beginPath();ctx.arc(mx,my,r*.7,0,Math.PI*2);ctx.fillStyle=hex2rgba(grabbing?C.neonGreen:C.neonCyan,.3*p);ctx.fill();
  ctx.shadowBlur=0;
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
  var bx=S.sx(5),by2=ty+S.s(3),bw=S.s(58),bh=S.s(32);
  ctx.fillStyle='rgba(0,240,255,0.1)';rr(ctx,bx,by2,bw,bh,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.4);ctx.lineWidth=S.s(.5);rr(ctx,bx,by2,bw,bh,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('菜单',bx+bw/2,by2+bh/2);
  regBtn(bx,by2,bw,bh,function(){gs.currentScene='menu';clearTimer();gs.gameActive=false;});
  var px=canvas.width-S.sx(58),py=ty+S.s(3),pw=S.s(50),ph=S.s(32);
  ctx.fillStyle='rgba(0,240,255,0.1)';rr(ctx,px,py,pw,ph,S.s(4));ctx.fill();
  ctx.strokeStyle=hex2rgba(C.neonCyan,.4);ctx.lineWidth=S.s(.5);rr(ctx,px,py,pw,ph,S.s(4));ctx.stroke();
  ctx.fillStyle=C.neonCyan;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';ctx.fillText(gs.gamePaused?'继续':'暂停',px+pw/2,py+ph/2);
  regBtn(px,py,pw,ph,function(){gs.gamePaused=!gs.gamePaused;});
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

  // 星级显示
  var starY=by+S.s(75);
  for(var si=0;si<3;si++){
    ctx.font=S.s(30)+'px Arial';ctx.textAlign='center';
    ctx.fillStyle=si<gs.stars?C.neonYellow:C.textDim;
    ctx.fillText('★',cx-S.s(35)+si*S.s(35),starY);
  }

  ctx.fillStyle=C.textMain;ctx.font=S.s(18)+'px Arial';ctx.textAlign='center';ctx.fillText('得分: '+gs.score,cx,by+S.s(115));ctx.fillStyle=C.textDim;ctx.fillText('目标: '+gs.targetScore,cx,by+S.s(140));

  // 当前关卡玩法
  var mc = getMechanicForLevel(gs.currentLevel);
  ctx.fillStyle=mc.color;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';
  ctx.fillText('L'+gs.currentLevel+' ['+mc.name+'] '+mc.desc,cx,by+S.s(165));

  var bw2=S.s(130),bh2=S.s(52),by2=by+bh-S.s(85);
  drawBtn(cx-bw2-S.s(10),by2,bw2,bh2,'重玩',C.neonRed);regBtn(cx-bw2-S.s(10),by2,bw2,bh2,function(){loadLevel(gs.currentLevel);});
  if(win && gs.currentLevel<1000){
    drawBtn(cx+S.s(10),by2,bw2,bh2,'下一关',C.neonGreen);regBtn(cx+S.s(10),by2,bw2,bh2,function(){gs.currentLevel++;loadLevel(gs.currentLevel);});
  }
  drawBtn(cx-bw2/2,by2+bh2+S.s(12),bw2,bh2,'返回主菜单',C.textDim);regBtn(cx-bw2/2,by2+bh2+S.s(12),bw2,bh2,function(){gs.currentScene='menu';});
  drawNPC(bx+S.s(5),by+bh-S.s(60),S.s(50));
}

// ===== 关卡选择（1000关分页版）=====
function renderLevelSel(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();

  // 标题
  ctx.save();ctx.shadowColor=C.neonCyan;ctx.shadowBlur=12;ctx.fillStyle=C.neonCyan;
  ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('关卡选择',canvas.width/2,S.safY(40));ctx.restore();

  // 版本
  ctx.fillStyle=C.textDim;ctx.font=S.s(10)+'px Arial';ctx.textAlign='right';
  ctx.fillText('V'+VERSION,canvas.width-S.sx(10),S.safY(10));

  // 当前玩法提示
  var curMc = getMechanicForLevel(progress.highestLevel);
  ctx.fillStyle=curMc.color;ctx.font=S.s(12)+'px Arial';ctx.textAlign='center';
  ctx.fillText('最新解锁: L'+progress.highestLevel+' ['+curMc.name+']',canvas.width/2,S.safY(65));

  // 关卡网格 - 5列4行 = 20关/页
  var cols=5, rows=4, perPage=cols*rows;
  var totalPage=Math.ceil(1000/perPage);
  var page=gs.levelPage;
  if(page<0)page=0;if(page>=totalPage)page=totalPage-1;
  gs.levelPage=page;

  var cellW=S.s(62), cellH=S.s(62), gap=S.s(6);
  var gridW=cols*cellW+(cols-1)*gap;
  var startX=(canvas.width-gridW)/2;
  var startY=S.safY(85);

  for(var r=0;r<rows;r++){
    for(var c=0;c<cols;c++){
      var idx=r*cols+c;
      var lv=page*perPage+idx+1;
      if(lv>1000) continue;

      var x=startX+c*(cellW+gap);
      var y=startY+r*(cellH+gap);
      var unlocked=progress.isUnlocked(lv);
      var stars=progress.getStars(lv);
      var mc=getMechanicForLevel(lv);

      // 背景
      ctx.save();
      if(unlocked){
        ctx.fillStyle=hex2rgba(mc.color,0.15);
        rr(ctx,x,y,cellW,cellH,S.s(6));ctx.fill();
        ctx.strokeStyle=hex2rgba(mc.color,0.6);
        ctx.lineWidth=S.s(1.5);
        rr(ctx,x,y,cellW,cellH,S.s(6));ctx.stroke();

        // 新玩法标记
        if(lv===mc.level){
          ctx.fillStyle=mc.color;ctx.font='bold '+S.s(8)+'px Arial';ctx.textAlign='center';
          ctx.fillText('NEW',x+cellW/2,y+S.s(8));
        }

        // 关卡号
        ctx.fillStyle=C.textMain;ctx.font='bold '+S.s(18)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(lv,x+cellW/2,y+cellH/2);

        // 星级
        if(stars>0){
          ctx.fillStyle=C.neonYellow;ctx.font=S.s(10)+'px Arial';ctx.textAlign='center';
          var starStr='';for(var si=0;si<stars;si++)starStr+='★';
          ctx.fillText(starStr,x+cellW/2,y+cellH-S.s(6));
        }

        // 注册按钮
        (function(lvNum){
          regBtn(x,y,cellW,cellH,function(){
            gs.currentLevel=lvNum;
            loadLevel(lvNum);
          });
        })(lv);
      } else {
        // 锁定状态
        ctx.fillStyle='rgba(40,45,70,0.5)';
        rr(ctx,x,y,cellW,cellH,S.s(6));ctx.fill();
        ctx.strokeStyle='rgba(80,90,120,0.3)';
        ctx.lineWidth=S.s(1);
        rr(ctx,x,y,cellW,cellH,S.s(6));ctx.stroke();
        ctx.fillStyle=C.textDim;ctx.font=S.s(20)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('🔒',x+cellW/2,y+cellH/2);
      }
      ctx.restore();
    }
  }

  // 页码信息
  var pageY=startY+rows*(cellH+gap)+S.s(8);
  ctx.fillStyle=C.textDim;ctx.font=S.s(13)+'px Arial';ctx.textAlign='center';
  ctx.fillText('第 '+(page+1)+' / '+totalPage+' 页  (关卡 '+(page*perPage+1)+'-'+Math.min((page+1)*perPage,1000)+')',canvas.width/2,pageY);

  // 翻页按钮
  var btnW=S.s(60),btnH=S.s(38),btnY=pageY+S.s(12);
  // 上一页
  if(page>0){
    drawBtn(S.sx(30),btnY,btnW,btnH,'◀ 上一页',C.neonCyan);
    regBtn(S.sx(30),btnY,btnW,btnH,function(){gs.levelPage--;});
  }
  // 下一页
  if(page<totalPage-1){
    drawBtn(canvas.width-S.sx(30)-btnW,btnY,btnW,btnH,'下一页 ▶',C.neonCyan);
    regBtn(canvas.width-S.sx(30)-btnW,btnY,btnW,btnH,function(){gs.levelPage++;});
  }

  // 跳转到最新关卡
  var jumpY=btnY+btnH+S.s(8);
  var jumpW=S.s(200),jumpH=S.s(36);
  drawBtn((canvas.width-jumpW)/2,jumpY,jumpW,jumpH,'跳到最新 L'+progress.highestLevel,C.neonGreen);
  regBtn((canvas.width-jumpW)/2,jumpY,jumpW,jumpH,function(){gs.levelPage=Math.floor((progress.highestLevel-1)/perPage);});

  // 返回主菜单
  var backY=canvas.height-S.sy(70);
  var backW=S.s(280);
  drawBtn((canvas.width-backW)/2,backY,backW,S.s(50),'返回主菜单',C.neonRed);
  regBtn((canvas.width-backW)/2,backY,backW,S.s(50),function(){gs.currentScene='menu';});
}

// ===== 排行榜（好友+世界）=====
function renderLB(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();

  // 标题
  ctx.save();ctx.shadowColor=C.neonYellow;ctx.shadowBlur=12;ctx.fillStyle=C.neonYellow;
  ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('排行榜',canvas.width/2,S.safY(40));ctx.restore();

  // Tab切换
  var tabW=S.s(130),tabH=S.s(38),tabY=S.safY(70);
  var tabCx=canvas.width/2;

  // 好友Tab
  ctx.fillStyle=gs.lbTab==='friend'?hex2rgba(C.neonCyan,0.2):'rgba(30,35,60,0.5)';
  rr(ctx,tabCx-tabW-S.s(3),tabY,tabW,tabH,S.s(6));ctx.fill();
  ctx.strokeStyle=gs.lbTab==='friend'?C.neonCyan:'rgba(80,90,120,0.3)';
  ctx.lineWidth=gs.lbTab==='friend'?S.s(2):S.s(1);
  rr(ctx,tabCx-tabW-S.s(3),tabY,tabW,tabH,S.s(6));ctx.stroke();
  ctx.fillStyle=gs.lbTab==='friend'?C.neonCyan:C.textDim;
  ctx.font='bold '+S.s(15)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('好友排行',tabCx-tabW/2-S.s(3),tabY+tabH/2);
  regBtn(tabCx-tabW-S.s(3),tabY,tabW,tabH,function(){gs.lbTab='friend';loadFriendScores();});

  // 世界Tab
  ctx.fillStyle=gs.lbTab==='world'?hex2rgba(C.neonYellow,0.2):'rgba(30,35,60,0.5)';
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.fill();
  ctx.strokeStyle=gs.lbTab==='world'?C.neonYellow:'rgba(80,90,120,0.3)';
  ctx.lineWidth=gs.lbTab==='world'?S.s(2):S.s(1);
  rr(ctx,tabCx+S.s(3),tabY,tabW,tabH,S.s(6));ctx.stroke();
  ctx.fillStyle=gs.lbTab==='world'?C.neonYellow:C.textDim;
  ctx.font='bold '+S.s(15)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('世界排行',tabCx+tabW/2+S.s(3),tabY+tabH/2);
  regBtn(tabCx+S.s(3),tabY,tabW,tabH,function(){gs.lbTab='world';loadWorldScores();});

  // 排行列表
  var listY=tabY+tabH+S.s(15);
  var itemH=S.s(38);

  if(gs.lbTab==='friend'){
    // 好友排行
    // 尝试渲染开放数据域画布
    if(openDataContext){
      try {
        var sharedCanvas = openDataContext.canvas;
        if(sharedCanvas){
          ctx.drawImage(sharedCanvas, 0, listY, canvas.width, canvas.height - listY - S.s(80));
        }
      } catch(e) {}
    }

    // 备用：本地排行数据
    var lb=[];try{var d=wx.getStorageSync('leaderboard');if(d)lb=JSON.parse(d);}catch(e){}
    if(!lb.length){
      ctx.fillStyle=C.textDim;ctx.font=S.s(15)+'px Arial';ctx.textAlign='center';
      ctx.fillText('暂无好友记录',canvas.width/2,listY+S.s(80));
      ctx.font=S.s(12)+'px Arial';
      ctx.fillText('完成关卡后分数将自动上传',canvas.width/2,listY+S.s(110));
    } else {
      var ms=[C.neonYellow,'#C0C0C0','#CD7F32'];
      for(var i=0;i<Math.min(lb.length,10);i++){
        var iy=listY+i*itemH;
        ctx.fillStyle=i<3?hex2rgba(ms[i],0.08):'rgba(30,35,60,0.3)';
        ctx.fillRect(S.sx(20),iy,canvas.width-S.sx(40),itemH-S.s(4));
        ctx.fillStyle=i<3?ms[i]:C.textDim;ctx.font='bold '+S.s(15)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        var rank=i<3?['🥇','🥈','🥉'][i]:((i+1)+'.');
        ctx.fillText(rank,S.sx(30),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.textMain;ctx.font=S.s(14)+'px Arial';
        ctx.fillText('L'+(lb[i].level||'-')+' '+(lb[i].name||'我'),S.sx(70),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';
        ctx.fillText((lb[i].score||0)+'分',canvas.width-S.sx(30),iy+itemH/2-S.s(2));
      }
    }
  } else {
    // 世界排行
    if(!gs.worldScores||!gs.worldScores.length) loadWorldScores();
    if(gs.worldScores.length>0){
      var ms=[C.neonYellow,'#C0C0C0','#CD7F32'];
      for(var i=0;i<Math.min(gs.worldScores.length,10);i++){
        var iy=listY+i*itemH;
        ctx.fillStyle=i<3?hex2rgba(ms[i],0.08):'rgba(30,35,60,0.3)';
        ctx.fillRect(S.sx(20),iy,canvas.width-S.sx(40),itemH-S.s(4));
        ctx.fillStyle=i<3?ms[i]:C.textDim;ctx.font='bold '+S.s(15)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
        var rank=i<3?['🥇','🥈','🥉'][i]:((i+1)+'.');
        ctx.fillText(rank,S.sx(30),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.textMain;ctx.font=S.s(14)+'px Arial';
        ctx.fillText(gs.worldScores[i].name||'???',S.sx(70),iy+itemH/2-S.s(2));
        ctx.fillStyle=C.neonGreen;ctx.textAlign='right';
        ctx.fillText(gs.worldScores[i].score+'分',canvas.width-S.sx(30),iy+itemH/2-S.s(2));
      }
    } else {
      ctx.fillStyle=C.textDim;ctx.font=S.s(15)+'px Arial';ctx.textAlign='center';
      ctx.fillText('暂无世界排行数据',canvas.width/2,listY+S.s(80));
    }
  }

  // 返回
  var bw=S.s(280),backY=canvas.height-S.sy(70);
  drawBtn((canvas.width-bw)/2,backY,bw,S.s(50),'返回主菜单',C.neonRed);
  regBtn((canvas.width-bw)/2,backY,bw,S.s(50),function(){gs.currentScene='menu';});
}

// ===== 玩法说明 =====
function renderHelp(){
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=C.neonPurple;ctx.shadowBlur=12;ctx.fillStyle=C.neonPurple;ctx.font='bold '+S.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('玩法说明',canvas.width/2,S.safY(40));ctx.restore();

  var t=['▸ 点击方块 → 磁铁抓住它','▸ 左右滑动 → 甩动方块','▸ 再次点击 → 释放砸向建筑','▸ 砸中建筑 → 得分！','▸ 连续破坏 → 连击加分','▸ TNT方块 → 爆炸范围伤害','▸ 摧毁支撑 → 建筑倒塌','▸ 达到目标分数 → 过关'];
  ctx.fillStyle=C.textMain;ctx.font=S.s(14)+'px Arial';ctx.textAlign='left';
  for(var i=0;i<t.length;i++)ctx.fillText(t[i],S.sx(25),S.safY(80)+i*S.s(30));

  // 机制列表
  var mcY=S.safY(80)+t.length*S.s(30)+S.s(10);
  ctx.fillStyle=C.neonCyan;ctx.font='bold '+S.s(14)+'px Arial';ctx.textAlign='left';
  ctx.fillText('【每10关解锁新玩法】',S.sx(25),mcY);
  mcY+=S.s(24);

  // 显示前10个机制
  var showCount = Math.min(MECHANICS.length, 10);
  for(var mi=0;mi<showCount;mi++){
    var m=MECHANICS[mi];
    ctx.fillStyle=m.color;ctx.font=S.s(12)+'px Arial';ctx.textAlign='left';
    ctx.fillText('L'+m.level+': '+m.name+' - '+m.desc,S.sx(30),mcY+mi*S.s(20));
  }

  drawNPC(canvas.width-S.s(70),mcY+S.s(30),S.s(55));
  var bw=S.s(280),backY=canvas.height-S.sy(70);
  drawBtn((canvas.width-bw)/2,backY,bw,S.s(50),'返回主菜单',C.neonRed);
  regBtn((canvas.width-bw)/2,backY,bw,S.s(50),function(){gs.currentScene='menu';});
}

// ===== 通用绘制 =====
function drawBtn(x,y,w,h,t,c){ctx.save();ctx.fillStyle=hex2rgba(c,.08);rr(ctx,x,y,w,h,S.s(6));ctx.fill();ctx.shadowColor=c;ctx.shadowBlur=6;ctx.strokeStyle=hex2rgba(c,.6);ctx.lineWidth=S.s(1.5);rr(ctx,x,y,w,h,S.s(6));ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=c;ctx.font='bold '+S.s(17)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x+w/2,y+h/2);ctx.restore();}
function drawStars(){ctx.fillStyle='#fff';for(var i=0;i<50;i++){var x=(i*127+33)%canvas.width,y=(i*89+17)%canvas.height;ctx.globalAlpha=.3+Math.sin(frame*.02+i)*.2;ctx.fillRect(x,y,1,1);}ctx.globalAlpha=1;}

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
