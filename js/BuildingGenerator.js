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
      wood: { color: '#DEB887', strokeColor: '#8B4513', health: 15, mass: 1.0, score: 10, friction: 0.3 },
      brick: { color: '#FF6347', strokeColor: '#8B0000', health: 30, mass: 2.0, score: 20, friction: 0.5 },
      steel: { color: '#808080', strokeColor: '#333333', health: 50, mass: 3.0, score: 30, friction: 0.8 },
      ice: { color: '#ADD8E6', strokeColor: '#4682B4', health: 12, mass: 0.8, score: 15, friction: 0.1 },
      rubber: { color: '#FF69B4', strokeColor: '#C71585', health: 10, mass: 0.5, score: 25, friction: 0.9, bounceiness: 1.5 },
      tnt: { color: '#FF4500', strokeColor: '#8B0000', health: 8, mass: 1.5, score: 50, friction: 0.4, explosive: true }
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
      buildingCount: 3 + Math.floor(level / 15),
      maxFloors: 3 + Math.floor(level / 25),
      woodRatio: 0.5, brickRatio: 0.3, steelRatio: 0.2,
      iceRatio: 0, rubberRatio: 0, tntRatio: 0,
      timeLimit: Math.max(30, 90 - Math.floor(level / 10)),
      targetScore: Math.floor(40 + level * 8 + Math.floor(level/5) * 15),
      // V3.1.4: 新增机制参数
      chainExplosion: false,  // L51+: 连锁爆炸（TNT炸毁建筑也会引爆相邻TNT）
      windForce: 0,           // L61+: 侧风干扰（飞行中的工具受侧向力）
      timeBonus: false,       // L71+: 限时奖励（快速击毁额外加分）
      multiTarget: false,     // L81+: 多目标（需要摧毁所有建筑才能过关）
      bossLevel: false,       // L91+: BOSS关（每10关有1个超高血量BOSS建筑）
      steelRatioBoost: false  // L41+: 钢铁比例提升
    };
    // L11: 解锁TNT
    if (level >= 11) params.tntRatio = 0.05;
    // L21: 解锁冰块
    if (level >= 21) params.iceRatio = 0.1;
    // L31: 解锁橡胶
    if (level >= 31) params.rubberRatio = 0.1;
    // L41: 钢铁比例提升
    if (level >= 41) { params.steelRatioBoost = true; params.woodRatio = 0.3; params.brickRatio = 0.3; params.steelRatio = 0.4; }
    // L51: 连锁爆炸
    if (level >= 51) params.chainExplosion = true;
    // L61: 侧风干扰
    if (level >= 61) params.windForce = Math.min(0.15, 0.03 + (level - 61) * 0.002);
    // L71: 限时奖励
    if (level >= 71) params.timeBonus = true;
    // L81: 多目标
    if (level >= 81) params.multiTarget = true;
    // L91: BOSS关
    if (level >= 91 && level % 10 >= 1 && level % 10 <= 3) params.bossLevel = true;
    // V3.1.4: 高级阶段难度递增
    if (level >= 101) { params.buildingCount = Math.min(5, 3 + Math.floor(level / 50)); } // 更多建筑
    if (level >= 201) { params.iceRatio = Math.min(0.3, 0.1 + (level - 200) * 0.001); } // 冰块增加
    if (level >= 301) { params.steelRatio = 0.5; params.woodRatio = 0.15; params.brickRatio = 0.15; } // 钢铁主导
    if (level >= 401) { params.tntRatio = Math.min(0.15, 0.05 + (level - 400) * 0.001); } // TNT增加
    if (level >= 501) { // 全混合
      params.woodRatio = 0.2; params.brickRatio = 0.2; params.steelRatio = 0.25;
      params.iceRatio = 0.15; params.rubberRatio = 0.1; params.tntRatio = 0.1;
    }
    if (level >= 701) { // 极难：强风+连锁
      params.windForce = Math.min(0.25, 0.1 + (level - 700) * 0.002);
      params.chainExplosion = true;
      params.bossLevel = level % 20 >= 1 && level % 20 <= 3;
    }
    if (level >= 901) { // 炼狱：全机制
      params.chainExplosion = true;
      params.windForce = 0.25;
      params.timeBonus = true;
      params.multiTarget = true;
      params.bossLevel = level % 15 >= 1 && level % 15 <= 5;
    }
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

    const bw = Math.max(40, Math.min(55, W / 7));
    const bh = Math.max(35, Math.min(45, bw * 0.8));
    const gap = 2;

    const buildingCount = Math.min(params.buildingCount, 4);
    const totalUsableWidth = W - 40;
    const buildingSpacing = totalUsableWidth / buildingCount;

    for (let b = 0; b < buildingCount; b++) {
      const centerX = 20 + buildingSpacing * b + buildingSpacing / 2;
      const cols = 2 + Math.floor(random() * 3);
      const floors = 2 + Math.floor(random() * params.maxFloors);
      const actualFloors = Math.min(floors, 8);
      const buildingWidth = cols * (bw + gap) - gap;
      const startX = centerX - buildingWidth / 2;

      for (let floor = 0; floor < actualFloors; floor++) {
        for (let col = 0; col < cols; col++) {
          const blockType = this.selectBlockType(params, random);
          const blockTypeDef = this.blockTypes[blockType];

          const x = startX + col * (bw + gap);
          const y = groundY - (floor + 1) * (bh + gap);

          if (x < 5 || x + bw > W - 5) continue;
          if (y < 80) continue;

          this.buildings.push({
            x, y, width: bw, height: bh, type: blockType,
            color: blockTypeDef.color, strokeColor: blockTypeDef.strokeColor,
            health: blockTypeDef.health, maxHealth: blockTypeDef.health,
            mass: blockTypeDef.mass, score: blockTypeDef.score, friction: blockTypeDef.friction,
            velocityX: 0, velocityY: 0, isGrabbed: false, isDestroyed: false,
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

    // V3.1.4: BOSS关 - 添加1个超大血量BOSS建筑
    if (params.bossLevel) {
      const bossW = Math.min(W * 0.35, bw * 4);
      const bossH = bh * 2;
      const bossX = (W - bossW) / 2;
      const bossY = groundY - bossH - 2;
      const bossHealth = 80 + level * 2; // 超高血量
      this.buildings.push({
        x: bossX, y: bossY, width: bossW, height: bossH, type: 'steel',
        color: '#FFD700', strokeColor: '#B8860B',
        health: bossHealth, maxHealth: bossHealth,
        mass: 5.0, score: Math.floor(bossHealth * 2), friction: 1.0,
        velocityX: 0, velocityY: 0, isGrabbed: false, isDestroyed: false,
        explosive: false, isBoss: true  // V3.1.4: BOSS标记
      });
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
    // V3.1.4: 与 game.js MECHANICS 数组对齐
    const mechanicSet = [
      { level: 1, mechanic: 'basic', description: '基础玩法' },
      { level: 11, mechanic: 'explosive', description: '爆炸方块' },
      { level: 21, mechanic: 'ice', description: '冰块' },
      { level: 31, mechanic: 'rubber', description: '橡胶块' },
      { level: 41, mechanic: 'steel', description: '钢铁强化' },
      { level: 51, mechanic: 'chain', description: '连锁爆炸' },
      { level: 61, mechanic: 'wind', description: '侧风干扰' },
      { level: 71, mechanic: 'timed', description: '限时奖励' },
      { level: 81, mechanic: 'multi', description: '多目标' },
      { level: 91, mechanic: 'boss', description: 'BOSS关' }
    ];
    for (let i = mechanicSet.length - 1; i >= 0; i--) {
      if (level >= mechanicSet[i].level) return [mechanicSet[i]];
    }
    return [mechanicSet[0]];
  }

  getParamsForLevel(level) {
    return this.calculateLevelParams(level, this.seededRandom(level * 12345));
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
