/**
 * 建筑生成系统模块（V3.0.2 - 真实建筑版）
 * 生成紧密堆叠的建筑群，看起来像真正的建筑
 */

class BuildingGenerator {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.buildings = [];
    this.particles = [];
    this.currentTheme = null;
    this.currentMechanics = [];
    
    this.blockTypes = {
      wood: { color: '#DEB887', strokeColor: '#8B4513', health: 50, mass: 1.0, score: 10, friction: 0.3 },
      brick: { color: '#FF6347', strokeColor: '#8B0000', health: 100, mass: 2.0, score: 20, friction: 0.5 },
      steel: { color: '#808080', strokeColor: '#333333', health: 200, mass: 3.0, score: 30, friction: 0.8 },
      ice: { color: '#ADD8E6', strokeColor: '#4682B4', health: 40, mass: 0.8, score: 15, friction: 0.1 },
      rubber: { color: '#FF69B4', strokeColor: '#C71585', health: 30, mass: 0.5, score: 25, friction: 0.9, bounceiness: 1.5 },
      tnt: { color: '#FF4500', strokeColor: '#8B0000', health: 20, mass: 1.5, score: 50, friction: 0.4, explosive: true }
    };
    
    this.themes = {
      1: { name: '城市', skyColor: '#87CEEB', groundColor: '#8B4513' },
      101: { name: '沙漠', skyColor: '#F4D19F', groundColor: '#F4A460' },
      201: { name: '雪地', skyColor: '#E0EFFF', groundColor: '#F5F5F5' },
      301: { name: '太空', skyColor: '#0C1445', groundColor: '#1C1C1C' },
      401: { name: '火山', skyColor: '#8B0000', groundColor: '#2F4F4F' }
    };
  }

  generateLevel(level) {
    this.buildings = [];
    this.currentTheme = this.getTheme(level);
    this.currentMechanics = this.getMechanics(level);
    const seed = level * 12345;
    const random = this.seededRandom(seed);
    const params = this.calculateLevelParams(level, random);
    this.generateBuildingLayout(level, params, random);
    return this.buildings;
  }

  calculateLevelParams(level, random) {
    const params = {
      buildingCount: 3 + Math.floor(level / 15),  // 建筑数量（不是方块数量）
      maxFloors: 3 + Math.floor(level / 25),       // 最高层数
      woodRatio: 0.5, brickRatio: 0.3, steelRatio: 0.2,
      iceRatio: 0, rubberRatio: 0, tntRatio: 0,
      timeLimit: Math.max(30, 90 - Math.floor(level / 10)),
      targetScore: 500 + level * 10
    };
    if (level >= 11) params.tntRatio = 0.05;
    if (level >= 21) params.iceRatio = 0.1;
    if (level >= 31) params.rubberRatio = 0.1;
    return params;
  }

  /**
   * 生成真实建筑布局
   * 每个建筑是一个紧密堆叠的方块群，像真正的楼房
   */
  generateBuildingLayout(level, params, random) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const groundY = H - 50;
    
    // 方块尺寸 - 适中，不要太大也不要太小
    const bw = Math.max(40, Math.min(55, W / 7));
    const bh = Math.max(35, Math.min(45, bw * 0.8));
    const gap = 2; // 方块之间微小间隙
    
    // 计算建筑群分布
    const buildingCount = Math.min(params.buildingCount, 4);
    
    // 将屏幕水平空间分配给建筑
    const totalUsableWidth = W - 40; // 左右各留20px
    const buildingSpacing = totalUsableWidth / buildingCount;
    
    for (let b = 0; b < buildingCount; b++) {
      // 每个建筑的中心X
      const centerX = 20 + buildingSpacing * b + buildingSpacing / 2;
      
      // 每个建筑的宽度（列数）和高度（行数）
      const cols = 2 + Math.floor(random() * 3); // 2-4列宽
      const floors = 2 + Math.floor(random() * params.maxFloors); // 2到maxFloors层
      const actualFloors = Math.min(floors, 8); // 最多8层
      
      // 建筑的总宽度
      const buildingWidth = cols * (bw + gap) - gap;
      const startX = centerX - buildingWidth / 2;
      
      // 逐层逐列生成方块
      for (let floor = 0; floor < actualFloors; floor++) {
        for (let col = 0; col < cols; col++) {
          const blockType = this.selectBlockType(params, random);
          const blockTypeDef = this.blockTypes[blockType];
          
          const x = startX + col * (bw + gap);
          const y = groundY - (floor + 1) * (bh + gap);
          
          // 确保方块在屏幕内
          if (x < 5 || x + bw > W - 5) continue;
          if (y < 80) continue; // 不超过起重机区域
          
          this.buildings.push({
            x: x,
            y: y,
            width: bw,
            height: bh,
            type: blockType,
            color: blockTypeDef.color,
            strokeColor: blockTypeDef.strokeColor,
            health: blockTypeDef.health,
            maxHealth: blockTypeDef.health,
            mass: blockTypeDef.mass,
            score: blockTypeDef.score,
            friction: blockTypeDef.friction,
            velocityX: 0,
            velocityY: 0,
            isGrabbed: false,
            isDestroyed: false,
            explosive: blockTypeDef.explosive || false
          });
        }
      }
      
      // 有概率在建筑顶部放TNT（10关以后）
      if (level >= 11 && random() < 0.3 && actualFloors > 2) {
        const topY = groundY - actualFloors * (bh + gap);
        const topX = centerX - bw / 2;
        if (topY > 80) {
          this.buildings.push({
            x: topX, y: topY, width: bw, height: bh,
            type: 'tnt', color: '#FF4500', strokeColor: '#8B0000',
            health: 20, maxHealth: 20, mass: 1.5, score: 50, friction: 0.4,
            velocityX: 0, velocityY: 0, isGrabbed: false, isDestroyed: false, explosive: true
          });
        }
      }
    }
  }

  selectBlockType(params, random) {
    const r = random();
    if (params.tntRatio && r < params.tntRatio) return 'tnt';
    if (params.rubberRatio && r < params.rubberRatio + params.tntRatio) return 'rubber';
    if (params.iceRatio && r < params.iceRatio + params.rubberRatio + params.tntRatio) return 'ice';
    if (r < params.woodRatio) return 'wood';
    if (r < params.woodRatio + params.brickRatio) return 'brick';
    return 'steel';
  }

  getTheme(level) {
    let themeKey = 1;
    const themeKeys = Object.keys(this.themes).map(Number).sort((a, b) => a - b);
    for (let i = themeKeys.length - 1; i >= 0; i--) {
      if (level >= themeKeys[i]) { themeKey = themeKeys[i]; break; }
    }
    return this.themes[themeKey];
  }

  getMechanics(level) {
    const mechanicSet = [
      { level: 1, mechanic: 'basic', description: '基础玩法' },
      { level: 11, mechanic: 'explosive', description: '爆炸方块' },
      { level: 21, mechanic: 'ice', description: '冰块' },
      { level: 31, mechanic: 'rubber', description: '橡胶块' }
    ];
    for (let i = mechanicSet.length - 1; i >= 0; i--) {
      if (level >= mechanicSet[i].level) return [mechanicSet[i]];
    }
    return [mechanicSet[0]];
  }

  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  update(physics) {
    this.buildings.forEach(block => {
      if (block.isDestroyed || block.isGrabbed) return;
      physics.applyGravity(block);
      physics.updatePosition(block, this.canvas.height, this.canvas.width);
    });
    this.checkCollisions(physics);
    this.updateParticles();
  }

  checkCollisions(physics) {
    for (let i = 0; i < this.buildings.length; i++) {
      for (let j = i + 1; j < this.buildings.length; j++) {
        const a = this.buildings[i], b = this.buildings[j];
        if (a.isDestroyed || b.isDestroyed || a.isGrabbed || b.isGrabbed) continue;
        if (physics.isColliding(a, b)) physics.resolveCollision(a, b);
      }
    }
  }

  damageBlock(block, damage) {
    if (!block || block.isDestroyed) return { destroyed: false };
    block.health -= damage;
    if (block.health <= 0) {
      block.isDestroyed = true;
      if (block.explosive) this.triggerExplosion(block);
      return { destroyed: true, score: block.score };
    }
    return { destroyed: false, score: 0 };
  }

  triggerExplosion(explosiveBlock) {
    const radius = 100;
    this.buildings.forEach(block => {
      if (block === explosiveBlock || block.isDestroyed) return;
      const dx = (block.x + block.width/2) - (explosiveBlock.x + explosiveBlock.width/2);
      const dy = (block.y + block.height/2) - (explosiveBlock.y + explosiveBlock.height/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < radius) this.damageBlock(block, 50 * (1 - dist/radius));
    });
  }

  onCreateParticleEffect(x, y, color) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x, y, vx: (Math.random()-.5)*8, vy: (Math.random()-.5)*8,
        life: 25, color, size: Math.random()*3+1
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  getTargetScore(level) {
    return this.calculateLevelParams(level, this.seededRandom(level * 12345)).targetScore;
  }

  getTimeLimit(level) {
    return this.calculateLevelParams(level, this.seededRandom(level * 12345)).timeLimit;
  }
}

module.exports = BuildingGenerator;
