# 磁吸拆迁队 - 微信小游戏

## 📋 项目简介

**游戏名称**：磁吸拆迁队  
**游戏类型**：物理模拟 + 策略消除  
**开发技术**：微信小游戏原生 API + Canvas 2D  
**核心玩法**：控制起重机磁铁吸附物体，利用物理惯性撞击拆除建筑

---

## 🎮 游戏特性

### 核心机制
- ✅ **真实物理模拟**：基于钟摆物理方程的运动模拟
- ✅ **磁铁吸附系统**：智能吸附附近的建筑方块
- ✅ **重量分级系统**：轻(木材) < 中(砖石) < 重(钢材)
- ✅ **碰撞伤害计算**：基于物体质量和速度的精确伤害

### 游戏系统
- ✅ **关卡系统**：3个预设关卡（可扩展）
- ✅ **计分系统**：根据拆除效率和连击计算分数
- ✅ **星级评价**：⭐⭐⭐ 根据完成度给予1-3星
- ✅ **计时系统**：限时挑战模式

### 技术特性
- ✅ **模块化设计**：物理系统、控制器、生成器分离
- ✅ **性能优化**：对象池、碰撞优化
- ✅ **响应式设计**：适配不同屏幕尺寸
- ✅ **音效管理**：完整的音效系统接口

---

## 📂 项目结构

```
magnetic-demolition/
├── game.js                 # 主游戏逻辑（入口文件）
├── game.json               # 微信小游戏配置文件
├── project.config.json     # 项目配置文件
├── js/
│   ├── PhysicsSystem.js    # 物理系统模块
│   ├── CraneController.js  # 起重机控制模块
│   ├── BuildingGenerator.js # 建筑生成器模块
│   └── AudioManager.js     # 音效管理模块
├── images/                 # 图片资源目录
├── audio/                  # 音效资源目录
└── utils/                  # 工具函数目录
```

---

## 🚀 快速开始

### 1. 环境准备

**必需环境**：
- 微信开发者工具（最新版）
- 微信小游戏 AppID（或使用测试号）

**下载地址**：
- 微信开发者工具：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 导入项目

1. 打开微信开发者工具
2. 选择「小游戏」项目类型
3. 导入 `magnetic-demolition` 文件夹
4. 填入 AppID（没有的话选择"测试号"）
5. 点击「确定」导入项目

### 3. 运行游戏

1. 导入成功后，点击「编译」按钮
2. 在模拟器中可以看到游戏界面
3. 点击「预览」可以生成二维码，在手机微信中体验

### 4. 调试与测试

**调试方法**：
- 使用「调试器」查看 console.log 输出
- 使用「性能」面板监控 FPS
- 使用「网络」面板查看资源加载

**测试建议**：
- 测试不同屏幕尺寸的适配
- 测试触摸控制的灵敏度
- 测试物理系统的稳定性

---

## 🎯 游戏操作说明

### 触摸控制
- **左下区域滑动**：控制起重机左右移动
- **长按屏幕**：激活磁铁，吸附附近物体
- **松开手指**：释放物体，利用惯性撞击建筑

### 游戏目标
- 在限定时间内，通过撞击拆除建筑获得足够分数
- 达到目标分数即可过关
- 根据得分给予星级评价（⭐⭐⭐）

---

## 🔧 开发文档

### 核心模块说明

#### 1. PhysicsSystem（物理系统）
**文件路径**：`js/PhysicsSystem.js`

**主要功能**：
- 钟摆运动模拟（基于真实物理公式）
- 重力与碰撞检测
- 伤害计算

**关键方法**：
```javascript
updatePendulum(pendulum, ropeLength, pivotX, pivotY)  // 更新钟摆
applyGravity(block)                                     // 应用重力
updatePosition(block, canvasHeight, groundLevel)         // 更新位置
isColliding(blockA, blockB)                            // 碰撞检测
resolveCollision(blockA, blockB)                       // 处理碰撞
calculateDamage(block, impactForce)                    // 计算伤害
```

#### 2. CraneController（起重机控制器）
**文件路径**：`js/CraneController.js`

**主要功能**：
- 起重机移动控制
- 磁铁吸附/释放逻辑
- 触摸输入处理

**关键方法**：
```javascript
move(direction)                   // 移动起重机
activateMagnet(touchX, touchY, blocks)  // 激活磁铁
releaseMagnet()                   // 释放磁铁
checkAttraction(blocks)           // 检测吸附
draw(ctx)                         // 绘制起重机
```

#### 3. BuildingGenerator（建筑生成器）
**文件路径**：`js/BuildingGenerator.js`

**主要功能**：
- 关卡建筑生成
- 方块类型配置
- 粒子效果管理

**关键方法**：
```javascript
generateLevel(level)        // 生成关卡
getLevelConfig(level)       // 获取关卡配置
update(physics)             // 更新建筑状态
damageBlock(block, damage)  // 伤害方块
draw(ctx)                   // 绘制建筑
```

#### 4. AudioManager（音效管理器）
**文件路径**：`js/AudioManager.js`

**主要功能**：
- 音效加载与播放
- 背景音乐控制
- 音量管理

**关键方法**：
```javascript
loadSound(name, src)    // 加载音效
playSound(name)          // 播放音效
playBGM(src, loop)      // 播放背景音乐
toggleMute()            // 切换静音
```

---

## 📦 构建与发布

### 1. 上传代码

1. 在微信开发者工具中，点击「上传」按钮
2. 填写版本号和项目备注
3. 点击「上传」提交代码

### 2. 提交审核

1. 登录微信公众平台（https://mp.weixin.qq.com）
2. 进入「管理」→「版本管理」
3. 选择刚上传的版本，点击「提交审核」
4. 填写游戏信息、截图等材料
5. 等待微信团队审核（通常1-7个工作日）

### 3. 发布上线

1. 审核通过后，在微信公众平台点击「发布」
2. 游戏正式上线，用户可以通过搜索或分享进入

---

## 🎨 扩展开发指南

### 添加新关卡

编辑 `js/BuildingGenerator.js` 中的 `getLevelConfig` 方法：

```javascript
4: {
  timeLimit: 90,
  targetScore: 1500,
  blocks: [
    { x: 100, y: 300, type: 'steel', width: 60, height: 60 },
    // 添加更多方块...
  ]
}
```

### 添加新方块类型

编辑 `js/BuildingGenerator.js` 中的 `blockTypes` 对象：

```javascript
concrete: {
  color: '#A9A9A9',
  strokeColor: '#696969',
  health: 150,
  mass: 2.5,
  score: 25,
  friction: 0.6
}
```

### 调整游戏难度

编辑 `game.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  gravity: 0.5,           // 重力系数（越大越难）
  ropeLength: 150,         // 绳索长度（越长越难控制）
  magnetRadius: 80,        // 磁铁吸附范围
  magnetPower: 0.8,       // 磁力强度
  craneSpeed: 5             // 起重机移动速度
};
```

---

## 🐛 常见问题

### 1. 游戏无法启动

**原因**：可能是 Canvas 初始化失败  
**解决**：检查 `wx.createCanvas()` 是否成功调用

### 2. 物理系统异常

**原因**：物理参数配置不当  
**解决**：调整 `CONFIG` 中的物理参数，特别是 `gravity` 和 `damping`

### 3. 触摸控制不灵敏

**原因**：触摸检测区域设置不当  
**解决**：调整 `bindTouchEvents` 中的触摸区域判断逻辑

### 4. 帧率过低

**原因**：绘制或计算过于频繁  
**解决**：
- 减少粒子效果数量
- 优化碰撞检测算法
- 使用对象池复用对象

---

## 📄 版权与许可

**作者**：AI Assistant  
**授权**：MIT License  
**免责声明**：本游戏为演示项目，仅供学习交流使用

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue（如项目托管在 GitHub）
- 发送邮件至：[your-email@example.com]

---

**祝游戏开发顺利！** 🎮
