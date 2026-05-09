/**
 * 建筑生成系统模块（优化版 v2）
 * 优化：增加关卡多样性、平衡性、结构性
 */

class BuildingGenerator {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.buildings = [];
    this.particles = [];
    this.currentTheme = null;
    this.currentMechanics = [];
    
    // 方块类型配置（保持原配置）
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
    
    // 主题配置（保持原配置）
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
    
    // 新增：关卡结构模板库
    this.structureTemplates = [
      'stack',      // 简单堆叠
      'pyramid',    // 金字塔
      'wall',        // 墙壁
      'tower',      // 高塔
      'scatter',     // 散落
      'bridge',      // 桥梁
      'two-towers', // 双塔
      'castle'       // 城堡
    ];
  }

  /**
   * 生成关卡（优化版 - 增加多样性）
   */
  generateLevel(level) {
    this.buildings = [];
    
    // 更新主题和机制
    this.currentTheme = this.getTheme(level);
    this.currentMechanics = this.getMechanics(level);
    
    // 使用关卡编号作为随机种子（确保可重复性）
    const seed = level * 12345 + 67890;
    const random = this.seededRandom(seed);
    
    // 根据关卡计算参数（优化版 - 更平衡）
    const params = this.calculateLevelParamsV2(level, random);
    
    // 生成建筑布局（优化版 - 使用多种结构）
    this.generateBuildingLayoutV2(level, params, random);
    
    return this.buildings;
  }

  /**
   * 计算关卡参数（优化版 - 更平衡的难度曲线）
   */
  calculateLevelParamsV2(level, random) {
    // 基础参数
    const params = {
      buildingCount: 5 + Math.floor(level / 10),  // 方块数量随关卡增加
      maxHeight: 3 + Math.floor(level / 20),      // 最大高度
      woodRatio: 0.5,                           // 木材比例
      brickRatio: 0.3,                          // 砖石比例
      steelRatio: 0.2,                          // 钢材比例
      specialBlockChance: 0,                    // 特殊方块概率
      timeLimit: Math.max(30, 90 - Math.floor(level / 10)),  // 时间限制递减
      targetScore: 500 + level * 10,           // 目标分数递增
      structureType: 'stack'                    // 结构类型
    };
    
    // 根据关卡调整参数（优化版 - 更平滑的难度曲线）
    if (level >= 11) {
      params.specialBlockChance = 0.1;
      params.steelRatio = 0.3;
      params.brickRatio = 0.4;
      params.woodRatio = 0.3;
    }
    if (level >= 21) {
      params.iceRatio = 0.1;
      params.steelRatio = 0.3;
      params.brickRatio = 0.3;
      params.woodRatio = 0.3;
    }
    if (level >= 31) {
      params.rubberRatio = 0.1;
      params.steelRatio = 0.3;
      params.brickRatio = 0.3;
      params.woodRatio = 0.2;
      params.iceRatio = 0.1;
    }
    if (level >= 41) {
      params.tntRatio = 0.05;
      params.steelRatio = 0.3;
      params.brickRatio = 0.3;
      params.woodRatio = 0.2;
      params.iceRatio = 0.1;
      params.rubberRatio = 0.05;
    }
    
    // 高级关卡调整（优化版 - 更平衡）
    if (level >= 100) {
      // 随机选择结构类型
      params.structureType = this.structureTemplates[Math.floor(random() * this.structureTemplates.length)];
      
      params.woodRatio = 0.2;
      params.brickRatio = 0.3;
      params.steelRatio = 0.4;
      params.specialBlockChance = 0.2;
    }
    if (level >= 500) {
      params.steelRatio = 0.5;
      params.brickRatio = 0.3;
      params.woodRatio = 0.1;
      params.specialBlockChance = 0.3;
    }
    
    return params;
  }

  /**
   * 生成建筑布局（优化版 - 使用多种结构模板）
   */
  generateBuildingLayoutV2(level, params, random) {
    const canvasWidth = this.canvas.width;
    const groundY = this.canvas.height - 50;
    
    // 根据结构类型生成不同的布局
    let structure = [];
    
    switch (params.structureType) {
      case 'stack':
        structure = this.generateStack(level, params, random);
        break;
      case 'pyramid':
        structure = this.generatePyramid(level, params, random);
        break;
      case 'wall':
        structure = this.generateWall(level, params, random);
        break;
      case 'tower':
        structure = this.generateTower(level, params, random);
        break;
      case 'scatter':
        structure = this.generateScatter(level, params, random);
        break;
      case 'bridge':
        structure = this.generateBridge(level, params, random);
        break;
      case 'two-towers':
        structure = this.generateTwoTowers(level, params, random);
        break;
      case 'castle':
        structure = this.generateCastle(level, params, random);
        break;
      default:
        structure = this.generateStack(level, params, random);
    }
    
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
   * 生成简单堆叠结构
   */
  generateStack(level, params, random) {
    const structure = [];
    const baseX = 150 + (level * 7) % (this.canvas.width - 300);
    
    for (let i = 0; i < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      const x = baseX + (i % 5) * 70 - 140;
      const y = this.canvas.height - 50 - 60 - Math.floor(i / 5) * 70;
      
      if (x >= 50 && x <= this.canvas.width - 110) {
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
   * 生成金字塔结构
   */
  generatePyramid(level, params, random) {
    const structure = [];
    const baseX = this.canvas.width / 2;
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    let currentY = baseY - blockSize;
    let blocksInRow = Math.min(params.buildingCount, 5);
    
    for (let row = 0; row < 5 && blocksInRow > 0; row++) {
      const startX = baseX - (blocksInRow * blockSize) / 2;
      
      for (let i = 0; i < blocksInRow && structure.length < params.buildingCount; i++) {
        const blockType = this.selectBlockType(params, random);
        structure.push({
          x: startX + i * blockSize,
          y: currentY,
          type: blockType,
          width: blockSize,
          height: blockSize
        });
      }
      
      currentY -= blockSize;
      blocksInRow -= 2;
      if (blocksInRow < 1) blocksInRow = 1;
    }
    
    return structure;
  }

  /**
   * 生成墙壁结构
   */
  generateWall(level, params, random) {
    const structure = [];
    const baseX = 100;
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    const cols = Math.ceil(Math.sqrt(params.buildingCount));
    const rows = Math.ceil(params.buildingCount / cols);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols && structure.length < params.buildingCount; col++) {
        const blockType = this.selectBlockType(params, random);
        structure.push({
          x: baseX + col * (blockSize + 5),
          y: baseY - blockSize - row * (blockSize + 5),
          type: blockType,
          width: blockSize,
          height: blockSize
        });
      }
    }
    
    return structure;
  }

  /**
   * 生成高塔结构
   */
  generateTower(level, params, random) {
    const structure = [];
    const baseX = this.canvas.width / 2 - 30;
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    const towerHeight = Math.min(params.buildingCount, 10);
    
    for (let i = 0; i < towerHeight; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: baseX,
        y: baseY - blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    return structure;
  }

  /**
   * 生成散落结构
   */
  generateScatter(level, params, random) {
    const structure = [];
    const margin = 100;
    
    for (let i = 0; i < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      const x = margin + random() * (this.canvas.width - 2 * margin);
      const y = this.canvas.height - 50 - 60 - random() * 200;
      
      structure.push({
        x: x,
        y: y,
        type: blockType,
        width: 60,
        height: 60
      });
    }
    
    return structure;
  }

  /**
   * 生成桥梁结构
   */
  generateBridge(level, params, random) {
    const structure = [];
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    // 桥墩
    const pillarX1 = this.canvas.width / 4;
    const pillarX2 = this.canvas.width * 3 / 4;
    
    for (let i = 0; i < 3; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: pillarX1 - blockSize / 2,
        y: baseY - blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
      
      structure.push({
        x: pillarX2 - blockSize / 2,
        y: baseY - blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    // 桥面
    const bridgeY = baseY - blockSize * 4;
    for (let i = 0; i < 5 && structure.length < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: pillarX1 + blockSize / 2 + i * blockSize,
        y: bridgeY,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    return structure;
  }

  /**
   * 生成双塔结构
   */
  generateTwoTowers(level, params, random) {
    const structure = [];
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    const tower1X = this.canvas.width / 3 - blockSize / 2;
    const tower2X = this.canvas.width * 2 / 3 - blockSize / 2;
    const towerHeight = Math.min(Math.floor(params.buildingCount / 2), 8);
    
    // 塔1
    for (let i = 0; i < towerHeight; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: tower1X,
        y: baseY - blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    // 塔2
    for (let i = 0; i < towerHeight && structure.length < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: tower2X,
        y: baseY - blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    return structure;
  }

  /**
   * 生成城堡结构
   */
  generateCastle(level, params, random) {
    const structure = [];
    const baseX = this.canvas.width / 2;
    const baseY = this.canvas.height - 50;
    const blockSize = 60;
    
    // 城墙
    for (let i = 0; i < 5; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: baseX - 2 * blockSize + i * blockSize,
        y: baseY - blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    // 塔楼
    for (let i = 0; i < 3 && structure.length < params.buildingCount; i++) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: baseX - 2 * blockSize,
        y: baseY - 2 * blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
      
      structure.push({
        x: baseX + 2 * blockSize,
        y: baseY - 2 * blockSize - i * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    // 城堡中心
    if (structure.length < params.buildingCount) {
      const blockType = this.selectBlockType(params, random);
      structure.push({
        x: baseX - blockSize / 2,
        y: baseY - 2 * blockSize,
        type: blockType,
        width: blockSize,
        height: blockSize
      });
    }
    
    return structure;
  }

  /**
   * 选择方块类型（保持原逻辑）
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
   * 获取关卡主题（保持原逻辑）
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
   * 获取关卡游戏机制（保持原逻辑）
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
   * seeded 随机数生成器（保持原逻辑）
   */
  seededRandom(seed) {
    let state = seed;
    
    return function() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  // ==================== 以下为原有方法（简化显示）====================
  // update(), checkCollisions(), damageBlock(), triggerExplosion(), etc.
  // ...（保持原有实现）
}

module.exports = BuildingGenerator;
