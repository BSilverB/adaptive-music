/**
 * Adaptive Web Audio Engine (v3.0 - 4-Stem Active Mixer Edition)
 * Đảm bảo đồng bộ pha 0ms bằng cơ chế lập lịch phần cứng (Lookahead Scheduling audioCtx.currentTime + 0.1)
 * và quản lý RAM với cơ chế Single-Track Buffer Pool cho cả 4 stems: Vocals, Other, Bass, Drums.
 */

export interface TrackMeta {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  status: string;
  has_stems: boolean;
  bpm?: number;
}

export interface Playlist {
  id: string;
  name: string;
  track_ids: string[];
  is_default: boolean;
  created_at?: number;
}

export type StemType = "vocals" | "other" | "bass" | "drums";

export interface StemChannelState {
  volume: number; // 0.0 - 1.0
  muted: boolean;
  solo: boolean;
}

export type StemMixerState = Record<StemType, StemChannelState>;
export type MixerMode = "auto" | "manual";
export type PresetName = "full" | "deep_focus" | "acoustic" | "rhythm";

export const STEM_PRESETS: Record<
  PresetName,
  { id: PresetName; name: string; icon: string; gains: Record<StemType, number> }
> = {
  full: {
    id: "full",
    name: "Bản Chuẩn (Full)",
    icon: "🎤",
    gains: { vocals: 1.0, other: 1.0, bass: 1.0, drums: 1.0 },
  },
  deep_focus: {
    id: "deep_focus",
    name: "Code / Deep Focus",
    icon: "💻",
    gains: { vocals: 0.0, other: 1.0, bass: 1.0, drums: 1.0 },
  },
  acoustic: {
    id: "acoustic",
    name: "Acoustic Chill",
    icon: "☕",
    gains: { vocals: 1.0, other: 1.0, bass: 0.0, drums: 0.0 },
  },
  rhythm: {
    id: "rhythm",
    name: "Trống & Bass",
    icon: "🎧",
    gains: { vocals: 0.0, other: 0.0, bass: 1.0, drums: 1.0 },
  },
};

export class AdaptiveEngine {
  private audioCtx: AudioContext | null = null;

  // 4 Stems Audio Nodes
  private sources: Record<StemType, AudioBufferSourceNode | null> = {
    vocals: null,
    other: null,
    bass: null,
    drums: null,
  };

  private stemGains: Record<StemType, GainNode | null> = {
    vocals: null,
    other: null,
    bass: null,
    drums: null,
  };

  private rhythmFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;

  // Fallback Audio Nodes (cho bài chưa tách stems)
  private origSource: AudioBufferSourceNode | null = null;
  private fallbackFilter: BiquadFilterNode | null = null;

  // Buffer Cache (Single-Track Buffer Pool)
  private currentTrackId: string | null = null;
  private buffers: Record<StemType, AudioBuffer | null> = {
    vocals: null,
    other: null,
    bass: null,
    drums: null,
  };
  private originalBuffer: AudioBuffer | null = null;

  // Playback state
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private playbackStartTime: number = 0;
  private pausedAtOffset: number = 0;
  private currentEnergy: number = 0.0;
  private currentTrack: TrackMeta | null = null;
  private fallbackMode: "lofi" | "full" = "lofi";

  // Mixer Settings & State
  private mixerMode: MixerMode = "auto";
  private stemState: StemMixerState = {
    vocals: { volume: 1.0, muted: false, solo: false },
    other: { volume: 1.0, muted: false, solo: false },
    bass: { volume: 1.0, muted: false, solo: false },
    drums: { volume: 1.0, muted: false, solo: false },
  };

  private stateListeners: Set<() => void> = new Set();
  private onTrackEndedCallback: (() => void) | null = null;
  private isManuallyStopped: boolean = false;
  private activePlaybackToken: number = 0;

  constructor() {
    this.loadPersistedMixerState();
  }

  private loadPersistedMixerState(): void {
    try {
      const savedState = localStorage.getItem("adaptive_stem_mixer_state");
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.vocals && parsed.other && parsed.bass && parsed.drums) {
          this.stemState = parsed;
        }
      }
      const savedMode = localStorage.getItem("adaptive_stem_mixer_mode");
      if (savedMode === "auto" || savedMode === "manual") {
        this.mixerMode = savedMode;
      }
    } catch {
      // ignore
    }
  }

  private persistMixerState(): void {
    try {
      localStorage.setItem("adaptive_stem_mixer_state", JSON.stringify(this.stemState));
      localStorage.setItem("adaptive_stem_mixer_mode", this.mixerMode);
    } catch {
      // ignore
    }
  }

  public setOnTrackEnded(cb: (() => void) | null): void {
    this.onTrackEndedCallback = cb;
  }

  public subscribe(cb: () => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  private notifyListeners(): void {
    this.stateListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }

  public setFallbackMode(mode: "lofi" | "full"): void {
    this.fallbackMode = mode;
    if (this.isPlaying && !this.currentTrack?.has_stems) {
      this.applyFallbackParameters(this.currentEnergy, 0.2);
    }
  }

  public getFallbackMode(): "lofi" | "full" {
    return this.fallbackMode;
  }

  public getMixerMode(): MixerMode {
    return this.mixerMode;
  }

  public setMixerMode(mode: MixerMode): void {
    this.mixerMode = mode;
    this.persistMixerState();
    this.applyAudioGraph(0.3);
    this.notifyListeners();
  }

  public getStemState(): StemMixerState {
    return {
      vocals: { ...this.stemState.vocals },
      other: { ...this.stemState.other },
      bass: { ...this.stemState.bass },
      drums: { ...this.stemState.drums },
    };
  }

  public setStemVolume(stem: StemType, volume: number): void {
    this.stemState[stem].volume = Math.max(0.0, Math.min(1.0, volume));
    this.persistMixerState();
    this.applyAudioGraph(0.1);
    this.notifyListeners();
  }

  public toggleMute(stem: StemType): void {
    this.stemState[stem].muted = !this.stemState[stem].muted;
    this.persistMixerState();
    this.applyAudioGraph(0.3);
    this.notifyListeners();
  }

  public toggleSolo(stem: StemType): void {
    const nextVal = !this.stemState[stem].solo;
    this.stemState[stem].solo = nextVal;
    this.persistMixerState();
    this.applyAudioGraph(0.3);
    this.notifyListeners();
  }

  public applyPreset(presetId: PresetName): void {
    const preset = STEM_PRESETS[presetId];
    if (!preset) return;

    for (const s of ["vocals", "other", "bass", "drums"] as StemType[]) {
      this.stemState[s].volume = preset.gains[s];
      this.stemState[s].muted = preset.gains[s] === 0.0;
      this.stemState[s].solo = false;
    }

    this.persistMixerState();
    this.applyAudioGraph(0.3);
    this.notifyListeners();
  }

  public initContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public getContextState(): string {
    return this.audioCtx ? this.audioCtx.state : "uninitialized";
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer> {
    const ctx = this.initContext();
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Lỗi tải audio: ${resp.status} ${resp.statusText}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  public async playTrack(track: TrackMeta, offsetSec: number = 0): Promise<void> {
    this.initContext();
    this.stop();

    this.currentTrack = track;
    this.pausedAtOffset = offsetSec;

    // Giải phóng buffer cũ nếu đổi bài
    if (this.currentTrackId !== track.id) {
      this.buffers = { vocals: null, other: null, bass: null, drums: null };
      this.originalBuffer = null;
      this.currentTrackId = track.id;
    }

    this.isPlaying = true;
    this.isPaused = false;

    if (track.has_stems) {
      // Tải và giải mã 4 Stems đồng thời
      const needFetch = !this.buffers.vocals || !this.buffers.other || !this.buffers.bass || !this.buffers.drums;
      if (needFetch) {
        const [vocals, other, bass, drums] = await Promise.all([
          this.fetchAndDecode(`http://127.0.0.1:8000/api/tracks/${track.id}/audio/vocals`),
          this.fetchAndDecode(`http://127.0.0.1:8000/api/tracks/${track.id}/audio/other`),
          this.fetchAndDecode(`http://127.0.0.1:8000/api/tracks/${track.id}/audio/bass`),
          this.fetchAndDecode(`http://127.0.0.1:8000/api/tracks/${track.id}/audio/drums`),
        ]);
        this.buffers.vocals = vocals;
        this.buffers.other = other;
        this.buffers.bass = bass;
        this.buffers.drums = drums;
      }
      this.startStemsPlayback(offsetSec);
    } else {
      // Chế độ Fallback Lo-Fi tức thời (bài gốc)
      if (!this.originalBuffer) {
        this.originalBuffer = await this.fetchAndDecode(
          `http://127.0.0.1:8000/api/tracks/${track.id}/audio/original`
        );
      }
      this.startFallbackPlayback(offsetSec);
    }

    this.notifyListeners();
  }

  /**
   * Lập lịch phát 4 stems đồng bộ tuyệt đối tại audioCtx.currentTime + 0.1
   */
  private startStemsPlayback(offsetSec: number): void {
    if (
      !this.audioCtx ||
      !this.buffers.vocals ||
      !this.buffers.other ||
      !this.buffers.bass ||
      !this.buffers.drums
    ) {
      return;
    }

    const now = this.audioCtx.currentTime;

    // Master Gain
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, now);
    this.masterGain.connect(this.audioCtx.destination);

    // Dynamic Filter cho Drums & Bass
    this.rhythmFilter = this.audioCtx.createBiquadFilter();
    this.rhythmFilter.type = "lowpass";
    this.rhythmFilter.connect(this.masterGain);

    const stemTypes: StemType[] = ["vocals", "other", "bass", "drums"];

    // Tạo các AudioBufferSourceNode và GainNode với targetGain ban đầu được khóa chuẩn
    for (const stem of stemTypes) {
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.buffers[stem];
      this.sources[stem] = src;

      const gain = this.audioCtx.createGain();
      const initialGain = this.computeEffectiveGain(stem);
      gain.gain.setValueAtTime(initialGain, now);
      this.stemGains[stem] = gain;

      src.connect(gain);

      if (stem === "bass" || stem === "drums") {
        gain.connect(this.rhythmFilter);
      } else {
        gain.connect(this.masterGain);
      }
    }

    // Áp dụng thông số ban đầu
    this.applyAudioGraph(0.05);

    // Khóa pha 0ms: Xếp lịch chạy đồng thời tại 100ms trong tương lai
    const scheduledTime = now + 0.1;
    for (const stem of stemTypes) {
      this.sources[stem]?.start(scheduledTime, offsetSec);
    }

    this.playbackStartTime = scheduledTime - offsetSec;

    // Lắng nghe sự kiện kết thúc bài hát
    const token = ++this.activePlaybackToken;
    this.isManuallyStopped = false;
    this.sources.other?.addEventListener("ended", () => {
      if (this.activePlaybackToken === token && !this.isManuallyStopped) {
        if (this.onTrackEndedCallback) {
          this.onTrackEndedCallback();
        }
      }
    });
  }

  private startFallbackPlayback(offsetSec: number): void {
    if (!this.audioCtx || !this.originalBuffer) return;

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    this.masterGain.connect(this.audioCtx.destination);

    this.origSource = this.audioCtx.createBufferSource();
    this.origSource.buffer = this.originalBuffer;

    this.fallbackFilter = this.audioCtx.createBiquadFilter();
    this.fallbackFilter.type = "lowpass";

    this.origSource.connect(this.fallbackFilter);
    this.fallbackFilter.connect(this.masterGain);

    this.applyFallbackParameters(this.currentEnergy, 0.05);

    const scheduledTime = this.audioCtx.currentTime + 0.1;
    this.origSource.start(scheduledTime, offsetSec);
    this.playbackStartTime = scheduledTime - offsetSec;

    const token = ++this.activePlaybackToken;
    this.isManuallyStopped = false;
    this.origSource.addEventListener("ended", () => {
      if (this.activePlaybackToken === token && !this.isManuallyStopped) {
        if (this.onTrackEndedCallback) {
          this.onTrackEndedCallback();
        }
      }
    });
  }

  public setEnergy(energy: number, rampTime: number = 1.0): void {
    this.currentEnergy = Math.max(0.0, Math.min(1.0, energy));
    if (!this.audioCtx || !this.isPlaying) return;

    if (this.currentTrack?.has_stems) {
      this.applyAudioGraph(rampTime);
    } else {
      this.applyFallbackParameters(this.currentEnergy, rampTime);
    }
  }

  private computeEffectiveGain(stem: StemType): number {
    const state = this.stemState[stem];
    const anySolo = Object.values(this.stemState).some((s) => s.solo);

    if (anySolo && !state.solo) {
      return 0.0;
    }
    if (state.muted) {
      return 0.0;
    }

    const baseVol = state.volume;

    // Chế độ Manual Mixer: hoàn toàn theo fader người dùng
    if (this.mixerMode === "manual") {
      return baseVol;
    }

    // Chế độ Auto Adaptive:
    // Vocals & Other: giữ nguyên âm sắc giai điệu mộc mạc
    if (stem === "vocals" || stem === "other") {
      return baseVol;
    }

    // Drums & Bass: điều chế nhịp nhàng theo mức năng lượng
    // Deep focus (0.0) -> tiết tấu êm nhẹ
    // Overdrive (1.0) -> bùng nổ 100% fader
    const rhythmScale = Math.max(0.08, this.currentEnergy);
    return baseVol * rhythmScale;
  }

  private applyAudioGraph(rampTime: number): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    // 1. Cập nhật Gain cho từng stem
    const stemTypes: StemType[] = ["vocals", "other", "bass", "drums"];
    for (const stem of stemTypes) {
      const gainNode = this.stemGains[stem];
      if (gainNode) {
        const targetGain = this.computeEffectiveGain(stem);
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(targetGain, now + rampTime);
      }
    }

    // 2. Cập nhật Lowpass Filter cho Drums & Bass
    if (this.rhythmFilter) {
      let targetFreq = 20000;
      if (this.mixerMode === "auto") {
        // Tần số cắt mở dần: 350Hz (năng lượng 0) -> 20,000Hz (năng lượng >= 0.8)
        targetFreq = 350 + Math.min(1.0, this.currentEnergy / 0.8) * 19650;
      }
      this.rhythmFilter.frequency.cancelScheduledValues(now);
      this.rhythmFilter.frequency.exponentialRampToValueAtTime(
        Math.max(100, targetFreq),
        now + rampTime
      );
    }
  }

  private applyFallbackParameters(energy: number, rampTime: number): void {
    if (!this.audioCtx || !this.fallbackFilter) return;
    const now = this.audioCtx.currentTime;

    if (this.fallbackMode === "full") {
      this.fallbackFilter.frequency.cancelScheduledValues(now);
      this.fallbackFilter.frequency.linearRampToValueAtTime(20000, now + rampTime);
    } else {
      const targetFreq = 500 + energy * 19500;
      this.fallbackFilter.frequency.cancelScheduledValues(now);
      this.fallbackFilter.frequency.exponentialRampToValueAtTime(
        Math.max(100, targetFreq),
        now + rampTime
      );
    }
  }

  public pause(): void {
    if (!this.audioCtx || !this.isPlaying || this.isPaused) return;
    this.pausedAtOffset = this.getCurrentTime();
    this.stopSources();
    this.isPaused = true;
    this.notifyListeners();
  }

  public resume(): void {
    if (!this.currentTrack || !this.isPaused) return;
    this.playTrack(this.currentTrack, this.pausedAtOffset);
  }

  public seek(seconds: number): void {
    if (!this.currentTrack) return;
    this.pausedAtOffset = seconds;
    if (this.isPlaying && !this.isPaused) {
      this.playTrack(this.currentTrack, seconds);
    }
  }

  public stop(): void {
    this.stopSources();
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAtOffset = 0;
    this.notifyListeners();
  }

  private stopSources(): void {
    this.isManuallyStopped = true;
    this.activePlaybackToken++;
    try {
      this.sources.vocals?.stop();
      this.sources.other?.stop();
      this.sources.bass?.stop();
      this.sources.drums?.stop();
      this.origSource?.stop();
    } catch {
      // Bỏ qua nếu source chưa start
    }

    this.sources.vocals?.disconnect();
    this.sources.other?.disconnect();
    this.sources.bass?.disconnect();
    this.sources.drums?.disconnect();
    this.origSource?.disconnect();

    this.sources = { vocals: null, other: null, bass: null, drums: null };
    this.stemGains = { vocals: null, other: null, bass: null, drums: null };
    this.origSource = null;
    this.rhythmFilter = null;
  }

  public getCurrentTime(): number {
    if (!this.audioCtx) return 0;
    if (this.isPaused) return this.pausedAtOffset;
    if (!this.isPlaying) return 0;
    return Math.max(0, this.audioCtx.currentTime - this.playbackStartTime);
  }

  public getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: this.getCurrentTime(),
      energy: this.currentEnergy,
      track: this.currentTrack,
      mixerMode: this.mixerMode,
      stemState: this.getStemState(),
    };
  }
}

export const adaptiveEngine = new AdaptiveEngine();
