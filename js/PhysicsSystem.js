/**
 * 物理系统模块
 * 实现真实的钟摆物理模拟和碰撞检测
 */

class PhysicsSystem {
  constructor(config) {
    this.gravity = config.gravity || 0.5;
    this.damping = config.damping || 0.99; // 阻尼系数
    this.bounceDamping = config.bounceDamping || 0.5; // 弹跳衰减
    this.friction = config.friction || 0.8; // 地面摩擦力
  }

  /**
   * 更新钟摆运动
   * 物理公式: θ'' = -g/L * sin(θ) - damping * θ'
   * @param {Object} pendulum - 钟摆对象
   * @param {number} ropeLength - 绳索长度
   * @param {number} pivotX - 支点X坐标
   * @param {number} pivotY - 支点Y坐标
   * @returns {Object} 更新后的磁铁位置 {x, y}
   */
  updatePendulum(pendulum, ropeLength, pivotX, pivotY) {
    if (!pendulum) {
      console.error('钟摆对象未定义');
      return { x: pivotX, y: pivotY + ropeLength };
    }

    // 计算角加速度: α = -g/L * sin(θ)
    const angularAcceleration = -this.gravity / ropeLength * Math.sin(pendulum.angle);
    
    // 更新角速度（加入阻尼）
    pendulum.angularVelocity += angularAcceleration;
    pendulum.angularVelocity *= this.damping;
    
    // 限制最大角速度，防止失控
    const maxAngularVelocity = 0.5;
    if (pendulum.angularVelocity > maxAngularVelocity) {
      pendulum.angularVelocity = maxAngularVelocity;
    } else if (pendulum.angularVelocity < -maxAngularVelocity) {
      pendulum.angularVelocity = -maxAngularVelocity;
    }
    
    // 更新角度
    pendulum.angle += pendulum.angularVelocity;
    
    // 计算磁铁位置
    const magnetX = pivotX + Math.sin(pendulum.angle) * ropeLength;
    const magnetY = pivotY + Math.cos(pendulum.angle) * ropeLength;
    
    return { x: magnetX, y: magnetY };
  }

  /**
   * 应用重力到物体
   * @param {Object} block - 建筑方块
   */
  applyGravity(block) {
    if (!block || block.isGrabbed) return;
    
    // v = v0 + gt
    block.velocityY += this.gravity;
    
    // 限制最大下落速度
    const maxFallSpeed = 15;
    if (block.velocityY > maxFallSpeed) {
      block.velocityY = maxFallSpeed;
    }
  }

  /**
   * 更新物体位置
   * @param {Object} block - 建筑方块
   * @param {number} canvasHeight - 画布高度
   * @param {number} canvasWidth - 画布宽度
   * @param {number} groundLevel - 地面高度
   */
  updatePosition(block, canvasHeight, canvasWidth, groundLevel = 50) {
    if (!block || block.isGrabbed) return;
    
    // 更新位置
    block.x += block.velocityX;
    block.y += block.velocityY;
    
    // 地面碰撞检测
    const groundY = canvasHeight - groundLevel;
    if (block.y + block.height > groundY) {
      block.y = groundY - block.height;
      
      // 反弹（带衰减）
      block.velocityY *= -this.bounceDamping;
      
      // 地面摩擦力
      block.velocityX *= this.friction;
      
      // 如果速度很小，停止
      if (Math.abs(block.velocityY) < 0.5) {
        block.velocityY = 0;
      }
    }
    
    // 边界检测（左右墙壁）
    if (block.x < 0) {
      block.x = 0;
      block.velocityX *= -0.5;
    }
    if (block.x + block.width > canvasWidth) {
      block.x = canvasWidth - block.width;
      block.velocityX *= -0.5;
    }
    
    // 顶部边界检测
    if (block.y < 0) {
      block.y = 0;
      block.velocityY *= -0.5;
    }
  }

  /**
   * 检测两个方块是否碰撞
   * @param {Object} blockA - 方块A
   * @param {Object} blockB - 方块B
   * @returns {boolean} 是否碰撞
   */
  isColliding(blockA, blockB) {
    if (!blockA || !blockB) return false;
    
    return blockA.x < blockB.x + blockB.width &&
           blockA.x + blockA.width > blockB.x &&
           blockA.y < blockB.y + blockB.height &&
           blockA.y + blockA.height > blockB.y;
  }

  /**
   * 处理方块碰撞反应（改进版 - 基于动量和能量守恒）
   * @param {Object} blockA - 方块A
   * @param {Object} blockB - 方块B
   */
  resolveCollision(blockA, blockB) {
    if (!blockA || !blockB || blockA.isGrabbed || blockB.isGrabbed) return;
    
    // 计算碰撞法向量
    const centerAX = blockA.x + blockA.width / 2;
    const centerAY = blockA.y + blockA.height / 2;
    const centerBX = blockB.x + blockB.width / 2;
    const centerBY = blockB.y + blockB.height / 2;
    
    const dx = centerBX - centerAX;
    const dy = centerBY - centerAY;
    
    // 计算相对速度
    const relVelocityX = blockB.velocityX - blockA.velocityX;
    const relVelocityY = blockB.velocityY - blockA.velocityY;
    
    // 沿碰撞法向的速度
    const relVelocityDotNormal = relVelocityX * dx + relVelocityY * dy;
    
    // 如果物体正在分离，不处理碰撞
    if (relVelocityDotNormal > 0) return;
    
    // 计算冲量
    const minMass = Math.min(blockA.mass, blockB.mass);
    const impulse = 0.3 * minMass; // 冲量系数
    
    blockA.velocityX -= (dx / 100) * impulse * blockB.mass;
    blockA.velocityY -= (dy / 100) * impulse * blockB.mass;
    blockB.velocityX += (dx / 100) * impulse * blockA.mass;
    blockB.velocityY += (dy / 100) * impulse * blockA.mass;
    
    // 分离重叠的方块
    this.separateBlocks(blockA, blockB);
  }

  /**
   * 分离重叠的方块
   * @param {Object} blockA - 方块A
   * @param {Object} blockB - 方块B
   */
  separateBlocks(blockA, blockB) {
    if (!blockA || !blockB) return;
    
    const overlapX = Math.min(
      blockA.x + blockA.width - blockB.x,
      blockB.x + blockB.width - blockA.x
    );
    const overlapY = Math.min(
      blockA.y + blockA.height - blockB.y,
      blockB.y + blockB.height - blockA.y
    );
    
    if (overlapX < overlapY && overlapX > 0) {
      // X 轴分离
      const totalMass = blockA.mass + blockB.mass;
      const moveA = (blockB.mass / totalMass) * overlapX;
      const moveB = (blockA.mass / totalMass) * overlapX;
      
      if (blockA.x < blockB.x) {
        blockA.x -= moveA;
        blockB.x += moveB;
      } else {
        blockA.x += moveA;
        blockB.x -= moveB;
      }
    } else if (overlapY > 0) {
      // Y 轴分离
      const totalMass = blockA.mass + blockB.mass;
      const moveA = (blockB.mass / totalMass) * overlapY;
      const moveB = (blockA.mass / totalMass) * overlapY;
      
      if (blockA.y < blockB.y) {
        blockA.y -= moveA;
        blockB.y += moveB;
      } else {
        blockA.y += moveA;
        blockB.y -= moveB;
      }
    }
  }

  /**
   * 计算撞击伤害（改进版）
   * @param {Object} block - 目标方块
   * @param {number} impactForce - 撞击力
   * @returns {Object} 伤害结果 {damage, isDestroyed}
   */
  calculateDamage(block, impactForce) {
    if (!block) return { damage: 0, isDestroyed: false };
    
    // 伤害 = 撞击力 / 质量 * 伤害系数
    const damage = impactForce / block.mass * 0.5;
    block.health -= damage;
    
    // 确保生命值不为负
    if (block.health < 0) {
      block.health = 0;
    }
    
    return {
      damage: damage,
      isDestroyed: block.health <= 0
    };
  }

  /**
   * 给予物体抛掷力
   * @param {Object} block - 目标方块
   * @param {number} forceX - X 方向力
   * @param {number} forceY - Y 方向力
   */
  applyForce(block, forceX, forceY) {
    if (!block) return;
    
    block.velocityX += forceX / block.mass;
    block.velocityY += forceY / block.mass;
  }
}

// 导出物理系统
module.exports = PhysicsSystem;
