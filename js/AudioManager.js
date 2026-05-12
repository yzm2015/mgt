/**
 * 音效管理系统模块
 * 管理游戏音效和背景音乐
 */

class AudioManager {
  constructor() {
    this.sounds = {};
    this.bgm = null;
    this.isMuted = false;
    this.bgmVolume = 0.5;
    this.sfxVolume = 0.7;
  }

  /**
   * 初始化音效管理器
   */
  init() {
    // 在微信小游戏中，音频需要使用 wx.createInnerAudioContext()
    // 这里提供接口定义，实际音效文件需要自行添加
    
    console.log('音效管理器初始化完成');
  }

  /**
   * 加载音效
   * @param {string} name - 音效名称
   * @param {string} src - 音效文件路径
   */
  loadSound(name, src) {
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境
      const audio = wx.createInnerAudioContext();
      audio.src = src;
      this.sounds[name] = audio;
    } else {
      // 浏览器环境（用于测试）
      const audio = wx.createInnerAudioContext();
      audio.src = src;
      this.sounds[name] = audio;
    }
  }

  /**
   * 播放音效
   * @param {string} name - 音效名称
   */
  playSound(name) {
    if (this.isMuted) return;
    
    const sound = this.sounds[name];
    if (sound) {
      sound.volume = this.sfxVolume;
      
      if (typeof wx !== 'undefined') {
        // 微信小游戏
        sound.stop();
        sound.play();
      } else {
        // 浏览器
        sound.currentTime = 0;
        sound.play();
      }
    }
  }

  /**
   * 播放背景音乐
   * @param {string} src - 音乐文件路径
   * @param {boolean} loop - 是否循环播放
   */
  playBGM(src, loop = true) {
    if (this.bgm) {
      this.bgm.stop();
    }
    
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境
      this.bgm = wx.createInnerAudioContext();
      this.bgm.src = src;
      this.bgm.loop = loop;
      this.bgm.volume = this.bgmVolume;
      
      if (!this.isMuted) {
        this.bgm.play();
      }
    } else {
      // 浏览器环境
      this.bgm = wx.createInnerAudioContext();
      this.bgm.src = src;
      this.bgm.loop = loop;
      this.bgm.volume = this.bgmVolume;
      
      if (!this.isMuted) {
        this.bgm.play();
      }
    }
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this.bgm) {
      this.bgm.stop();
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBGM() {
    if (this.bgm) {
      this.bgm.pause();
    }
  }

  /**
   * 恢复背景音乐
   */
  resumeBGM() {
    if (this.bgm && !this.isMuted) {
      this.bgm.play();
    }
  }

  /**
   * 切换静音状态
   * @returns {boolean} 当前静音状态
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    
    if (this.isMuted) {
      this.pauseBGM();
    } else {
      this.resumeBGM();
    }
    
    return this.isMuted;
  }

  /**
   * 设置背景音乐音量
   * @param {number} volume - 音量值 (0.0 - 1.0)
   */
  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    
    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
  }

  /**
   * 设置音效音量
   * @param {number} volume - 音量值 (0.0 - 1.0)
   */
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 释放所有音频资源
   */
  destroy() {
    // 停止并销毁所有音效
    Object.values(this.sounds).forEach(sound => {
      sound.stop();
      sound.destroy();
    });
    
    this.sounds = {};
    
    // 停止并销毁背景音乐
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
    }
  }
}

// 游戏音效名称常量
const SoundNames = {
  GRAB: 'grab',           // 磁铁吸附音效
  RELEASE: 'release',       // 释放物体音效
  CRASH: 'crash',          // 碰撞音效
  DESTROY: 'destroy',      // 摧毁方块音效
  WIN: 'win',              // 胜利音效
  LOSE: 'lose',            // 失败音效
  BUTTON: 'button',        // 按钮点击音效
  WARNING: 'warning'        // 警告音效（时间紧迫）
};

// 导出音效管理器和常量
module.exports = {
  AudioManager,
  SoundNames
};
