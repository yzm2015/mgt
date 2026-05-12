/**
 * 磁吸拆迁队 - 微信小游戏 V2.1
 * 修复操控流程 + NPC引导 + 返回菜单
 */

// ==================== 模块导入 ====================
var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

// ==================== 科幻配色 ====================
var THEME = {
  bgDark: '#070b1a', bgMid: '#0d1333', bgLight: '#141b4d',
  neonCyan: '#00f0ff', neonPurple: '#b44aff', neonGreen: '#00ff88',
  neonRed: '#ff3366', neonYellow: '#ffe033', neonOrange: '#ff8800',
  panelBg: 'rgba(10, 14, 40, 0.85)', panelBorder: 'rgba(0, 240, 255, 0.3)',
  textMain: '#e0e8ff', textDim: '#6b7db3',
  groundColor: '#0a1628', groundLine: 'rgba(0, 240, 255, 0.12)',
  npcSkin: '#FFD5B8', npcHair: '#FF6B9D', npcDress: '#9B59B6', npcEyes: '#4FC3F7'
};

// ==================== 游戏配置 ====================
var CONFIG = {
  gravity: 0.5, ropeLength: 150, magnetRadius: 80,
  magnetPower: 0.8, craneSpeed: 5, damping: 0.99,
  bounceDamping: 0.5, friction: 0.8
};

// ==================== 全局状态 ====================
var gameState = {
  score: 0, timeLeft: 60, gameActive: false, gamePaused: false,
  currentLevel: 1, targetScore: 500, stars: 0,
  currentScene: 'menu', screenShake: 0, screenShakeX: 0, screenShakeY: 0,
  comboCount: 0, comboTimer: 0, flashAlpha: 0, magnetPulse: 0,
  // NPC对话
  npcDialogue: '', npcDialogueTimer: 0, npcDialogueQueue: [],
  npcMood: 'normal', // normal, happy, sad, excited, thinking
  tutorialStep: 0
};

var canvas, ctx, physics, crane, buildingGenerator, audioManager;
var buildings = [], particles = [], floatingTexts = [];
var gameTimer = null, loopRunning = false, frameCount = 0, lastTime = 0;
var uiButtons = []; // 统一按钮注册表，渲染时写入，触摸时读取

// 触摸状态
var touch = { startX: 0, startY: 0, lastX: 0, lastY: 0, isDragging: false, dragDist: 0, startTime: 0, moved: false };

// ==================== 屏幕适配 ====================
var SA = {
  w: 375, h: 667, pr: 1, sf: 1,
  safeTop: 44, safeBottom: 0, safeLeft: 0, safeRight: 0, statusH: 44,
  init: function() {
    try {
      var info = wx.getSystemInfoSync();
      this.w = info.windowWidth || info.screenWidth || 375;
      this.h = info.windowHeight || info.screenHeight || 667;
      this.pr = info.pixelRatio || 1;
      this.sf = this.w / 375;
      this.statusH = info.statusBarHeight || 44;
      if (info.safeArea) {
        this.safeTop = info.safeArea.top || this.statusH;
        this.safeBottom = this.h - (info.safeArea.bottom || this.h);
      } else {
        this.safeTop = Math.max(this.statusH, 44);
        var m = (info.model || '').toLowerCase();
        if (m.indexOf('iphone') !== -1 && this.h >= 812) { this.safeTop = 44; this.safeBottom = 34; }
      }
    } catch(e) { this.safeTop = 44; }
  },
  sx: function(x) { return x * this.sf; },
  sy: function(y) { return y * this.sf; },
  s: function(v) { return v * this.sf; },
  safeY: function(y) { return this.safeTop + y * this.sf; }
};

// ==================== 工具函数 ====================
function darkenColor(c, f) {
  if (!c || typeof c !== 'string') return '#000000'; f = f || 0.7;
  var r, g, b;
  if (c.indexOf('#') === 0) { var h = c.substring(1); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; r=parseInt(h.substring(0,2),16); g=parseInt(h.substring(2,4),16); b=parseInt(h.substring(4,6),16); }
  else if (c.indexOf('rgb') === 0) { var m = c.match(/(\d+)/g); if(m&&m.length>=3){r=+m[0];g=+m[1];b=+m[2];}else return '#000000'; }
  else return '#000000';
  r=Math.max(0,Math.min(255,Math.floor(r*f))); g=Math.max(0,Math.min(255,Math.floor(g*f))); b=Math.max(0,Math.min(255,Math.floor(b*f)));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function hexToRgba(hex, a) {
  if(!hex||hex.indexOf('#')!==0) return 'rgba(0,0,0,'+a+')';
  var h=hex.substring(1); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return 'rgba('+parseInt(h.substring(0,2),16)+','+parseInt(h.substring(2,4),16)+','+parseInt(h.substring(4,6),16)+','+a+')';
}

function safeGrad(ctx, x0, y0, x1, y1) {
  try { if(x0===x1&&y0===y1) x1=x0+1; if(typeof ctx.createLinearGradient==='function') return ctx.createLinearGradient(x0,y0,x1,y1); } catch(e){}
  return null;
}

function drawRR(ctx, x, y, w, h, r) {
  r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

// ==================== NPC系统 ====================
var NPC = {
  name: '小磁',
  dialogues: {
    welcome: ['欢迎来到磁吸拆迁队！我是小磁~', '让我教你如何使用磁力起重机吧！'],
    grab: ['点击方块就能用磁铁抓住它哦~', '靠近建筑点击试试看！'],
    swing: ['滑动屏幕让起重机左右移动~', '抓着方块晃动，甩出去砸建筑！'],
    release: ['松手就能把方块抛出去啦！', '利用摆锤的惯性甩得更远哦~'],
    destroy: ['哇，砸得好！继续加油！', '破坏得越狠，得分越高哦~'],
    combo: ['连击！太厉害了！', '连续破坏有额外加分哦~'],
    tnt: ['小心TNT方块，会爆炸的！', '利用爆炸可以连锁破坏~'],
    lowtime: ['时间不多了，加油啊！', '快快快，最后冲刺！'],
    win: ['太棒了，通关啦！', '你真是拆迁天才！'],
    lose: ['没关系，再来一次吧~', '下次一定能通过的！'],
    idle: ['点击建筑上的方块试试~', '别发呆啦，快动手！', '磁力就在你指尖~'],
    tutorial_step1: ['第一步：点击一个方块，磁铁会自动抓住它'],
    tutorial_step2: ['第二步：左右滑动移动起重机，甩动方块'],
    tutorial_step3: ['第三步：松手释放方块，砸向建筑！'],
    back_menu: ['随时可以回来找我哦~', '想我了就点主菜单~']
  },

  say: function(category, idx) {
    var list = this.dialogues[category];
    if (!list || list.length === 0) return '';
    return list[idx !== undefined ? idx % list.length : Math.floor(Math.random() * list.length)];
  },

  queueDialogue: function(category) {
    var list = this.dialogues[category];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      gameState.npcDialogueQueue.push(list[i]);
    }
  },

  showDialogue: function(text, duration) {
    gameState.npcDialogue = text;
    gameState.npcDialogueTimer = duration || 180; // 3秒@60fps
  }
};

// ==================== 初始化 ====================
function init() {
  console.log('磁吸拆迁队 V2.1 初始化...');
  try {
    SA.init();
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');
    var info = wx.getSystemInfoSync();
    canvas.width = info.windowWidth || info.screenWidth || 375;
    canvas.height = info.windowHeight || info.screenHeight || 667;

    physics = new PhysicsSystem(CONFIG);
    crane = new CraneController(canvas, CONFIG);
    buildingGenerator = new BuildingGenerator(canvas, CONFIG);
    audioManager = new AudioManager();
    crane.setPhysicsSystem(physics);
    audioManager.init();

    // 修正起重机位置和绳长
    crane.crane.y = SA.safeTop + SA.s(5);
    crane.crane.x = canvas.width / 2;
    // 绳长：画面35%左右，磁铁悬浮在建筑上方
    crane.pendulum.ropeLength = Math.floor(canvas.height * 0.32);
    crane.magnet.x = crane.crane.x;
    crane.magnet.y = crane.crane.y + crane.crane.height + crane.pendulum.ropeLength;
    // 吸附范围覆盖到地面建筑
    crane.magnet.attractRadius = canvas.height * 0.5;

    gameState.currentScene = 'menu';
    NPC.queueDialogue('welcome');
    processDialogueQueue();

    bindTouchEvents();
    loopRunning = true;
    lastTime = Date.now();
    gameLoop();
    console.log('初始化完成 画布:' + canvas.width + 'x' + canvas.height);
  } catch(err) { console.error('初始化失败:', err); }
}

function nextFrame(cb) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
  else if (canvas && typeof canvas.requestAnimationFrame === 'function') canvas.requestAnimationFrame(cb);
  else setTimeout(cb, 16);
}

// ==================== 对话队列处理 ====================
function processDialogueQueue() {
  if (gameState.npcDialogueTimer > 0) return;
  if (gameState.npcDialogueQueue.length > 0) {
    NPC.showDialogue(gameState.npcDialogueQueue.shift(), 180);
  }
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (!loopRunning) return;
  var now = Date.now();
  lastTime = now;
  frameCount++;

  if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
    update();
  }

  // 屏幕震动衰减
  if (gameState.screenShake > 0) {
    gameState.screenShake *= 0.9;
    gameState.screenShakeX = (Math.random()-0.5) * gameState.screenShake;
    gameState.screenShakeY = (Math.random()-0.5) * gameState.screenShake;
    if (gameState.screenShake < 0.5) gameState.screenShake = 0;
  }

  updateParticles();
  updateFloatingTexts();
  gameState.magnetPulse = (gameState.magnetPulse + 0.05) % (Math.PI * 2);
  if (gameState.flashAlpha > 0) gameState.flashAlpha *= 0.85;
  if (gameState.comboTimer > 0) { gameState.comboTimer--; if (gameState.comboTimer <= 0) gameState.comboCount = 0; }
  if (gameState.npcDialogueTimer > 0) gameState.npcDialogueTimer--;
  processDialogueQueue();

  // 空闲提示
  if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused && frameCount % 600 === 0) {
    NPC.showDialogue(NPC.say('idle'), 150);
  }

  render();
  nextFrame(gameLoop);
}

function update() {
  crane.update();
  buildingGenerator.update(physics);
  checkMagnetCollision();
  checkGameEnd();
}

// ==================== 触摸控制 ====================
function bindTouchEvents() {
  wx.onTouchStart(function(e) {
    if (!e || !e.touches || e.touches.length === 0) return;
    var t = e.touches[0];
    touch.startX = t.clientX; touch.startY = t.clientY;
    touch.lastX = t.clientX; touch.lastY = t.clientY;
    touch.isDragging = true; touch.dragDist = 0;
    touch.startTime = Date.now(); touch.moved = false;
  });

  wx.onTouchMove(function(e) {
    if (!e || !e.touches || e.touches.length === 0) return;
    var t = e.touches[0];
    var dx = t.clientX - touch.lastX;
    touch.dragDist += Math.abs(dx);
    if (touch.dragDist > 10) touch.moved = true;

    if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
      // 拖动控制起重机移动
      if (Math.abs(dx) > 2) {
        crane.move(dx > 0 ? 1 : -1);
        // 抓着东西时晃动增加角速度
        if (crane.magnet.isGrabbing) {
          crane.pendulum.angularVelocity += dx * 0.003;
        }
      }
    }
    touch.lastX = t.clientX; touch.lastY = t.clientY;
  });

  wx.onTouchEnd(function(e) {
    var x = touch.lastX, y = touch.lastY;
    var elapsed = Date.now() - touch.startTime;
    var isTap = !touch.moved || elapsed < 250;

    // 优先查找注册按钮
    var btn = findBtn(x, y);
    if (btn) {
      audioManager.playSound(SoundNames.BUTTON);
      btn.action();
      touch.isDragging = false; touch.moved = false;
      return;
    }

    // 游戏场景的特殊触摸（抓取/释放方块）
    if (gameState.currentScene === 'game') {
      handleGameTouch(x, y, isTap);
    }
    touch.isDragging = false; touch.moved = false;
  });
}

// 主菜单触摸已由按钮注册表处理

// ==================== 游戏触摸（核心修复） ====================
function handleGameTouch(x, y, isTap) {
  // 返回菜单和暂停按钮已由按钮注册表处理
  if (gameState.gamePaused || !gameState.gameActive) return;

  if (isTap) {
    if (crane.isGrabbing()) {
      // ===== 释放方块 =====
      var block = crane.releaseMagnet();
      if (block) {
        audioManager.playSound(SoundNames.RELEASE);
        spawnParticles(block.x + block.width/2, block.y + block.height/2, THEME.neonCyan, 8);
        // 根据摆锤角度给额外水平速度
        var throwForce = crane.pendulum.angularVelocity * 80;
        block.velocityX += throwForce;
        block.velocityY = -8;
        NPC.showDialogue(NPC.say('release'), 100);
        gameState.tutorialStep = Math.max(gameState.tutorialStep, 3);
      }
    } else {
      // ===== 抓取方块：找触摸点最近的方块 =====
      var best = null, bestDist = crane.magnet.attractRadius * 2;
      for (var i = 0; i < buildings.length; i++) {
        var b = buildings[i];
        if (b.isDestroyed || b.isGrabbed) continue;
        var bx = b.x + b.width/2;
        var by = b.y + b.height/2;
        var d = Math.sqrt((x-bx)*(x-bx) + (y-by)*(y-by));
        if (d < bestDist) { bestDist = d; best = b; }
      }
      if (best) {
        crane.magnet.isActive = true;
        crane.magnet.isGrabbing = true;
        crane.magnet.grabbedBlock = best;
        best.isGrabbed = true;
        // 方块飞向磁铁位置（而非磁铁移到方块）
        best.x = crane.magnet.x - best.width/2;
        best.y = crane.magnet.y + crane.magnet.radius;
        // 起重机移到方块所在列
        crane.crane.x = crane.magnet.x;
        crane.pendulum.angle = 0;
        crane.pendulum.angularVelocity = 0;
        audioManager.playSound(SoundNames.GRAB);
        spawnParticles(crane.magnet.x, crane.magnet.y, THEME.neonPurple, 6);
        NPC.showDialogue(NPC.say('grab'), 100);
        gameState.tutorialStep = Math.max(gameState.tutorialStep, 1);
      } else {
        // 没找到方块，提示
        NPC.showDialogue('点击建筑上的方块来抓取哦~', 120);
      }
    }
  }
}

// ==================== 游戏结束触摸 ====================
// 游戏结束触摸已由按钮注册表处理

// 关卡选择/返回触摸已由按钮注册表处理

// ==================== 加载关卡 ====================
function loadLevel(level) {
  clearGameTimer();
  buildings = buildingGenerator.generateLevel(level);
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0; gameState.gameActive = true; gameState.gamePaused = false;
  gameState.currentScene = 'game';
  gameState.comboCount = 0; gameState.comboTimer = 0;
  particles = []; floatingTexts = []; gameState.tutorialStep = 0;

  // 重置起重机
  crane.crane.x = canvas.width / 2;
  crane.pendulum.ropeLength = Math.floor(canvas.height * 0.32);
  crane.magnet.x = crane.crane.x;
  crane.magnet.y = crane.crane.y + crane.crane.height + crane.pendulum.ropeLength;
  crane.magnet.attractRadius = canvas.height * 0.5;
  crane.magnet.isActive = false;
  crane.magnet.isGrabbing = false;
  crane.magnet.grabbedBlock = null;
  crane.pendulum.angle = 0;
  crane.pendulum.angularVelocity = 0;

  startTimer();
  // NPC引导
  NPC.queueDialogue('tutorial_step1');
  processDialogueQueue();
}

function clearGameTimer() { if(gameTimer){clearInterval(gameTimer);gameTimer=null;} }

function startTimer() {
  clearGameTimer();
  gameTimer = setInterval(function() {
    if (!gameState.gameActive || gameState.gamePaused) return;
    gameState.timeLeft--;
    if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
      try{wx.vibrateShort();}catch(e){}
      audioManager.playSound(SoundNames.WARNING);
      if (gameState.timeLeft <= 5) NPC.showDialogue(NPC.say('lowtime'), 90);
    }
    if (gameState.timeLeft <= 0) { gameState.timeLeft = 0; endGame(false); }
  }, 1000);
}

function togglePause() {
  gameState.gamePaused = !gameState.gamePaused;
  audioManager.playSound(SoundNames.BUTTON);
}

// ==================== 碰撞检测 ====================
function checkMagnetCollision() {
  if (!crane.isGrabbing()) return;
  var mp = crane.getMagnetPosition();
  buildings.forEach(function(block) {
    if (block.isDestroyed || block.isGrabbed) return;
    var bx = block.x+block.width/2, by = block.y+block.height/2;
    var dx = bx-mp.x, dy = by-mp.y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    var speed = Math.sqrt(block.velocityX*block.velocityX + block.velocityY*block.velocityY);
    if (dist < 100 && speed > 2) {
      var impactForce = speed * block.mass * 10;
      var result = physics.calculateDamage(block, impactForce);
      if (result.damage > 0) {
        var dr = buildingGenerator.damageBlock(block, result.damage);
        audioManager.playSound(SoundNames.CRASH);
        gameState.screenShake = Math.min(12, impactForce * 0.3);
        if (dr.destroyed) {
          var pts = dr.score;
          gameState.comboCount++; gameState.comboTimer = 60;
          if (gameState.comboCount > 1) pts = Math.floor(pts * (1 + gameState.comboCount * 0.2));
          gameState.score += pts;
          spawnParticles(bx, by, block.color || THEME.neonRed, 15);
          spawnDebris(bx, by, block.color || THEME.neonOrange, 8);
          addFloatingText(bx, by, '+'+pts, gameState.comboCount > 1 ? THEME.neonYellow : THEME.neonGreen);
          gameState.flashAlpha = 0.15;
          audioManager.playSound(SoundNames.DESTROY);
          NPC.showDialogue(NPC.say(gameState.comboCount > 2 ? 'combo' : 'destroy'), 80);
          if (block.explosive) {
            gameState.screenShake = 20; gameState.flashAlpha = 0.4;
            spawnParticles(bx, by, THEME.neonRed, 25);
            NPC.showDialogue(NPC.say('tnt'), 100);
          }
        }
      }
    }
  });
}

// ==================== 粒子系统 ====================
function spawnParticles(x,y,color,count) {
  for(var i=0;i<count;i++){var a=Math.random()*Math.PI*2,s=1+Math.random()*4;
    particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:30+Math.random()*20,maxLife:50,color:color,size:2+Math.random()*4,type:'spark'});}
}
function spawnDebris(x,y,color,count) {
  for(var i=0;i<count;i++){var a=Math.random()*Math.PI*2,s=2+Math.random()*5;
    particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,life:40+Math.random()*30,maxLife:70,color:color,size:4+Math.random()*8,type:'debris',rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*0.3});}
}
function updateParticles() {
  for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.vx*=0.98;p.life--;
    if(p.rotation!==undefined)p.rotation+=p.rotSpeed;if(p.life<=0)particles.splice(i,1);}
}
function addFloatingText(x,y,text,color) { floatingTexts.push({x:x,y:y,text:text,color:color,life:40,vy:-2}); }
function updateFloatingTexts() {
  for(var i=floatingTexts.length-1;i>=0;i--){var ft=floatingTexts[i];ft.y+=ft.vy;ft.vy*=0.96;ft.life--;if(ft.life<=0)floatingTexts.splice(i,1);}
}

function checkGameEnd() { if(gameState.score>=gameState.targetScore) endGame(true); }
function endGame(isWin) {
  gameState.gameActive=false; clearGameTimer();
  var pct=gameState.targetScore>0?gameState.score/gameState.targetScore:0;
  gameState.stars=pct>=1.0?3:pct>=0.8?2:pct>=0.5?1:0;
  if(isWin) saveToLeaderboard(gameState.currentLevel,gameState.score);
  audioManager.playSound(isWin?SoundNames.WIN:SoundNames.LOSE);
  gameState.currentScene='gameover';
  NPC.showDialogue(NPC.say(isWin?'win':'lose'), 200);
}
function saveToLeaderboard(level,score) {
  try{var lb=[];var d=wx.getStorageSync('leaderboard');if(d)lb=JSON.parse(d);
    lb.push({level:level,score:score,time:Date.now()});lb.sort(function(a,b){return b.score-a.score;});
    if(lb.length>20)lb=lb.slice(0,20);wx.setStorageSync('leaderboard',JSON.stringify(lb));}catch(e){}
}

// ==================== 渲染 ====================
function render() {
  uiButtons = []; // 每帧重置按钮注册表
  ctx.save();
  if(gameState.screenShake>0) ctx.translate(gameState.screenShakeX,gameState.screenShakeY);
  switch(gameState.currentScene) {
    case 'menu': renderMainMenu(); break;
    case 'game': renderGameScene(); break;
    case 'gameover': renderGameScene(); renderGameOver(); break;
    case 'levelselect': renderLevelSelect(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'instructions': renderInstructions(); break;
  }
  ctx.restore();
}

// 注册按钮（渲染时调用）
function regBtn(x, y, w, h, action) {
  uiButtons.push({ x: x, y: y, w: w, h: h, action: action });
}

// 查找点击的按钮
function findBtn(px, py) {
  for (var i = 0; i < uiButtons.length; i++) {
    var b = uiButtons[i];
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
  }
  return null;
}

// ==================== 主菜单渲染 ====================
function renderMainMenu() {
  var bg = safeGrad(ctx,0,0,0,canvas.height);
  if(bg){bg.addColorStop(0,'#020510');bg.addColorStop(0.5,'#0a1035');bg.addColorStop(1,'#050a20');ctx.fillStyle=bg;}
  else ctx.fillStyle=THEME.bgDark;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawStars(); drawSciGrid();

  // NPC角色
  drawNPC(SA.sx(30), SA.safeY(50), SA.s(80));

  // 标题
  ctx.save(); ctx.shadowColor=THEME.neonCyan; ctx.shadowBlur=20;
  ctx.fillStyle=THEME.neonCyan; ctx.font='bold '+SA.s(30)+'px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('磁吸拆迁队', canvas.width/2, SA.safeY(170));
  ctx.shadowBlur=0; ctx.restore();

  ctx.fillStyle=THEME.textDim; ctx.font=SA.s(12)+'px Arial'; ctx.textAlign='center';
  ctx.fillText('MAGNETIC DEMOLITION TEAM', canvas.width/2, SA.safeY(198));

  // NPC对话气泡
  if (gameState.npcDialogue && gameState.npcDialogueTimer > 0) {
    drawDialogueBubble(SA.sx(120), SA.safeY(35), SA.s(220), gameState.npcDialogue);
  }

  // 按钮（渲染时注册到uiButtons，触摸时自动匹配）
  var cx=canvas.width/2, btnW=SA.s(240), btnH=SA.s(52), startY=SA.safeY(225);
  var labels=['开始游戏','关卡选择','排行榜','玩法说明'];
  var colors=[THEME.neonGreen,THEME.neonCyan,THEME.neonYellow,THEME.neonPurple];
  var actions=[
    function(){ loadLevel(gameState.currentLevel); },
    function(){ gameState.currentScene='levelselect'; },
    function(){ gameState.currentScene='leaderboard'; },
    function(){ gameState.currentScene='instructions'; }
  ];
  for(var i=0;i<labels.length;i++){
    var btnY=startY+i*(btnH+SA.s(14));
    drawSciButton(cx-btnW/2,btnY,btnW,btnH,labels[i],colors[i]);
    regBtn(cx-btnW/2,btnY,btnW,btnH,actions[i]);
  }
}

// ==================== NPC角色绘制（动漫风） ====================
function drawNPC(x, y, size) {
  ctx.save();
  var s = size;
  var cx = x + s * 0.4; // 角色中心偏移

  // 身体发光光环
  var pulse = Math.sin(frameCount * 0.03) * 0.15 + 0.85;
  ctx.strokeStyle = hexToRgba(THEME.neonPurple, 0.3 * pulse);
  ctx.lineWidth = SA.s(2);
  ctx.beginPath(); ctx.arc(cx, y + s * 0.5, s * 0.45, 0, Math.PI * 2); ctx.stroke();

  // 头发（长粉色头发）
  ctx.fillStyle = THEME.npcHair;
  // 头发外轮廓
  ctx.beginPath();
  ctx.ellipse(cx, y + s * 0.22, s * 0.28, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // 左侧长发
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, y + s * 0.2);
  ctx.quadraticCurveTo(cx - s * 0.35, y + s * 0.55, cx - s * 0.2, y + s * 0.85);
  ctx.quadraticCurveTo(cx - s * 0.12, y + s * 0.85, cx - s * 0.15, y + s * 0.4);
  ctx.fill();
  // 右侧长发
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.25, y + s * 0.2);
  ctx.quadraticCurveTo(cx + s * 0.35, y + s * 0.55, cx + s * 0.2, y + s * 0.85);
  ctx.quadraticCurveTo(cx + s * 0.12, y + s * 0.85, cx + s * 0.15, y + s * 0.4);
  ctx.fill();

  // 脸部
  ctx.fillStyle = THEME.npcSkin;
  ctx.beginPath();
  ctx.ellipse(cx, y + s * 0.28, s * 0.2, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 刘海
  ctx.fillStyle = THEME.npcHair;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22, y + s * 0.15);
  ctx.quadraticCurveTo(cx - s * 0.15, y + s * 0.05, cx, y + s * 0.08);
  ctx.quadraticCurveTo(cx + s * 0.15, y + s * 0.05, cx + s * 0.22, y + s * 0.15);
  ctx.quadraticCurveTo(cx + s * 0.18, y + s * 0.22, cx + s * 0.08, y + s * 0.2);
  ctx.quadraticCurveTo(cx, y + s * 0.18, cx - s * 0.08, y + s * 0.2);
  ctx.quadraticCurveTo(cx - s * 0.18, y + s * 0.22, cx - s * 0.22, y + s * 0.15);
  ctx.fill();

  // 眼睛（大动漫眼）
  // 左眼
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(cx - s * 0.08, y + s * 0.27, s * 0.06, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = THEME.npcEyes;
  ctx.beginPath(); ctx.ellipse(cx - s * 0.08, y + s * 0.28, s * 0.04, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.ellipse(cx - s * 0.08, y + s * 0.29, s * 0.025, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  // 高光
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(cx - s * 0.06, y + s * 0.26, s * 0.015, 0, Math.PI * 2); ctx.fill();

  // 右眼
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(cx + s * 0.08, y + s * 0.27, s * 0.06, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = THEME.npcEyes;
  ctx.beginPath(); ctx.ellipse(cx + s * 0.08, y + s * 0.28, s * 0.04, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.ellipse(cx + s * 0.08, y + s * 0.29, s * 0.025, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(cx + s * 0.1, y + s * 0.26, s * 0.015, 0, Math.PI * 2); ctx.fill();

  // 嘴巴
  var mouthOpen = (gameState.npcDialogueTimer > 0 && frameCount % 12 < 6) ? s * 0.015 : 0;
  ctx.strokeStyle = '#E88B8B';
  ctx.lineWidth = SA.s(1.5);
  ctx.beginPath();
  ctx.arc(cx, y + s * 0.35, s * 0.04, 0.1, Math.PI - 0.1);
  ctx.stroke();
  if (mouthOpen > 0) {
    ctx.fillStyle = '#D46A6A';
    ctx.beginPath(); ctx.ellipse(cx, y + s * 0.355, s * 0.025, mouthOpen, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 腮红
  ctx.fillStyle = 'rgba(255, 150, 150, 0.25)';
  ctx.beginPath(); ctx.ellipse(cx - s * 0.14, y + s * 0.32, s * 0.035, s * 0.02, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + s * 0.14, y + s * 0.32, s * 0.035, s * 0.02, 0, 0, Math.PI * 2); ctx.fill();

  // 身体（简化 - 紫色衣服）
  ctx.fillStyle = THEME.npcDress;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, y + s * 0.42);
  ctx.quadraticCurveTo(cx - s * 0.2, y + s * 0.7, cx - s * 0.18, y + s * 0.95);
  ctx.lineTo(cx + s * 0.18, y + s * 0.95);
  ctx.quadraticCurveTo(cx + s * 0.2, y + s * 0.7, cx + s * 0.12, y + s * 0.42);
  ctx.fill();
  // 衣服装饰线
  ctx.strokeStyle = hexToRgba(THEME.neonCyan, 0.5);
  ctx.lineWidth = SA.s(1);
  ctx.beginPath(); ctx.moveTo(cx, y + s * 0.42); ctx.lineTo(cx, y + s * 0.65); ctx.stroke();

  // 名字标签
  ctx.fillStyle = THEME.neonPurple;
  ctx.font = 'bold ' + SA.s(11) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('小磁', cx, y + s);

  ctx.restore();
}

// ==================== NPC对话气泡 ====================
function drawDialogueBubble(x, y, maxW, text) {
  if (!text) return;
  ctx.save();

  var fs = SA.s(13);
  ctx.font = fs + 'px Arial';

  // 自动换行
  var lines = [];
  var line = '';
  for (var i = 0; i < text.length; i++) {
    var testLine = line + text[i];
    if (ctx.measureText(testLine).width > maxW - SA.s(20)) {
      lines.push(line);
      line = text[i];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  var lineH = fs + SA.s(4);
  var bubbleH = lines.length * lineH + SA.s(16);
  var bubbleW = maxW;
  var alpha = Math.min(1, gameState.npcDialogueTimer / 30);

  // 气泡背景
  ctx.fillStyle = 'rgba(20, 15, 50, ' + (0.9 * alpha) + ')';
  drawRR(ctx, x, y, bubbleW, bubbleH, SA.s(8));
  ctx.fill();
  ctx.strokeStyle = hexToRgba(THEME.neonPurple, 0.6 * alpha);
  ctx.lineWidth = SA.s(1);
  drawRR(ctx, x, y, bubbleW, bubbleH, SA.s(8));
  ctx.stroke();

  // 小三角指向NPC
  ctx.fillStyle = 'rgba(20, 15, 50, ' + (0.9 * alpha) + ')';
  ctx.beginPath();
  ctx.moveTo(x + SA.s(10), y);
  ctx.lineTo(x, y - SA.s(8));
  ctx.lineTo(x + SA.s(20), y);
  ctx.fill();

  // 文字
  ctx.fillStyle = hexToRgba(THEME.textMain, alpha);
  ctx.font = fs + 'px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (var li = 0; li < lines.length; li++) {
    ctx.fillText(lines[li], x + SA.s(10), y + SA.s(8) + li * lineH);
  }

  ctx.restore();
}

// ==================== 科幻按钮 ====================
function drawSciButton(x,y,w,h,text,color) {
  ctx.save();
  ctx.fillStyle=hexToRgba(color,0.08); drawRR(ctx,x,y,w,h,SA.s(6)); ctx.fill();
  ctx.shadowColor=color; ctx.shadowBlur=8; ctx.strokeStyle=hexToRgba(color,0.6);
  ctx.lineWidth=SA.s(1.5); drawRR(ctx,x,y,w,h,SA.s(6)); ctx.stroke(); ctx.shadowBlur=0;
  ctx.strokeStyle=hexToRgba(color,0.8); ctx.lineWidth=SA.s(1);
  ctx.beginPath(); ctx.moveTo(x+SA.s(10),y); ctx.lineTo(x+w-SA.s(10),y); ctx.stroke();
  ctx.fillStyle=color; ctx.font='bold '+SA.s(17)+'px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,x+w/2,y+h/2);
  ctx.restore();
}

function drawStars() {
  ctx.fillStyle='#ffffff';
  for(var i=0;i<60;i++){var sx=((i*127+33)%canvas.width),sy=((i*89+17)%canvas.height),sz=((i%3)+1)*0.5;
    ctx.globalAlpha=0.3+Math.sin(frameCount*0.02+i)*0.2; ctx.fillRect(sx,sy,sz,sz);}
  ctx.globalAlpha=1;
}

function drawSciGrid() {
  ctx.strokeStyle='rgba(0,240,255,0.04)'; ctx.lineWidth=1; var sp=SA.s(40);
  for(var x=0;x<canvas.width;x+=sp){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(var y=0;y<canvas.height;y+=sp){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
}

// ==================== 游戏场景渲染 ====================
function renderGameScene() {
  var bg=safeGrad(ctx,0,0,0,canvas.height);
  if(bg){bg.addColorStop(0,'#020510');bg.addColorStop(0.6,'#0a1035');bg.addColorStop(1,'#0d1540');ctx.fillStyle=bg;}
  else ctx.fillStyle=THEME.bgDark;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawStars(); drawSciGrid();

  // 地面
  var groundY=canvas.height-SA.s(50);
  ctx.fillStyle=THEME.groundColor; ctx.fillRect(0,groundY,canvas.width,SA.s(50));
  ctx.strokeStyle=THEME.groundLine; ctx.lineWidth=SA.s(1);
  ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(canvas.width,groundY); ctx.stroke();
  ctx.strokeStyle='rgba(0,240,255,0.06)';
  for(var gx=0;gx<canvas.width;gx+=SA.s(30)){ctx.beginPath();ctx.moveTo(gx,groundY);ctx.lineTo(gx,canvas.height);ctx.stroke();}

  drawBuildings(); drawCrane(); drawParticles(); drawFloatingTexts();

  if(gameState.flashAlpha>0.01){ctx.fillStyle='rgba(255,255,255,'+gameState.flashAlpha+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
  drawGameUI();
  if(gameState.gamePaused) drawPauseOverlay();

  // 游戏中NPC小头像+对话
  if (gameState.npcDialogue && gameState.npcDialogueTimer > 0) {
    var npcSize = SA.s(40);
    drawNPC(SA.sx(5), canvas.height - npcSize - SA.s(10), npcSize);
    drawDialogueBubble(SA.sx(50), canvas.height - SA.s(60), SA.s(240), gameState.npcDialogue);
  }
}

// ==================== 建筑渲染 ====================
function drawBuildings() {
  buildings.forEach(function(block) {
    if(block.isDestroyed) return;
    var hp=block.health/block.maxHealth;
    var bx=block.x,by=block.y,bw=block.width,bh=block.height;
    ctx.save();

    var bg=safeGrad(ctx,bx,by,bx,by+bh);
    var bc=getBlockColor(block.type,hp);
    if(bg){bg.addColorStop(0,bc.light);bg.addColorStop(1,bc.dark);ctx.fillStyle=bg;}
    else ctx.fillStyle=block.color;
    ctx.fillRect(bx,by,bw,bh);

    ctx.strokeStyle=getBlockGlow(block.type,hp);
    ctx.lineWidth=hp<0.5?SA.s(2):SA.s(1); ctx.strokeRect(bx,by,bw,bh);
    if(hp<0.7) drawCracks(bx,by,bw,bh,hp);
    drawBlockDetail(bx,by,bw,bh,block.type);

    if(hp<1.0){var barW=bw*0.8,barH=SA.s(3),barX=bx+(bw-barW)/2,barY=by-SA.s(7);
      ctx.fillStyle='rgba(255,0,0,0.5)';ctx.fillRect(barX,barY,barW,barH);
      ctx.fillStyle=hp>0.5?THEME.neonGreen:hp>0.25?THEME.neonYellow:THEME.neonRed;
      ctx.fillRect(barX,barY,barW*hp,barH);}
    ctx.restore();
  });
}

function getBlockColor(t,hp){var c={wood:{light:'#8B6914',dark:'#5C4409'},brick:{light:'#A03020',dark:'#6B1A10'},steel:{light:'#607080',dark:'#3A4550'},ice:{light:'#4FC3F7',dark:'#0288D1'},rubber:{light:'#E91E90',dark:'#AD1457'},tnt:{light:'#FF5722',dark:'#BF360C'}};var r=c[t]||c.wood;if(hp<0.5)return{light:darkenColor(r.light,0.6),dark:darkenColor(r.dark,0.6)};return r;}
function getBlockGlow(t,hp){var g={wood:'rgba(139,105,20,0.4)',brick:'rgba(160,48,32,0.4)',steel:'rgba(0,240,255,0.3)',ice:'rgba(79,195,247,0.5)',rubber:'rgba(233,30,144,0.4)',tnt:'rgba(255,87,34,0.6)'};if(hp<0.3)return'rgba(255,50,50,0.7)';return g[t]||g.wood;}
function drawCracks(x,y,w,h,hp){ctx.strokeStyle='rgba(0,0,0,0.6)';ctx.lineWidth=SA.s(1);var n=hp<0.3?4:2;for(var i=0;i<n;i++){ctx.beginPath();ctx.moveTo(x+w*(0.2+i*0.3),y);ctx.lineTo(x+w*(0.3+i*0.2),y+h*0.4);ctx.lineTo(x+w*(0.15+i*0.25),y+h*0.7);ctx.lineTo(x+w*(0.25+i*0.3),y+h);ctx.stroke();}if(hp<0.3&&frameCount%20<10){ctx.fillStyle='rgba(255,0,0,0.1)';ctx.fillRect(x,y,w,h);}}
function drawBlockDetail(x,y,w,h,t){
  if(t==='steel'){ctx.fillStyle='rgba(200,220,240,0.3)';var r=SA.s(3);ctx.beginPath();ctx.arc(x+SA.s(6),y+SA.s(6),r,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+w-SA.s(6),y+SA.s(6),r,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+SA.s(6),y+h-SA.s(6),r,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+w-SA.s(6),y+h-SA.s(6),r,0,Math.PI*2);ctx.fill();}
  else if(t==='ice'){ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(x+SA.s(4),y+SA.s(4),w*0.3,SA.s(2));ctx.fillRect(x+SA.s(4),y+SA.s(10),w*0.15,SA.s(2));}
  else if(t==='tnt'){ctx.fillStyle='rgba(255,255,0,0.8)';ctx.font='bold '+SA.s(12)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('TNT',x+w/2,y+h/2);}
  else if(t==='brick'){ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=SA.s(0.5);ctx.beginPath();ctx.moveTo(x,y+h/3);ctx.lineTo(x+w,y+h/3);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+h*2/3);ctx.lineTo(x+w,y+h*2/3);ctx.stroke();ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y+h/3);ctx.stroke();}
  else if(t==='wood'){ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=SA.s(0.5);for(var i=0;i<3;i++){var wy=y+h*(0.2+i*0.3);ctx.beginPath();ctx.moveTo(x+SA.s(3),wy);ctx.lineTo(x+w-SA.s(3),wy+SA.s(2));ctx.stroke();}}
}

// ==================== 起重机渲染 ====================
function drawCrane() {
  if(!crane) return;
  var craneX=crane.crane.x, craneY=crane.crane.y, craneW=crane.crane.width, craneH=crane.crane.height;
  ctx.save();

  // 轨道线
  ctx.strokeStyle='rgba(0,240,255,0.15)'; ctx.lineWidth=SA.s(1);
  try{if(ctx.setLineDash)ctx.setLineDash([SA.s(5),SA.s(5)]);}catch(e){}
  ctx.beginPath(); ctx.moveTo(0,craneY+craneH); ctx.lineTo(canvas.width,craneY+craneH); ctx.stroke();
  try{if(ctx.setLineDash)ctx.setLineDash([]);}catch(e){}

  // 主体
  var bg=safeGrad(ctx,craneX-craneW/2,craneY,craneX+craneW/2,craneY);
  if(bg){bg.addColorStop(0,'#1a2744');bg.addColorStop(0.5,'#2a3b5e');bg.addColorStop(1,'#1a2744');ctx.fillStyle=bg;}
  else ctx.fillStyle='#2a3b5e';
  drawRR(ctx,craneX-craneW/2,craneY,craneW,craneH,SA.s(4)); ctx.fill();
  ctx.strokeStyle=THEME.neonCyan; ctx.lineWidth=SA.s(1.5);
  ctx.shadowColor=THEME.neonCyan; ctx.shadowBlur=6;
  drawRR(ctx,craneX-craneW/2,craneY,craneW,craneH,SA.s(4)); ctx.stroke(); ctx.shadowBlur=0;

  // 窗口
  ctx.fillStyle=hexToRgba(THEME.neonCyan,0.3); ctx.fillRect(craneX-SA.s(12),craneY+SA.s(10),SA.s(24),SA.s(16));
  ctx.strokeStyle=THEME.neonCyan; ctx.lineWidth=SA.s(0.5); ctx.strokeRect(craneX-SA.s(12),craneY+SA.s(10),SA.s(24),SA.s(16));

  // 轮子
  ctx.fillStyle=THEME.neonCyan;
  ctx.beginPath(); ctx.arc(craneX-SA.s(18),craneY+craneH+SA.s(2),SA.s(6),0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(craneX+SA.s(18),craneY+craneH+SA.s(2),SA.s(6),0,Math.PI*2); ctx.fill();

  // 绳索
  var pivotX=craneX, pivotY=craneY+craneH;
  var magnetX=crane.magnet.x, magnetY=crane.magnet.y;
  ctx.strokeStyle='rgba(0,240,255,0.6)'; ctx.lineWidth=SA.s(2);
  ctx.beginPath(); ctx.moveTo(pivotX,pivotY); ctx.lineTo(magnetX,magnetY); ctx.stroke();
  ctx.strokeStyle=hexToRgba(THEME.neonCyan,0.15); ctx.lineWidth=SA.s(6);
  ctx.beginPath(); ctx.moveTo(pivotX,pivotY); ctx.lineTo(magnetX,magnetY); ctx.stroke();

  // 磁铁
  drawMagnet(magnetX, magnetY);
  ctx.restore();
}

// ==================== 磁铁渲染 ====================
function drawMagnet(mx,my) {
  var isActive=crane.magnet.isActive, isGrabbing=crane.isGrabbing();
  var radius=crane.magnet.radius, attractR=crane.magnet.attractRadius;
  var pulse=Math.sin(gameState.magnetPulse)*0.3+0.7;
  ctx.save();

  // 磁力范围
  if(isActive||isGrabbing){
    for(var ring=3;ring>=1;ring--){var rr=attractR*(ring/3)*pulse;
      ctx.strokeStyle=hexToRgba(THEME.neonCyan,0.06*(4-ring));ctx.lineWidth=SA.s(1);
      ctx.beginPath();ctx.arc(mx,my,rr,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle=hexToRgba(THEME.neonPurple,0.2);ctx.lineWidth=SA.s(1);
    for(var li=0;li<8;li++){var la=(li/8)*Math.PI*2+frameCount*0.02;
      ctx.beginPath();ctx.moveTo(mx+Math.cos(la)*(radius+SA.s(5)),my+Math.sin(la)*(radius+SA.s(5)));
      ctx.lineTo(mx+Math.cos(la)*attractR*0.7,my+Math.sin(la)*attractR*0.7);ctx.stroke();}
  }

  // U形磁铁
  ctx.shadowColor=isGrabbing?THEME.neonGreen:THEME.neonCyan; ctx.shadowBlur=20*pulse;
  ctx.lineWidth=SA.s(5); ctx.strokeStyle=isGrabbing?THEME.neonGreen:THEME.neonCyan;
  ctx.beginPath(); ctx.arc(mx,my,radius,0,Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx-radius,my); ctx.lineTo(mx-radius,my-SA.s(8)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx+radius,my); ctx.lineTo(mx+radius,my-SA.s(8)); ctx.stroke();

  // 发光核心
  var coreColor=isGrabbing?THEME.neonGreen:THEME.neonCyan;
  var cg=safeGrad(ctx,mx-radius,my,mx+radius,my);
  if(cg){cg.addColorStop(0,hexToRgba(coreColor,0.1));cg.addColorStop(0.5,hexToRgba(coreColor,0.4*pulse));cg.addColorStop(1,hexToRgba(coreColor,0.1));ctx.fillStyle=cg;}
  else ctx.fillStyle=hexToRgba(coreColor,0.3);
  ctx.beginPath(); ctx.arc(mx,my,radius*0.8,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;

  // 电弧
  if(isGrabbing&&crane.magnet.grabbedBlock){
    var block=crane.magnet.grabbedBlock, bx=block.x+block.width/2, by=block.y;
    ctx.strokeStyle=THEME.neonYellow; ctx.lineWidth=SA.s(1.5);
    ctx.shadowColor=THEME.neonYellow; ctx.shadowBlur=8;
    for(var si=-1;si<=1;si++){ctx.beginPath();ctx.moveTo(mx+si*SA.s(8),my+radius);
      var midX=mx+si*SA.s(8)+(Math.random()-0.5)*SA.s(15),midY=(my+by)/2;
      ctx.quadraticCurveTo(midX,midY,bx+si*SA.s(10),by);ctx.stroke();}
    ctx.shadowBlur=0;
  }
  ctx.restore();
}

function drawParticles(){particles.forEach(function(p){var a=p.life/p.maxLife;ctx.save();if(p.type==='debris'){ctx.translate(p.x,p.y);ctx.rotate(p.rotation||0);ctx.fillStyle=hexToRgba(p.color,a);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);}else{ctx.fillStyle=hexToRgba(p.color,a);ctx.shadowColor=p.color;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(p.x,p.y,p.size*a,0,Math.PI*2);ctx.fill();}ctx.restore();});}

function drawFloatingTexts(){floatingTexts.forEach(function(ft){var a=ft.life/40;ctx.save();ctx.globalAlpha=a;ctx.fillStyle=ft.color;ctx.font='bold '+SA.s(20)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=ft.color;ctx.shadowBlur=10;ctx.fillText(ft.text,ft.x,ft.y);if(gameState.comboCount>1&&ft.text.indexOf('+')===0){ctx.font=SA.s(12)+'px Arial';ctx.fillText(gameState.comboCount+'x COMBO',ft.x,ft.y-SA.s(18));}ctx.restore();});}

// ==================== 游戏UI ====================
function drawGameUI() {
  var topBarH=SA.s(36), topBarY=SA.safeTop;
  ctx.fillStyle=THEME.panelBg; ctx.fillRect(0,topBarY,canvas.width,topBarH);
  ctx.strokeStyle=THEME.panelBorder; ctx.lineWidth=SA.s(1);
  ctx.beginPath(); ctx.moveTo(0,topBarY+topBarH); ctx.lineTo(canvas.width,topBarY+topBarH); ctx.stroke();

  var fs=SA.s(14), midY=topBarY+topBarH/2;
  ctx.font='bold '+fs+'px Arial'; ctx.textBaseline='middle';
  ctx.fillStyle=THEME.neonGreen; ctx.textAlign='left'; ctx.fillText('分数 '+gameState.score,SA.sx(75),midY);
  var tc=gameState.timeLeft<=10?THEME.neonRed:THEME.neonCyan;
  ctx.fillStyle=tc; ctx.textAlign='center'; ctx.fillText(gameState.timeLeft+'s',canvas.width/2,midY);
  ctx.fillStyle=THEME.neonYellow; ctx.textAlign='right'; ctx.fillText('L'+gameState.currentLevel+' 目标'+gameState.targetScore,canvas.width-SA.sx(70),midY);
  if(gameState.timeLeft<=5&&frameCount%30<15){ctx.fillStyle='rgba(255,50,50,0.15)';ctx.fillRect(0,0,canvas.width,canvas.height);}

  // 返回主菜单按钮（左上角）- 渲染+注册
  var backX=SA.sx(5), backY2=topBarY+SA.s(3), backW=SA.s(60), backH=SA.s(30);
  ctx.fillStyle='rgba(0,240,255,0.1)'; drawRR(ctx,backX,backY2,backW,backH,SA.s(4)); ctx.fill();
  ctx.strokeStyle=hexToRgba(THEME.neonCyan,0.4); ctx.lineWidth=SA.s(0.5); drawRR(ctx,backX,backY2,backW,backH,SA.s(4)); ctx.stroke();
  ctx.fillStyle=THEME.neonCyan; ctx.font=SA.s(12)+'px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('菜单',backX+backW/2,backY2+backH/2);
  regBtn(backX, backY2, backW, backH, function(){ gameState.currentScene='menu'; clearGameTimer(); gameState.gameActive=false; });

  // 暂停按钮（右上角）- 渲染+注册
  var pauseX=canvas.width-SA.sx(60), pauseY=topBarY+SA.s(3), pauseW=SA.s(50), pauseH=SA.s(30);
  ctx.fillStyle='rgba(0,240,255,0.1)'; drawRR(ctx,pauseX,pauseY,pauseW,pauseH,SA.s(4)); ctx.fill();
  ctx.strokeStyle=hexToRgba(THEME.neonCyan,0.4); ctx.lineWidth=SA.s(0.5); drawRR(ctx,pauseX,pauseY,pauseW,pauseH,SA.s(4)); ctx.stroke();
  ctx.fillStyle=THEME.neonCyan; ctx.font=SA.s(12)+'px Arial'; ctx.textAlign='center';
  ctx.fillText(gameState.gamePaused?'继续':'暂停',pauseX+pauseW/2,pauseY+pauseH/2);
  regBtn(pauseX, pauseY, pauseW, pauseH, function(){ togglePause(); });

  // 连击
  if(gameState.comboCount>1&&gameState.comboTimer>0){ctx.save();ctx.fillStyle=THEME.neonYellow;ctx.font='bold '+SA.s(16)+'px Arial';ctx.textAlign='center';ctx.shadowColor=THEME.neonYellow;ctx.shadowBlur=10;ctx.fillText(gameState.comboCount+'x COMBO!',canvas.width/2,topBarY+topBarH+SA.s(25));ctx.restore();}

  // 操作提示
  if(gameState.gameActive&&!gameState.gamePaused){
    var el=buildingGenerator.getTimeLimit(gameState.currentLevel)-gameState.timeLeft;
    if(el<4){ctx.fillStyle=hexToRgba(THEME.neonCyan,Math.max(0,1-el/4));ctx.font=SA.s(13)+'px Arial';ctx.textAlign='center';ctx.fillText('滑动移动 · 点击抓取/释放',canvas.width/2,canvas.height-SA.s(20));}
  }
}

function drawPauseOverlay(){
  ctx.fillStyle='rgba(5,10,30,0.85)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.shadowColor=THEME.neonCyan;ctx.shadowBlur=15;ctx.fillStyle=THEME.neonCyan;
  ctx.font='bold '+SA.s(32)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('游戏暂停',canvas.width/2,canvas.height/2);ctx.restore();
  ctx.fillStyle=THEME.textDim;ctx.font=SA.s(14)+'px Arial';ctx.fillText('点击暂停按钮继续',canvas.width/2,canvas.height/2+SA.s(40));
}

// ==================== 游戏结束 ====================
function renderGameOver(){
  ctx.fillStyle='rgba(5,10,30,0.9)';ctx.fillRect(0,0,canvas.width,canvas.height);
  var cx=canvas.width/2,boxW=SA.s(300),boxH=SA.s(300),boxX=(canvas.width-boxW)/2,boxY=(canvas.height-boxH)/2;
  ctx.fillStyle=THEME.panelBg;ctx.strokeStyle=THEME.panelBorder;ctx.lineWidth=SA.s(1.5);
  drawRR(ctx,boxX,boxY,boxW,boxH,SA.s(12));ctx.fill();drawRR(ctx,boxX,boxY,boxW,boxH,SA.s(12));ctx.stroke();
  var pct=gameState.targetScore>0?gameState.score/gameState.targetScore:0,isWin=pct>=1.0;
  ctx.save();ctx.shadowColor=isWin?THEME.neonGreen:THEME.neonRed;ctx.shadowBlur=15;
  ctx.fillStyle=isWin?THEME.neonGreen:THEME.neonRed;ctx.font='bold '+SA.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(isWin?'关卡通过!':'时间到!',cx,boxY+SA.s(45));ctx.restore();
  drawSciStars(cx,boxY+SA.s(95),gameState.stars);
  ctx.fillStyle=THEME.textMain;ctx.font=SA.s(16)+'px Arial';ctx.textAlign='center';
  ctx.fillText('得分: '+gameState.score,cx,boxY+SA.s(140));
  ctx.fillStyle=THEME.textDim;ctx.fillText('目标: '+gameState.targetScore,cx,boxY+SA.s(168));
  var btnW=SA.s(130),btnH=SA.s(52),btnY=boxY+boxH-SA.s(85);
  drawSciButton(cx-btnW-SA.s(10),btnY,btnW,btnH,'重玩',THEME.neonRed);
  regBtn(cx-btnW-SA.s(10),btnY,btnW,btnH,function(){ loadLevel(gameState.currentLevel); });
  drawSciButton(cx+SA.s(10),btnY,btnW,btnH,'下一关',THEME.neonGreen);
  regBtn(cx+SA.s(10),btnY,btnW,btnH,function(){ gameState.currentLevel++; loadLevel(gameState.currentLevel); });
  drawSciButton(cx-btnW/2,btnY+btnH+SA.s(12),btnW,btnH,'返回主菜单',THEME.textDim);
  regBtn(cx-btnW/2,btnY+btnH+SA.s(12),btnW,btnH,function(){ gameState.currentScene='menu'; });

  // NPC在结算页
  drawNPC(boxX + SA.s(5), boxY + boxH - SA.s(65), SA.s(50));
}

function drawSciStars(cx,cy,count){var size=SA.s(22),gap=SA.s(8),tw=3*size*2+2*gap,sx=cx-tw/2;
  for(var i=0;i<3;i++){var x=sx+i*(size*2+gap),f=i<count;ctx.save();if(f){ctx.shadowColor=THEME.neonYellow;ctx.shadowBlur=10;}
    ctx.strokeStyle=f?THEME.neonYellow:THEME.textDim;ctx.lineWidth=SA.s(1.5);drawStar5(ctx,x,cy,size);ctx.stroke();
    if(f){ctx.fillStyle=hexToRgba(THEME.neonYellow,0.3);drawStar5(ctx,x,cy,size);ctx.fill();}ctx.restore();}}
function drawStar5(ctx,cx,cy,size){ctx.beginPath();for(var i=0;i<10;i++){var r=i%2===0?size:size*0.45,a=(i*Math.PI/5)-Math.PI/2;
  var px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();}

// ==================== 关卡选择/排行榜/说明 ====================
function renderLevelSelect(){
  ctx.fillStyle=THEME.bgDark;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=THEME.neonCyan;ctx.shadowBlur=12;ctx.fillStyle=THEME.neonCyan;
  ctx.font='bold '+SA.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('关卡选择',canvas.width/2,SA.safeY(55));ctx.restore();
  var btnW=SA.s(280),btnH=SA.s(48),startX=(canvas.width-btnW)/2,startY=SA.safeY(95);
  for(var i=0;i<5;i++){var btnY=startY+i*(btnH+SA.s(10));drawSciButton(startX,btnY,btnW,btnH,'关卡 '+(i+1),THEME.neonCyan); (function(lv){regBtn(startX,btnY,btnW,btnH,function(){gameState.currentLevel=lv;loadLevel(lv);});})(i+1);}
  drawSciButton((canvas.width-btnW)/2,canvas.height-SA.sy(80),btnW,SA.s(50),'返回主菜单',THEME.neonRed);
  regBtn((canvas.width-btnW)/2,canvas.height-SA.sy(80),btnW,SA.s(50),function(){gameState.currentScene='menu';});
}

function renderLeaderboard(){
  ctx.fillStyle=THEME.bgDark;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=THEME.neonYellow;ctx.shadowBlur=12;ctx.fillStyle=THEME.neonYellow;
  ctx.font='bold '+SA.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('排行榜',canvas.width/2,SA.safeY(55));ctx.restore();
  var lb=[];try{var d=wx.getStorageSync('leaderboard');if(d)lb=JSON.parse(d);}catch(e){}
  if(lb.length===0){ctx.fillStyle=THEME.textDim;ctx.font=SA.s(15)+'px Arial';ctx.fillText('暂无记录',canvas.width/2,canvas.height/2);}
  else{var medals=[THEME.neonYellow,'#C0C0C0','#CD7F32'];for(var i=0;i<Math.min(lb.length,10);i++){var ey=SA.safeY(100)+i*SA.s(36);ctx.fillStyle=i<3?medals[i]:THEME.textDim;ctx.font='bold '+SA.s(16)+'px Arial';ctx.textAlign='left';ctx.fillText((i+1)+'. L'+(lb[i].level||'-')+'  '+(lb[i].score||0)+'分',SA.sx(40),ey);}}
  drawSciButton((canvas.width-SA.s(280))/2,canvas.height-SA.sy(80),SA.s(280),SA.s(50),'返回主菜单',THEME.neonRed);
  regBtn((canvas.width-SA.s(280))/2,canvas.height-SA.sy(80),SA.s(280),SA.s(50),function(){gameState.currentScene='menu';});
}

function renderInstructions(){
  ctx.fillStyle=THEME.bgDark;ctx.fillRect(0,0,canvas.width,canvas.height);drawStars();
  ctx.save();ctx.shadowColor=THEME.neonPurple;ctx.shadowBlur=12;ctx.fillStyle=THEME.neonPurple;
  ctx.font='bold '+SA.s(26)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('玩法说明',canvas.width/2,SA.safeY(55));ctx.restore();
  var tips=['▸ 点击方块 — 磁铁抓住它','▸ 左右滑动 — 移动起重机','▸ 再次点击 — 释放方块','▸ 利用摆锤惯性砸向建筑','▸ 达到目标分数即可过关','▸ TNT方块会爆炸','▸ 每10关解锁新机制','▸ 每100关换主题'];
  ctx.fillStyle=THEME.textMain;ctx.font=SA.s(14)+'px Arial';ctx.textAlign='left';
  for(var i=0;i<tips.length;i++){ctx.fillText(tips[i],SA.sx(30),SA.safeY(100)+i*SA.s(32));}

  // NPC在说明页
  drawNPC(canvas.width - SA.s(80), SA.safeY(300), SA.s(70));

  drawSciButton((canvas.width-SA.s(280))/2,canvas.height-SA.sy(80),SA.s(280),SA.s(50),'返回主菜单',THEME.neonRed);
  regBtn((canvas.width-SA.s(280))/2,canvas.height-SA.sy(80),SA.s(280),SA.s(50),function(){gameState.currentScene='menu';});
}

// ==================== 启动 ====================
init();
