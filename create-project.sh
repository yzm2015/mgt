#!/bin/bash
# 《磁吸拆迁队》微信小游戏 - 一键创建脚本
# 使用方法：将此脚本保存到电脑，然后运行 bash create-project.sh

PROJECT_DIR="magnetic-demolition"

echo "=========================================="
echo "  磁吸拆迁队 - 微信小游戏项目创建工具"
echo "=========================================="
echo ""

# 创建目录结构
echo "[1/5] 创建目录结构..."
mkdir -p "$PROJECT_DIR/js"
mkdir -p "$PROJECT_DIR/images"
mkdir -p "$PROJECT_DIR/audio"
mkdir -p "$PROJECT_DIR/utils"
echo "  ✓ 目录结构创建完成"

# 创建 game.json
echo "[2/5] 创建配置文件..."
cat > "$PROJECT_DIR/game.json" << 'GAMEJSON'
{
  "deviceOrientation": "portrait",
  "showStatusBar": false,
  "networkTimeout": {
    "request": 10000,
    "connectSocket": 10000,
    "uploadFile": 10000,
    "downloadFile": 10000
  }
}
GAMEJSON

cat > "$PROJECT_DIR/project.config.json" << 'PROJCONF'
{
  "description": "磁吸拆迁队 - 微信小游戏",
  "setting": {
    "urlCheck": true,
    "es6": true,
    "postcss": true,
    "minified": true,
    "enhance": true,
    "compileHotReLoad": false
  },
  "compileType": "game",
  "libVersion": "3.3.4",
  "appid": "wxXXXXXXXXXXXXXX",
  "projectname": "magnetic-demolition",
  "condition": {}
}
PROJCONF
echo "  ✓ 配置文件创建完成"

# 创建核心模块文件
echo "[3/5] 创建核心模块..."
echo "  请将以下文件从云开发环境复制到对应目录："
echo "    js/PhysicsSystem.js      - 物理系统"
echo "    js/CraneController.js    - 起重机控制"
echo "    js/BuildingGenerator.js  - 建筑生成器"
echo "    js/GameMechanics.js      - 游戏机制"
echo "    js/AudioGenerator.js     - 音效生成器"
echo "    js/AudioManager.js       - 音效管理器"
echo "    js/game.js               - 游戏主逻辑"

# 创建入口文件
echo "[4/5] 创建入口文件..."
cat > "$PROJECT_DIR/game.js" << 'ENTRYFILE'
// 磁吸拆迁队 - 微信小游戏入口文件
// 此文件是微信小游戏的入口，加载所有模块
const PhysicsSystem = require('./js/PhysicsSystem');
const CraneController = require('./js/CraneController');
const BuildingGenerator = require('./js/BuildingGenerator');
const GameMechanics = require('./js/GameMechanics');
const AudioGenerator = require('./js/AudioGenerator');

// === 游戏配置 ===
const CONFIG = {
  gravity: 0.5,
  ropeLength: 150,
  magnetRadius: 80,
  craneSpeed: 5,
  damping: 0.99,
  bounceDamping: 0.5
};

// === 屏幕适配系统 ===
const ScreenAdapter = {
  screenWidth: 375,
  screenHeight: 667,
  scaleFactor: 1,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
  pixelRatio: 1,

  init() {
    try {
      const sys = wx.getSystemInfoSync();
      this.screenWidth = sys.windowWidth || sys.screenWidth || 375;
      this.screenHeight = sys.windowHeight || sys.screenHeight || 667;
      this.pixelRatio = sys.pixelRatio || 1;
      this.scaleFactor = this.screenWidth / 375;

      if (sys.safeArea) {
        this.safeAreaTop = sys.safeArea.top || 0;
        this.safeAreaBottom = sys.screenHeight - (sys.safeArea.bottom || sys.screenHeight);
        this.safeAreaLeft = sys.safeArea.left || 0;
        this.safeAreaRight = sys.screenWidth - (sys.safeArea.right || sys.screenWidth);
      }

      // iPhone X+ 刘海屏兜底
      if (sys.model && sys.model.indexOf('iPhone') >= 0 && this.screenHeight >= 812) {
        this.safeAreaTop = Math.max(this.safeAreaTop, 44);
        this.safeAreaBottom = Math.max(this.safeAreaBottom, 34);
      }
    } catch (e) {
      console.warn('ScreenAdapter init failed:', e);
    }
  },

  scale(val) { return val * this.scaleFactor; },
  sx(val) { return val * this.scaleFactor + this.safeAreaLeft; },
  sy(val) { return val * this.scaleFactor + this.safeAreaTop; }
};

// === 游戏状态 ===
let gameState = {
  score: 0,
  timeLeft: 60,
  gameActive: false,
  gamePaused: false,
  currentLevel: 1,
  targetScore: 500,
  stars: 0,
  currentScene: 'menu',
  unlockedLevel: 1
};

let canvas, ctx, physics, crane, buildingGenerator, gameMechanics, audioGen;
let buildings = [];
let leaderboard = [];
let uiElements = {};
let gameTimer = null;
let loopRunning = false;

// === 颜色工具 ===
function darkenColor(color, factor) {
  if (!color || typeof color !== 'string') return '#000000';
  factor = Math.max(0, Math.min(1, factor || 0.3));

  // 处理 hex 格式
  if (color.charAt(0) === '#') {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = Math.floor(parseInt(hex.substring(0,2), 16) * (1 - factor));
    const g = Math.floor(parseInt(hex.substring(2,4), 16) * (1 - factor));
    const b = Math.floor(parseInt(hex.substring(4,6), 16) * (1 - factor));
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  // 处理 rgb/rgba 格式
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = Math.floor(parseInt(match[1]) * (1 - factor));
    const g = Math.floor(parseInt(match[2]) * (1 - factor));
    const b = Math.floor(parseInt(match[3]) * (1 - factor));
    return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  return color;
}

function safeSetLineDash(ctx, segments) {
  try { ctx.setLineDash(segments); } catch(e) {}
}
function safeClearLineDash(ctx) {
  try { ctx.setLineDash([]); } catch(e) {}
}
function safePow(base, exp) {
  return Math.pow(base, exp);
}

// === 初始化 ===
function init() {
  try {
    ScreenAdapter.init();
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');
    canvas.width = ScreenAdapter.screenWidth;
    canvas.height = ScreenAdapter.screenHeight;

    audioGen = new AudioGenerator();
    loadLeaderboard();
    loadGameProgress();

    bindEvents();
    loopRunning = true;
    gameLoop();
    console.log('游戏初始化完成 ' + canvas.width + 'x' + canvas.height);
  } catch (err) {
    console.error('游戏初始化失败:', err);
  }
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
      try { wx.vibrateShort(); } catch(e) {}
    }
    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      endGame(false);
    }
  }, 1000);
}

function gameLoop() {
  if (!loopRunning) return;
  update();
  render();
  requestAnimationFrame(gameLoop);
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  switch (gameState.currentScene) {
    case 'menu': renderMainMenu(); break;
    case 'game': renderGameScene(); break;
    case 'levelselect': renderLevelSelect(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'instructions': renderInstructions(); break;
    case 'gameover': renderGameOver(); break;
    default: renderMainMenu();
  }
}

// === 主菜单 ===
function renderMainMenu() {
  var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(1, '#E0EFFF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawClouds('rgba(255,255,255,0.8)');

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold ' + ScreenAdapter.scale(48) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText('磁吸拆迁队', canvas.width / 2, ScreenAdapter.sy(80));
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = ScreenAdapter.scale(20) + 'px Arial';
  ctx.fillText('物理消除小游戏', canvas.width / 2, ScreenAdapter.sy(120));

  var bw = ScreenAdapter.scale(200), bh = ScreenAdapter.scale(50);
  var sx = (canvas.width - bw) / 2;
  var sy = ScreenAdapter.sy(200);
  var gap = ScreenAdapter.scale(70);

  drawButton(sx, sy, bw, bh, '开始游戏', '#00CC00');
  uiElements.startBtn = { x: sx, y: sy, w: bw, h: bh };

  drawButton(sx, sy + gap, bw, bh, '关卡选择', '#4169E1');
  uiElements.levelBtn = { x: sx, y: sy + gap, w: bw, h: bh };

  drawButton(sx, sy + gap*2, bw, bh, '排行榜', '#CC9900');
  uiElements.leaderBtn = { x: sx, y: sy + gap*2, w: bw, h: bh };

  drawButton(sx, sy + gap*3, bw, bh, '玩法说明', '#CC3399');
  uiElements.instBtn = { x: sx, y: sy + gap*3, w: bw, h: bh };
}

// === 游戏场景 ===
function renderGameScene() {
  var theme = buildingGenerator && buildingGenerator.currentTheme
    ? buildingGenerator.currentTheme
    : { skyColor:'#87CEEB', groundColor:'#8B4513', grassColor:'#228B22', cloudColor:'rgba(255,255,255,0.8)' };

  var skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, theme.skyColor);
  skyGrad.addColorStop(1, darkenColor(theme.skyColor, 0.2));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawClouds(theme.cloudColor);

  var gndGrad = ctx.createLinearGradient(0, canvas.height - 50, 0, canvas.height);
  gndGrad.addColorStop(0, theme.groundColor);
  gndGrad.addColorStop(1, darkenColor(theme.groundColor, 0.3));
  ctx.fillStyle = gndGrad;
  ctx.fillRect(0, canvas.height - ScreenAdapter.scale(50), canvas.width, ScreenAdapter.scale(50));

  ctx.fillStyle = theme.grassColor;
  ctx.fillRect(0, canvas.height - ScreenAdapter.scale(50), canvas.width, ScreenAdapter.scale(10));

  if (buildingGenerator) buildingGenerator.draw(ctx);
  if (crane) crane.draw(ctx);
  drawGameUI();
  if (gameState.gamePaused) drawPauseOverlay();
}

// === 结算场景 ===
function renderGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var bw = Math.min(300, canvas.width - 40), bh = 350;
  var bx = (canvas.width - bw) / 2, by = (canvas.height - bh) / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold ' + ScreenAdapter.scale(32) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var isWin = gameState.stars > 0;
  ctx.fillText(isWin ? '关卡通过!' : '时间到!', canvas.width / 2, by + ScreenAdapter.scale(50));

  // 星级
  var starY = by + ScreenAdapter.scale(100);
  for (var s = 0; s < 3; s++) {
    ctx.fillStyle = s < gameState.stars ? '#FFD700' : '#C0C0C0';
    ctx.font = ScreenAdapter.scale(36) + 'px Arial';
    ctx.fillText('\u2605', canvas.width / 2 - ScreenAdapter.scale(40) + s * ScreenAdapter.scale(40), starY);
  }

  ctx.font = ScreenAdapter.scale(22) + 'px Arial';
  ctx.fillText('得分: ' + gameState.score, canvas.width / 2, by + ScreenAdapter.scale(180));
  ctx.fillText('目标: ' + gameState.targetScore, canvas.width / 2, by + ScreenAdapter.scale(220));

  var btnW = ScreenAdapter.scale(90), btnH = ScreenAdapter.scale(40);
  drawButton(bx + ScreenAdapter.scale(30), by + bh - ScreenAdapter.scale(70), btnW, btnH, '重玩', '#FF6347');
  uiElements.replayBtn = { x: bx + ScreenAdapter.scale(30), y: by + bh - ScreenAdapter.scale(70), w: btnW, h: btnH };

  drawButton(bx + bw - ScreenAdapter.scale(30) - btnW, by + bh - ScreenAdapter.scale(70), btnW, btnH, '返回', '#4169E1');
  uiElements.backToMenuBtn = { x: bx + bw - ScreenAdapter.scale(30) - btnW, y: by + bh - ScreenAdapter.scale(70), w: btnW, h: btnH };

  if (isWin) {
    drawButton(bx + (bw - btnW)/2, by + bh - ScreenAdapter.scale(70), btnW, btnH, '下一关', '#00CC00');
    uiElements.nextLevelBtn = { x: bx + (bw - btnW)/2, y: by + bh - ScreenAdapter.scale(70), w: btnW, h: btnH };
  }
}

// === 关卡选择 / 排行榜 / 玩法说明（简化渲染）===
function renderLevelSelect() {
  ctx.fillStyle = '#2F4F4F'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold '+ScreenAdapter.scale(32)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('选择关卡', canvas.width/2, ScreenAdapter.sy(40));

  var cols=5, bs=ScreenAdapter.scale(50), sp=ScreenAdapter.scale(8);
  var startX = (canvas.width - cols*(bs+sp))/2;
  uiElements.levelButtons = {};
  for (var i=1; i<=Math.min(gameState.unlockedLevel,50); i++) {
    var col=(i-1)%cols, row=Math.floor((i-1)/cols);
    var x=startX+col*(bs+sp), y=ScreenAdapter.sy(80)+row*(bs+sp);
    drawButton(x, y, bs, bs, ''+i, i<=gameState.unlockedLevel?'#00CC00':'#808080');
    uiElements.levelButtons[i] = { x:x, y:y, w:bs, h:bs };
  }
  drawBackButton();
}

function renderLeaderboard() {
  ctx.fillStyle = '#1C1C1C'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#FFD700'; ctx.font = 'bold '+ScreenAdapter.scale(32)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('排行榜', canvas.width/2, ScreenAdapter.sy(40));

  ctx.fillStyle = '#FFFFFF'; ctx.font = ScreenAdapter.scale(16)+'px Arial'; ctx.textAlign = 'left';
  for (var i=0; i<Math.min(leaderboard.length,10); i++) {
    ctx.fillText((i+1)+'. '+(leaderboard[i].name||'玩家')+' - '+leaderboard[i].score, ScreenAdapter.sx(30), ScreenAdapter.sy(90+i*40));
  }
  drawBackButton();
}

function renderInstructions() {
  ctx.fillStyle = '#F0F8FF'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#1C1C1C'; ctx.font = 'bold '+ScreenAdapter.scale(32)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('玩法说明', canvas.width/2, ScreenAdapter.sy(40));

  var lines = ['【操作方式】','1.左下区域滑动-控制起重机','2.长按屏幕-激活磁铁','3.松开手指-释放物体','','【方块类型】','木材(轻)/砖石(中)/钢材(重)','冰块(滑)/橡胶(弹)/TNT(爆)','','【星级评价】','⭐50% ⭐⭐80% ⭐⭐⭐100%'];
  ctx.font = ScreenAdapter.scale(14)+'px Arial'; ctx.textAlign = 'left'; ctx.fillStyle = '#333333';
  for (var i=0; i<lines.length; i++) {
    ctx.fillText(lines[i], ScreenAdapter.sx(30), ScreenAdapter.sy(90+i*24));
  }
  drawBackButton();
}

// === UI 组件 ===
function drawButton(x, y, w, h, text, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x+3, y+3, w, h);
  try {
    var grad = ctx.createLinearGradient(x, y, x, y+h);
    grad.addColorStop(0, color || '#808080');
    grad.addColorStop(1, darkenColor(color || '#808080', 0.3));
    ctx.fillStyle = grad;
  } catch(e) { ctx.fillStyle = color || '#808080'; }
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = darkenColor(color || '#808080', 0.5); ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold '+ScreenAdapter.scale(18)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x+w/2, y+h/2);
}

function drawBackButton() {
  drawButton(ScreenAdapter.sx(15), ScreenAdapter.sy(15), ScreenAdapter.scale(80), ScreenAdapter.scale(40), '返回', '#808080');
  uiElements.backBtn = { x:ScreenAdapter.sx(15), y:ScreenAdapter.sy(15), w:ScreenAdapter.scale(80), h:ScreenAdapter.scale(40) };
}

function drawGameUI() {
  var fs = ScreenAdapter.scale(22);
  ctx.fillStyle = '#000000'; ctx.font = 'bold '+fs+'px Arial';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('分数: '+gameState.score, ScreenAdapter.sx(15), ScreenAdapter.sy(15));
  ctx.fillText('时间: '+gameState.timeLeft+'s', ScreenAdapter.sx(15), ScreenAdapter.sy(15)+fs+5));
  ctx.fillText('关卡: '+gameState.currentLevel, ScreenAdapter.sx(15), ScreenAdapter.sy(15)+(fs+5)*2);
  ctx.textAlign = 'right';
  ctx.fillText('目标: '+gameState.targetScore, canvas.width-ScreenAdapter.sx(15), ScreenAdapter.sy(15));

  var pbx = canvas.width-ScreenAdapter.scale(80), pby = ScreenAdapter.sy(10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(pbx, pby, ScreenAdapter.scale(60), ScreenAdapter.scale(40));
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold '+ScreenAdapter.scale(18)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(gameState.gamePaused?'继续':'暂停', pbx+ScreenAdapter.scale(30), pby+ScreenAdapter.scale(20));
  uiElements.pauseBtn = { x:pbx, y:pby, w:ScreenAdapter.scale(60), h:ScreenAdapter.scale(40) };
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold '+ScreenAdapter.scale(44)+'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', canvas.width/2, canvas.height/2);
}

function drawClouds(cloudColor) {
  ctx.fillStyle = cloudColor || 'rgba(255,255,255,0.8)';
  drawCloud(ScreenAdapter.scale(100), ScreenAdapter.scale(80), ScreenAdapter.scale(60));
  drawCloud(ScreenAdapter.scale(300), ScreenAdapter.scale(120), ScreenAdapter.scale(40));
  drawCloud(ScreenAdapter.scale(500), ScreenAdapter.scale(60), ScreenAdapter.scale(50));
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size*0.5, 0, Math.PI*2);
  ctx.arc(x+size*0.6, y, size*0.7, 0, Math.PI*2);
  ctx.arc(x+size*1.2, y, size*0.5, 0, Math.PI*2);
  ctx.fill();
}

// === 游戏逻辑 ===
function loadLevel(level) {
  physics = new PhysicsSystem(CONFIG);
  crane = new CraneController(canvas, CONFIG);
  buildingGenerator = new BuildingGenerator(canvas, CONFIG);
  crane.setPhysicsSystem(physics);

  buildings = buildingGenerator.generateLevel(level);
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0;
  gameState.gameActive = true;
  gameState.currentScene = 'game';
  startTimer();
}

function checkMagnetCollision() {
  if (!crane || !crane.isGrabbing()) return;
  var pos = crane.getMagnetPosition();
  buildings.forEach(function(block) {
    if (block.isDestroyed || block.isGrabbed) return;
    var dx = (block.x+block.width/2) - pos.x;
    var dy = (block.y+block.height/2) - pos.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var speed = Math.sqrt(safePow(block.velocityX,2) + safePow(block.velocityY,2));
    if (dist < 100 && speed > 3) {
      var impact = speed * block.mass * 10;
      var result = physics.calculateDamage(block, impact);
      if (result.damage > 0) {
        var dr = buildingGenerator.damageBlock(block, result.damage);
        if (dr.destroyed) gameState.score += dr.score;
      }
    }
  });
}

function checkGameEnd() {
  if (gameState.score >= gameState.targetScore) endGame(true);
}

function endGame(isWin) {
  gameState.gameActive = false;
  clearGameTimer();
  var pct = gameState.targetScore > 0 ? gameState.score / gameState.targetScore : 0;
  gameState.stars = pct >= 1.0 ? 3 : pct >= 0.8 ? 2 : pct >= 0.5 ? 1 : 0;
  updateLeaderboard(gameState.score);
  saveGameProgress();
  gameState.currentScene = 'gameover';
}

// === 事件处理 ===
function bindEvents() {
  wx.onTouchStart(function(e) {
    if (!e.touches || e.touches.length === 0) return;
    var t = e.touches[0];
    var x = t.clientX, y = t.clientY;
    if (gameState.currentScene === 'game' && gameState.gameActive) {
      handleGameTouch(x, y);
    } else {
      handleMenuTouch(x, y);
    }
  });

  wx.onTouchMove(function(e) {
    if (!e.touches || e.touches.length === 0) return;
    if (gameState.currentScene !== 'game' || gameState.gamePaused) return;
    var t = e.touches[0];
    if (crane && crane.isDragging) {
      var dx = t.clientX - crane.touchStartX;
      if (Math.abs(dx) > 5) {
        crane.move(dx > 0 ? 1 : -1);
        crane.touchStartX = t.clientX;
      }
    }
  });

  wx.onTouchEnd(function(e) {
    if (crane) {
      var released = crane.releaseMagnet();
    }
    if (crane) crane.isDragging = false;
  });
}

function handleGameTouch(x, y) {
  if (isInBtn(x, y, uiElements.pauseBtn)) {
    gameState.gamePaused = !gameState.gamePaused;
    return;
  }
  if (x < canvas.width/3 && y > canvas.height/2) {
    if (crane) { crane.touchStartX = x; crane.isDragging = true; }
  } else {
    if (crane) crane.activateMagnet(x, y, buildings);
  }
}

function handleMenuTouch(x, y) {
  switch (gameState.currentScene) {
    case 'menu':
      if (isInBtn(x,y,uiElements.startBtn)) { loadLevel(gameState.currentLevel); }
      else if (isInBtn(x,y,uiElements.levelBtn)) { gameState.currentScene = 'levelselect'; }
      else if (isInBtn(x,y,uiElements.leaderBtn)) { gameState.currentScene = 'leaderboard'; }
      else if (isInBtn(x,y,uiElements.instBtn)) { gameState.currentScene = 'instructions'; }
      break;
    case 'levelselect':
      if (uiElements.levelButtons) {
        for (var i=1; i<=gameState.unlockedLevel; i++) {
          if (isInBtn(x,y,uiElements.levelButtons[i])) { loadLevel(i); return; }
        }
      }
      if (isInBtn(x,y,uiElements.backBtn)) gameState.currentScene = 'menu';
      break;
    case 'gameover':
      if (isInBtn(x,y,uiElements.replayBtn)) { loadLevel(gameState.currentLevel); }
      else if (isInBtn(x,y,uiElements.nextLevelBtn)) { gameState.currentLevel++; loadLevel(gameState.currentLevel); }
      else if (isInBtn(x,y,uiElements.backToMenuBtn)) { gameState.currentScene = 'menu'; }
      break;
    case 'leaderboard':
    case 'instructions':
      if (isInBtn(x,y,uiElements.backBtn)) gameState.currentScene = 'menu';
      break;
  }
}

function isInBtn(x, y, btn) {
  return btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
}

// === 数据管理 ===
function loadLeaderboard() {
  try { leaderboard = wx.getStorageSync('leaderboard') || []; } catch(e) { leaderboard = []; }
}
function saveLeaderboard() {
  try { wx.setStorageSync('leaderboard', leaderboard); } catch(e) {}
}
function updateLeaderboard(score) {
  leaderboard.push({ name: '玩家', score: score, date: Date.now() });
  leaderboard.sort(function(a,b){ return b.score - a.score; });
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
  } catch(e) {}
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
  } catch(e) {}
}

// === 启动 ===
init();
ENTRYFILE
echo "  ✓ 入口文件创建完成"

# 创建说明文件
echo "[5/5] 创建说明文件..."
cat > "$PROJECT_DIR/README.md" << 'README'
# 磁吸拆迁队 - 微信小游戏

## 快速开始
1. 打开微信开发者工具
2. 选择"小游戏"项目
3. 导入本项目目录
4. 使用测试号
5. 点击"编译"运行

## 操作方式
- 左下区域滑动：控制起重机左右移动
- 长按屏幕：激活磁铁吸附方块
- 松开手指：释放方块撞击建筑

## 项目结构
- game.js         入口文件
- js/             核心模块
- images/         图片资源
- audio/          音效资源
README
echo "  ✓ 说明文件创建完成"

echo ""
echo "=========================================="
echo "  ✓ 项目创建完成！"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR/"
echo ""
echo "⚠️  注意：核心模块文件需要单独复制："
echo "  - js/PhysicsSystem.js"
echo "  - js/CraneController.js"
echo "  - js/BuildingGenerator.js"
echo "  - js/GameMechanics.js"
echo "  - js/AudioGenerator.js"
echo ""
echo "下一步：用微信开发者工具导入 $PROJECT_DIR 目录"
echo "=========================================="
README
echo "  ✓ 说明文件创建完成"

echo ""
echo "=========================================="
echo "  ✓ 项目创建完成！"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR/"
echo ""
echo "⚠️  注意：核心模块文件需要单独复制："
echo "  - js/PhysicsSystem.js"
echo "  - js/CraneController.js"
echo "  - js/BuildingGenerator.js"
echo "  - js/GameMechanics.js"
echo "  - js/AudioGenerator.js"
echo ""
echo "下一步：用微信开发者工具导入 $PROJECT_DIR 目录"
echo "=========================================="
