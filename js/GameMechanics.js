/**
 * 游戏机制系统模块
 * 实现每10关新增的游戏机制效果
 */

class GameMechanics {
  constructor() {
    this.activeMechanics = [];
    this.magnetBoostActive = false;
    this.timeBonusActive = false;
    this.chainReactionActive = false;
  }

  /**
   * 根据关卡更新激活的机制
   * @param {number} level - 当前关卡
   * @param {Array} mechanicsList - 机制列表
   */
  updateMechanics(level, mechanicsList) {
    this.activeMechanics = mechanicsList || [];
    
    // 重置所有机制状态
    this.magnetBoostActive = false;
    this.timeBonusActive = false;
    this.chainReactionActive = false;
    
    // 激活当前关卡适用的机制
    this.activeMechanics.forEach(mech => {
      switch (mech.mechanic) {
        case 'explosive':
          // 爆炸方块已通过 BuildingGenerator 实现
          break;
        case 'ice':
          // 冰块已通过 BuildingGenerator 实现
          break;
        case 'rubber':
          // 橡胶块已通过 BuildingGenerator 实现
          break;
        case 'tnt':
          // TNT 已通过 BuildingGenerator 实现
          break;
        case 'chain_reaction':
          this.chainReactionActive = true;
          break;
        case 'magnet_boost':
          this.magnetBoostActive = true;
          break;
        case 'time_bonus':
          this.timeBonusActive = true;
          break;
        case 'multi_target':
          // 多目标逻辑
          break;
        case 'boss':
          // BOSS关卡逻辑
          break;
      }
    });
  }

  /**
   * 应用磁力增强效果
   * @param {Object} crane - 起重机对象
   * @param {Object} CONFIG - 配置对象
   */
  applyMagnetBoost(crane, CONFIG) {
    if (!this.magnetBoostActive || !crane) return;
    
    // 增强磁力范围和力量
    if (crane.magnet) {
      crane.magnet.attractRadius = (CONFIG.magnetRadius || 80) * 1.5;
      crane.magnet.magnetPower = (CONFIG.magnetPower || 0.8) * 1.5;
    }
  }

  /**
   * 检查时间奖励
   * @param {number} score - 当前分数
   * @param {number} targetScore - 目标分数
   * @param {number} timeLeft - 剩余时间
   * @returns {number} 额外时间（秒）
   */
  checkTimeBonus(score, targetScore, timeLeft) {
    if (!this.timeBonusActive) return 0;
    
    // 每达到目标的25%奖励5秒
    const percent = score / targetScore;
    const bonusThreshold = Math.floor(percent / 0.25);
    
    // 简化版：达到50%和100%时奖励时间
    if (percent >= 0.5 && percent < 0.75) {
      return 5; // 奖励5秒
    } else if (percent >= 1.0) {
      return 10; // 奖励10秒
    }
    
    return 0;
  }

  /**
   * 处理连锁反应
   * @param {Object} destroyedBlock - 被摧毁的方块
   * @param {Array} buildings - 所有方块
   * @param {Function} damageCallback - 伤害回调函数
   */
  processChainReaction(destroyedBlock, buildings, damageCallback) {
    if (!this.chainReactionActive || !destroyedBlock) return;
    
    const chainRadius = 80;
    let chainCount = 0;
    
    buildings.forEach(block => {
      if (block === destroyedBlock || block.isDestroyed || block.isGrabbed) return;
      
      const dx = (block.x + block.width / 2) - (destroyedBlock.x + destroyedBlock.width / 2);
      const dy = (block.y + block.height / 2) - (destroyedBlock.y + destroyedBlock.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < chainRadius) {
        // 连锁伤害（递减）
        const chainDamage = 30 * Math.pow(0.7, chainCount);
        if (damageCallback) {
          damageCallback(block, chainDamage);
          chainCount++;
        }
      }
    });
    
    if (chainCount > 0) {
      console.log(`连锁反应：影响了 ${chainCount} 个方块`);
    }
  }

  /**
   * 处理多目标检查
   * @param {Array} buildings - 所有方块
   * @returns {Object} 目标完成状态
   */
  checkMultiTarget(buildings) {
    // 简化版：检查是否所有方块都被摧毁
    const totalBlocks = buildings.length;
    const destroyedBlocks = buildings.filter(b => b.isDestroyed).length;
    
    return {
      total: totalBlocks,
      destroyed: destroyedBlocks,
      percent: totalBlocks > 0 ? destroyedBlocks / totalBlocks : 0
    };
  }

  /**
   * 处理BOSS关卡
   * @param {number} level - 当前关卡
   * @returns {Object} BOSS配置
   */
  getBossConfig(level) {
    if (!this.activeMechanics.some(m => m.mechanic === 'boss')) {
      return null;
    }
    
    // BOSS方块配置
    return {
      health: 500 + (level - 90) * 50,  // BOSS生命值随关卡增加
      mass: 5.0,                       // BOSS质量很大
      score: 200,                      // BOSS分数很高
      color: '#8B0000',                // BOSS颜色（深红）
      width: 120,                      // BOSS尺寸更大
      height: 120
    };
  }

  /**
   * 重置机制效果
   * @param {Object} crane - 起重机对象
   * @param {Object} CONFIG - 配置对象
   */
  resetMechanics(crane, CONFIG) {
    // 恢复磁力参数
    if (crane && crane.magnet) {
      crane.magnet.attractRadius = CONFIG.magnetRadius || 80;
      crane.magnet.magnetPower = CONFIG.magnetPower || 0.8;
    }
    
    // 重置所有机制状态
    this.activeMechanics = [];
    this.magnetBoostActive = false;
    this.timeBonusActive = false;
    this.chainReactionActive = false;
  }
}

module.exports = GameMechanics;
