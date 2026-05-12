/**
 * 磁吸拆迁队 - 微信小游戏
 * 微信小游戏入口文件（兼容版）
 */

// 导入模块
const PhysicsSystem = require('./js/PhysicsSystem');
const CraneController = require('./js/CraneController');
const BuildingGenerator = require('./js/BuildingGenerator');
const { AudioManager, SoundNames } = require('./js/AudioManager');

// ==================== 游戏配置 ====================
const CONFIG = {
  gravity: 0.5,
  ropeLength: 150,
  magnetRadius: 80,
  magnetPower: 0.8,
  craneSpeed: 5,
  damping: 0.99,
  bounceDamping: 0.5,
  friction: 0.8
};

// ==================== 游戏状态 ====================
let gameState = {
  score: 0,
  timeLeft: 60,
  gameRunning: false,
  gameActive: true,   // 控制游戏逻辑，与循环运行分离
  gamePaused: false,
  currentLevel: 1,
  targetScore: 500,
  stars: 0,
  currentScene: 'game'  // menu, game, levelselect, leaderboard, instructions, gameover
};

// ==================== 游戏对象 ====================
let canvas = null;
let ctx = null;
let physics = null;
let crane = null;
let buildingGenerator = null;
let audioManager = null;
let buildings = [];
let uiElements = {};
let gameTimer = null;
let loopRunning = false;

// ==================== 屏幕适配 ====================
var ScreenAdapter = {
  screenWidth: 375,
  screenHeight: 667,
  pixelRatio: 1,
  scaleFactor: 1,
  safeTop: 0,
  safeBottom: 0,
  safeLeft: 0,
  safeRight: 0,

  init: function() {
    try {
      var sysInfo = wx.getSystemInfoSync();
      this.screenWidth = sysInfo.windowWidth || sysInfo.screenWidth || 375;
      this.screenHeight = sysInfo.windowHeight || sysInfo.screenHeight || 667;
      this.pixelRatio = sysInfo.pixelRatio || 1;
      this.scaleFactor = this.screenWidth / 375;

      // 安全区域
      if (sysInfo.safeArea) {
        this.safeTop = sysInfo.safeArea.top || 0;
        this.safeBottom = sysInfo.screenHeight - (sysInfo.safeArea.bottom || sysInfo.screenHeight);
        this.safeLeft = sysInfo.safeArea.left || 0;
        this.safeRight = sysInfo.screenWidth - (sysInfo.safeArea.right || sysInfo.screenWidth);
      } else {
        // iPhone X+ 兼容
        var model = (sysInfo.model || '').toLowerCase();
        if (model.indexOf('iphone x') !== -1 || model.indexOf('iphone 11') !== -1 ||
            model.indexOf('iphone 12') !== -1 || model.indexOf('iphone 13') !== -1 ||
            model.indexOf('iphone 14') !== -1 || model.indexOf('iphone 15') !== -1 ||
            model.indexOf('iphone 16') !== -1) {
          this.safeTop = 44;
          this.safeBottom = 34;
        }
      }
    } catch (e) {
      console.warn('ScreenAdapter init warning:', e);
    }
  },

  sx: function(x) { return x * this.scaleFactor; },
  sy: function(y) { return y * this.scaleFactor; },
  s: function(v) { return v * this.scaleFactor; }
};

// ==================== 工具函数 ====================
function darkenColor(color, factor) {
  if (!color || typeof color !== 'string') return '#000000';
  factor = factor || 0.7;
  var r, g, b;

  if (color.indexOf('#') === 0) {
    var hex = color.substring(1);
    if (hex.length === 3) {
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.indexOf('rgb') === 0) {
    var match = color.match(/(\d+)/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    } else {
      return '#000000';
    }
  } else {
    return '#000000';
  }

  r = Math.max(0, Math.min(255, Math.floor(r * factor)));
  g = Math.max(0, Math.min(255, Math.floor(g * factor)));
  b = Math.max(0, Math.min(255, Math.floor(b * factor)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function safeSetLineDash(ctx, segments) {
  try {
    if (ctx && typeof ctx.setLineDash === 'function') {
      ctx.setLineDash(segments);
    }
  } catch (e) { /* ignore */ }
}

function safeClearLineDash(ctx) {
  try {
    if (ctx && typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([]);
    }
  } catch (e) { /* ignore */ }
}

function safePow(base, exp) {
  return Math.pow(base, exp);
}

function safeCreateLinearGradient(ctx, x0, y0, x1, y1) {
  try {
    if (x0 === x1 && y0 === y1) { x1 = x0 + 1; }
    if (typeof ctx.createLinearGradient === 'function') {
      return ctx.createLinearGradient(x0, y0, x1, y1);
    }
  } catch (e) { /* ignore */ }
  return null;
}

// ==================== 初始化游戏 ====================
function init() {
  console.log('开始初始化游戏...');

  try {
    // 屏幕适配
    ScreenAdapter.init();

    // 获取 Canvas
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');

    // 设置画布大小 - 使用 wx API 而非 window
    var sysInfo = wx.getSystemInfoSync();
    canvas.width = sysInfo.windowWidth || sysInfo.screenWidth || 375;
    canvas.height = sysInfo.windowHeight || sysInfo.screenHeight || 667;

    console.log('画布大小: ' + canvas.width + 'x' + canvas.height);

    // 初始化模块
    physics = new PhysicsSystem(CONFIG);
    crane = new CraneController(canvas, CONFIG);
    buildingGenerator = new BuildingGenerator(canvas, CONFIG);
    audioManager = new AudioManager();

    // 设置物理系统引用
    crane.setPhysicsSystem(physics);

    // 初始化音效管理器
    audioManager.init();

    // 初始场景为主菜单
    gameState.currentScene = 'menu';

    // 绑定触摸事件
    bindTouchEvents();

    // 启动游戏循环
    loopRunning = true;
    gameLoop();

    console.log('游戏初始化完成');

  } catch (err) {
    console.error('游戏初始化失败:', err);
  }
}

// ==================== requestAnimationFrame 兼容 ====================
function nextFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
  } else if (typeof canvas !== 'undefined' && canvas && typeof canvas.requestAnimationFrame === 'function') {
    canvas.requestAnimationFrame(callback);
  } else {
    setTimeout(callback, 16);
  }
}

// ==================== 游戏主循环 ====================
function gameLoop() {
  if (!loopRunning) return;

  if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
    update();
  }

  render();
  nextFrame(gameLoop);
}

// ==================== 更新游戏状态 ====================
function update() {
  // 更新起重机
  crane.update();

  // 更新建筑
  buildingGenerator.update(physics);

  // 检测磁铁与建筑的碰撞
  checkMagnetCollision();

  // 更新 UI
  updateUI();

  // 检查游戏结束条件
  checkGameEnd();
}

// ==================== 加载关卡 ====================
function loadLevel(level) {
  console.log('加载关卡 ' + level);

  clearGameTimer();

  // 生成建筑
  buildings = buildingGenerator.generateLevel(level);

  // 更新目标分数
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0;
  gameState.gameActive = true;
  gameState.currentScene = 'game';

  // 启动计时器
  startTimer();
}

// ==================== 清理计时器 ====================
function clearGameTimer() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
}

// ==================== 启动计时器 ====================
function startTimer() {
  clearGameTimer();
  gameTimer = setInterval(function() {
    if (!gameState.gameActive || gameState.gamePaused) return;

    gameState.timeLeft--;

    if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
      try { wx.vibrateShort(); } catch (e) { /* ignore */ }
      audioManager.playSound(SoundNames.WARNING);
    }

    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      endGame(false);
    }
  }, 1000);
}

// ==================== 初始化 UI ====================
function initUI() {
  uiElements = {
    scoreText: { x: ScreenAdapter.sx(20), y: ScreenAdapter.sy(40), text: '分数: ' + gameState.score },
    timerText: { x: ScreenAdapter.sx(20), y: ScreenAdapter.sy(80), text: '时间: ' + gameState.timeLeft + 's' },
    levelText: { x: ScreenAdapter.sx(20), y: ScreenAdapter.sy(120), text: '关卡: ' + gameState.currentLevel },
    targetText: { x: canvas.width - ScreenAdapter.sx(20), y: ScreenAdapter.sy(40), text: '目标: ' + gameState.targetScore, align: 'right' }
  };
}

// ==================== 绑定触摸事件 ====================
function bindTouchEvents() {
  wx.onTouchStart(function(e) {
    if (!e || !e.touches || e.touches.length === 0) return;
    var touch = e.touches[0];
    var touchX = touch.clientX;
    var touchY = touch.clientY;

    switch (gameState.currentScene) {
      case 'menu':
        handleMenuTouch(touchX, touchY);
        break;
      case 'game':
        handleGameTouchStart(touchX, touchY);
        break;
      case 'gameover':
        handleGameOverTouch(touchX, touchY);
        break;
      case 'levelselect':
        handleLevelSelectTouch(touchX, touchY);
        break;
      case 'leaderboard':
        handleLeaderboardTouch(touchX, touchY);
        break;
      case 'instructions':
        handleInstructionsTouch(touchX, touchY);
        break;
    }
  });

  wx.onTouchMove(function(e) {
    if (!e || !e.touches || e.touches.length === 0) return;
    var touch = e.touches[0];
    var touchX = touch.clientX;

    if (gameState.currentScene === 'game') {
      handleGameTouchMove(touchX);
    }
  });

  wx.onTouchEnd(function(e) {
    if (gameState.currentScene === 'game') {
      handleGameTouchEnd();
    }
  });
}

// ==================== 主菜单触摸 ====================
function handleMenuTouch(x, y) {
  var cx = canvas.width / 2;
  var btnW = ScreenAdapter.s(200);
  var btnH = ScreenAdapter.s(60);
  var startY = ScreenAdapter.sy(280);

  // 开始游戏按钮
  if (x > cx - btnW/2 && x < cx + btnW/2 && y > startY && y < startY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    loadLevel(gameState.currentLevel);
  }
  // 关卡选择按钮
  else if (x > cx - btnW/2 && x < cx + btnW/2 && y > startY + btnH + ScreenAdapter.s(20) && y < startY + btnH*2 + ScreenAdapter.s(20)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'levelselect';
  }
  // 排行榜按钮
  else if (x > cx - btnW/2 && x < cx + btnW/2 && y > startY + btnH*2 + ScreenAdapter.s(40) && y < startY + btnH*3 + ScreenAdapter.s(40)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'leaderboard';
  }
  // 玩法说明按钮
  else if (x > cx - btnW/2 && x < cx + btnW/2 && y > startY + btnH*3 + ScreenAdapter.s(60) && y < startY + btnH*4 + ScreenAdapter.s(60)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'instructions';
  }
}

// ==================== 游戏触摸 ====================
function handleGameTouchStart(touchX, touchY) {
  if (!gameState.gameActive || gameState.gamePaused) {
    // 检查暂停按钮
    if (touchX > canvas.width - ScreenAdapter.sx(80) && touchY < ScreenAdapter.sy(60)) {
      togglePause();
    }
    return;
  }

  // 暂停按钮
  if (touchX > canvas.width - ScreenAdapter.sx(80) && touchY < ScreenAdapter.sy(60)) {
    togglePause();
    return;
  }

  // 左下区域：控制起重机移动
  if (touchX < canvas.width / 3 && touchY > canvas.height / 2) {
    crane.touchStartX = touchX;
    crane.isDragging = true;
    return;
  }

  // 其他区域：激活磁铁
  crane.activateMagnet(touchX, touchY, buildings);
  audioManager.playSound(SoundNames.GRAB);
}

function handleGameTouchMove(touchX) {
  if (!gameState.gameActive || gameState.gamePaused) return;

  if (crane.isDragging) {
    var deltaX = touchX - crane.touchStartX;
    if (Math.abs(deltaX) > 5) {
      var direction = deltaX > 0 ? 1 : -1;
      crane.move(direction);
      crane.touchStartX = touchX;
    }
  }
}

function handleGameTouchEnd() {
  crane.isDragging = false;

  var releasedBlock = crane.releaseMagnet();
  if (releasedBlock) {
    audioManager.playSound(SoundNames.RELEASE);
  }
}

// ==================== 游戏结束触摸 ====================
function handleGameOverTouch(x, y) {
  var cx = canvas.width / 2;
  var btnW = ScreenAdapter.s(120);
  var btnH = ScreenAdapter.s(50);
  var btnY = canvas.height / 2 + ScreenAdapter.s(60);

  // 重玩按钮
  var replayX = cx - btnW - ScreenAdapter.s(15);
  if (x > replayX && x < replayX + btnW && y > btnY && y < btnY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    loadLevel(gameState.currentLevel);
  }

  // 下一关按钮
  var nextX = cx + ScreenAdapter.s(15);
  if (x > nextX && x < nextX + btnW && y > btnY && y < btnY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentLevel++;
    loadLevel(gameState.currentLevel);
  }

  // 返回主菜单按钮
  var backY = btnY + btnH + ScreenAdapter.s(20);
  if (x > cx - btnW/2 && x < cx + btnW/2 && y > backY && y < backY + btnH) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

// ==================== 关卡选择触摸 ====================
function handleLevelSelectTouch(x, y) {
  var btnH = ScreenAdapter.s(50);
  var startY = ScreenAdapter.sy(120);

  for (var i = 0; i < 5; i++) {
    var btnY = startY + i * (btnH + ScreenAdapter.s(10));
    if (y > btnY && y < btnY + btnH) {
      audioManager.playSound(SoundNames.BUTTON);
      gameState.currentLevel = i + 1;
      loadLevel(gameState.currentLevel);
      return;
    }
  }

  // 返回按钮
  if (y > canvas.height - ScreenAdapter.sy(80)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

// ==================== 排行榜触摸 ====================
function handleLeaderboardTouch(x, y) {
  if (y > canvas.height - ScreenAdapter.sy(80)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

// ==================== 玩法说明触摸 ====================
function handleInstructionsTouch(x, y) {
  if (y > canvas.height - ScreenAdapter.sy(80)) {
    audioManager.playSound(SoundNames.BUTTON);
    gameState.currentScene = 'menu';
  }
}

// ==================== 暂停/继续游戏 ====================
function togglePause() {
  gameState.gamePaused = !gameState.gamePaused;

  if (gameState.gamePaused) {
    console.log('游戏暂停');
    audioManager.pauseBGM();
  } else {
    console.log('游戏继续');
    audioManager.resumeBGM();
  }
}

// ==================== 检测磁铁碰撞 ====================
function checkMagnetCollision() {
  if (!crane.isGrabbing()) return;

  var magnetPos = crane.getMagnetPosition();

  buildings.forEach(function(block) {
    if (block.isDestroyed || block.isGrabbed) return;

    var blockCenterX = block.x + block.width / 2;
    var blockCenterY = block.y + block.height / 2;

    var dx = blockCenterX - magnetPos.x;
    var dy = blockCenterY - magnetPos.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var speed = Math.sqrt(block.velocityX * block.velocityX + block.velocityY * block.velocityY);

    if (distance < 100 && speed > 3) {
      var impactForce = speed * block.mass * 10;
      var result = physics.calculateDamage(block, impactForce);

      if (result.damage > 0) {
        var damageResult = buildingGenerator.damageBlock(block, result.damage);
        audioManager.playSound(SoundNames.CRASH);

        if (damageResult.destroyed) {
          gameState.score += damageResult.score;
          audioManager.playSound(SoundNames.DESTROY);
        }
      }
    }
  });
}

// ==================== 更新 UI ====================
function updateUI() {
  uiElements.scoreText = { x: ScreenAdapter.sx(15), y: ScreenAdapter.sy(40), text: '分数: ' + gameState.score };
  uiElements.timerText = { x: ScreenAdapter.sx(15), y: ScreenAdapter.sy(80), text: '时间: ' + gameState.timeLeft + 's' };
  uiElements.levelText = { x: ScreenAdapter.sx(15), y: ScreenAdapter.sy(120), text: '关卡: ' + gameState.currentLevel };
  uiElements.targetText = { x: canvas.width - ScreenAdapter.sx(15), y: ScreenAdapter.sy(40), text: '目标: ' + gameState.targetScore };
}

// ==================== 渲染 ====================
function render() {
  switch (gameState.currentScene) {
    case 'menu':
      renderMainMenu();
      break;
    case 'game':
      renderGameScene();
      break;
    case 'gameover':
      renderGameScene();
      renderGameOver();
      break;
    case 'levelselect':
      renderLevelSelect();
      break;
    case 'leaderboard':
      renderLeaderboard();
      break;
    case 'instructions':
      renderInstructions();
      break;
  }
}

// ==================== 渲染主菜单 ====================
function renderMainMenu() {
  // 背景渐变
  var bgGrad = safeCreateLinearGradient(ctx, 0, 0, 0, canvas.height);
  if (bgGrad) {
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(0.5, '#16213e');
    bgGrad.addColorStop(1, '#0f3460');
    ctx.fillStyle = bgGrad;
  } else {
    ctx.fillStyle = '#1a1a2e';
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 标题
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold ' + ScreenAdapter.s(36) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('磁吸拆迁队', canvas.width / 2, ScreenAdapter.sy(120));

  // 副标题
  ctx.fillStyle = '#E0E0E0';
  ctx.font = ScreenAdapter.s(16) + 'px Arial';
  ctx.fillText('Magnetic Demolition Team', canvas.width / 2, ScreenAdapter.sy(170));

  // 按钮
  var cx = canvas.width / 2;
  var btnW = ScreenAdapter.s(200);
  var btnH = ScreenAdapter.s(60);
  var startY = ScreenAdapter.sy(280);
  var labels = ['开始游戏', '关卡选择', '排行榜', '玩法说明'];
  var colors = ['#00B894', '#0984E3', '#FDCB6E', '#E17055'];

  for (var i = 0; i < labels.length; i++) {
    var btnY = startY + i * (btnH + ScreenAdapter.s(20));
    var grad = safeCreateLinearGradient(ctx, cx - btnW/2, btnY, cx + btnW/2, btnY);
    if (grad) {
      grad.addColorStop(0, colors[i]);
      grad.addColorStop(1, darkenColor(colors[i], 0.7));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = colors[i];
    }

    // 按钮圆角效果（用圆角矩形模拟）
    drawRoundRect(ctx, cx - btnW/2, btnY, btnW, btnH, ScreenAdapter.s(10));
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + ScreenAdapter.s(20) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx, btnY + btnH / 2);
  }
}

// ==================== 渲染游戏场景 ====================
function renderGameScene() {
  var theme = buildingGenerator.currentTheme || { skyColor: '#87CEEB', groundColor: '#8B4513', grassColor: '#228B22' };

  // 天空
  ctx.fillStyle = theme.skyColor || '#87CEEB';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 云朵
  drawClouds();

  // 地面
  ctx.fillStyle = theme.groundColor || '#8B4513';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

  // 草地
  ctx.fillStyle = theme.grassColor || '#228B22';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 10);

  // 建筑
  buildingGenerator.draw(ctx);

  // 起重机
  crane.draw(ctx);

  // UI
  drawGameUI();

  // 暂停遮罩
  if (gameState.gamePaused) {
    drawPauseOverlay();
  }
}

// ==================== 绘制游戏UI ====================
function drawGameUI() {
  var fs = ScreenAdapter.s(18);

  // 半透明背景条
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvas.width, ScreenAdapter.sy(35));

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + fs + 'px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  if (uiElements.scoreText) {
    ctx.fillText('分数: ' + gameState.score, ScreenAdapter.sx(15), ScreenAdapter.sy(17));
  }
  if (uiElements.timerText) {
    ctx.fillText('时间: ' + gameState.timeLeft + 's', ScreenAdapter.sx(120), ScreenAdapter.sy(17));
  }
  if (uiElements.levelText) {
    ctx.textAlign = 'right';
    ctx.fillText('关卡: ' + gameState.currentLevel + '  目标: ' + gameState.targetScore, canvas.width - ScreenAdapter.sx(15), ScreenAdapter.sy(17));
  }

  // 暂停按钮
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  drawRoundRect(ctx, canvas.width - ScreenAdapter.sx(55), ScreenAdapter.sy(40), ScreenAdapter.s(45), ScreenAdapter.s(35), ScreenAdapter.s(5));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = ScreenAdapter.s(14) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameState.gamePaused ? '继续' : '暂停', canvas.width - ScreenAdapter.sx(32), ScreenAdapter.sy(57));
}

// ==================== 绘制暂停遮罩 ====================
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + ScreenAdapter.s(36) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', canvas.width / 2, canvas.height / 2);
}

// ==================== 渲染游戏结束 ====================
function renderGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var boxW = ScreenAdapter.s(300);
  var boxH = ScreenAdapter.s(320);
  var boxX = (canvas.width - boxW) / 2;
  var boxY = (canvas.height - boxH) / 2;

  // 结算框
  ctx.fillStyle = '#FFFFFF';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, ScreenAdapter.s(15));
  ctx.fill();

  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, ScreenAdapter.s(15));
  ctx.stroke();

  // 标题
  ctx.fillStyle = '#333333';
  ctx.font = 'bold ' + ScreenAdapter.s(28) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  var scorePercent = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  var title = scorePercent >= 1.0 ? '关卡通过!' : '时间到!';
  ctx.fillText(title, canvas.width / 2, boxY + ScreenAdapter.s(45));

  // 星级
  drawStars(canvas.width / 2, boxY + ScreenAdapter.s(100), gameState.stars);

  // 分数
  ctx.font = ScreenAdapter.s(18) + 'px Arial';
  ctx.fillText('得分: ' + gameState.score, canvas.width / 2, boxY + ScreenAdapter.s(150));
  ctx.fillText('目标: ' + gameState.targetScore, canvas.width / 2, boxY + ScreenAdapter.s(180));

  // 按钮
  var btnW = ScreenAdapter.s(120);
  var btnH = ScreenAdapter.s(50);
  var btnY = boxY + boxH - ScreenAdapter.s(90);
  var cx = canvas.width / 2;

  // 重玩
  ctx.fillStyle = '#FF6347';
  drawRoundRect(ctx, cx - btnW - ScreenAdapter.s(15), btnY, btnW, btnH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + ScreenAdapter.s(18) + 'px Arial';
  ctx.fillText('重玩', cx - btnW/2 - ScreenAdapter.s(15), btnY + btnH/2);

  // 下一关
  ctx.fillStyle = '#00B894';
  drawRoundRect(ctx, cx + ScreenAdapter.s(15), btnY, btnW, btnH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('下一关', cx + btnW/2 + ScreenAdapter.s(15), btnY + btnH/2);

  // 返回主菜单
  var backY = btnY + btnH + ScreenAdapter.s(15);
  ctx.fillStyle = '#636E72';
  drawRoundRect(ctx, cx - btnW/2, backY, btnW, btnH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = ScreenAdapter.s(14) + 'px Arial';
  ctx.fillText('返回主菜单', cx, backY + btnH/2);
}

// ==================== 渲染关卡选择 ====================
function renderLevelSelect() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold ' + ScreenAdapter.s(28) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('关卡选择', canvas.width / 2, ScreenAdapter.sy(60));

  var btnW = ScreenAdapter.s(280);
  var btnH = ScreenAdapter.s(50);
  var startX = (canvas.width - btnW) / 2;
  var startY = ScreenAdapter.sy(120);

  for (var i = 0; i < 5; i++) {
    var btnY = startY + i * (btnH + ScreenAdapter.s(10));
    ctx.fillStyle = i < 5 ? '#0984E3' : '#636E72';
    drawRoundRect(ctx, startX, btnY, btnW, btnH, ScreenAdapter.s(8));
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + ScreenAdapter.s(18) + 'px Arial';
    ctx.fillText('关卡 ' + (i + 1), canvas.width / 2, btnY + btnH / 2);
  }

  // 返回按钮
  ctx.fillStyle = '#E17055';
  var backH = ScreenAdapter.s(50);
  drawRoundRect(ctx, (canvas.width - btnW) / 2, canvas.height - ScreenAdapter.sy(80), btnW, backH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('返回主菜单', canvas.width / 2, canvas.height - ScreenAdapter.sy(80) + backH/2);
}

// ==================== 渲染排行榜 ====================
function renderLeaderboard() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold ' + ScreenAdapter.s(28) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('排行榜', canvas.width / 2, ScreenAdapter.sy(60));

  // 读取本地排行榜数据
  var leaderboard = [];
  try {
    var data = wx.getStorageSync('leaderboard');
    if (data) leaderboard = JSON.parse(data);
  } catch (e) { /* ignore */ }

  if (leaderboard.length === 0) {
    ctx.fillStyle = '#AAAAAA';
    ctx.font = ScreenAdapter.s(16) + 'px Arial';
    ctx.fillText('暂无记录', canvas.width / 2, canvas.height / 2);
  } else {
    for (var i = 0; i < Math.min(leaderboard.length, 10); i++) {
      var entry = leaderboard[i];
      var entryY = ScreenAdapter.sy(120) + i * ScreenAdapter.s(40);
      var medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
      ctx.fillStyle = i < 3 ? medals[i] : '#FFFFFF';
      ctx.font = 'bold ' + ScreenAdapter.s(18) + 'px Arial';
      ctx.textAlign = 'left';
      ctx.fillText((i + 1) + '. 关卡' + (entry.level || '-') + '  ' + (entry.score || 0) + '分', ScreenAdapter.sx(40), entryY);
    }
  }

  // 返回按钮
  var btnW = ScreenAdapter.s(280);
  var btnH = ScreenAdapter.s(50);
  ctx.fillStyle = '#E17055';
  drawRoundRect(ctx, (canvas.width - btnW) / 2, canvas.height - ScreenAdapter.sy(80), btnW, btnH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + ScreenAdapter.s(18) + 'px Arial';
  ctx.fillText('返回主菜单', canvas.width / 2, canvas.height - ScreenAdapter.sy(80) + btnH/2);
}

// ==================== 渲染玩法说明 ====================
function renderInstructions() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold ' + ScreenAdapter.s(28) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('玩法说明', canvas.width / 2, ScreenAdapter.sy(60));

  var instructions = [
    '1. 点击屏幕激活磁铁吸附方块',
    '2. 左右滑动移动起重机',
    '3. 松手释放方块，利用摆锤惯性',
    '4. 将方块砸向建筑造成破坏',
    '5. 达到目标分数即可过关',
    '6. TNT方块会爆炸产生范围伤害',
    '7. 每10关解锁新机制',
    '8. 每100关更换场景主题'
  ];

  ctx.fillStyle = '#E0E0E0';
  ctx.font = ScreenAdapter.s(15) + 'px Arial';
  ctx.textAlign = 'left';
  for (var i = 0; i < instructions.length; i++) {
    ctx.fillText(instructions[i], ScreenAdapter.sx(30), ScreenAdapter.sy(120) + i * ScreenAdapter.s(35));
  }

  // 返回按钮
  var btnW = ScreenAdapter.s(280);
  var btnH = ScreenAdapter.s(50);
  ctx.fillStyle = '#E17055';
  drawRoundRect(ctx, (canvas.width - btnW) / 2, canvas.height - ScreenAdapter.sy(80), btnW, btnH, ScreenAdapter.s(8));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + ScreenAdapter.s(18) + 'px Arial';
  ctx.fillText('返回主菜单', canvas.width / 2, canvas.height - ScreenAdapter.sy(80) + btnH/2);
}

// ==================== 绘制云朵 ====================
function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  drawCloud(100, 80, 60);
  drawCloud(300, 120, 40);
  drawCloud(500, 60, 50);
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.6, y, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x + size * 1.2, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ==================== 绘制星级 ====================
function drawStars(cx, cy, stars) {
  var starSize = ScreenAdapter.s(30);
  var starSpacing = ScreenAdapter.s(10);
  var totalWidth = 3 * starSize + 2 * starSpacing;
  var startX = cx - totalWidth / 2;

  for (var i = 0; i < 3; i++) {
    var starX = startX + i * (starSize + starSpacing);
    var color = i < stars ? '#FFD700' : '#C0C0C0';
    drawStar(starX, cy, starSize, color);
  }
}

function drawStar(x, y, size, color) {
  ctx.fillStyle = color;
  var spikes = 5;
  var outerRadius = size / 2;
  var innerRadius = outerRadius / 2;

  ctx.beginPath();
  for (var i = 0; i < spikes * 2; i++) {
    var radius = i % 2 === 0 ? outerRadius : innerRadius;
    var angle = (i * Math.PI) / spikes - Math.PI / 2;
    var px = x + Math.cos(angle) * radius;
    var py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

// ==================== 绘制圆角矩形 ====================
function drawRoundRect(ctx, x, y, w, h, r) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ==================== 检查游戏结束 ====================
function checkGameEnd() {
  if (gameState.score >= gameState.targetScore) {
    endGame(true);
  }
}

// ==================== 结束游戏 ====================
function endGame(isWin) {
  gameState.gameActive = false;
  clearGameTimer();

  // 计算星级
  var scorePercent = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  if (scorePercent >= 1.0) {
    gameState.stars = 3;
  } else if (scorePercent >= 0.8) {
    gameState.stars = 2;
  } else if (scorePercent >= 0.5) {
    gameState.stars = 1;
  } else {
    gameState.stars = 0;
  }

  // 保存排行榜
  if (isWin) {
    saveToLeaderboard(gameState.currentLevel, gameState.score);
  }

  // 播放音效
  if (isWin) {
    audioManager.playSound(SoundNames.WIN);
  } else {
    audioManager.playSound(SoundNames.LOSE);
  }

  // 切换到结束场景
  gameState.currentScene = 'gameover';
}

// ==================== 保存排行榜 ====================
function saveToLeaderboard(level, score) {
  try {
    var leaderboard = [];
    var data = wx.getStorageSync('leaderboard');
    if (data) {
      leaderboard = JSON.parse(data);
    }
    leaderboard.push({ level: level, score: score, time: Date.now() });
    leaderboard.sort(function(a, b) { return b.score - a.score; });
    if (leaderboard.length > 20) {
      leaderboard = leaderboard.slice(0, 20);
    }
    wx.setStorageSync('leaderboard', JSON.stringify(leaderboard));
  } catch (e) {
    console.warn('保存排行榜失败:', e);
  }
}

// ==================== 启动游戏 ====================
init();
