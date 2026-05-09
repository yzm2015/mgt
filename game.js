/**
 * 磁吸拆迁队 - 微信小游戏
 * 微信小游戏入口文件
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
  gamePaused: false,
  currentLevel: 1,
  targetScore: 500,
  stars: 0
};

// ==================== 游戏对象 ====================
let canvas = null;
let ctx = null;
let physics = null;
let crane = null;
let buildingGenerator = null;
let audioManager = null;
let buildings = [];

// ==================== 初始化游戏 ====================
function init() {
  console.log('开始初始化游戏...');
  
  try {
    // 获取 Canvas
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');
    
    // 设置画布大小
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    console.log(`画布大小: ${canvas.width}x${canvas.height}`);
    
    // 初始化模块
    physics = new PhysicsSystem(CONFIG);
    crane = new CraneController(canvas, CONFIG);
    buildingGenerator = new BuildingGenerator(canvas, CONFIG);
    audioManager = new AudioManager();
    
    // 设置物理系统引用
    crane.setPhysicsSystem(physics);
    
    // 初始化音效管理器
    audioManager.init();
    
    // 生成关卡
    loadLevel(gameState.currentLevel);
    
    // 初始化 UI
    initUI();
    
    // 绑定触摸事件
    bindTouchEvents();
    
    // 启动游戏循环
    gameState.gameRunning = true;
    gameLoop();
    
    // 启动计时器
    startTimer();
    
    // 播放背景音乐（如果有）
    // audioManager.playBGM('audio/bgm.mp3', true);
    
    console.log('游戏初始化完成');
    
  } catch (err) {
    console.error('游戏初始化失败:', err);
  }
}

// ==================== 加载关卡 ====================
function loadLevel(level) {
  console.log(`加载关卡 ${level}`);
  
  // 生成建筑
  buildings = buildingGenerator.generateLevel(level);
  
  // 更新目标分数
  gameState.targetScore = buildingGenerator.getTargetScore(level);
  gameState.timeLeft = buildingGenerator.getTimeLimit(level);
  gameState.score = 0;
  
  console.log(`目标分数: ${gameState.targetScore}, 时间: ${gameState.timeLeft}s`);
}

// ==================== 初始化 UI ====================
function initUI() {
  uiElements = {
    scoreText: { x: 20, y: 40, text: `分数: ${gameState.score}` },
    timerText: { x: 20, y: 80, text: `时间: ${gameState.timeLeft}s` },
    levelText: { x: 20, y: 120, text: `关卡: ${gameState.currentLevel}` },
    targetText: { x: canvas.width - 20, y: 40, text: `目标: ${gameState.targetScore}`, align: 'right' }
  };
}

// ==================== UI 元素引用 ====================
let uiElements = {};

// ==================== 绑定触摸事件 ====================
function bindTouchEvents() {
  // 触摸开始
  wx.onTouchStart((e) => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    
    // 检查是否点击了 UI 按钮
    if (checkUIButtons(touchX, touchY)) return;
    
    // 左下区域：控制起重机移动
    if (touchX < canvas.width / 3 && touchY > canvas.height / 2) {
      crane.touchStartX = touchX;
      crane.isDragging = true;
      return;
    }
    
    // 其他区域：激活磁铁
    crane.activateMagnet(touchX, touchY, buildings);
    
    // 播放音效
    audioManager.playSound(SoundNames.GRAB);
  });
  
  // 触摸移动
  wx.onTouchMove((e) => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    const touch = e.touches[0];
    const touchX = touch.clientX;
    
    // 控制起重机移动
    if (crane.isDragging) {
      const deltaX = touchX - crane.touchStartX;
      
      if (Math.abs(deltaX) > 5) {
        const direction = deltaX > 0 ? 1 : -1;
        crane.move(direction);
        crane.touchStartX = touchX;
      }
    }
  });
  
  // 触摸结束
  wx.onTouchEnd((e) => {
    if (!gameState.gameRunning) return;
    
    // 停止起重机拖动
    crane.isDragging = false;
    
    // 释放磁铁
    const releasedBlock = crane.releaseMagnet();
    
    // 播放音效
    if (releasedBlock) {
      audioManager.playSound(SoundNames.RELEASE);
    }
  });
}

// ==================== 检查 UI 按钮点击 ====================
function checkUIButtons(x, y) {
  // 暂停按钮
  if (x > canvas.width - 80 && y < 60) {
    togglePause();
    audioManager.playSound(SoundNames.BUTTON);
    return true;
  }
  
  return false;
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

// ==================== 游戏主循环 ====================
function gameLoop() {
  if (!gameState.gameRunning) return;
  
  update();
  render();
  
  requestAnimationFrame(gameLoop);
}

// ==================== 更新游戏状态 ====================
function update() {
  if (gameState.gamePaused) return;
  
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

// ==================== 检测磁铁碰撞 ====================
function checkMagnetCollision() {
  if (!crane.isGrabbing()) return;
  
  const magnetPos = crane.getMagnetPosition();
  
  buildings.forEach(block => {
    if (block.isDestroyed || block.isGrabbed) return;
    
    // 检测碰撞
    const blockCenterX = block.x + block.width / 2;
    const blockCenterY = block.y + block.height / 2;
    
    const dx = blockCenterX - magnetPos.x;
    const dy = blockCenterY - magnetPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 如果方块在磁铁附近且速度足够大，造成伤害
    const speed = Math.sqrt(block.velocityX * block.velocityX + block.velocityY * block.velocityY);
    
    if (distance < 100 && speed > 3) {
      const impactForce = speed * block.mass * 10;
      const result = physics.calculateDamage(block, impactForce);
      
      if (result.damage > 0) {
        const damageResult = buildingGenerator.damageBlock(block, result.damage);
        
        // 播放碰撞音效
        audioManager.playSound(SoundNames.CRASH);
        
        if (damageResult.destroyed) {
          gameState.score += damageResult.score;
          console.log(`摧毁 ${block.type} 方块, 获得 ${damageResult.score} 分`);
          
          // 播放摧毁音效
          audioManager.playSound(SoundNames.DESTROY);
        }
      }
    }
  });
}

// ==================== 更新 UI ====================
function updateUI() {
  uiElements.scoreText.text = `分数: ${gameState.score}`;
  uiElements.timerText.text = `时间: ${gameState.timeLeft}s`;
  uiElements.levelText.text = `关卡: ${gameState.currentLevel}`;
  uiElements.targetText.text = `目标: ${gameState.targetScore}`;
}

// ==================== 渲染游戏画面 ====================
function render() {
  // 清空画布
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 绘制云朵（装饰）
  drawClouds();
  
  // 绘制地面
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
  
  // 绘制草地
  ctx.fillStyle = '#228B22';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 10);
  
  // 绘制建筑
  buildingGenerator.draw(ctx);
  
  // 绘制起重机
  crane.draw(ctx);
  
  // 绘制 UI
  drawUI();
  
  // 绘制暂停遮罩
  if (gameState.gamePaused) {
    drawPauseOverlay();
  }
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

// ==================== 绘制 UI ====================
function drawUI() {
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Arial';
  
  // 左上方 UI
  ctx.textAlign = 'left';
  ctx.fillText(uiElements.scoreText.text, uiElements.scoreText.x, uiElements.scoreText.y);
  ctx.fillText(uiElements.timerText.text, uiElements.timerText.x, uiElements.timerText.y);
  ctx.fillText(uiElements.levelText.text, uiElements.levelText.x, uiElements.levelText.y);
  
  // 右上方 UI
  ctx.textAlign = 'right';
  ctx.fillText(uiElements.targetText.text, uiElements.targetText.x, uiElements.targetText.y);
  
  // 暂停按钮
  drawPauseButton();
}

// ==================== 绘制暂停按钮 ====================
function drawPauseButton() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(canvas.width - 80, 10, 60, 40);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.gamePaused ? '继续' : '暂停', canvas.width - 50, 37);
}

// ==================== 绘制暂停遮罩 ====================
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('游戏暂停', canvas.width / 2, canvas.height / 2);
}

// ==================== 启动计时器 ====================
function startTimer() {
  const timer = setInterval(() => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    gameState.timeLeft--;
    
    if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
      // 时间紧迫提示
      wx.vibrateShort();
      audioManager.playSound(SoundNames.WARNING);
    }
    
    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      endGame(false);
      clearInterval(timer);
    }
  }, 1000);
}

// ==================== 检查游戏结束 ====================
function checkGameEnd() {
  // 检查是否达到目标分数
  if (gameState.score >= gameState.targetScore) {
    endGame(true);
  }
}

// ==================== 结束游戏 ====================
function endGame(isWin) {
  gameState.gameRunning = false;
  
  // 计算星级
  const scorePercent = gameState.score / gameState.targetScore;
  if (scorePercent >= 1.0) {
    gameState.stars = 3;
  } else if (scorePercent >= 0.8) {
    gameState.stars = 2;
  } else if (scorePercent >= 0.5) {
    gameState.stars = 1;
  } else {
    gameState.stars = 0;
  }
  
  // 播放音效
  if (isWin) {
    audioManager.playSound(SoundNames.WIN);
  } else {
    audioManager.playSound(SoundNames.LOSE);
  }
  
  // 显示结算界面
  showGameOver(isWin);
}

// ==================== 显示结算界面 ====================
function showGameOver(isWin) {
  // 绘制半透明遮罩
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 绘制结算框
  const boxWidth = 300;
  const boxHeight = 400;
  const boxX = (canvas.width - boxWidth) / 2;
  const boxY = (canvas.height - boxHeight) / 2;
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  
  // 绘制文字
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  
  const title = isWin ? '关卡通过!' : '时间到!';
  ctx.fillText(title, canvas.width / 2, boxY + 50);
  
  // 绘制星级
  drawStars(boxX + boxWidth / 2, boxY + 120, gameState.stars);
  
  // 绘制分数
  ctx.font = '24px Arial';
  ctx.fillText(`得分: ${gameState.score}`, canvas.width / 2, boxY + 200);
  ctx.fillText(`目标: ${gameState.targetScore}`, canvas.width / 2, boxY + 240);
  
  // 绘制按钮
  drawButton(boxX + 50, boxY + 280, 80, 40, '重玩', '#FF6347');
  drawButton(boxX + 170, boxY + 280, 80, 40, '下一关', '#00FF00');
}

// ==================== 绘制星级 ====================
function drawStars(x, y, stars) {
  const starSize = 30;
  const starSpacing = 10;
  const totalWidth = 3 * starSize + 2 * starSpacing;
  const startX = x - totalWidth / 2;
  
  for (let i = 0; i < 3; i++) {
    const starX = startX + i * (starSize + starSpacing);
    const color = i < stars ? '#FFD700' : '#C0C0C0';
    drawStar(starX, y, starSize, color);
  }
}

function drawStar(x, y, size, color) {
  ctx.fillStyle = color;
  
  const spikes = 5;
  const outerRadius = size / 2;
  const innerRadius = outerRadius / 2;
  
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

// ==================== 绘制按钮 ====================
function drawButton(x, y, width, height, text, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + height / 2 + 6);
}

// ==================== 启动游戏 ====================
init();
