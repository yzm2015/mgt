/**
 * 磁吸拆迁队 - 微信小游戏 V2.0
 * 科幻风格 · 完整场景 · 兼容微信环境
 */

// ==================== 模块导入 ====================
var PhysicsSystem = require('./js/PhysicsSystem');
var CraneController = require('./js/CraneController');
var BuildingGenerator = require('./js/BuildingGenerator');
var AudioManager = require('./js/AudioManager').AudioManager;
var SoundNames = require('./js/AudioManager').SoundNames;

// ==================== 科幻配色 ====================
var THEME = {
  bgDark: '#070b1a',
  bgMid: '#0d1333',
  bgLight: '#141b4d',
  neonCyan: '#00f0ff',
  neonPurple: '#b44aff',
  neonGreen: '#00ff88',
  neonRed: '#ff3366',
  neonYellow: '#ffe033',
  neonOrange: '#ff8800',
  panelBg: 'rgba(10, 14, 40, 0.85)',
  panelBorder: 'rgba(0, 240, 255, 0.3)',
  textMain: '#e0e8ff',
  textDim: '#6b7db3',
  glowCyan: 'rgba(0, 240, 255, 0.15)',
  magnetGlow: 'rgba(0, 240, 255, 0.6)',
  magnetCore: '#00f0ff',
  groundColor: '#0a1628',
  groundLine: 'rgba(0, 240, 255, 0.12)'
};

// ==================== 游戏配置 ====================
var CONFIG = {
  gravity: 0.5,
  ropeLength: 150,
  magnetRadius: 80,
  magnetPower: 0.8,
  craneSpeed: 5,
  damping: 0.99,
  bounceDamping: 0.5,
  friction: 0.8
};

// ==================== 全局状态 ====================
var gameState = {
  score: 0,
  timeLeft: 60,
  gameActive: false,
  gamePaused: false,
  currentLevel: 1,
  targetScore: 500,
  stars: 0,
  currentScene: 'menu',
  screenShake: 0,
  screenShakeX: 0,
  screenShakeY: 0,
  comboCount: 0,
  comboTimer: 0,
  flashAlpha: 0,
  magnetPulse: 0
};

var canvas = null;
var ctx = null;
var physics = null;
var crane = null;
var buildingGenerator = null;
var audioManager = null;
var buildings = [];
var particles = [];
var floatingTexts = [];
var gameTimer = null;
var loopRunning = false;
var frameCount = 0;
var lastTime = 0;

// 触摸状态
var touchState = {
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  isDragging: false,
  dragDistance: 0,
  touchStartTime: 0,
  moved: false
};

// ==================== 屏幕适配 ====================
var SA = {
  w: 375, h: 667,
  pr: 1, sf: 1,
  safeTop: 44, safeBottom: 0,
  safeLeft: 0, safeRight: 0,
  statusBarH: 44,

  init: function() {
    try {
      var info = wx.getSystemInfoSync();
      this.w = info.windowWidth || info.screenWidth || 375;
      this.h = info.windowHeight || info.screenHeight || 667;
      this.pr = info.pixelRatio || 1;
      this.sf = this.w / 375;
      this.statusBarH = info.statusBarHeight || 44;

      if (info.safeArea) {
        this.safeTop = info.safeArea.top || this.statusBarH;
        this.safeBottom = this.h - (info.safeArea.bottom || this.h);
        this.safeLeft = info.safeArea.left || 0;
        this.safeRight = this.w - (info.safeArea.right || this.w);
      } else {
        this.safeTop = Math.max(this.statusBarH, 44);
        var model = (info.model || '').toLowerCase();
        if (model.indexOf('iphone') !== -1 && this.h >= 812) {
          this.safeTop = 44;
          this.safeBottom = 34;
        }
      }
    } catch (e) {
      this.safeTop = 44;
    }
  },

  sx: function(x) { return x * this.sf; },
  sy: function(y) { return y * this.sf; },
  s: function(v) { return v * this.sf; },
  // 安全区域内的坐标
  safeY: function(y) { return this.safeTop + y * this.sf; }
};

// ==================== 工具函数 ====================
function darkenColor(color, factor) {
  if (!color || typeof color !== 'string') return '#000000';
  factor = factor || 0.7;
  var r, g, b;
  if (color.indexOf('#') === 0) {
    var hex = color.substring(1);
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    r = parseInt(hex.substring(0,2), 16);
    g = parseInt(hex.substring(2,4), 16);
    b = parseInt(hex.substring(4,6), 16);
  } else if (color.indexOf('rgb') === 0) {
    var m = color.match(/(\d+)/g);
    if (m && m.length >= 3) { r=+m[0]; g=+m[1]; b=+m[2]; }
    else return '#000000';
  } else return '#000000';
  r = Math.max(0, Math.min(255, Math.floor(r * factor)));
  g = Math.max(0, Math.min(255, Math.floor(g * factor)));
  b = Math.max(0, Math.min(255, Math.floor(b * factor)));
  return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function rgbaStr(r, g, b, a) {
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function hexToRgba(hex, a) {
  if (!hex || hex.indexOf('#') !== 0) return rgbaStr(0,0,0,a);
  var h = hex.substring(1);
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.substring(0,2),16);
  var g = parseInt(h.substring(2,4),16);
  var b = parseInt(h.substring(4,6),16);
  return rgbaStr(r, g, b, a);
}

function safeCreateLinearGradient(ctx, x0, y0, x1, y1) {
  try {
    if (x0 === x1 && y0 === y1) x1 = x0 + 1;
    if (typeof ctx.createLinearGradient === 'function') return ctx.createLinearGradient(x0, y0, x1, y1);
  } catch (e) {}
  return null;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

// ==================== 初始化 ====================
function init() {
  console.log('磁吸拆迁队 V2.0 初始化...');
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

    gameState.currentScene = 'menu';
    bindTouchEvents();
    loopRunning = true;
    lastTime = Date.now();
    gameLoop();
    console.log('初始化完成');
  } catch (err) {
    console.error('初始化失败:', err);
  }
}

function nextFrame(cb) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
  else if (canvas && typeof canvas.requestAnimationFrame === 'function') canvas.requestAnimationFrame(cb);
  else setTimeout(cb, 16);
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (!loopRunning) return;
  var now = Date.now();
  var dt = Math.min((now - lastTime) / 16.67, 3); // 最多3倍速补偿
  lastTime = now;
  frameCount++;

  if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
    update(dt);
  }

  // 更新屏幕震动
  if (gameState.screenShake > 0) {
    gameState.screenShake *= 0.9;
    gameState.screenShakeX = (Math.random() - 0.5) * gameState.screenShake;
    gameState.screenShakeY = (Math.random() - 0.5) * gameState.screenShake;
    if (gameState.screenShake < 0.5) gameState.screenShake = 0;
  }

  // 更新粒子
  updateParticles();

  // 更新飘字
  updateFloatingTexts();

  // 磁铁脉冲
  gameState.magnetPulse = (gameState.magnetPulse + 0.05) % (Math.PI * 2);

  // 闪光衰减
  if (gameState.flashAlpha > 0) gameState.flashAlpha *= 0.85;

  // 连击计时
  if (gameState.comboTimer > 0) {
    gameState.comboTimer--;
    if (gameState.comboTimer <= 0) gameState.comboCount = 0;
  }

  render();
  nextFrame(gameLoop);
}

// ==================== 更新 ====================
function update(dt) {
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
    touchState.startX = t.clientX;
    touchState.startY = t.clientY;
    touchState.lastX = t.clientX;
    touchState.lastY = t.clientY;
    touchState.isDragging = true;
    touchState.dragDistance = 0;
    touchState.touchStartTime = Date.now();
    touchState.moved = false;
  });

  wx.onTouchMove(function(e) {
    if (!e || !e.touches || e.touches.length === 0) return;
    var t = e.touches[0];
    var dx = t.clientX - touchState.lastX;

    touchState.dragDistance += Math.abs(dx);
    if (touchState.dragDistance > 10) touchState.moved = true;

    if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
      // 拖动控制起重机：跟随手指水平移动
      if (Math.abs(dx) > 2) {
        crane.move(dx > 0 ? 1 : -1);
        // 钟摆跟随拖拽施加角速度
        if (crane.magnet && crane.magnet.isGrabbing) {
          crane.pendulum.angularVelocity += dx * 0.002;
        }
      }
    }
    touchState.lastX = t.clientX;
    touchState.lastY = t.clientY;
  });

  wx.onTouchEnd(function(e) {
    var elapsed = Date.now() - touchState.touchStartTime;
    var x = touchState.lastX;
    var y = touchState.lastY;

    // 分场景处理
    switch (gameState.currentScene) {
      case 'menu': handleMenuTouch(x, y); break;
      case 'game': handleGameTouchEnd(x, y, touchState.moved, elapsed); break;
      case 'gameover': handleGameOverTouch(x, y); break;
      case 'levelselect': handleLevelSelectTouch(x, y); break;
      case 'leaderboard': handleBackTouch(x, y); break;
      case 'instructions': handleBackTouch(x, y); break;
    }

    touchState.isDragging = false;
    touchState.moved = false;
  });
}

// ==================== 主菜单 ====================
function handleMenuTouch(x, y) {
  var cx = canvas.width / 2;
  var btnW = SA.s(240);
  var btnH = SA.s(56);
  var startY = SA.safeY(240);

  var labels = ['start', 'levels', 'rank', 'help'];
  for (var i = 0; i < labels.length; i++) {
    var btnY = startY + i * (btnH + SA.s(16));
    if (x > cx - btnW/2 && x < cx + btnW/2 && y > btnY && y < btnY + btnH) {
      audioManager.playSound(SoundNames.BUTTON);
      switch(labels[i]) {
        case 'start': loadLevel(gameState.currentLevel); break;
        case 'levels': gameState.currentScene = 'levelselect'; break;
        case 'rank': gameState.currentScene = 'leaderboard'; break;
        case 'help': gameState.currentScene = 'instructions'; break;
      }
      return;
    }
  }
}

// ==================== 游戏触摸 ====================
function handleGameTouchEnd(x, y, moved, elapsed) {
  // 暂停按钮
  if (x > canvas.width - SA.sx(70) && y < SA.safeY(50)) {
    togglePause();
    return;
  }

  if (gameState.gamePaused) return;
  if (!gameState.gameActive) return;

  // 短点击（<200ms且没大幅移动）= 抓取/释放
  if (!moved || elapsed < 200) {
    if (crane.isGrabbing()) {
      // 释放
      var block = crane.releaseMagnet();
      if (block) {
        audioManager.playSound(SoundNames.RELEASE);
        spawnParticles(block.x + block.width/2, block.y + block.height/2, THEME.neonCyan, 8);
      }
    } else {
      // 抓取
      crane.activateMagnet(x, y, buildings);
      audioManager.playSound(SoundNames.GRAB);
      spawnParticles(crane.magnet.x, crane.magnet.y, THEME.neonPurple, 6);
    }
  } else {
    // 长拖后释放 = 抛掷
    if (crane.isGrabbing()) {
      var block2 = crane.releaseMagnet();
      if (block2) {
        audioManager.playSound(SoundNames.RELEASE);
        spawnParticles(block2.x + block2.width/2, block2.y + block2.height/2, THEME.neonCyan, 8);
      }
    }
  }
}

// ==================== 游戏结束触摸 ====================
function handleGameOverTouch(x, y) {
  var cx = canvas.width / 2;
  var btnW = SA.s(130);
  var btnH = SA.s(52);
  var btnY = canvas.height / 2 + SA.s(50);

  // 重玩
  if (x > cx - btnW - SA.s(10) && x < cx - SA.s(10) && y > btnY && y < btnY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    loadLevel(gameState.currentLevel);
  }
  // 下一关
  if (x > cx + SA.s(10) && x < cx + btnW + SA.s(10) && y > btnY && y < btnY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentLevel++;
    loadLevel(gameState.currentLevel);
  }
  // 返回
  var backY = btnY + btnH + SA.s(14);
  if (x > cx - btnW/2 && x < cx + btnW/2 && y > backY && y < backY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

function handleLevelSelectTouch(x, y) {
  var btnW = SA.s(280);
  var btnH = SA.s(48);
  var startY = SA.safeY(110);
  for (var i = 0; i < 5; i++) {
    var btnY = startY + i * (btnH + SA.s(10));
    if (y > btnY && y < btnY + btnH) {
      audioManager.playSound(SoundNames.BUTTON);
      gameState.currentLevel = i + 1;
      loadLevel(gameState.currentLevel);
      return;
    }
  }
  handleBackTouch(x, y);
}

function handleBackTouch(x, y) {
  var btnW = SA.s(280);
  var btnH = SA.s(50);
  var backY = canvas.height - SA.sy(80);
  if (x > (canvas.width-btnW)/2 && x < (canvas.width+btnW)/2 && y > backY && y < backY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

// ==================== 加载关卡 ====================
function loadLevel(level) {
  clearGameTimer();
  buildings = buildingGenerator.generateLevel(level);
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0;
  gameState.gameActive = true;
  gameState.gamePaused = false;
  gameState.currentScene = 'game';
  gameState.comboCount = 0;
  gameState.comboTimer = 0;
  particles = [];
  floatingTexts = [];
  startTimer();
}

function clearGameTimer() {
  if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
}

function startTimer() {
  clearGameTimer();
  gameTimer = setInterval(function() {
    if (!gameState.gameActive || gameState.gamePaused) return;
    gameState.timeLeft--;
    if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
      try { wx.vibrateShort(); } catch(e){}
      audioManager.playSound(SoundNames.WARNING);
    }
    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      endGame(false);
    }
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
    var bx = block.x + block.width/2;
    var by = block.y + block.height/2;
    var dx = bx - mp.x;
    var dy = by - mp.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var speed = Math.sqrt(block.velocityX*block.velocityX + block.velocityY*block.velocityY);

    if (dist < 100 && speed > 3) {
      var impactForce = speed * block.mass * 10;
      var result = physics.calculateDamage(block, impactForce);
      if (result.damage > 0) {
        var dr = buildingGenerator.damageBlock(block, result.damage);
        audioManager.playSound(SoundNames.CRASH);
        gameState.screenShake = Math.min(12, impactForce * 0.3);

        if (dr.destroyed) {
          var pts = dr.score;
          gameState.comboCount++;
          gameState.comboTimer = 60;
          if (gameState.comboCount > 1) pts = Math.floor(pts * (1 + gameState.comboCount * 0.2));
          gameState.score += pts;

          spawnParticles(bx, by, block.color || THEME.neonRed, 15);
          spawnDebris(bx, by, block.color || THEME.neonOrange, 8);
          addFloatingText(bx, by, '+' + pts, gameState.comboCount > 1 ? THEME.neonYellow : THEME.neonGreen);
          gameState.flashAlpha = 0.15;
          audioManager.playSound(SoundNames.DESTROY);

          if (block.explosive) {
            gameState.screenShake = 20;
            gameState.flashAlpha = 0.4;
            spawnParticles(bx, by, THEME.neonRed, 25);
            spawnParticles(bx, by, THEME.neonYellow, 15);
          }
        }
      }
    }
  });
}

// ==================== 粒子系统 ====================
function spawnParticles(x, y, color, count) {
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 1 + Math.random() * 4;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color: color,
      size: 2 + Math.random() * 4,
      type: 'spark'
    });
  }
}

function spawnDebris(x, y, color, count) {
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 2 + Math.random() * 5;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 40 + Math.random() * 30,
      maxLife: 70,
      color: color,
      size: 4 + Math.random() * 8,
      type: 'debris',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3
    });
  }
}

function updateParticles() {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // 重力
    p.vx *= 0.98;
    p.life--;
    if (p.rotation !== undefined) p.rotation += p.rotSpeed;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ==================== 飘字 ====================
function addFloatingText(x, y, text, color) {
  floatingTexts.push({ x: x, y: y, text: text, color: color, life: 40, vy: -2 });
}

function updateFloatingTexts() {
  for (var i = floatingTexts.length - 1; i >= 0; i--) {
    var ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.vy *= 0.96;
    ft.life--;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

// ==================== 检查游戏结束 ====================
function checkGameEnd() {
  if (gameState.score >= gameState.targetScore) endGame(true);
}

function endGame(isWin) {
  gameState.gameActive = false;
  clearGameTimer();

  var pct = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  gameState.stars = pct >= 1.0 ? 3 : pct >= 0.8 ? 2 : pct >= 0.5 ? 1 : 0;

  if (isWin) saveToLeaderboard(gameState.currentLevel, gameState.score);
  audioManager.playSound(isWin ? SoundNames.WIN : SoundNames.LOSE);
  gameState.currentScene = 'gameover';
}

function saveToLeaderboard(level, score) {
  try {
    var lb = [];
    var data = wx.getStorageSync('leaderboard');
    if (data) lb = JSON.parse(data);
    lb.push({ level: level, score: score, time: Date.now() });
    lb.sort(function(a,b) { return b.score - a.score; });
    if (lb.length > 20) lb = lb.slice(0, 20);
    wx.setStorageSync('leaderboard', JSON.stringify(lb));
  } catch(e) {}
}

// ==================== 渲染 ====================
function render() {
  ctx.save();
  // 屏幕震动
  if (gameState.screenShake > 0) {
    ctx.translate(gameState.screenShakeX, gameState.screenShakeY);
  }

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

// ==================== 主菜单渲染 ====================
function renderMainMenu() {
  // 深空背景
  var bg = safeCreateLinearGradient(ctx, 0, 0, 0, canvas.height);
  if (bg) { bg.addColorStop(0, '#020510'); bg.addColorStop(0.5, '#0a1035'); bg.addColorStop(1, '#050a20'); ctx.fillStyle = bg; }
  else ctx.fillStyle = THEME.bgDark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 星空
  drawStars();

  // 网格线（科幻感）
  drawSciGrid();

  // ===== 游戏图标 =====
  drawGameIcon(canvas.width / 2, SA.safeY(100));

  // 游戏标题
  ctx.save();
  ctx.shadowColor = THEME.neonCyan;
  ctx.shadowBlur = 20;
  ctx.fillStyle = THEME.neonCyan;
  ctx.font = 'bold ' + SA.s(34) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('磁吸拆迁队', canvas.width / 2, SA.safeY(180));
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.fillStyle = THEME.textDim;
  ctx.font = SA.s(13) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MAGNETIC DEMOLITION TEAM', canvas.width / 2, SA.safeY(210));

  // 按钮
  var cx = canvas.width / 2;
  var btnW = SA.s(240);
  var btnH = SA.s(56);
  var startY = SA.safeY(250);
  var labels = ['开始游戏', '关卡选择', '排行榜', '玩法说明'];
  var colors = [THEME.neonGreen, THEME.neonCyan, THEME.neonYellow, THEME.neonPurple];

  for (var i = 0; i < labels.length; i++) {
    var btnY = startY + i * (btnH + SA.s(16));
    drawSciButton(cx - btnW/2, btnY, btnW, btnH, labels[i], colors[i]);
  }
}

// ==================== 游戏图标 ====================
function drawGameIcon(cx, cy) {
  var size = SA.s(50);
  ctx.save();

  // 光环
  var pulse = Math.sin(frameCount * 0.03) * 0.2 + 0.8;
  ctx.strokeStyle = hexToRgba(THEME.neonCyan, 0.3 * pulse);
  ctx.lineWidth = SA.s(3);
  ctx.beginPath();
  ctx.arc(cx, cy, size + SA.s(8), 0, Math.PI * 2);
  ctx.stroke();

  // 起重机主体（简化图标）
  ctx.fillStyle = THEME.neonCyan;
  // 支架
  ctx.fillRect(cx - SA.s(3), cy - size * 0.6, SA.s(6), size * 0.8);
  // 横臂
  ctx.fillRect(cx - SA.s(20), cy - size * 0.6, SA.s(40), SA.s(5));
  // 磁铁U形
  ctx.lineWidth = SA.s(4);
  ctx.strokeStyle = THEME.neonPurple;
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.25, SA.s(12), 0, Math.PI);
  ctx.stroke();
  // 磁铁发光
  ctx.shadowColor = THEME.neonPurple;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.25, SA.s(6), 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(THEME.neonPurple, 0.6);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 小建筑轮廓
  ctx.fillStyle = hexToRgba(THEME.neonGreen, 0.4);
  ctx.fillRect(cx - SA.s(25), cy + size * 0.35, SA.s(12), SA.s(18));
  ctx.fillRect(cx - SA.s(10), cy + size * 0.25, SA.s(10), SA.s(28));
  ctx.fillRect(cx + SA.s(5), cy + size * 0.3, SA.s(14), SA.s(23));

  ctx.restore();
}

// ==================== 科幻按钮 ====================
function drawSciButton(x, y, w, h, text, color) {
  ctx.save();
  // 背景
  ctx.fillStyle = hexToRgba(color, 0.08);
  drawRoundRect(ctx, x, y, w, h, SA.s(6));
  ctx.fill();

  // 边框发光
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = hexToRgba(color, 0.6);
  ctx.lineWidth = SA.s(1.5);
  drawRoundRect(ctx, x, y, w, h, SA.s(6));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 顶部高亮线
  ctx.strokeStyle = hexToRgba(color, 0.8);
  ctx.lineWidth = SA.s(1);
  ctx.beginPath();
  ctx.moveTo(x + SA.s(10), y);
  ctx.lineTo(x + w - SA.s(10), y);
  ctx.stroke();

  // 文字
  ctx.fillStyle = color;
  ctx.font = 'bold ' + SA.s(18) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w/2, y + h/2);
  ctx.restore();
}

// ==================== 星空 ====================
function drawStars() {
  ctx.fillStyle = '#ffffff';
  for (var i = 0; i < 60; i++) {
    var sx = ((i * 127 + 33) % canvas.width);
    var sy = ((i * 89 + 17) % canvas.height);
    var sz = ((i % 3) + 1) * 0.5;
    var alpha = 0.3 + Math.sin(frameCount * 0.02 + i) * 0.2;
    ctx.globalAlpha = alpha;
    ctx.fillRect(sx, sy, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ==================== 科幻网格 ====================
function drawSciGrid() {
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
  ctx.lineWidth = 1;
  var spacing = SA.s(40);
  for (var x = 0; x < canvas.width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (var y = 0; y < canvas.height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

// ==================== 游戏场景渲染 ====================
function renderGameScene() {
  // 深空背景
  var bg = safeCreateLinearGradient(ctx, 0, 0, 0, canvas.height);
  if (bg) { bg.addColorStop(0, '#020510'); bg.addColorStop(0.6, '#0a1035'); bg.addColorStop(1, '#0d1540'); ctx.fillStyle = bg; }
  else ctx.fillStyle = THEME.bgDark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 星空
  drawStars();

  // 网格
  drawSciGrid();

  // 地面
  var groundY = canvas.height - SA.s(50);
  var gGrad = safeCreateLinearGradient(ctx, 0, groundY, 0, canvas.height);
  if (gGrad) { gGrad.addColorStop(0, '#0a1628'); gGrad.addColorStop(1, '#050c18'); ctx.fillStyle = gGrad; }
  else ctx.fillStyle = THEME.groundColor;
  ctx.fillRect(0, groundY, canvas.width, SA.s(50));

  // 地面发光线
  ctx.strokeStyle = THEME.groundLine;
  ctx.lineWidth = SA.s(1);
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY); ctx.stroke();

  // 地面网格
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
  for (var gx = 0; gx < canvas.width; gx += SA.s(30)) {
    ctx.beginPath(); ctx.moveTo(gx, groundY); ctx.lineTo(gx, canvas.height); ctx.stroke();
  }

  // 建筑
  drawBuildings();

  // 起重机
  drawCrane();

  // 粒子
  drawParticles();

  // 飘字
  drawFloatingTexts();

  // 闪光
  if (gameState.flashAlpha > 0.01) {
    ctx.fillStyle = rgbaStr(255, 255, 255, gameState.flashAlpha);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // UI
  drawGameUI();

  // 暂停遮罩
  if (gameState.gamePaused) drawPauseOverlay();
}

// ==================== 绘制建筑（增强版） ====================
function drawBuildings() {
  buildings.forEach(function(block) {
    if (block.isDestroyed) return;

    var healthPct = block.health / block.maxHealth;
    var bx = block.x, by = block.y, bw = block.width, bh = block.height;

    ctx.save();

    // 方块主体 - 科幻风格
    var blockGrad = safeCreateLinearGradient(ctx, bx, by, bx, by + bh);
    if (blockGrad) {
      var baseColor = getBlockColor(block.type, healthPct);
      blockGrad.addColorStop(0, baseColor.light);
      blockGrad.addColorStop(1, baseColor.dark);
      ctx.fillStyle = blockGrad;
    } else {
      ctx.fillStyle = block.color;
    }
    ctx.fillRect(bx, by, bw, bh);

    // 发光边框
    var borderColor = getBlockGlow(block.type, healthPct);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = healthPct < 0.5 ? SA.s(2) : SA.s(1);
    ctx.strokeRect(bx, by, bw, bh);

    // 受损裂纹
    if (healthPct < 0.7) {
      drawCracks(bx, by, bw, bh, healthPct);
    }

    // 建筑细节（窗户等）
    drawBlockDetail(bx, by, bw, bh, block.type);

    // 生命值条（科幻风格）
    if (healthPct < 1.0) {
      var barW = bw * 0.8;
      var barH = SA.s(3);
      var barX = bx + (bw - barW) / 2;
      var barY = by - SA.s(7);

      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = healthPct > 0.5 ? THEME.neonGreen : healthPct > 0.25 ? THEME.neonYellow : THEME.neonRed;
      ctx.fillRect(barX, barY, barW * healthPct, barH);
    }

    ctx.restore();
  });
}

function getBlockColor(type, hp) {
  var colors = {
    wood:  { light: '#8B6914', dark: '#5C4409' },
    brick: { light: '#A03020', dark: '#6B1A10' },
    steel: { light: '#607080', dark: '#3A4550' },
    ice:   { light: '#4FC3F7', dark: '#0288D1' },
    rubber:{ light: '#E91E90', dark: '#AD1457' },
    tnt:   { light: '#FF5722', dark: '#BF360C' }
  };
  var c = colors[type] || colors.wood;
  if (hp < 0.5) {
    return { light: darkenColor(c.light, 0.6), dark: darkenColor(c.dark, 0.6) };
  }
  return c;
}

function getBlockGlow(type, hp) {
  var glows = {
    wood: 'rgba(139, 105, 20, 0.4)',
    brick: 'rgba(160, 48, 32, 0.4)',
    steel: 'rgba(0, 240, 255, 0.3)',
    ice: 'rgba(79, 195, 247, 0.5)',
    rubber: 'rgba(233, 30, 144, 0.4)',
    tnt: 'rgba(255, 87, 34, 0.6)'
  };
  if (hp < 0.3) return 'rgba(255, 50, 50, 0.7)';
  return glows[type] || glows.wood;
}

function drawCracks(x, y, w, h, hp) {
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = SA.s(1);
  var crackCount = hp < 0.3 ? 4 : 2;
  for (var i = 0; i < crackCount; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w * (0.2 + i * 0.3), y);
    ctx.lineTo(x + w * (0.3 + i * 0.2), y + h * 0.4);
    ctx.lineTo(x + w * (0.15 + i * 0.25), y + h * 0.7);
    ctx.lineTo(x + w * (0.25 + i * 0.3), y + h);
    ctx.stroke();
  }
  // 闪烁警告
  if (hp < 0.3 && frameCount % 20 < 10) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fillRect(x, y, w, h);
  }
}

function drawBlockDetail(x, y, w, h, type) {
  if (type === 'steel') {
    // 钢铁铆钉
    ctx.fillStyle = 'rgba(200, 220, 240, 0.3)';
    var rivetSize = SA.s(3);
    ctx.beginPath(); ctx.arc(x + SA.s(6), y + SA.s(6), rivetSize, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - SA.s(6), y + SA.s(6), rivetSize, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + SA.s(6), y + h - SA.s(6), rivetSize, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - SA.s(6), y + h - SA.s(6), rivetSize, 0, Math.PI*2); ctx.fill();
  } else if (type === 'ice') {
    // 冰块反光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + SA.s(4), y + SA.s(4), w * 0.3, SA.s(2));
    ctx.fillRect(x + SA.s(4), y + SA.s(10), w * 0.15, SA.s(2));
  } else if (type === 'tnt') {
    // TNT标记
    ctx.fillStyle = 'rgba(255,255,0,0.8)';
    ctx.font = 'bold ' + SA.s(12) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', x + w/2, y + h/2);
  } else if (type === 'brick') {
    // 砖缝
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = SA.s(0.5);
    ctx.beginPath(); ctx.moveTo(x, y + h/3); ctx.lineTo(x+w, y + h/3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h*2/3); ctx.lineTo(x+w, y + h*2/3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w/2, y); ctx.lineTo(x+w/2, y+h/3); ctx.stroke();
  } else if (type === 'wood') {
    // 木纹
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = SA.s(0.5);
    for (var wi = 0; wi < 3; wi++) {
      var wy = y + h * (0.2 + wi * 0.3);
      ctx.beginPath(); ctx.moveTo(x + SA.s(3), wy); ctx.lineTo(x + w - SA.s(3), wy + SA.s(2)); ctx.stroke();
    }
  }
}

// ==================== 绘制起重机（增强版） ====================
function drawCrane() {
  if (!crane) return;
  var craneX = crane.crane.x;
  var craneY = crane.crane.y;
  var craneW = crane.crane.width;
  var craneH = crane.crane.height;

  ctx.save();

  // 起重机轨道线
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = SA.s(1);
  ctx.setLineDash && ctx.setLineDash([SA.s(5), SA.s(5)]);
  ctx.beginPath();
  ctx.moveTo(0, craneY + craneH);
  ctx.lineTo(canvas.width, craneY + craneH);
  ctx.stroke();
  ctx.setLineDash && ctx.setLineDash([]);

  // 起重机主体
  var bodyGrad = safeCreateLinearGradient(ctx, craneX - craneW/2, craneY, craneX + craneW/2, craneY);
  if (bodyGrad) {
    bodyGrad.addColorStop(0, '#1a2744');
    bodyGrad.addColorStop(0.5, '#2a3b5e');
    bodyGrad.addColorStop(1, '#1a2744');
    ctx.fillStyle = bodyGrad;
  } else ctx.fillStyle = '#2a3b5e';

  drawRoundRect(ctx, craneX - craneW/2, craneY, craneW, craneH, SA.s(4));
  ctx.fill();

  // 发光边框
  ctx.strokeStyle = THEME.neonCyan;
  ctx.lineWidth = SA.s(1.5);
  ctx.shadowColor = THEME.neonCyan;
  ctx.shadowBlur = 6;
  drawRoundRect(ctx, craneX - craneW/2, craneY, craneW, craneH, SA.s(4));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 起重机窗口
  ctx.fillStyle = hexToRgba(THEME.neonCyan, 0.3);
  ctx.fillRect(craneX - SA.s(12), craneY + SA.s(10), SA.s(24), SA.s(16));
  ctx.strokeStyle = THEME.neonCyan;
  ctx.lineWidth = SA.s(0.5);
  ctx.strokeRect(craneX - SA.s(12), craneY + SA.s(10), SA.s(24), SA.s(16));

  // 轮子
  ctx.fillStyle = THEME.neonCyan;
  ctx.beginPath();
  ctx.arc(craneX - SA.s(18), craneY + craneH + SA.s(2), SA.s(6), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(craneX + SA.s(18), craneY + craneH + SA.s(2), SA.s(6), 0, Math.PI * 2);
  ctx.fill();

  // ===== 绳索 =====
  var pivotX = craneX;
  var pivotY = craneY + craneH;
  var magnetX = crane.magnet.x;
  var magnetY = crane.magnet.y;

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
  ctx.lineWidth = SA.s(2);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(magnetX, magnetY);
  ctx.stroke();

  // 绳索发光
  ctx.strokeStyle = hexToRgba(THEME.neonCyan, 0.15);
  ctx.lineWidth = SA.s(6);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(magnetX, magnetY);
  ctx.stroke();

  // ===== 磁铁（突出显示） =====
  drawMagnet(magnetX, magnetY);

  ctx.restore();
}

// ==================== 绘制磁铁（突出显示） ====================
function drawMagnet(mx, my) {
  var isActive = crane.magnet.isActive;
  var isGrabbing = crane.isGrabbing();
  var radius = crane.magnet.radius;
  var attractR = crane.magnet.attractRadius;
  var pulse = Math.sin(gameState.magnetPulse) * 0.3 + 0.7;

  ctx.save();

  // 磁力范围指示（同心圆脉冲）
  if (isActive || isGrabbing) {
    for (var ring = 3; ring >= 1; ring--) {
      var ringR = attractR * (ring / 3) * pulse;
      ctx.strokeStyle = hexToRgba(THEME.neonCyan, 0.06 * (4 - ring));
      ctx.lineWidth = SA.s(1);
      ctx.beginPath();
      ctx.arc(mx, my, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 磁力线
    ctx.strokeStyle = hexToRgba(THEME.neonPurple, 0.2);
    ctx.lineWidth = SA.s(1);
    for (var li = 0; li < 8; li++) {
      var la = (li / 8) * Math.PI * 2 + frameCount * 0.02;
      var lr1 = radius + SA.s(5);
      var lr2 = attractR * 0.7;
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(la) * lr1, my + Math.sin(la) * lr1);
      ctx.lineTo(mx + Math.cos(la) * lr2, my + Math.sin(la) * lr2);
      ctx.stroke();
    }
  }

  // 磁铁外发光
  ctx.shadowColor = isGrabbing ? THEME.neonGreen : THEME.neonCyan;
  ctx.shadowBlur = 20 * pulse;

  // 磁铁U形
  ctx.lineWidth = SA.s(5);
  ctx.strokeStyle = isGrabbing ? THEME.neonGreen : THEME.neonCyan;
  ctx.beginPath();
  ctx.arc(mx, my, radius, 0, Math.PI);
  ctx.stroke();

  // 左右极
  ctx.beginPath();
  ctx.moveTo(mx - radius, my); ctx.lineTo(mx - radius, my - SA.s(8));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx + radius, my); ctx.lineTo(mx + radius, my - SA.s(8));
  ctx.stroke();

  // 中心发光核心
  var coreGrad = safeCreateLinearGradient(ctx, mx - radius, my, mx + radius, my);
  if (coreGrad) {
    var coreColor = isGrabbing ? THEME.neonGreen : THEME.neonCyan;
    coreGrad.addColorStop(0, hexToRgba(coreColor, 0.1));
    coreGrad.addColorStop(0.5, hexToRgba(coreColor, 0.4 * pulse));
    coreGrad.addColorStop(1, hexToRgba(coreColor, 0.1));
    ctx.fillStyle = coreGrad;
  } else {
    ctx.fillStyle = hexToRgba(THEME.neonCyan, 0.3);
  }
  ctx.beginPath();
  ctx.arc(mx, my, radius * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // 抓取时的电弧效果
  if (isGrabbing && crane.magnet.grabbedBlock) {
    var block = crane.magnet.grabbedBlock;
    var bx = block.x + block.width/2;
    var by = block.y;
    ctx.strokeStyle = THEME.neonYellow;
    ctx.lineWidth = SA.s(1.5);
    ctx.shadowColor = THEME.neonYellow;
    ctx.shadowBlur = 8;
    for (var si = -1; si <= 1; si++) {
      ctx.beginPath();
      ctx.moveTo(mx + si * SA.s(8), my + radius);
      var midX = mx + si * SA.s(8) + (Math.random()-0.5) * SA.s(15);
      var midY = (my + by) / 2;
      ctx.quadraticCurveTo(midX, midY, bx + si * SA.s(10), by);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ==================== 粒子渲染 ====================
function drawParticles() {
  particles.forEach(function(p) {
    var alpha = p.life / p.maxLife;
    ctx.save();
    if (p.type === 'debris') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      // 碎片发光
      ctx.strokeStyle = hexToRgba(THEME.neonCyan, alpha * 0.3);
      ctx.lineWidth = SA.s(0.5);
      ctx.strokeRect(-p.size/2, -p.size/2, p.size, p.size);
    } else {
      // 火花
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

// ==================== 飘字渲染 ====================
function drawFloatingTexts() {
  floatingTexts.forEach(function(ft) {
    var alpha = ft.life / 40;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold ' + SA.s(20) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 10;
    ctx.fillText(ft.text, ft.x, ft.y);
    if (gameState.comboCount > 1 && ft.text.indexOf('+') === 0) {
      ctx.font = SA.s(12) + 'px Arial';
      ctx.fillText(gameState.comboCount + 'x COMBO', ft.x, ft.y - SA.s(18));
    }
    ctx.restore();
  });
}

// ==================== 游戏UI ====================
function drawGameUI() {
  // 顶部信息栏（在安全区域下方）
  var topBarH = SA.s(36);
  var topBarY = SA.safeTop;

  ctx.fillStyle = THEME.panelBg;
  ctx.fillRect(0, topBarY, canvas.width, topBarH);

  // 底线发光
  ctx.strokeStyle = THEME.panelBorder;
  ctx.lineWidth = SA.s(1);
  ctx.beginPath();
  ctx.moveTo(0, topBarY + topBarH);
  ctx.lineTo(canvas.width, topBarY + topBarH);
  ctx.stroke();

  var fs = SA.s(15);
  var midY = topBarY + topBarH / 2;
  ctx.font = 'bold ' + fs + 'px Arial';
  ctx.textBaseline = 'middle';

  // 分数
  ctx.fillStyle = THEME.neonGreen;
  ctx.textAlign = 'left';
  ctx.fillText('分数 ' + gameState.score, SA.sx(12), midY);

  // 时间
  var timeColor = gameState.timeLeft <= 10 ? THEME.neonRed : THEME.neonCyan;
  ctx.fillStyle = timeColor;
  ctx.textAlign = 'center';
  ctx.fillText(gameState.timeLeft + 's', canvas.width / 2, midY);
  // 时间紧迫闪烁
  if (gameState.timeLeft <= 5 && frameCount % 30 < 15) {
    ctx.fillStyle = rgbaStr(255, 50, 50, 0.15);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 关卡和目标
  ctx.fillStyle = THEME.neonYellow;
  ctx.textAlign = 'right';
  ctx.fillText('L' + gameState.currentLevel + ' 目标' + gameState.targetScore, canvas.width - SA.sx(12), midY);

  // 暂停按钮
  var pauseX = canvas.width - SA.sx(12);
  var pauseY = topBarY + topBarH + SA.s(8);
  ctx.fillStyle = THEME.panelBg;
  drawRoundRect(ctx, pauseX - SA.s(40), pauseY, SA.s(40), SA.s(30), SA.s(4));
  ctx.fill();
  ctx.strokeStyle = THEME.panelBorder;
  ctx.lineWidth = SA.s(0.5);
  drawRoundRect(ctx, pauseX - SA.s(40), pauseY, SA.s(40), SA.s(30), SA.s(4));
  ctx.stroke();
  ctx.fillStyle = THEME.textDim;
  ctx.font = SA.s(12) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameState.gamePaused ? '继续' : '暂停', pauseX - SA.s(20), pauseY + SA.s(15));

  // 连击提示
  if (gameState.comboCount > 1 && gameState.comboTimer > 0) {
    ctx.save();
    ctx.fillStyle = THEME.neonYellow;
    ctx.font = 'bold ' + SA.s(16) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = THEME.neonYellow;
    ctx.shadowBlur = 10;
    ctx.fillText(gameState.comboCount + 'x COMBO!', canvas.width / 2, topBarY + topBarH + SA.s(25));
    ctx.restore();
  }

  // 操作提示（前3秒）
  if (gameState.gameActive && !gameState.gamePaused) {
    var elapsed = (buildingGenerator.getTimeLimit(gameState.currentLevel) - gameState.timeLeft);
    if (elapsed < 3) {
      ctx.fillStyle = hexToRgba(THEME.neonCyan, Math.max(0, 1 - elapsed / 3));
      ctx.font = SA.s(13) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('滑动移动 · 点击抓取/释放', canvas.width / 2, canvas.height - SA.s(20));
    }
  }
}

// ==================== 暂停遮罩 ====================
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(5, 10, 30, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.shadowColor = THEME.neonCyan;
  ctx.shadowBlur = 15;
  ctx.fillStyle = THEME.neonCyan;
  ctx.font = 'bold ' + SA.s(32) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', canvas.width / 2, canvas.height / 2);
  ctx.restore();

  ctx.fillStyle = THEME.textDim;
  ctx.font = SA.s(14) + 'px Arial';
  ctx.fillText('点击暂停按钮继续', canvas.width / 2, canvas.height / 2 + SA.s(40));
}

// ==================== 游戏结束 ====================
function renderGameOver() {
  ctx.fillStyle = 'rgba(5, 10, 30, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var cx = canvas.width / 2;
  var boxW = SA.s(300);
  var boxH = SA.s(300);
  var boxX = (canvas.width - boxW) / 2;
  var boxY = (canvas.height - boxH) / 2;

  // 结算框
  ctx.fillStyle = THEME.panelBg;
  ctx.strokeStyle = THEME.panelBorder;
  ctx.lineWidth = SA.s(1.5);
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, SA.s(12));
  ctx.fill();
  ctx.stroke();

  var pct = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  var isWin = pct >= 1.0;

  // 标题
  ctx.save();
  ctx.shadowColor = isWin ? THEME.neonGreen : THEME.neonRed;
  ctx.shadowBlur = 15;
  ctx.fillStyle = isWin ? THEME.neonGreen : THEME.neonRed;
  ctx.font = 'bold ' + SA.s(26) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isWin ? '关卡通过!' : '时间到!', cx, boxY + SA.s(45));
  ctx.restore();

  // 星级
  drawSciStars(cx, boxY + SA.s(95), gameState.stars);

  // 分数
  ctx.fillStyle = THEME.textMain;
  ctx.font = SA.s(16) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('得分: ' + gameState.score, cx, boxY + SA.s(140));
  ctx.fillStyle = THEME.textDim;
  ctx.fillText('目标: ' + gameState.targetScore, cx, boxY + SA.s(168));

  // 按钮
  var btnW = SA.s(130);
  var btnH = SA.s(52);
  var btnY = boxY + boxH - SA.s(85);

  drawSciButton(cx - btnW - SA.s(10), btnY, btnW, btnH, '重玩', THEME.neonRed);
  drawSciButton(cx + SA.s(10), btnY, btnW, btnH, '下一关', THEME.neonGreen);

  var backY = btnY + btnH + SA.s(12);
  drawSciButton(cx - btnW/2, backY, btnW, btnH, '返回主菜单', THEME.textDim);
}

function drawSciStars(cx, cy, count) {
  var size = SA.s(22);
  var gap = SA.s(8);
  var totalW = 3 * size * 2 + 2 * gap;
  var startX = cx - totalW / 2;

  for (var i = 0; i < 3; i++) {
    var sx = startX + i * (size * 2 + gap);
    var filled = i < count;
    ctx.save();
    if (filled) {
      ctx.shadowColor = THEME.neonYellow;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = filled ? THEME.neonYellow : THEME.textDim;
    ctx.lineWidth = SA.s(1.5);
    drawStar5(ctx, sx, cy, size);
    ctx.stroke();
    if (filled) {
      ctx.fillStyle = hexToRgba(THEME.neonYellow, 0.3);
      drawStar5(ctx, sx, cy, size);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStar5(ctx, cx, cy, size) {
  ctx.beginPath();
  for (var i = 0; i < 10; i++) {
    var r = i % 2 === 0 ? size : size * 0.45;
    var angle = (i * Math.PI / 5) - Math.PI / 2;
    var px = cx + Math.cos(angle) * r;
    var py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ==================== 关卡选择 ====================
function renderLevelSelect() {
  ctx.fillStyle = THEME.bgDark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars();

  ctx.save();
  ctx.shadowColor = THEME.neonCyan;
  ctx.shadowBlur = 12;
  ctx.fillStyle = THEME.neonCyan;
  ctx.font = 'bold ' + SA.s(26) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('关卡选择', canvas.width / 2, SA.safeY(55));
  ctx.restore();

  var btnW = SA.s(280);
  var btnH = SA.s(48);
  var startX = (canvas.width - btnW) / 2;
  var startY = SA.safeY(95);

  for (var i = 0; i < 5; i++) {
    var btnY = startY + i * (btnH + SA.s(10));
    drawSciButton(startX, btnY, btnW, btnH, '关卡 ' + (i + 1), THEME.neonCyan);
  }

  drawSciButton((canvas.width - btnW) / 2, canvas.height - SA.sy(80), btnW, SA.s(50), '返回主菜单', THEME.neonRed);
}

// ==================== 排行榜 ====================
function renderLeaderboard() {
  ctx.fillStyle = THEME.bgDark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars();

  ctx.save();
  ctx.shadowColor = THEME.neonYellow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = THEME.neonYellow;
  ctx.font = 'bold ' + SA.s(26) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('排行榜', canvas.width / 2, SA.safeY(55));
  ctx.restore();

  var lb = [];
  try { var d = wx.getStorageSync('leaderboard'); if (d) lb = JSON.parse(d); } catch(e) {}

  if (lb.length === 0) {
    ctx.fillStyle = THEME.textDim;
    ctx.font = SA.s(15) + 'px Arial';
    ctx.fillText('暂无记录', canvas.width / 2, canvas.height / 2);
  } else {
    var medals = [THEME.neonYellow, '#C0C0C0', '#CD7F32'];
    for (var i = 0; i < Math.min(lb.length, 10); i++) {
      var ey = SA.safeY(100) + i * SA.s(36);
      ctx.fillStyle = i < 3 ? medals[i] : THEME.textDim;
      ctx.font = 'bold ' + SA.s(16) + 'px Arial';
      ctx.textAlign = 'left';
      ctx.fillText((i+1) + '. L' + (lb[i].level||'-') + '  ' + (lb[i].score||0) + '分', SA.sx(40), ey);
    }
  }

  drawSciButton((canvas.width - SA.s(280))/2, canvas.height - SA.sy(80), SA.s(280), SA.s(50), '返回主菜单', THEME.neonRed);
}

// ==================== 玩法说明 ====================
function renderInstructions() {
  ctx.fillStyle = THEME.bgDark;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars();

  ctx.save();
  ctx.shadowColor = THEME.neonPurple;
  ctx.shadowBlur = 12;
  ctx.fillStyle = THEME.neonPurple;
  ctx.font = 'bold ' + SA.s(26) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('玩法说明', canvas.width / 2, SA.safeY(55));
  ctx.restore();

  var tips = [
    '▸ 左右滑动 — 移动起重机',
    '▸ 点击屏幕 — 抓取/释放方块',
    '▸ 利用摆锤惯性甩出方块',
    '▸ 砸向建筑造成破坏得分',
    '▸ 达到目标分数即可过关',
    '▸ TNT方块爆炸产生范围伤害',
    '▸ 每10关解锁新游戏机制',
    '▸ 每100关更换场景主题'
  ];

  ctx.fillStyle = THEME.textMain;
  ctx.font = SA.s(14) + 'px Arial';
  ctx.textAlign = 'left';
  for (var i = 0; i < tips.length; i++) {
    ctx.fillText(tips[i], SA.sx(30), SA.safeY(100) + i * SA.s(32));
  }

  drawSciButton((canvas.width - SA.s(280))/2, canvas.height - SA.sy(80), SA.s(280), SA.s(50), '返回主菜单', THEME.neonRed);
}

// ==================== 启动 ====================
init();
