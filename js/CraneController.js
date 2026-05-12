/**
 * 起重机控制系统模块
 * 处理起重机移动、磁铁吸附/释放逻辑
 */

class CraneController {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    
    // 起重机属性
    this.crane = {
      x: canvas.width / 2,
      y: 100,
      width: 80,
      height: 120,
      speed: config.craneSpeed || 5
    };
    
    // 磁铁属性
    this.magnet = {
      x: this.crane.x,
      y: this.crane.y + (config.ropeLength || 150),
      radius: 20,
      isActive: false,
      isGrabbing: false,
      grabbedBlock: null,
      attractRadius: config.magnetRadius || 60,
      magnetPower: config.magnetPower || 0.8
    };
    
    // 钟摆系统
    this.pendulum = {
      angle: 0,
      angularVelocity: 0,
      ropeLength: config.ropeLength || 150
    };
    
    // 物理系统实例
    this.physics = null;
    
    // 触摸状态
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isDragging = false;
  }

  /**
   * 设置物理系统引用
   * @param {PhysicsSystem} physicsSystem - 物理系统实例
   */
  setPhysicsSystem(physicsSystem) {
    this.physics = physicsSystem;
  }

  /**
   * 更新起重机状态
   */
  update() {
    // 更新钟摆运动
    if (this.magnet.isGrabbing && this.magnet.grabbedBlock) {
      this.updatePendulum();
    }
    
    // 更新磁铁位置
    this.updateMagnetPosition();
  }

  /**
   * 更新钟摆运动
   */
  updatePendulum() {
    if (!this.physics) return;
    
    const pivotX = this.crane.x;
    const pivotY = this.crane.y + this.crane.height;
    
    const magnetPos = this.physics.updatePendulum(
      this.pendulum,
      this.pendulum.ropeLength,
      pivotX,
      pivotY
    );
    
    if (magnetPos) {
      this.magnet.x = magnetPos.x;
      this.magnet.y = magnetPos.y;
    }
  }

  /**
   * 更新磁铁位置
   */
  updateMagnetPosition() {
    if (this.magnet.isGrabbing && this.magnet.grabbedBlock) {
      // 磁铁跟随钟摆，方块挂在磁铁下方
      const block = this.magnet.grabbedBlock;
      block.x = this.magnet.x - block.width / 2;
      block.y = this.magnet.y + this.magnet.radius + 2; // 方块挂在磁铁正下方
    } else if (!this.magnet.isGrabbing) {
      // 磁铁静止在起重机下方
      this.magnet.x = this.crane.x;
      this.magnet.y = this.crane.y + this.crane.height + this.pendulum.ropeLength;
      this.pendulum.angle = 0;
      this.pendulum.angularVelocity = 0;
    }
  }

  /**
   * 移动起重机
   * @param {number} direction - 移动方向（-1: 左, 1: 右）
   */
  move(direction) {
    if (direction !== -1 && direction !== 1) return;
    
    this.crane.x += direction * this.crane.speed;
    
    // 边界检测
    const minX = this.crane.width / 2;
    const maxX = this.canvas.width - this.crane.width / 2;
    
    if (this.crane.x < minX) {
      this.crane.x = minX;
    }
    if (this.crane.x > maxX) {
      this.crane.x = maxX;
    }
  }

  /**
   * 激活磁铁（触摸开始）
   * @param {number} touchX - 触摸X坐标
   * @param {number} touchY - 触摸Y坐标
   * @param {Array} blocks - 建筑方块数组
   */
  activateMagnet(touchX, touchY, blocks) {
    if (!blocks || !Array.isArray(blocks)) return;
    
    this.magnet.isActive = true;
    this.magnet.isGrabbing = true;
    this.touchStartX = touchX;
    this.touchStartY = touchY;
    
    // 检测可吸附的物体
    this.checkAttraction(blocks);
  }

  /**
   * 释放磁铁（触摸结束）
   * @returns {Object|null} 被释放的方块（如果有）
   */
  releaseMagnet() {
    this.magnet.isActive = false;
    
    if (this.magnet.grabbedBlock) {
      const block = this.magnet.grabbedBlock;
      
      // 计算抛掷力（基于钟摆角速度）
      const forceX = this.pendulum.angularVelocity * 50;
      const forceY = -15; // 向上抛掷
      
      if (this.physics) {
        this.physics.applyForce(block, forceX, forceY);
      } else {
        block.velocityX = forceX / block.mass;
        block.velocityY = forceY / block.mass;
      }
      
      block.isGrabbed = false;
      this.magnet.grabbedBlock = null;
      this.magnet.isGrabbing = false;
      this.pendulum.angle = 0;
      this.pendulum.angularVelocity = 0;
      
      return block;
    }
    
    this.magnet.isGrabbing = false;
    return null;
  }

  /**
   * 检测磁铁吸附
   * @param {Array} blocks - 建筑方块数组
   */
  checkAttraction(blocks) {
    if (!blocks || this.magnet.grabbedBlock) return;
    
    let closestBlock = null;
    let closestDistance = this.magnet.attractRadius;
    
    blocks.forEach(block => {
      if (!block || block.isGrabbed || block.health <= 0) return;
      
      const blockCenterX = block.x + block.width / 2;
      const blockCenterY = block.y + block.height / 2;
      const dx = blockCenterX - this.magnet.x;
      const dy = blockCenterY - this.magnet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBlock = block;
      }
    });
    
    if (closestBlock) {
      this.magnet.grabbedBlock = closestBlock;
      closestBlock.isGrabbed = true;
      this.magnet.isGrabbing = true;
    }
  }

  /**
   * 绘制起重机
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   */
  draw(ctx) {
    if (!ctx) return;
    
    // 绘制起重机底座
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(
      this.crane.x - this.crane.width / 2,
      this.crane.y,
      this.crane.width,
      this.crane.height
    );
    
    // 绘制起重机车轮
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(this.crane.x - 20, this.crane.y + this.crane.height, 10, 0, Math.PI * 2);
    ctx.arc(this.crane.x + 20, this.crane.y + this.crane.height, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制绳索
    const pivotX = this.crane.x;
    const pivotY = this.crane.y + this.crane.height;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(this.magnet.x, this.magnet.y);
    ctx.stroke();
    
    // 绘制磁铁
    this.drawMagnet(ctx);
  }

  /**
   * 绘制磁铁
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   */
  drawMagnet(ctx) {
    if (!ctx) return;
    
    // 磁铁主体
    ctx.fillStyle = this.magnet.isActive ? '#00FF00' : '#0000FF';
    ctx.beginPath();
    ctx.arc(this.magnet.x, this.magnet.y, this.magnet.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 磁铁边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 绘制吸附范围（调试用）
    if (this.magnet.isActive && !this.magnet.grabbedBlock) {
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.3)';
      try {
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([5, 5]);
        }
      } catch (e) { /* ignore */ }
      ctx.beginPath();
      ctx.arc(this.magnet.x, this.magnet.y, this.magnet.attractRadius, 0, Math.PI * 2);
      ctx.stroke();
      try {
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([]);
        }
      } catch (e) { /* ignore */ }
    }
    
    // 绘制磁力线效果
    if (this.magnet.isGrabbing && this.magnet.grabbedBlock) {
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(this.magnet.x + i * 5, this.magnet.y);
        ctx.lineTo(
          this.magnet.grabbedBlock.x + this.magnet.grabbedBlock.width / 2 + i * 5,
          this.magnet.grabbedBlock.y
        );
        ctx.stroke();
      }
    }
  }

  /**
   * 获取起重机位置
   * @returns {Object} 起重机位置 {x, y}
   */
  getPosition() {
    return { x: this.crane.x, y: this.crane.y };
  }

  /**
   * 获取磁铁位置
   * @returns {Object} 磁铁位置 {x, y}
   */
  getMagnetPosition() {
    return { x: this.magnet.x, y: this.magnet.y };
  }

  /**
   * 检查是否正在抓取物体
   * @returns {boolean} 是否正在抓取
   */
  isGrabbing() {
    return this.magnet.isGrabbing && this.magnet.grabbedBlock !== null;
  }
}

// 导出起重机控制器
module.exports = CraneController;
