/**
 * 音效生成器模块
 * 使用 Web Audio API 程序生成音效，无需外部音频文件
 */

class AudioGenerator {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.initialized = false;
  }

  /**
   * 初始化音频上下文（必须在用户交互后调用）
   */
  init() {
    if (this.initialized) return;
    
    try {
      // 创建音频上下文
      if (typeof wx !== 'undefined') {
        // 微信小游戏环境（使用微信音频 API）
        this.initialized = true;
        console.log('微信音频环境已就绪');
        return;
      }
      
      // 浏览器环境
      var AudioContextCls = (typeof AudioContext !== 'undefined') ? AudioContext :
                            (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null;
      if (!AudioContextCls) {
        console.warn('AudioContext不可用，音效已禁用');
        return;
      }
      this.audioContext = new AudioContextCls();
      
      // 创建主音量控制
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.audioContext.destination);
      
      this.initialized = true;
      console.log('音频上下文初始化完成');
    } catch (err) {
      console.error('音频初始化失败:', err);
    }
  }

  /**
   * 生成磁铁吸附音效
   */
  playGrabSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      // 微信环境使用微信 API
      this.playWechatSound('grab');
      return;
    }
    
    // 浏览器环境：生成磁铁吸附音效（上升音调）
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  /**
   * 生成释放物体音效
   */
  playReleaseSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('release');
      return;
    }
    
    // 浏览器环境：生成释放音效（下降音调）
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  /**
   * 生成碰撞音效
   */
  playCrashSound(intensity = 0.5) {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('crash');
      return;
    }
    
    // 浏览器环境：生成碰撞音效（噪声 + 低频）
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = intensity * 0.5;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    source.start(this.audioContext.currentTime);
  }

  /**
   * 生成摧毁方块音效
   */
  playDestroySound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('destroy');
      return;
    }
    
    // 浏览器环境：生成摧毁音效（破碎声）
    const bufferSize = this.audioContext.sampleRate * 0.2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2) * 0.5;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.4;
    
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    source.start(this.audioContext.currentTime);
  }

  /**
   * 生成胜利音效
   */
  playWinSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('win');
      return;
    }
    
    // 浏览器环境：生成胜利音效（上升和弦）
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + index * 0.15);
      gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + index * 0.15 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + index * 0.15 + 0.5);
      
      oscillator.start(this.audioContext.currentTime + index * 0.15);
      oscillator.stop(this.audioContext.currentTime + index * 0.15 + 0.5);
    });
  }

  /**
   * 生成失败音效
   */
  playLoseSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('lose');
      return;
    }
    
    // 浏览器环境：生成失败音效（下降音调）
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 1);
  }

  /**
   * 生成按钮点击音效
   */
  playButtonSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('button');
      return;
    }
    
    // 浏览器环境：生成简短点击音
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * 生成警告音效（时间紧迫）
   */
  playWarningSound() {
    if (!this.initialized || typeof wx !== 'undefined') {
      this.playWechatSound('warning');
      return;
    }
    
    // 浏览器环境：生成警告音（急促嘟嘟声）
    for (let i = 0; i < 3; i++) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.type = 'square';
      oscillator.frequency.value = 800;
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + i * 0.2);
      gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + i * 0.2 + 0.05);
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + i * 0.2 + 0.08);
      gainNode.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + i * 0.2 + 0.15);
      
      oscillator.start(this.audioContext.currentTime + i * 0.2);
      oscillator.stop(this.audioContext.currentTime + i * 0.2 + 0.15);
    }
  }

  /**
   * 微信环境音效播放（使用微信音频 API）
   */
  playWechatSound(soundName) {
    if (typeof wx === 'undefined') return;
    
    // 微信小游戏环境
    // 注意：实际项目中需要准备音频文件
    console.log(`播放音效: ${soundName}`);
    
    // 示例：如果有音频文件
    // const audio = wx.createInnerAudioContext();
    // audio.src = `audio/${soundName}.mp3`;
    // audio.volume = 0.5;
    // audio.play();
  }

  /**
   * 生成背景音乐（简单旋律）
   */
  playBGM() {
    if (!this.initialized || typeof wx !== 'undefined') {
      console.log('背景音乐：微信环境请使用音频文件');
      return;
    }
    
    // 浏览器环境：生成简单的循环旋律
    console.log('背景音乐生成功能需进一步开发');
  }

  /**
   * 停止所有音效
   */
  stopAll() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.masterGain.gain.value = 0;
    }
  }

  /**
   * 设置主音量
   * @param {number} volume - 音量 (0.0 - 1.0)
   */
  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 销毁音频资源
   */
  destroy() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.initialized = false;
  }
}

// 导出音效生成器
module.exports = AudioGenerator;
