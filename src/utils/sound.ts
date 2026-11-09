/**
 * Super Mario 经典金币提示音（清脆、明亮、悦耳）
 * 核心音频设计：
 * 1. 音符构成：经典两段式升调（B5: 987.77Hz，持续约 82ms -> E6: 1318.51Hz，清脆延音约 350ms）
 * 2. 混合波形：~55% 方波（NES 8-bit 复古金币辨识度）+ ~45% 正弦波（圆润高频与剔透基底）
 * 3. 滤波优化：BiquadFilter 低通滤波（约 7200Hz）+ 适度 Q 值共振峰，去除高频刺耳杂波，强化金币金属反光质感
 * 4. 0 延迟 Web Audio API 原生合成，零外部资源加载，跨平台离线可用且不占体积
 */

const STORAGE_KEY_SOUND_ENABLED = 'flashlist_sound_enabled';

class SoundEffectManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private volume: number = 0.35;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SOUND_ENABLED);
        if (stored !== null) {
          this.soundEnabled = stored === 'true';
        }
      } catch {
        this.soundEnabled = true;
      }
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY_SOUND_ENABLED, String(enabled));
    } catch {
      // 忽略存储异常
    }
  }

  public toggle(): boolean {
    const next = !this.soundEnabled;
    this.setEnabled(next);
    if (next) {
      this.playMarioCoin(true);
    }
    return next;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * 播放经典超级马里奥金币提示音
   * @param forceIgnoreMute 是否忽略静音设置强制播放（例如设置面板中试听）
   */
  public playMarioCoin(forceIgnoreMute: boolean = false): void {
    if (!this.soundEnabled && !forceIgnoreMute) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) {
        this.playFallbackAudio();
        return;
      }

      // 浏览器用户手势恢复机制
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // 关键音符频率 (B5 -> E6 经典纯四度跳跃)
      const f1 = 987.77; // B5
      const f2 = 1318.51; // E6

      const tNote1 = now;
      const tNote2 = now + 0.082; // 第一音持续约 82ms
      const tEnd = now + 0.42;    // 总持续约 420ms，自然指数淡出

      // 1. 双振荡器：方波（复古金币颗粒）+ 正弦波（清脆晶莹质感）
      const oscSquare = ctx.createOscillator();
      const oscSine = ctx.createOscillator();

      oscSquare.type = 'square';
      oscSine.type = 'sine';

      // 频率设置与瞬时跳频
      oscSquare.frequency.setValueAtTime(f1, tNote1);
      oscSquare.frequency.setValueAtTime(f2, tNote2);

      oscSine.frequency.setValueAtTime(f1, tNote1);
      oscSine.frequency.setValueAtTime(f2, tNote2);

      // 2. 独立增益混合节点
      const gainSquare = ctx.createGain();
      const gainSine = ctx.createGain();

      gainSquare.gain.setValueAtTime(0.55, tNote1);
      gainSine.gain.setValueAtTime(0.45, tNote1);

      // 3. 仿硬件低通滤波器：消除 7200Hz 以上尖锐毛刺，使声音格外清脆、饱满、不刺耳
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(7200, tNote1);
      filter.Q.setValueAtTime(1.2, tNote1);

      // 4. 总音量包络控制 (ADSR)
      const masterGain = ctx.createGain();
      const vol = this.volume;

      // 起音极快（4ms）消除爆音，第一音饱满保持，第二音指数衰减
      masterGain.gain.setValueAtTime(0, tNote1);
      masterGain.gain.linearRampToValueAtTime(vol, tNote1 + 0.004);
      masterGain.gain.setValueAtTime(vol, tNote2);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      // 5. 组装音频路由
      oscSquare.connect(gainSquare);
      oscSine.connect(gainSine);

      gainSquare.connect(filter);
      gainSine.connect(filter);

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      // 6. 启动并定时停止
      oscSquare.start(tNote1);
      oscSine.start(tNote1);

      oscSquare.stop(tEnd + 0.02);
      oscSine.stop(tEnd + 0.02);

      // 7. 定时断开节点连接，辅助垃圾回收
      setTimeout(() => {
        try {
          oscSquare.disconnect();
          oscSine.disconnect();
          gainSquare.disconnect();
          gainSine.disconnect();
          filter.disconnect();
          masterGain.disconnect();
        } catch {}
      }, 500);
    } catch (err) {
      console.warn('Web Audio API 播放异常，尝试回退音频文件:', err);
      this.playFallbackAudio();
    }
  }

  /**
   * 降级兜底播放静态音频文件
   */
  private playFallbackAudio(): void {
    try {
      if (typeof Audio === 'undefined') return;
      const audio = new Audio('/sounds/coin.wav');
      audio.volume = this.volume;
      audio.play().catch(() => {});
    } catch {}
  }
}

export const soundManager = new SoundEffectManager();

/**
 * 每次完成待办任务或子项时调用的快捷方法
 */
export function playTaskCompleteSound(): void {
  soundManager.playMarioCoin();
}
