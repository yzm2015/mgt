/**
 * 磁吸拆迁队 - 浏览器测试版
 * 适配浏览器的游戏逻辑
 */

// ==================== 全局变量 ====================
let canvas = null;
let ctx = null;
let physics = null;
let crane = null;
let buildingGenerator = null;
let audioManager = null;
let buildings = [];

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

// ==================== UI 元素 ====================
let uiElements = {};

// ==================== 浏览器模拟微信 API ====================
// 模拟 wx 对象
if (typeof wx === 'undefined') {
  window.wx = {
    createCanvas: () => canvas,
    onTouchStart: (callback) => {
      canvas.addEventListener('mousedown', (e) => {
        callback({
          touches: [{ clientX: e.clientX, clientY: e.clientY }]
        });
      });
    },
    onTouchMove: (callback) => {
      canvas.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) {  // 左键按下
          callback({
            touches: [{ clientX: e.clientX, clientY: e.clientY }]
          });
        }
      });
    },
    onTouchEnd: (callback) => {
      canvas.addEventListener('mouseup', (e) => {
        callback({
          touches: []
        });
      });
    },
    vibrateShort: () => {
      console.log('震动反馈');
    }
  };
}

// ==================== 初始化游戏 ====================
function init() {
  console.log('开始初始化游戏（浏览器版）...');
  
  try {
    // 获取 Canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置画布大小
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
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
    
    // 绑定事件
    bindEvents();
    
    // 启动游戏循环
    gameState.gameRunning = true;
    gameLoop();
    
    // 启动计时器
    startTimer();
    
    console.log('游戏初始化完成（浏览器版）');
    
  } catch (err) {
    console.error('游戏初始化失败:', err);
  }
}

// ==================== 调整画布大小 ====================
function resizeCanvas() {
  const container = document.getElementById('gameContainer');
  const maxWidth = 500;
  const maxHeight = 800;
  
  const width = Math.min(window.innerWidth - 40, maxWidth);
  const height = Math.min(window.innerHeight - 40, maxHeight);
  
  canvas.width = width;
  canvas.height = height;
  container.style.width = width + 'px';
  container.style.height = height + 'px';
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

// ==================== 绑定事件 ====================
function bindEvents() {
  // 鼠标事件（模拟触摸）
  let isRightClick = false;
  
  canvas.addEventListener('mousedown', (e) => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    const touchX = e.offsetX;
    const touchY = e.offsetY;
    
    // 检查是否点击了 UI 按钮
    if (checkUIButtons(touchX, touchY)) return;
    
    // 右键或左键
    if (e.button === 2 || e.button === 0) {
      isRightClick = e.button === 2;
      
      // 左下区域：控制起重机移动
      if (touchX < canvas.width / 3 && touchY > canvas.height / 2) {
        crane.touchStartX = touchX;
        crane.isDragging = true;
        return;
      }
      
      // 其他区域：激活磁铁
      crane.activateMagnet(touchX, touchY, buildings);
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    const touchX = e.offsetX;
    
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
  
  canvas.addEventListener('mouseup', (e) => {
    if (!gameState.gameRunning) return;
    
    // 停止起重机拖动
    crane.isDragging = false;
    
    // 释放磁铁
    const releasedBlock = crane.releaseMagnet();
    
    if (releasedBlock) {
      console.log('释放方块:', releasedBlock.type);
    }
  });
  
  // 键盘事件
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyR') {
      restartGame();
    } else if (e.code === 'KeyN') {
      nextLevel();
    }
  });
  
  // 阻止右键菜单
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

// ==================== 检查 UI 按钮点击 ====================
function checkUIButtons(x, y) {
  // 暂停按钮
  if (x > canvas.width - 80 && y < 60) {
    togglePause();
    return true;
  }
  
  return false;
}

// ==================== 暂停/继续游戏 ====================
function togglePause() {
  gameState.gamePaused = !gameState.gamePaused;
  
  if (gameState.gamePaused) {
    console.log('游戏暂停');
  } else {
    console.log('游戏继续');
  }
}

// ==================== 重新开始游戏 ====================
function restartGame() {
  loadLevel(gameState.currentLevel);
  gameState.gameRunning = true;
  gameState.gamePaused = false;
}

// ==================== 下一关 ====================
function nextLevel() {
  gameState.currentLevel++;
  loadLevel(gameState.currentLevel);
  gameState.gameRunning = true;
  gameState.gamePaused = false;
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
        
        if (damageResult.destroyed) {
          gameState.score += damageResult.score;
          console.log(`摧毁 ${block.type} 方块, 获得 ${damageResult.score} 分`);
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
  
  // 更新调试信息
  updateDebugInfo();
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
  
  ctx.font = '24px Arial';
  ctx.fillText('按空格键继续', canvas.width / 2, canvas.height / 2 + 60);
}

// ==================== 更新调试信息 ====================
function updateDebugInfo() {
  const debugDiv = document.getElementById('debugInfo');
  
  if (debugDiv.style.display === 'block') {
    let debugText = '=== 调试信息 ===<br>';
    debugText += `Score: ${gameState.score}<br>`;
    debugText += `Time: ${gameState.timeLeft}s<br>`;
    debugText += `Level: ${gameState.currentLevel}<br>`;
    debugText += `Target: ${gameState.targetScore}<br>`;
    debugText += `Magnet: ${crane.isGrabbing() ? 'Grabbing' : 'Idle'}<br>`;
    debugText += `Buildings: ${buildings.filter(b => !b.isDestroyed).length}<br>`;
    
    debugDiv.innerHTML = debugText;
  }
}

// ==================== 启动计时器 ====================
function startTimer() {
  const timer = setInterval(() => {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    
    gameState.timeLeft--;
    
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

// ==================== 切换信息面板显示 ====================
function toggleInfo() {
  const infoPanel = document.getElementById('infoPanel');
  infoPanel.style.display = infoPanel.style.display === 'block' ? 'none' : 'block';
}

// ==================== 切换调试信息显示 ====================
function toggleDebug() {
  const debugDiv = document.getElementById('debugInfo');
  debugDiv.style.display = debugDiv.style.display === 'block' ? 'none' : 'block';
}

// ==================== 启动游戏 ====================
window.onload = function() {
  init();
};
