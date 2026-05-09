/**
 * 建筑生成系统模块（1000关版本）
 * 负责程序生成关卡、管理游戏机制、主题切换
 */

class BuildingGenerator {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.buildings = [];
    this.particles = [];
    this.currentTheme = null;
    this.currentMechanics = [];
    
    // 方块类型配置
    this.blockTypes = {
      wood: {
        color: '#DEB887',
        strokeColor: '#8B4513',
        health: 50,
        mass: 1.0,
        score: 10,
        friction: 0.3
      },
      brick: {
        color: '#FF6347',
        strokeColor: '#8B0000',
        health: 100,
        mass: 2.0,
        score: 20,
        friction: 0.5
      },
      steel: {
        color: '#808080',
        strokeColor: '#333333',
        health: 200,
        mass: 3.0,
        score: 30,
        friction: 0.8
      },
      ice: {
        color: '#ADD8E6',
        strokeColor: '#4682B4',
        health: 40,
        mass: 0.8,
        score: 15,
        friction: 0.1
      },
      rubber: {
        color: '#FF69B4',
        strokeColor: '#C71585',
        health: 30,
        mass: 0.5,
        score: 25,
        friction: 0.9,
        bounceiness: 1.5
      },
      tnt: {
        color: '#FF4500',
        strokeColor: '#8B0000',
        health: 20,
        mass: 1.5,
        score: 50,
        friction: 0.4,
        explosive: true
      }
    };
    
    // 主题配置
    this.themes = {
      1: {
        name: '城市',
        skyColor: '#87CEEB',
        groundColor: '#8B4513',
        grassColor: '#228B22',
        cloudColor: 'rgba(255, 255, 255, 0.8)'
      },
      101: {
        name: '沙漠',
        skyColor: '#F4D19F',
        groundColor: '#F4A460',
        grassColor: '#DAA520',
        cloudColor: 'rgba(255, 250, 205, 0.6)'
      },
      201: {
        name: '雪地',
        skyColor: '#E0EFFF',
        groundColor: '#F5F5F5',
        grassColor: '#FFFFFF',
        cloudColor: 'rgba(255, 255, 255, 0.9)'
      },
      301: {
        name: '太空',
        skyColor: '#0C1445',
        groundColor: '#1C1C1C',
        grassColor: '#2F4F4F',
        cloudColor: 'rgba(255, 255, 255, 0.3)'
      },
      401: {
        name: '火山',
        skyColor: '#8B0000',
        groundColor: '#2F4F4F',
        grassColor: '#556B2F',
        cloudColor: 'rgba(255, 69, 0, 0.4)'
      }
    };
  }

  /**
   * 生成关卡（程序生成，支持1000关）
   */
  generateLevel(level) {
    this.buildings = [];
    
    // 更新主题和机制
    this.currentTheme = this.getTheme(level);
    this.currentMechanics = this.getMechanics(level);
    
    // 使用关卡编号作为随机种子
    const seed = level * 12345;
    const random = this.seededRandom(seed);
    
    // 根据关卡计算参数
    const params = this.calculateLevelParams(level, random);
    
    // 生成建筑布局
    this.generateBuildingLayout(level, params, random);
    
    return this.buildings;
  }

  /**
   * 计算关卡参数
   */
  calculateLevelParams(level, random) {
    const params = {
      buildingCount: 5 + Math.floor(level / 10),
      maxHeight: 3 + Math.floor(level / 20),
      woodRatio: 0.5,
      brickRatio: 0.3,
      steelRatio: 0.2,
      iceRatio: 0,
      rubberRatio: 0,
      tntRatio: 0,
      timeLimit: Math.max(30, 90 - Math.floor(level / 10)),
      targetScore: 500 + level * 10
    };
    
    // 根据关卡调整参数
    if (level >= 11) {
      params.tntRatio = 0.05;
    }
    if (level >= 21) {
      params.iceRatio = 0.1;
    }
    if (level >= 31) {
      params.rubberRatio = 0.1;
    }
    
    return params;
  }

  /**
   * 生成建筑布局
   */
  generateBuildingLayout(level, params, random) {
    const canvasWidth = this.canvas.width;
    const groundY = this.canvas.height - 50;
    
    // 生成建筑结构
    const structure = this.generateStructure(level, params, random);
    
    // 将结构转换为方块
    structure.forEach(blockData => {
      const blockType = this.blockTypes[blockData.type];
      
      this.buildings.push({
        x: blockData.x,
        y: blockData.y,
        width: blockData.width || 60,
        height: blockData.height || 60,
        type: blockData.type,
        color: blockType.color,
        strokeColor: blockType.strokeColor,
        health: blockType.health,
        maxHealth: blockType.health,
        mass: blockType.mass,
        score: blockType.score,
        friction: blockType.friction,
        velocityX: 0,
        velocityY: 0,
        isGrabbed: false,
        isDestroyed: false,
        explosive: blockType.explosive || false
      });
    });
  }

  /**
   * 生成建筑结构
   */
  generateStructure(level, params, random) {
    const canvasWidth = this.canvas.width;
    const groundY = this.canvas.height - 50;
    const structure = [];
    
    // 简单结构：在地面上方堆叠方块
    const baseX = 150 + (level * 7) % (canvasWidth - 300);
    
    for (let i = 0; i < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      const x = baseX + (i % 5) * 70 - 140;
      const y = groundY - 60 - Math.floor(i / 5) * 70;
      
      if (x >= 50 && x <= canvasWidth - 110) {
        structure.push({
          x: x,
          y: y,
          type: blockType,
          width: 60,
          height: 60
        });
      }
    }
    
    return structure;
  }

  /**
   * 选择方块类型
   */
  selectBlockType(params, random) {
    const r = random();
    
    if (params.tntRatio && r < params.tntRatio) return 'tnt';
    if (params.rubberRatio && r < params.rubberRatio + params.tntRatio) return 'rubber';
    if (params.iceRatio && r < params.iceRatio + params.rubberRatio + params.tntRatio) return 'ice';
    if (r < params.woodRatio) return 'wood';
    if (r < params.woodRatio + params.brickRatio) return 'brick';
    return 'steel';
  }

  /**
   * 获取关卡主题
   */
  getTheme(level) {
    let themeKey = 1;
    
    const themeKeys = Object.keys(this.themes).map(Number).sort((a, b) => a - b);
    
    for (let i = themeKeys.length - 1; i >= 0; i--) {
      if (level >= themeKeys[i]) {
        themeKey = themeKeys[i];
        break;
      }
    }
    
    return this.themes[themeKey];
  }

  /**
   * 获取关卡游戏机制
   */
  getMechanics(level) {
    const mechanics = [];
    
    const mechanicSet = [
      { level: 1, mechanic: 'basic', description: '基础玩法' },
      { level: 11, mechanic: 'explosive', description: '爆炸方块' },
      { level: 21, mechanic: 'ice', description: '冰块' },
      { level: 31, mechanic: 'rubber', description: '橡胶块' },
      { level: 41, mechanic: 'tnt', description: 'TNT炸药' },
      { level: 51, mechanic: 'chain_reaction', description: '连锁反应' },
      { level: 61, mechanic: 'magnet_boost', description: '磁力增强' },
      { level: 71, mechanic: 'time_bonus', description: '时间奖励' },
      { level: 81, mechanic: 'multi_target', description: '多目标' },
      { level: 91, mechanic: 'boss', description: 'BOSS关卡' }
    ];
    
    for (let i = mechanicSet.length - 1; i >= 0; i--) {
      if (level >= mechanicSet[i].level) {
        mechanics.push(mechanicSet[i]);
        break;
      }
    }
    
    return mechanics;
  }

  /**
   * seeded 随机数生成器
   */
  seededRandom(seed) {
    let state = seed;
    
    return function() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * 更新所有建筑方块
   */
  update(physics) {
    this.buildings.forEach(block => {
      if (block.isDestroyed) return;
      if (block.isGrabbed) return;
      
      // 应用重力
      physics.applyGravity(block);
      
      // 更新位置
      physics.updatePosition(block, this.canvas.height, this.canvas.width);
    });
    
    // 检测碰撞
    this.checkCollisions(physics);
    
    // 更新粒子效果
    this.updateParticles();
  }

  /**
   * 检测和处理碰撞
   */
  checkCollisions(physics) {
    for (let i = 0; i < this.buildings.length; i++) {
      for (let j = i + 1; j < this.buildings.length; j++) {
        const blockA = this.buildings[i];
        const blockB = this.buildings[j];
        
        if (blockA.isDestroyed || blockB.isDestroyed) continue;
        if (blockA.isGrabbed || blockB.isGrabbed) continue;
        
        if (physics.isColliding(blockA, blockB)) {
          physics.resolveCollision(blockA, blockB);
          this.onCreateParticleEffect(
            (blockA.x + blockB.x + blockA.width) / 2,
            (blockA.y + blockB.y + blockA.height) / 2,
            '#FFFF00'
          );
        }
      }
    }
  }

  /**
   * 处理方块受到伤害
   */
  damageBlock(block, damage) {
    if (!block || block.isDestroyed) return { destroyed: false };
    
    block.health -= damage;
    
    // 创建受伤粒子效果
    this.onCreateParticleEffect(
      block.x + block.width / 2,
      block.y + block.height / 2,
      block.color
    );
    
    if (block.health <= 0) {
      block.isDestroyed = true;
      
      // 如果是爆炸方块，引发范围伤害
      if (block.explosive) {
        this.triggerExplosion(block);
      }
      
      return { destroyed: true, score: block.score };
    }
    
    return { destroyed: false, score: 0 };
  }

  /**
   * 触发爆炸
   */
  triggerExplosion(explosiveBlock) {
    const explosionRadius = 100;
    
    this.buildings.forEach(block => {
      if (block === explosiveBlock || block.isDestroyed) return;
      
      const dx = (block.x + block.width / 2) - (explosiveBlock.x + explosiveBlock.width / 2);
      const dy = (block.y + block.height / 2) - (explosiveBlock.y + explosiveBlock.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < explosionRadius) {
        // 爆炸伤害
        const explosionDamage = 50 * (1 - distance / explosionRadius);
        this.damageBlock(block, explosionDamage);
      }
    });
    
    // 创建爆炸粒子效果
    for (let i = 0; i < 20; i++) {
      this.onCreateParticleEffect(
        explosiveBlock.x + explosiveBlock.width / 2,
        explosiveBlock.y + explosiveBlock.height / 2,
        '#FF4500'
      );
    }
  }

  /**
   * 创建粒子效果
   */
  onCreateParticleEffect(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 30,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  }

  /**
   * 更新粒子效果
   */
  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 绘制所有建筑方块
   */
  draw(ctx) {
    // 绘制建筑方块
    this.buildings.forEach(block => {
      if (block.isDestroyed) return;
      
      // 绘制方块主体
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      
      // 绘制方块边框
      ctx.strokeStyle = block.strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.width, block.height);
      
      // 绘制生命值条
      this.drawHealthBar(ctx, block);
    });
    
    // 绘制粒子效果
    this.drawParticles(ctx);
  }

  /**
   * 绘制生命值条
   */
  drawHealthBar(ctx, block) {
    const barWidth = block.width;
    const barHeight = 5;
    const healthPercent = block.health / block.maxHealth;
    
    // 背景
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(block.x, block.y - 10, barWidth, barHeight);
    
    // 当前生命值
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(block.x, block.y - 10, barWidth * healthPercent, barHeight);
  }

  /**
   * 绘制粒子效果
   */
  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });
  }

  /**
   * 获取所有建筑方块
   */
  getBuildings() {
    return this.buildings;
  }

  /**
   * 清理已销毁的方块
   */
  cleanup() {
    this.buildings = this.buildings.filter(block => !block.isDestroyed);
  }

  /**
   * 获取关卡目标分数
   */
  getTargetScore(level) {
    const params = this.calculateLevelParams(level, this.seededRandom(level * 12345));
    return params.targetScore;
  }

  /**
   * 获取关卡时间限制
   */
  getTimeLimit(level) {
    const params = this.calculateLevelParams(level, this.seededRandom(level * 12345));
    return params.timeLimit;
  }
}

module.exports = BuildingGenerator;
