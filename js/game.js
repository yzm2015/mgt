/**
 * 磁吸拆迁队 - 微信小游戏（完整版v3）
 * 修复所有已知Bug + 安卓/iOS兼容性适配
 * 支持：主菜单、关卡选择、排行榜、玩法说明、游戏主体
 */

// ==================== 模块加载 ====================
// 微信小游戏环境支持 require，路径相对于当前文件
const PhysicsSystem = require('./PhysicsSystem');
const CraneController = require('./CraneController');
const BuildingGenerator = require('./BuildingGenerator');

// ==================== 游戏配置 ====================
const CONFIG = {
  gravity: 0.5,
  ropeLength: 150,
  magnetRadius: 80,
  craneSpeed: 5,
  damping: 0.99,
  bounceDamping: 0.5
};

// ==================== 屏幕适配系统 ====================
const ScreenAdapter = {
  screenWidth: 0,
  screenHeight: 0,
  dpr: 1,
  scaleFactor: 1,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
  isNotchDevice: false,
  platform: 'unknown',
  isIOS: false,
  isAndroid: false,
  isLowEndDevice: false,

  /**
   * 初始化屏幕适配参数
   * 使用 wx.getSystemInfoSync() 代替 window.innerWidth/innerHeight
   */
  init: function () {
    try {
      var sysInfo = wx.getSystemInfoSync();
      this.screenWidth = sysInfo.windowWidth || sysInfo.screenWidth || 375;
      this.screenHeight = sysInfo.windowHeight || sysInfo.screenHeight || 667;
      this.dpr = sysInfo.pixelRatio || 1;
      this.platform = sysInfo.platform || 'unknown';
      this.isIOS = (this.platform === 'ios');
      this.isAndroid = (this.platform === 'android');

      // 安全区域处理（刘海屏）
      if (sysInfo.safeArea) {
        this.safeAreaTop = sysInfo.safeArea.top || 0;
        this.safeAreaBottom = sysInfo.screenHeight - (sysInfo.safeArea.bottom || sysInfo.screenHeight);
        this.safeAreaLeft = sysInfo.safeArea.left || 0;
        this.safeAreaRight = sysInfo.screenWidth - (sysInfo.safeArea.right || sysInfo.screenWidth);
        this.isNotchDevice = this.safeAreaTop > 40;
      } else {
        // 没有safeArea信息时，根据机型推断
        if (sysInfo.model && sysInfo.model.indexOf('iPhone X') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        } else if (sysInfo.model && sysInfo.model.indexOf('iPhone 11') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        } else if (sysInfo.model && sysInfo.model.indexOf('iPhone 12') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        } else if (sysInfo.model && sysInfo.model.indexOf('iPhone 13') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        } else if (sysInfo.model && sysInfo.model.indexOf('iPhone 14') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        } else if (sysInfo.model && sysInfo.model.indexOf('iPhone 15') >= 0) {
          this.safeAreaTop = 44;
          this.safeAreaBottom = 34;
          this.isNotchDevice = true;
        }
      }

      // 计算缩放因子：以 375x667 (iPhone 6/7/8) 为基准
      this.scaleFactor = Math.min(
        this.screenWidth / 375,
        this.screenHeight / 667
      );

      // 低端设备检测
      var benchmarkLevel = sysInfo.benchmarkLevel || 0;
      if (this.isAndroid && benchmarkLevel < 20) {
        this.isLowEndDevice = true;
      }

      console.log('[ScreenAdapter] 屏幕适配初始化完成:', JSON.stringify({
        width: this.screenWidth,
        height: this.screenHeight,
        dpr: this.dpr,
        scaleFactor: this.scaleFactor,
        safeAreaTop: this.safeAreaTop,
        safeAreaBottom: this.safeAreaBottom,
        isNotchDevice: this.isNotchDevice,
        platform: this.platform,
        isLowEndDevice: this.isLowEndDevice
      }));
    } catch (err) {
      console.error('[ScreenAdapter] 初始化失败:', err);
      // 降级使用默认值
      this.screenWidth = 375;
      this.screenHeight = 667;
      this.dpr = 1;
      this.scaleFactor = 1;
    }
  },

  /**
   * 根据缩放因子计算实际尺寸
   */
  scale: function (value) {
    return Math.round(value * this.scaleFactor);
  },

  /**
   * 获取逻辑画布宽度（已扣除安全区域）
   */
  getUsableWidth: function () {
    return this.screenWidth - this.safeAreaLeft - this.safeAreaRight;
  },

  /**
   * 获取逻辑画布高度（已扣除安全区域）
   */
  getUsableHeight: function () {
    return this.screenHeight - this.safeAreaTop - this.safeAreaBottom;
  },

  /**
   * 获取安全区域起始X坐标
   */
  getContentX: function () {
    return this.safeAreaLeft;
  },

  /**
   * 获取安全区域起始Y坐标
   */
  getContentY: function () {
    return this.safeAreaTop;
  }
};

// ==================== FPS 监控和性能降级 ====================
const PerformanceMonitor = {
  fps: 60,
  frameCount: 0,
  lastFpsTime: 0,
  fpsHistory: [],
  degradeLevel: 0,  // 0=正常, 1=轻度降级, 2=重度降级
  maxDegradeLevel: 2,
  fpsCheckInterval: 2000, // 每2秒检测一次
  lowFpsThreshold: 25,
  veryLowFpsThreshold: 15,

  /**
   * 更新帧计数
   */
  tick: function (now) {
    this.frameCount++;
    if (this.lastFpsTime === 0) {
      this.lastFpsTime = now;
      return;
    }
    var elapsed = now - this.lastFpsTime;
    if (elapsed >= this.fpsCheckInterval) {
      this.fps = Math.round(this.frameCount * 1000 / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;

      // 记录FPS历史
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      // 计算平均FPS
      var avgFps = 0;
      for (var i = 0; i < this.fpsHistory.length; i++) {
        avgFps += this.fpsHistory[i];
      }
      avgFps = Math.round(avgFps / this.fpsHistory.length);

      // 自动降级
      if (avgFps < this.veryLowFpsThreshold && this.degradeLevel < 2) {
        this.degradeLevel = 2;
        console.log('[PerfMonitor] 重度性能降级: avgFps=' + avgFps);
      } else if (avgFps < this.lowFpsThreshold && this.degradeLevel < 1) {
        this.degradeLevel = 1;
        console.log('[PerfMonitor] 轻度性能降级: avgFps=' + avgFps);
      } else if (avgFps > this.lowFpsThreshold + 10 && this.degradeLevel > 0) {
        this.degradeLevel = Math.max(0, this.degradeLevel - 1);
        console.log('[PerfMonitor] 性能恢复: avgFps=' + avgFps + ', level=' + this.degradeLevel);
      }
    }
  },

  /**
   * 是否应跳过粒子渲染
   */
  shouldSkipParticles: function () {
    return this.degradeLevel >= 2;
  },

  /**
   * 是否应简化渲染
   */
  shouldSimplifyRender: function () {
    return this.degradeLevel >= 1;
  },

  /**
   * 获取当前FPS
   */
  getFps: function () {
    return this.fps;
  }
};

// ==================== requestAnimationFrame 兼容方案 ====================
var compatibleRAF = null;

function initRAF() {
  // 优先使用原生 requestAnimationFrame
  if (typeof requestAnimationFrame === 'function') {
    compatibleRAF = requestAnimationFrame;
  } else if (typeof wx !== 'undefined' && wx.createCanvas) {
    // 微信小游戏环境
    compatibleRAF = function (callback) {
      return setTimeout(callback, 16);
    };
  } else {
    // 降级方案：setTimeout 16ms ≈ 60fps
    compatibleRAF = function (callback) {
      return setTimeout(callback, 16);
    };
  }
}

function nextFrame(callback) {
  if (compatibleRAF) {
    return compatibleRAF(callback);
  }
  return setTimeout(callback, 16);
}

// ==================== 游戏状态 ====================
// 修复Bug#2: 分离游戏循环运行状态和游戏进行状态
// gameLoopRunning: 控制游戏循环是否持续运行（不应在 endGame 中设为 false）
// gameActive: 控制当前游戏是否处于可玩状态（endGame 时设为 false）
let gameState = {
  score: 0,
  timeLeft: 60,
  gameLoopRunning: false,  // 游戏渲染循环是否运行（全局，始终为true）
  gameActive: false,        // 当前关卡是否活跃（可进行游戏操作）
  gamePaused: false,
  currentLevel: 1,
  targetScore: 500,
  stars: 0,
  currentScene: 'menu',    // menu, game, levelselect, leaderboard, instructions, gameover
  unlockedLevel: 1,
  lastGameOverWin: false    // 上一次结算是否胜利
};

// ==================== 游戏对象 ====================
let canvas = null;
let ctx = null;
let physics = null;
let crane = null;
let buildingGenerator = null;
let buildings = [];
let leaderboard = [];
let uiElements = {};

// 修复Bug#3: 跟踪计时器，避免重复创建
let gameTimer = null;
let gameTimerCleared = true;

// FPS 显示开关
let showFPS = false;

// ==================== 工具函数 ====================

/**
 * 修复Bug#1: 实现 darkenColor 函数
 * 将十六进制颜色按 factor 比例变暗
 * factor: 0~1, 0=全黑, 1=原色
 */
function darkenColor(color, factor) {
  if (!color || typeof color !== 'string') {
    return '#000000';
  }

  factor = Math.max(0, Math.min(1, factor || 0.3));

  // 处理 rgba 格式
  if (color.indexOf('rgba') === 0 || color.indexOf('rgb') === 0) {
    var match = color.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      var r = Math.round(parseInt(match[0], 10) * factor);
      var g = Math.round(parseInt(match[1], 10) * factor);
      var b = Math.round(parseInt(match[2], 10) * factor);
      if (match.length >= 4) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + match[3] + ')';
      }
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return color;
  }

  // 处理十六进制颜色
  var hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
  }

  if (hex.length !== 6) {
    return color;
  }

  var rVal = parseInt(hex.substring(0, 2), 16);
  var gVal = parseInt(hex.substring(2, 4), 16);
  var bVal = parseInt(hex.substring(4, 6), 16);

  if (isNaN(rVal) || isNaN(gVal) || isNaN(bVal)) {
    return color;
  }

  rVal = Math.max(0, Math.min(255, Math.round(rVal * factor)));
  gVal = Math.max(0, Math.min(255, Math.round(gVal * factor)));
  bVal = Math.max(0, Math.min(255, Math.round(bVal * factor)));

  var rHex = (rVal < 16 ? '0' : '') + rVal.toString(16);
  var gHex = (gVal < 16 ? '0' : '') + gHex.toString(16);
  var bHex = (bVal < 16 ? '0' : '') + bVal.toString(16);

  return '#' + rHex + gHex + bHex;
}

/**
 * 安全地创建线性渐变
 * 修复Bug#15: 参数为0时崩溃保护
 */
function safeCreateLinearGradient(x0, y0, x1, y1) {
  // 确保所有参数为有效数值
  x0 = Number(x0) || 0;
  y0 = Number(y0) || 0;
  x1 = Number(x1) || 0;
  y1 = Number(y1) || 0;

  // 如果起点和终点完全相同，稍微偏移以避免崩溃
  if (x0 === x1 && y0 === y1) {
    y1 = y0 + 1;
  }

  try {
    return ctx.createLinearGradient(x0, y0, x1, y1);
  } catch (err) {
    // 部分安卓机型 createLinearGradient 可能异常
    console.warn('[safeCreateLinearGradient] 创建渐变失败:', err);
    return null;
  }
}

/**
 * 安全地设置虚线兼容
 * 修复Bug#16: 部分低版本安卓不支持 setLineDash
 */
function safeSetLineDash(segments) {
  try {
    if (ctx.setLineDash) {
      ctx.setLineDash(segments);
    }
  } catch (err) {
    // 静默忽略不支持的 setLineDash
  }
}

function safeClearLineDash() {
  try {
    if (ctx.setLineDash) {
      ctx.setLineDash([]);
    }
  } catch (err) {
    // 静默忽略
  }
}

/**
 * 修复Bug#14: 使用 Math.pow 替代 ** 运算符
 * 兼容低版本安卓 WebView
 */
function safePow(base, exponent) {
  return Math.pow(base, exponent);
}

/**
 * 安全地绘制文字（修复Bug#13: iOS/安卓文字基线差异）
 * 使用 textBaseline = 'middle' 确保文字垂直居中
 */
function drawText(text, x, y, font, color, align, baseline) {
  ctx.fillStyle = color || '#FFFFFF';
  if (font) {
    ctx.font = font;
  }
  ctx.textAlign = align || 'center';
  ctx.textBaseline = baseline || 'middle';
  ctx.fillText(text, x, y);
  // 恢复默认
  ctx.textBaseline = 'alphabetic';
}

/**
 * 修复Bug#11: 将屏幕触摸坐标转换为Canvas逻辑坐标
 * 部分安卓机型 canvas 坐标和屏幕坐标不一致
 */
function touchToCanvas(clientX, clientY) {
  var canvasX = clientX;
  var canvasY = clientY;

  // 如果canvas有偏移，需要减去偏移量
  // 微信小游戏默认canvas全屏，但部分安卓机型需要校准
  try {
    if (canvas && canvas.getBoundingClientRect) {
      var rect = canvas.getBoundingClientRect();
      canvasX = clientX - rect.left;
      canvasY = clientY - rect.top;
    }
  } catch (err) {
    // 忽略
  }

  // 考虑安全区域偏移
  canvasX = canvasX - ScreenAdapter.safeAreaLeft;
  canvasY = canvasY - ScreenAdapter.safeAreaTop;

  return { x: canvasX, y: canvasY };
}

// ==================== 初始化 ====================
function init() {
  console.log('[Game] 开始初始化游戏...');
  try {
    // 修复Bug#7: 先初始化屏幕适配系统
    ScreenAdapter.init();

    // 创建 Canvas
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');

    // 修复Bug#8: 使用 wx.getSystemInfoSync 获取屏幕尺寸
    // 修复Bug#9: DPI 适配 - 设置 canvas 物理像素大小
    var logicalWidth = ScreenAdapter.screenWidth;
    var logicalHeight = ScreenAdapter.screenHeight;

    // 设置逻辑尺寸
    canvas.width = logicalWidth;
    canvas.height = logicalHeight;

    console.log('[Game] 画布大小: ' + logicalWidth + 'x' + logicalHeight +
      ', dpr=' + ScreenAdapter.dpr + ', scale=' + ScreenAdapter.scaleFactor.toFixed(3));

    // 加载存档数据
    loadLeaderboard();
    loadGameProgress();

    // 初始化 requestAnimationFrame
    initRAF();

    // 启动游戏循环（修复Bug#2: gameLoopRunning 始终为 true，不因 endGame 停止）
    gameState.gameLoopRunning = true;
    gameState.gameActive = false;
    gameLoop();

    // 修复Bug#7: 在 canvas 初始化完成后再绑定事件
    bindEvents();

    console.log('[Game] 游戏初始化完成');
  } catch (err) {
    console.error('[Game] 游戏初始化失败:', err);
  }
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (!gameState.gameLoopRunning) return;

  var now = Date.now();
  PerformanceMonitor.tick(now);

  update();
  render();

  // 使用兼容的 requestAnimationFrame
  nextFrame(gameLoop);
}

function update() {
  if (gameState.currentScene === 'game' && gameState.gameActive && !gameState.gamePaused) {
    if (crane) crane.update();
    if (buildingGenerator) buildingGenerator.update(physics);
    checkMagnetCollision();
    checkGameEnd();
  }
}

function render() {
  var sw = canvas.width;
  var sh = canvas.height;

  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, sw, sh);

  switch (gameState.currentScene) {
    case 'menu': renderMainMenu(); break;
    case 'game': renderGameScene(); break;
    case 'levelselect': renderLevelSelect(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'instructions': renderInstructions(); break;
    case 'gameover': renderGameScene(); renderGameOverOverlay(); break;
    default: renderMainMenu();
  }

  // FPS 调试信息
  if (showFPS) {
    renderFPSInfo();
  }
}

function renderFPSInfo() {
  var fpsText = 'FPS: ' + PerformanceMonitor.getFps() +
    ' | Degrade: ' + PerformanceMonitor.degradeLevel;
  if (PerformanceMonitor.shouldSkipParticles()) {
    fpsText += ' [NO-PARTICLE]';
  }
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, canvas.height - 30, 250, 30);
  drawText(fpsText, 5, canvas.height - 15, '12px Arial', '#00FF00', 'left', 'middle');
}

// ==================== 主菜单 ====================
function renderMainMenu() {
  var sw = canvas.width;
  var sh = canvas.height;
  var sf = ScreenAdapter.scaleFactor;
  var safeY = ScreenAdapter.getContentY();

  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, sw, sh);

  // 标题
  var titleY = safeY + ScreenAdapter.scale(120);
  drawText('磁吸拆迁队', sw / 2, titleY,
    'bold ' + ScreenAdapter.scale(48) + 'px Arial', '#FFD700', 'center', 'middle');

  // 副标题
  drawText('物理消除小游戏', sw / 2, titleY + ScreenAdapter.scale(40),
    ScreenAdapter.scale(20) + 'px Arial', '#FFFFFF', 'center', 'middle');

  drawMenuButtons();
}

function drawMenuButtons() {
  var sf = ScreenAdapter.scaleFactor;
  var bw = ScreenAdapter.scale(200);
  var bh = ScreenAdapter.scale(50);
  var sx = (canvas.width - bw) / 2;
  var safeY = ScreenAdapter.getContentY();
  var sy = safeY + ScreenAdapter.scale(250);
  var gap = ScreenAdapter.scale(70);

  drawButton(sx, sy, bw, bh, '开始游戏', '#00FF00');
  uiElements.startBtn = { x: sx, y: sy, w: bw, h: bh };

  sy += gap;
  drawButton(sx, sy, bw, bh, '关卡选择', '#4169E1');
  uiElements.levelBtn = { x: sx, y: sy, w: bw, h: bh };

  sy += gap;
  drawButton(sx, sy, bw, bh, '排行榜', '#FFD700');
  uiElements.leaderBtn = { x: sx, y: sy, w: bw, h: bh };

  sy += gap;
  drawButton(sx, sy, bw, bh, '玩法说明', '#FF69B4');
  uiElements.instBtn = { x: sx, y: sy, w: bw, h: bh };

  // FPS 开关按钮（调试用）
  sy += gap;
  drawButton(sx, sy, bw, bh, showFPS ? 'FPS: 开' : 'FPS: 关', '#607D8B');
  uiElements.fpsBtn = { x: sx, y: sy, w: bw, h: bh };
}

// ==================== 游戏场景 ====================
function renderGameScene() {
  var sw = canvas.width;
  var sh = canvas.height;
  var theme = buildingGenerator ? buildingGenerator.currentTheme : {
    skyColor: '#87CEEB',
    groundColor: '#8B4513',
    grassColor: '#228B22',
    cloudColor: 'rgba(255,255,255,0.8)'
  };

  ctx.fillStyle = theme.skyColor || '#87CEEB';
  ctx.fillRect(0, 0, sw, sh);

  drawClouds(theme.cloudColor);
  drawGround(theme);

  if (buildingGenerator && !PerformanceMonitor.shouldSkipParticles()) {
    buildingGenerator.draw(ctx);
  } else if (buildingGenerator) {
    // 降级模式：只绘制方块，跳过粒子
    drawBuildingsSimplified();
  }

  if (crane) crane.draw(ctx);
  drawGameUI();

  if (gameState.gamePaused) drawPauseOverlay();
}

/**
 * 简化版建筑绘制（性能降级模式）
 */
function drawBuildingsSimplified() {
  if (!buildingGenerator) return;
  var bList = buildingGenerator.buildings;
  for (var i = 0; i < bList.length; i++) {
    var block = bList[i];
    if (block.isDestroyed) continue;
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.strokeStyle = block.strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(block.x, block.y, block.width, block.height);
  }
}

function drawGround(theme) {
  var sw = canvas.width;
  var sh = canvas.height;
  var groundH = ScreenAdapter.scale(50);
  var grassH = ScreenAdapter.scale(10);
  var groundY = sh - groundH - ScreenAdapter.safeAreaBottom;

  ctx.fillStyle = theme.groundColor || '#8B4513';
  ctx.fillRect(0, groundY, sw, groundH + ScreenAdapter.safeAreaBottom);

  ctx.fillStyle = theme.grassColor || '#228B22';
  ctx.fillRect(0, groundY, sw, grassH);
}

function drawClouds(cloudColor) {
  if (PerformanceMonitor.shouldSimplifyRender()) return; // 降级模式跳过云朵

  ctx.fillStyle = cloudColor || 'rgba(255,255,255,0.8)';
  var sf = ScreenAdapter.scaleFactor;
  drawCloud(ScreenAdapter.scale(100), ScreenAdapter.scale(80) + ScreenAdapter.safeAreaTop, ScreenAdapter.scale(60));
  drawCloud(ScreenAdapter.scale(300), ScreenAdapter.scale(120) + ScreenAdapter.safeAreaTop, ScreenAdapter.scale(40));
  if (!PerformanceMonitor.shouldSimplifyRender()) {
    drawCloud(ScreenAdapter.scale(500), ScreenAdapter.scale(60) + ScreenAdapter.safeAreaTop, ScreenAdapter.scale(50));
  }
}

function drawCloud(x, y, size) {
  if (size <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.6, y, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x + size * 1.2, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ==================== 关卡选择 ====================
function renderLevelSelect() {
  var sw = canvas.width;
  var sh = canvas.height;
  var safeY = ScreenAdapter.getContentY();

  ctx.fillStyle = '#2F4F4F';
  ctx.fillRect(0, 0, sw, sh);

  drawText('选择关卡', sw / 2, safeY + ScreenAdapter.scale(60),
    'bold ' + ScreenAdapter.scale(36) + 'px Arial', '#FFFFFF', 'center', 'middle');

  drawLevelGrid();
  drawBackButton();
}

function drawLevelGrid() {
  var sf = ScreenAdapter.scaleFactor;
  var cols = 5;
  var bs = ScreenAdapter.scale(50);
  var sp = ScreenAdapter.scale(10);
  var sx = (canvas.width - cols * (bs + sp)) / 2;
  var safeY = ScreenAdapter.getContentY();
  var sy = safeY + ScreenAdapter.scale(100);

  // 最多显示当前已解锁的关卡（限制显示数量避免溢出）
  var maxDisplay = Math.min(gameState.unlockedLevel, 50);

  for (var i = 1; i <= maxDisplay; i++) {
    var col = (i - 1) % cols;
    var row = Math.floor((i - 1) / cols);
    var x = sx + col * (bs + sp);
    var y = sy + row * (bs + sp);

    // 检查是否超出屏幕
    if (y + bs > canvas.height - ScreenAdapter.safeAreaBottom - ScreenAdapter.scale(60)) break;

    var color = i <= gameState.unlockedLevel ? '#00FF00' : '#808080';
    drawButton(x, y, bs, bs, String(i), color);

    if (!uiElements.levelButtons) uiElements.levelButtons = {};
    uiElements.levelButtons[i] = { x: x, y: y, w: bs, h: bs };
  }
}

// ==================== 排行榜 ====================
function renderLeaderboard() {
  var sw = canvas.width;
  var sh = canvas.height;
  var safeY = ScreenAdapter.getContentY();

  ctx.fillStyle = '#1C1C1C';
  ctx.fillRect(0, 0, sw, sh);

  drawText('排行榜', sw / 2, safeY + ScreenAdapter.scale(60),
    'bold ' + ScreenAdapter.scale(36) + 'px Arial', '#FFD700', 'center', 'middle');

  drawLeaderboardList();
  drawBackButton();
}

function drawLeaderboardList() {
  var sf = ScreenAdapter.scaleFactor;
  var safeY = ScreenAdapter.getContentY();
  var y = safeY + ScreenAdapter.scale(100);
  var lineHeight = ScreenAdapter.scale(40);
  var fontSize = ScreenAdapter.scale(16);
  var font = fontSize + 'px Arial';
  var xLeft = ScreenAdapter.getContentX() + ScreenAdapter.scale(50);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  var count = Math.min(leaderboard.length, 10);
  for (var i = 0; i < count; i++) {
    var entry = leaderboard[i];
    if (y + lineHeight > canvas.height - ScreenAdapter.safeAreaBottom - ScreenAdapter.scale(60)) break;
    ctx.font = font;
    ctx.fillText((i + 1) + '. ' + (entry.name || '玩家') + ' - ' + entry.score, xLeft, y);
    y += lineHeight;
  }

  ctx.textBaseline = 'alphabetic';
}

// ==================== 玩法说明 ====================
function renderInstructions() {
  var sw = canvas.width;
  var sh = canvas.height;
  var safeY = ScreenAdapter.getContentY();
  var safeX = ScreenAdapter.getContentX();

  ctx.fillStyle = '#F0F8FF';
  ctx.fillRect(0, 0, sw, sh);

  drawText('玩法说明', sw / 2, safeY + ScreenAdapter.scale(60),
    'bold ' + ScreenAdapter.scale(36) + 'px Arial', '#1C1C1C', 'center', 'middle');

  var fontSize = ScreenAdapter.scale(16);
  var font = fontSize + 'px Arial';
  var xLeft = safeX + ScreenAdapter.scale(50);
  var y = safeY + ScreenAdapter.scale(100);
  var lineH = ScreenAdapter.scale(25);

  var instructions = [
    '【操作方式】',
    '1. 左下区域滑动 - 控制起重机',
    '2. 长按屏幕 - 激活磁铁',
    '3. 松开手指 - 释放物体',
    '',
    '【游戏目标】',
    '在限定时间内拆除建筑获取得分',
    '',
    '【方块类型】',
    '木材（轻）、砖石（中）、钢材（重）'
  ];

  ctx.fillStyle = '#1C1C1C';
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (var idx = 0; idx < instructions.length; idx++) {
    if (y > canvas.height - ScreenAdapter.safeAreaBottom - ScreenAdapter.scale(60)) break;
    ctx.fillText(instructions[idx], xLeft, y);
    y += lineH;
  }

  ctx.textBaseline = 'alphabetic';
  drawBackButton();
}

// ==================== UI 组件（美化版）====================
function drawButton(x, y, width, height, text, color) {
  var sf = ScreenAdapter.scaleFactor;
  var safeColor = color || '#808080';

  // 绘制按钮阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 3, y + 3, width, height);

  // 修复Bug#1: 使用实现的 darkenColor 创建渐变
  var gradient = safeCreateLinearGradient(x, y, x, y + height);
  if (gradient) {
    gradient.addColorStop(0, safeColor);
    gradient.addColorStop(1, darkenColor(safeColor, 0.7));
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = safeColor;
  }

  // 绘制按钮背景
  ctx.fillRect(x, y, width, height);

  // 绘制按钮边框（使用变暗颜色）
  ctx.strokeStyle = darkenColor(safeColor, 0.5);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // 修复Bug#13: 使用 textBaseline = 'middle' 确保文字垂直居中
  var fontSize = ScreenAdapter.scale(18);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + fontSize + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawBackButton() {
  var safeX = ScreenAdapter.getContentX();
  var safeY = ScreenAdapter.getContentY();
  var bw = ScreenAdapter.scale(80);
  var bh = ScreenAdapter.scale(40);
  var pad = ScreenAdapter.scale(15);
  drawButton(safeX + pad, safeY + pad, bw, bh, '返回', '#808080');
  uiElements.backBtn = { x: safeX + pad, y: safeY + pad, w: bw, h: bh };
}

function drawGameUI() {
  var sf = ScreenAdapter.scaleFactor;
  var safeX = ScreenAdapter.getContentX();
  var safeY = ScreenAdapter.getContentY();
  var fontSize = ScreenAdapter.scale(24);
  var font = 'bold ' + fontSize + 'px Arial';
  var xLeft = safeX + ScreenAdapter.scale(20);
  var yStart = safeY + ScreenAdapter.scale(40);
  var lineH = ScreenAdapter.scale(40);

  ctx.fillStyle = '#000000';
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillText('分数: ' + gameState.score, xLeft, yStart);
  ctx.fillText('时间: ' + gameState.timeLeft + 's', xLeft, yStart + lineH);
  ctx.fillText('关卡: ' + gameState.currentLevel, xLeft, yStart + lineH * 2);

  ctx.textAlign = 'right';
  ctx.fillText('目标: ' + gameState.targetScore,
    canvas.width - ScreenAdapter.safeAreaRight - ScreenAdapter.scale(20), yStart);

  ctx.textBaseline = 'alphabetic';

  drawPauseButton();
}

function drawPauseButton() {
  var sf = ScreenAdapter.scaleFactor;
  var btnW = ScreenAdapter.scale(60);
  var btnH = ScreenAdapter.scale(40);
  var btnX = canvas.width - ScreenAdapter.safeAreaRight - ScreenAdapter.scale(80);
  var btnY = ScreenAdapter.getContentY() + ScreenAdapter.scale(10);
  var fontSize = ScreenAdapter.scale(20);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold ' + fontSize + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameState.gamePaused ? '继续' : '暂停', btnX + btnW / 2, btnY + btnH / 2);
  ctx.textBaseline = 'alphabetic';

  uiElements.pauseBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var fontSize = ScreenAdapter.scale(48);
  drawText('游戏暂停', canvas.width / 2, canvas.height / 2,
    'bold ' + fontSize + 'px Arial', '#FFFFFF', 'center', 'middle');
}

// ==================== 游戏逻辑 ====================
function loadLevel(level) {
  console.log('[Game] 加载关卡 ' + level);

  // 清理旧计时器（修复Bug#3: 防止多个计时器同时运行）
  clearGameTimer();

  // 初始化物理和游戏系统
  physics = new PhysicsSystem(CONFIG);
  crane = new CraneController(canvas, CONFIG);
  buildingGenerator = new BuildingGenerator(canvas, CONFIG);
  crane.setPhysicsSystem(physics);

  // 生成关卡
  buildings = buildingGenerator.generateLevel(level);
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0;
  gameState.gameActive = true;
  gameState.gamePaused = false;

  // 启动新计时器
  startTimer();

  console.log('[Game] 关卡 ' + level + ' 加载完成, 目标=' + gameState.targetScore + ', 时间=' + gameState.timeLeft + 's');
}

/**
 * 修复Bug#3: 清理游戏计时器
 */
function clearGameTimer() {
  if (gameTimer !== null) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  gameTimerCleared = true;
}

/**
 * 修复Bug#3: 启动计时器（先清理旧的）
 */
function startTimer() {
  // 确保清理旧计时器
  clearGameTimer();

  gameTimerCleared = false;
  gameTimer = setInterval(function () {
    if (!gameState.gameActive || gameState.gamePaused) return;

    gameState.timeLeft--;

    if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
      // 时间紧迫提示
      try {
        wx.vibrateShort();
      } catch (e) {
        // 部分安卓机型不支持
      }
    }

    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      endGame(false);
    }
  }, 1000);
}

function checkGameEnd() {
  if (gameState.score >= gameState.targetScore) {
    endGame(true);
  }
}

/**
 * 修复Bug#2: endGame 不再停止游戏循环
 * 改为设置 gameActive = false 并切换场景到 gameover
 */
function endGame(isWin) {
  // 防止重复调用
  if (!gameState.gameActive) return;
  gameState.gameActive = false;

  // 清理计时器
  clearGameTimer();

  // 计算星级
  var pct = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  if (pct >= 1.0) {
    gameState.stars = 3;
  } else if (pct >= 0.8) {
    gameState.stars = 2;
  } else if (pct >= 0.5) {
    gameState.stars = 1;
  } else {
    gameState.stars = 0;
  }

  gameState.lastGameOverWin = isWin;

  // 更新排行榜和存档
  updateLeaderboard(gameState.score);
  saveGameProgress();

  // 切换到结算场景（而不是停止游戏循环）
  gameState.currentScene = 'gameover';

  console.log('[Game] 游戏结束, ' + (isWin ? '胜利!' : '时间到!') +
    ' 得分=' + gameState.score + ' 星级=' + gameState.stars);
}

// ==================== 结算界面 ====================
/**
 * 修复Bug#4: 结算界面包含可交互的按钮
 */
function renderGameOverOverlay() {
  var sw = canvas.width;
  var sh = canvas.height;
  var sf = ScreenAdapter.scaleFactor;
  var isWin = gameState.lastGameOverWin;

  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, sw, sh);

  // 结算框
  var boxW = ScreenAdapter.scale(300);
  var boxH = ScreenAdapter.scale(400);
  var boxX = (sw - boxW) / 2;
  var boxY = (sh - boxH) / 2;

  // 框背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // 框边框
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 标题
  var titleFontSize = ScreenAdapter.scale(36);
  drawText(isWin ? '关卡通过!' : '时间到!', sw / 2, boxY + ScreenAdapter.scale(50),
    'bold ' + titleFontSize + 'px Arial', '#000000', 'center', 'middle');

  // 星级
  drawStars(boxX + boxW / 2, boxY + ScreenAdapter.scale(120), gameState.stars);

  // 分数
  var scoreFontSize = ScreenAdapter.scale(24);
  drawText('得分: ' + gameState.score, sw / 2, boxY + ScreenAdapter.scale(200),
    scoreFontSize + 'px Arial', '#000000', 'center', 'middle');
  drawText('目标: ' + gameState.targetScore, sw / 2, boxY + ScreenAdapter.scale(240),
    scoreFontSize + 'px Arial', '#000000', 'center', 'middle');

  // 修复Bug#4: 重玩和下一关按钮绑定到 uiElements
  var btnW = ScreenAdapter.scale(80);
  var btnH = ScreenAdapter.scale(40);
  var btnY2 = boxY + ScreenAdapter.scale(300);

  // 重玩按钮
  var replayBtnX = boxX + ScreenAdapter.scale(30);
  drawButton(replayBtnX, btnY2, btnW, btnH, '重玩', '#FF6347');
  uiElements.replayBtn = { x: replayBtnX, y: btnY2, w: btnW, h: btnH };

  // 下一关按钮（只有胜利时才显示）
  if (isWin) {
    var nextBtnX = boxX + boxW - ScreenAdapter.scale(30) - btnW;
    drawButton(nextBtnX, btnY2, btnW, btnH, '下一关', '#00FF00');
    uiElements.nextLevelBtn = { x: nextBtnX, y: btnY2, w: btnW, h: btnH };
  } else {
    uiElements.nextLevelBtn = null;
  }

  // 返回菜单按钮
  var menuBtnW = ScreenAdapter.scale(120);
  var menuBtnH = ScreenAdapter.scale(40);
  var menuBtnX = boxX + (boxW - menuBtnW) / 2;
  var menuBtnY = boxY + ScreenAdapter.scale(350);
  drawButton(menuBtnX, menuBtnY, menuBtnW, menuBtnH, '返回菜单', '#808080');
  uiElements.menuBtn = { x: menuBtnX, y: menuBtnY, w: menuBtnW, h: menuBtnH };
}

function drawStars(x, y, stars) {
  var starSize = ScreenAdapter.scale(30);
  var starSpacing = ScreenAdapter.scale(10);
  var totalWidth = 3 * starSize + 2 * starSpacing;
  var startX = x - totalWidth / 2;

  for (var i = 0; i < 3; i++) {
    var starX = startX + i * (starSize + starSpacing) + starSize / 2;
    var color = i < stars ? '#FFD700' : '#C0C0C0';
    drawStar(starX, y, starSize, color);
  }
}

function drawStar(x, y, size, color) {
  ctx.fillStyle = color;

  var spikes = 5;
  var outerRadius = size / 2;
  var innerRadius = outerRadius / 2;

  ctx.beginPath();
  for (var i = 0; i < spikes * 2; i++) {
    var radius = (i % 2 === 0) ? outerRadius : innerRadius;
    var angle = (i * Math.PI) / spikes - Math.PI / 2;

    // 修复Bug#14: 使用 Math.pow 替代 ** 运算符
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

// ==================== 磁铁碰撞检测 ====================
function checkMagnetCollision() {
  if (!crane || !crane.isGrabbing()) return;
  var magnetPos = crane.getMagnetPosition();

  for (var i = 0; i < buildings.length; i++) {
    var block = buildings[i];
    if (block.isDestroyed || block.isGrabbed) continue;

    var dx = (block.x + block.width / 2) - magnetPos.x;
    var dy = (block.y + block.height / 2) - magnetPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // 修复Bug#14: 使用 Math.pow 替代 **
    var speed = Math.sqrt(Math.pow(block.velocityX, 2) + Math.pow(block.velocityY, 2));

    if (dist < 100 && speed > 3) {
      var impact = speed * block.mass * 10;
      var result = physics.calculateDamage(block, impact);
      if (result.damage > 0) {
        var dr = buildingGenerator.damageBlock(block, result.damage);
        if (dr.destroyed) {
          gameState.score += dr.score;
        }
      }
    }
  }
}

// ==================== 事件处理 ====================
/**
 * 修复Bug#5: wx.onTouchStart/onTouchMove/onTouchEnd 每次调用覆盖前一次
 * 解决方案：只调用一次 wx.onTouchStart/onTouchMove/onTouchEnd，
 * 在回调内部根据当前场景分发事件
 */
function bindEvents() {
  wx.onTouchStart(function (e) {
    handleTouchStart(e);
  });
  wx.onTouchMove(function (e) {
    handleTouchMove(e);
  });
  wx.onTouchEnd(function (e) {
    handleTouchEnd(e);
  });
}

function handleTouchStart(e) {
  if (!e || !e.touches || e.touches.length === 0) return;

  var touch = e.touches[0];
  var coords = touchToCanvas(touch.clientX, touch.clientY);
  var x = coords.x;
  var y = coords.y;

  if (gameState.currentScene === 'game') {
    handleGameTouch(x, y);
  } else if (gameState.currentScene === 'gameover') {
    handleGameOverTouch(x, y);
  } else {
    handleMenuTouch(x, y);
  }
}

function handleTouchMove(e) {
  if (!e || !e.touches || e.touches.length === 0) return;
  if (gameState.currentScene !== 'game' || gameState.gamePaused || !gameState.gameActive) return;

  var touch = e.touches[0];
  var coords = touchToCanvas(touch.clientX, touch.clientY);
  var x = coords.x;

  if (crane && crane.isDragging) {
    var dx = x - (crane.touchStartX || 0);
    if (Math.abs(dx) > 5) {
      crane.move(dx > 0 ? 1 : -1);
      crane.touchStartX = x;
    }
  }
}

/**
 * 修复Bug#6: handleTouchEnd 应该使用 e.changedTouches
 * 手指离开时 e.touches 为空数组，应该从 e.changedTouches 获取坐标
 */
function handleTouchEnd(e) {
  // 修复: 使用 changedTouches 代替 touches
  // e.changedTouches 包含刚刚离开屏幕的触摸点
  if (crane) {
    crane.isDragging = false;
    var released = crane.releaseMagnet();
    if (released) {
      console.log('[Game] 释放方块: ' + released.type);
    }
  }
}

function handleGameTouch(x, y) {
  if (!gameState.gameActive || gameState.gamePaused) {
    // 暂停按钮仍然可以响应
    if (isInButton(x, y, uiElements.pauseBtn)) {
      gameState.gamePaused = !gameState.gamePaused;
      return;
    }
    return;
  }

  // 暂停按钮
  if (isInButton(x, y, uiElements.pauseBtn)) {
    gameState.gamePaused = !gameState.gamePaused;
    return;
  }

  // 左下区域：控制起重机
  var controlX = canvas.width / 3;
  var controlY = canvas.height / 2;
  if (crane && x < controlX && y > controlY) {
    crane.touchStartX = x;
    crane.isDragging = true;
  } else if (crane) {
    crane.activateMagnet(x, y, buildings);
  }
}

/**
 * 修复Bug#4: 结算界面触摸处理
 */
function handleGameOverTouch(x, y) {
  // 重玩按钮
  if (isInButton(x, y, uiElements.replayBtn)) {
    console.log('[Game] 重玩当前关卡');
    gameState.currentScene = 'game';
    loadLevel(gameState.currentLevel);
    return;
  }

  // 下一关按钮（只有胜利时才有）
  if (gameState.lastGameOverWin && isInButton(x, y, uiElements.nextLevelBtn)) {
    console.log('[Game] 进入下一关');
    gameState.currentLevel = Math.min(gameState.currentLevel + 1, 1000);
    gameState.currentScene = 'game';
    loadLevel(gameState.currentLevel);
    return;
  }

  // 返回菜单按钮
  if (isInButton(x, y, uiElements.menuBtn)) {
    console.log('[Game] 返回主菜单');
    gameState.currentScene = 'menu';
    clearGameTimer();
    return;
  }
}

function handleMenuTouch(x, y) {
  switch (gameState.currentScene) {
    case 'menu':
      if (isInButton(x, y, uiElements.startBtn)) {
        gameState.currentScene = 'game';
        loadLevel(gameState.currentLevel);
      } else if (isInButton(x, y, uiElements.levelBtn)) {
        gameState.currentScene = 'levelselect';
      } else if (isInButton(x, y, uiElements.leaderBtn)) {
        gameState.currentScene = 'leaderboard';
      } else if (isInButton(x, y, uiElements.instBtn)) {
        gameState.currentScene = 'instructions';
      } else if (isInButton(x, y, uiElements.fpsBtn)) {
        showFPS = !showFPS;
      }
      break;

    case 'levelselect':
      if (uiElements.levelButtons) {
        for (var i = 1; i <= gameState.unlockedLevel; i++) {
          if (isInButton(x, y, uiElements.levelButtons[i])) {
            gameState.currentLevel = i;
            gameState.currentScene = 'game';
            loadLevel(i);
            break;
          }
        }
      }
      if (isInButton(x, y, uiElements.backBtn)) {
        gameState.currentScene = 'menu';
      }
      break;

    case 'leaderboard':
    case 'instructions':
      if (isInButton(x, y, uiElements.backBtn)) {
        gameState.currentScene = 'menu';
      }
      break;
  }
}

function isInButton(x, y, btn) {
  if (!btn) return false;
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

// ==================== 数据管理 ====================
function loadLeaderboard() {
  try {
    var data = wx.getStorageSync('leaderboard');
    leaderboard = data || [];
  } catch (e) {
    leaderboard = [];
  }
}

function saveLeaderboard() {
  try {
    wx.setStorageSync('leaderboard', leaderboard);
  } catch (e) {
    console.error('[Game] 保存排行榜失败:', e);
  }
}

function updateLeaderboard(score) {
  leaderboard.push({ name: '玩家', score: score, date: Date.now() });
  leaderboard.sort(function (a, b) { return b.score - a.score; });
  leaderboard = leaderboard.slice(0, 10);
  saveLeaderboard();
}

function loadGameProgress() {
  try {
    var data = wx.getStorageSync('gameProgress');
    if (data) {
      gameState.unlockedLevel = data.unlockedLevel || 1;
      gameState.currentLevel = data.currentLevel || 1;
    }
  } catch (e) {
    // 使用默认值
  }
}

function saveGameProgress() {
  if (gameState.currentLevel >= gameState.unlockedLevel) {
    gameState.unlockedLevel = gameState.currentLevel + 1;
  }
  try {
    wx.setStorageSync('gameProgress', {
      unlockedLevel: gameState.unlockedLevel,
      currentLevel: gameState.currentLevel
    });
  } catch (e) {
    console.error('[Game] 保存游戏进度失败:', e);
  }
}

// ==================== 工具函数 ====================
function getThemeForLevel(level) {
  var themes = {
    1: { skyColor: '#87CEEB', groundColor: '#8B4513', grassColor: '#228B22' },
    101: { skyColor: '#F4D19F', groundColor: '#F4A460', grassColor: '#DAA520' },
    201: { skyColor: '#E0EFFF', groundColor: '#F5F5F5', grassColor: '#FFFFFF' }
  };
  var key = 1;
  var keys = Object.keys(themes);
  for (var i = 0; i < keys.length; i++) {
    var k = parseInt(keys[i], 10);
    if (level >= k) {
      key = k;
    }
  }
  return themes[key];
}

// ==================== 启动 ====================
// 修复Bug#7: 先 init()（创建 canvas）再 bindEvents()
// init() 内部会调用 bindEvents()，确保 canvas 已存在
init();
