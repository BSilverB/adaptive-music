/**
 * Adaptive Web Audio Engine (v3.0 - 4-Stem Active Mixer Edition)
 * Đảm bảo đồng bộ pha 0ms bằng cơ chế lập lịch phần cứng (Lookahead Scheduling audioCtx.currentTime + 0.1)
 * và quản lý RAM với cơ chế Single-Track Buffer Pool cho cả 4 stems: Vocals, Other, Bass, Drums.
 */

import { getApiBaseUrl } from "../config/api";

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
export type AmbientType = "off" | "binaural_40hz" | "brown_noise";
export type Spatial8DSpeed = "slow" | "normal" | "fast"; // 45s, 35s, 20s
export type Spatial8DVocalMode = "center" | "stage"; // Cố định tâm hoặc con lắc ±15°

export interface Spatial8DState {
  enabled: boolean;
  speed: Spatial8DSpeed;
  vocalMode: Spatial8DVocalMode;
}

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
  private playSessionId: number = 0;

  // Mixer Settings & State
  private mixerMode: MixerMode = "auto";
  private stemState: StemMixerState = {
    vocals: { volume: 1.0, muted: false, solo: false },
    other: { volume: 1.0, muted: false, solo: false },
    bass: { volume: 1.0, muted: false, solo: false },
    drums: { volume: 1.0, muted: false, solo: false },
  };

  // Ambient / Binaural Beats & Brown Noise Layer
  private ambientType: AmbientType = "off";
  private ambientVolume: number = 0.04; // 4% default
  private ambientGain: GainNode | null = null;
  private binauralOscLeft: OscillatorNode | null = null;
  private binauralOscRight: OscillatorNode | null = null;
  private brownNoiseSource: AudioBufferSourceNode | null = null;
  private brownNoiseFilter: BiquadFilterNode | null = null;

  // Meeting / Call Auto-Ducking Node
  private duckingGain: GainNode | null = null;
  private isDucked: boolean = false;

  // DJ Smart Transition Crossfade
  private djCrossfadeEnabled: boolean = true;
  private preloadedTrackId: string | null = null;
  private preloadedBuffers: Record<StemType, AudioBuffer | null> | null = null;
  private preloadedOriginalBuffer: AudioBuffer | null = null;

  // Binaural Spatial 8D Audio (HRTF 360° Orbit)
  private spatial8D: Spatial8DState = {
    enabled: false,
    speed: "normal",
    vocalMode: "center",
  };
  private pannerMelody: PannerNode | null = null;
  private pannerVocals: PannerNode | null = null;
  private spatialAnimId: number | null = null;
  private spatialAngleMelody: number = 0;
  private spatialAngleVocals: number = 0;
  private lastSpatialTimestamp: number = 0;

  // Real-time 4-Stem Analyser Nodes for Cyberpunk Visualizer
  private stemAnalysers: Record<StemType, AnalyserNode | null> = {
    vocals: null,
    other: null,
    bass: null,
    drums: null,
  };
  private masterAnalyser: AnalyserNode | null = null;
  private analyserFrequencyData: Record<StemType, Uint8Array<ArrayBuffer>> = {
    vocals: new Uint8Array(new ArrayBuffer(32)),
    other: new Uint8Array(new ArrayBuffer(32)),
    bass: new Uint8Array(new ArrayBuffer(32)),
    drums: new Uint8Array(new ArrayBuffer(32)),
  };
  private masterWaveformData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(64));

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
      const savedAmbientType = localStorage.getItem("adaptive_ambient_type");
      if (savedAmbientType === "off" || savedAmbientType === "binaural_40hz" || savedAmbientType === "brown_noise") {
        this.ambientType = savedAmbientType;
      }
      const savedAmbientVol = localStorage.getItem("adaptive_ambient_volume");
      if (savedAmbientVol !== null) {
        const parsedVol = parseFloat(savedAmbientVol);
        if (!isNaN(parsedVol)) {
          this.ambientVolume = Math.max(0.0, Math.min(0.20, parsedVol));
        }
      }
      const savedDJCrossfade = localStorage.getItem("adaptive_dj_crossfade");
      if (savedDJCrossfade !== null) {
        this.djCrossfadeEnabled = savedDJCrossfade === "true";
      }
      const saved8DEnabled = localStorage.getItem("adaptive_8d_enabled");
      if (saved8DEnabled !== null) {
        this.spatial8D.enabled = saved8DEnabled === "true";
      }
      const saved8DSpeed = localStorage.getItem("adaptive_8d_speed");
      if (saved8DSpeed === "slow" || saved8DSpeed === "normal" || saved8DSpeed === "fast") {
        this.spatial8D.speed = saved8DSpeed;
      }
      const saved8DVocal = localStorage.getItem("adaptive_8d_vocal_mode");
      if (saved8DVocal === "center" || saved8DVocal === "stage") {
        this.spatial8D.vocalMode = saved8DVocal;
      }
    } catch {
      // ignore
    }
  }

  private persistMixerState(): void {
    try {
      localStorage.setItem("adaptive_stem_mixer_state", JSON.stringify(this.stemState));
      localStorage.setItem("adaptive_stem_mixer_mode", this.mixerMode);
      localStorage.setItem("adaptive_ambient_type", this.ambientType);
      localStorage.setItem("adaptive_ambient_volume", this.ambientVolume.toString());
      localStorage.setItem("adaptive_dj_crossfade", this.djCrossfadeEnabled.toString());
      localStorage.setItem("adaptive_8d_enabled", this.spatial8D.enabled.toString());
      localStorage.setItem("adaptive_8d_speed", this.spatial8D.speed);
      localStorage.setItem("adaptive_8d_vocal_mode", this.spatial8D.vocalMode);
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

  // --- AMBIENT SOUND LAYER (BINAURAL BEATS & BROWN NOISE) ---
  public getAmbientType(): AmbientType {
    return this.ambientType;
  }

  public setAmbientType(type: AmbientType): void {
    this.ambientType = type;
    this.persistMixerState();
    this.initContext();
    this.applyAmbientGraph(0.5);
    this.notifyListeners();
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0.01, Math.min(0.20, vol));
    this.persistMixerState();
    this.applyAmbientGraph(0.2);
    this.notifyListeners();
  }

  private generateBrownNoiseBuffer(): AudioBuffer | null {
    if (!this.audioCtx) return null;
    const sampleRate = this.audioCtx.sampleRate;
    const bufferSize = sampleRate * 5; // 5s seamless loop
    const buffer = this.audioCtx.createBuffer(2, bufferSize, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
      }
    }
    return buffer;
  }

  private stopAmbientNodes(): void {
    if (this.binauralOscLeft) {
      try { this.binauralOscLeft.stop(); } catch { /* ignore */ }
      this.binauralOscLeft.disconnect();
      this.binauralOscLeft = null;
    }
    if (this.binauralOscRight) {
      try { this.binauralOscRight.stop(); } catch { /* ignore */ }
      this.binauralOscRight.disconnect();
      this.binauralOscRight = null;
    }
    if (this.brownNoiseSource) {
      try { this.brownNoiseSource.stop(); } catch { /* ignore */ }
      this.brownNoiseSource.disconnect();
      this.brownNoiseSource = null;
    }
    if (this.brownNoiseFilter) {
      this.brownNoiseFilter.disconnect();
      this.brownNoiseFilter = null;
    }
  }

  private applyAmbientGraph(rampTime: number = 0.4): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (!this.ambientGain) {
      this.ambientGain = this.audioCtx.createGain();
      this.ambientGain.gain.setValueAtTime(0.0, now);
      this.ambientGain.connect(this.duckingGain || this.audioCtx.destination);
    }

    if (this.ambientType === "off" || (!this.isPlaying && !this.isPaused)) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.linearRampToValueAtTime(0.0, now + rampTime);
      setTimeout(() => {
        if (this.ambientType === "off" || (!this.isPlaying && !this.isPaused)) {
          this.stopAmbientNodes();
        }
      }, rampTime * 1000 + 50);
      return;
    }

    // Auto-duck âm thanh bí mật khi bùng nổ Overdrive / Drop Beat để dồn lực vào tiếng đập
    const isHighEnergy = this.currentEnergy > 0.6;
    const targetGain = isHighEnergy ? 0.0 : this.ambientVolume;

    if (this.ambientType === "binaural_40hz") {
      if (!this.binauralOscLeft || !this.binauralOscRight) {
        this.stopAmbientNodes();
        const merger = this.audioCtx.createChannelMerger(2);

        // 200 Hz Left, 240 Hz Right -> Độ lệch 40 Hz Gamma kích hoạt Hyperfocus
        const oscL = this.audioCtx.createOscillator();
        oscL.type = "sine";
        oscL.frequency.setValueAtTime(200, now);

        const oscR = this.audioCtx.createOscillator();
        oscR.type = "sine";
        oscR.frequency.setValueAtTime(240, now);

        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(this.ambientGain);

        oscL.start(now);
        oscR.start(now);

        this.binauralOscLeft = oscL;
        this.binauralOscRight = oscR;
      }
    } else if (this.ambientType === "brown_noise") {
      if (!this.brownNoiseSource) {
        this.stopAmbientNodes();
        const noiseBuf = this.generateBrownNoiseBuffer();
        if (noiseBuf) {
          const src = this.audioCtx.createBufferSource();
          src.buffer = noiseBuf;
          src.loop = true;

          const filter = this.audioCtx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(800, now);

          src.connect(filter);
          filter.connect(this.ambientGain);
          src.start(now);

          this.brownNoiseSource = src;
          this.brownNoiseFilter = filter;
        }
      }
    }

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.linearRampToValueAtTime(targetGain, now + rampTime);
  }

  // --- 4-STEM CYBERPUNK VISUALIZER DATA ACCESSOR ---
  public getVisualizerData(): {
    stems: Record<StemType, number>;
    masterLevel: number;
    frequencies: Record<StemType, Uint8Array>;
    waveform: Uint8Array;
    isPlaying: boolean;
  } {
    const res = {
      stems: { vocals: 0, other: 0, bass: 0, drums: 0 },
      masterLevel: 0,
      frequencies: this.analyserFrequencyData,
      waveform: this.masterWaveformData,
      isPlaying: this.isPlaying && !this.isPaused,
    };

    if (!this.audioCtx || !this.isPlaying || this.isPaused) {
      return res;
    }

    if (this.masterAnalyser) {
      this.masterAnalyser.getByteTimeDomainData(this.masterWaveformData);
      let sum = 0;
      for (let i = 0; i < this.masterWaveformData.length; i++) {
        const val = (this.masterWaveformData[i] - 128) / 128;
        sum += val * val;
      }
      res.masterLevel = Math.min(1.0, Math.sqrt(sum / this.masterWaveformData.length) * 2.5);
    }

    const stemTypes: StemType[] = ["vocals", "other", "bass", "drums"];
    for (const stem of stemTypes) {
      const analyser = this.stemAnalysers[stem];
      if (analyser) {
        const arr = this.analyserFrequencyData[stem];
        analyser.getByteFrequencyData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i];
        }
        res.stems[stem] = Math.min(1.0, (sum / (arr.length * 255)) * 1.8);
      } else if (res.masterLevel > 0) {
        res.stems[stem] = res.masterLevel * (stem === "bass" || stem === "drums" ? 0.8 : 0.6);
      }
    }

    return res;
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
    if (!this.duckingGain) {
      this.duckingGain = this.audioCtx.createGain();
      this.duckingGain.gain.setValueAtTime(this.isDucked ? 0.10 : 1.0, this.audioCtx.currentTime);
      this.duckingGain.connect(this.audioCtx.destination);
    }
    this.setupSpatialListener();
    return this.audioCtx;
  }

  // --- MEETING / CALL AUTO-DUCKING CONTROLS ---
  public setDucking(ducked: boolean): void {
    this.isDucked = ducked;
    if (!this.audioCtx) return;
    this.initContext();
    if (!this.duckingGain) return;
    const now = this.audioCtx.currentTime;
    this.duckingGain.gain.cancelScheduledValues(now);
    if (ducked) {
      this.duckingGain.gain.linearRampToValueAtTime(0.10, now + 0.3);
    } else {
      this.duckingGain.gain.linearRampToValueAtTime(1.0, now + 1.2);
    }
    this.notifyListeners();
  }

  public getIsDucked(): boolean {
    return this.isDucked;
  }

  // --- SMART DJ BEAT-MATCHED CROSSFADE CONTROLS ---
  public setDJCrossfadeEnabled(enabled: boolean): void {
    this.djCrossfadeEnabled = enabled;
    this.persistMixerState();
    this.notifyListeners();
  }

  public getDJCrossfadeEnabled(): boolean {
    return this.djCrossfadeEnabled;
  }

  public async preloadTrack(track: TrackMeta): Promise<void> {
    if (this.currentTrackId === track.id || this.preloadedTrackId === track.id) return;
    try {
      this.initContext();
      if (track.has_stems) {
        const [vocals, other, bass, drums] = await Promise.all([
          this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/vocals`),
          this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/other`),
          this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/bass`),
          this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/drums`),
        ]);
        this.preloadedBuffers = { vocals, other, bass, drums };
        this.preloadedOriginalBuffer = null;
      } else {
        this.preloadedOriginalBuffer = await this.fetchAndDecode(
          `${getApiBaseUrl()}/api/tracks/${track.id}/audio/original`
        );
        this.preloadedBuffers = null;
      }
      this.preloadedTrackId = track.id;
    } catch {
      // Bỏ qua lỗi preload nếu có, fallback tải trực tiếp
    }
  }

  public async playWithDJCrossfade(nextTrack: TrackMeta): Promise<void> {
    if (!this.audioCtx || !this.isPlaying || !this.currentTrack) {
      await this.playTrack(nextTrack, 0);
      return;
    }

    // 1. Fade-out nhanh mượt mà bài cũ trong 0.8s
    try {
      if (this.masterGain && this.audioCtx.state === "running") {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.01, now + 0.8);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch {
      // ignore
    }

    // 2. Dừng triệt để toàn bộ nguồn phát cũ để TUYỆT ĐỐI KHÔNG chồng âm thanh
    this.stopSources();

    // 3. Khởi chạy bài mới sạch sẽ từ mốc 0:00
    await this.playTrack(nextTrack, 0);

    // 4. Fade-in nhẹ 0.4s cho bài mới
    if (this.masterGain && this.audioCtx && this.audioCtx.state === "running") {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0.01, now);
      this.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.4);
    }
  }

  // --- BINAURAL SPATIAL 8D CONTROLS & LOGIC ---
  public setSpatial8DEnabled(enabled: boolean): void {
    if (this.spatial8D.enabled === enabled) return;
    this.spatial8D.enabled = enabled;
    this.persistMixerState();
    this.rebuildSpatialRouting();
    if (enabled && this.isPlaying && !this.isPaused) {
      this.startSpatialLoop();
    } else if (!enabled) {
      this.stopSpatialLoop();
    }
    this.notifyListeners();
  }

  public setSpatial8DSpeed(speed: Spatial8DSpeed): void {
    this.spatial8D.speed = speed;
    this.persistMixerState();
    this.notifyListeners();
  }

  public setSpatial8DVocalMode(mode: Spatial8DVocalMode): void {
    if (this.spatial8D.vocalMode === mode) return;
    this.spatial8D.vocalMode = mode;
    this.persistMixerState();
    this.rebuildSpatialRouting();
    this.notifyListeners();
  }

  public getSpatial8DState(): Spatial8DState {
    return { ...this.spatial8D };
  }

  public getSpatial8DCoordinates(): {
    melodyAngle: number;
    vocalsX: number;
    enabled: boolean;
    speed: Spatial8DSpeed;
    vocalMode: Spatial8DVocalMode;
  } {
    return {
      melodyAngle: this.spatialAngleMelody,
      vocalsX: 0.55 * Math.sin(this.spatialAngleVocals),
      enabled: this.spatial8D.enabled,
      speed: this.spatial8D.speed,
      vocalMode: this.spatial8D.vocalMode,
    };
  }

  private setupSpatialListener(): void {
    if (!this.audioCtx) return;
    const listener = this.audioCtx.listener;
    try {
      if (listener.positionX?.setValueAtTime) {
        const now = this.audioCtx.currentTime;
        listener.positionX.setValueAtTime(0, now);
        listener.positionY.setValueAtTime(0, now);
        listener.positionZ.setValueAtTime(0, now);
        listener.forwardX.setValueAtTime(0, now);
        listener.forwardY.setValueAtTime(0, now);
        listener.forwardZ.setValueAtTime(-1, now);
        listener.upX.setValueAtTime(0, now);
        listener.upY.setValueAtTime(1, now);
        listener.upZ.setValueAtTime(0, now);
      } else {
        (listener as any).setPosition(0, 0, 0);
        (listener as any).setOrientation(0, 0, -1, 0, 1, 0);
      }
    } catch {
      // ignore
    }
  }

  private startSpatialLoop(): void {
    if (this.spatialAnimId !== null) return;
    this.lastSpatialTimestamp = performance.now();

    const loop = (timestamp: number) => {
      this.spatialAnimId = requestAnimationFrame(loop);

      if (!this.audioCtx || !this.isPlaying || this.isPaused || !this.spatial8D.enabled) {
        return;
      }

      const dt = Math.min(0.1, (timestamp - this.lastSpatialTimestamp) / 1000);
      this.lastSpatialTimestamp = timestamp;

      // 45s (êm dịu) / 35s (chuẩn) / 20s (bay bổng)
      const period =
        this.spatial8D.speed === "slow"
          ? 45
          : this.spatial8D.speed === "fast"
          ? 20
          : 35;

      const angularVelocity = (2 * Math.PI) / period;
      this.spatialAngleMelody = (this.spatialAngleMelody + angularVelocity * dt) % (2 * Math.PI);

      const now = this.audioCtx.currentTime;

      // 1. Panner Melody (HRTF 360° Horizontal Ellipse)
      if (this.pannerMelody) {
        const rx = 2.2;
        const rz = 2.5;
        const x = rx * Math.sin(this.spatialAngleMelody);
        const z = -rz * Math.cos(this.spatialAngleMelody);
        const y = 0.15 * Math.sin(this.spatialAngleMelody);

        try {
          if (this.pannerMelody.positionX?.setValueAtTime) {
            this.pannerMelody.positionX.setValueAtTime(x, now);
            this.pannerMelody.positionY.setValueAtTime(y, now);
            this.pannerMelody.positionZ.setValueAtTime(z, now);
          } else {
            (this.pannerMelody as any).setPosition(x, y, z);
          }
        } catch { /* ignore */ }
      }

      // 2. Panner Vocals (Stage Pendulum ±15° trước mặt)
      if (this.pannerVocals && this.spatial8D.vocalMode === "stage") {
        const vocalAngularVelocity = (2 * Math.PI) / 25; // 25s
        this.spatialAngleVocals = (this.spatialAngleVocals + vocalAngularVelocity * dt) % (2 * Math.PI);
        const vx = 0.55 * Math.sin(this.spatialAngleVocals);
        const vz = -2.2;

        try {
          if (this.pannerVocals.positionX?.setValueAtTime) {
            this.pannerVocals.positionX.setValueAtTime(vx, now);
            this.pannerVocals.positionY.setValueAtTime(0, now);
            this.pannerVocals.positionZ.setValueAtTime(vz, now);
          } else {
            (this.pannerVocals as any).setPosition(vx, 0, vz);
          }
        } catch { /* ignore */ }
      }
    };

    this.spatialAnimId = requestAnimationFrame(loop);
  }

  private stopSpatialLoop(): void {
    if (this.spatialAnimId !== null) {
      cancelAnimationFrame(this.spatialAnimId);
      this.spatialAnimId = null;
    }
  }

  public rebuildSpatialRouting(): void {
    if (!this.audioCtx || !this.isPlaying || !this.currentTrack?.has_stems) return;

    // 1. Routing cho Melody (Other)
    const melodyAnalyser = this.stemAnalysers.other;
    if (melodyAnalyser && this.masterGain) {
      try {
        melodyAnalyser.disconnect();
      } catch {}

      if (this.pannerMelody) {
        try {
          this.pannerMelody.disconnect();
        } catch {}
        this.pannerMelody = null;
      }

      if (this.spatial8D.enabled) {
        const panner = this.audioCtx.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        this.pannerMelody = panner;

        melodyAnalyser.connect(panner);
        panner.connect(this.masterGain);
      } else {
        melodyAnalyser.connect(this.masterGain);
      }
    }

    // 2. Routing cho Vocals
    const vocalsAnalyser = this.stemAnalysers.vocals;
    if (vocalsAnalyser && this.masterGain) {
      try {
        vocalsAnalyser.disconnect();
      } catch {}

      if (this.pannerVocals) {
        try {
          this.pannerVocals.disconnect();
        } catch {}
        this.pannerVocals = null;
      }

      if (this.spatial8D.enabled && this.spatial8D.vocalMode === "stage") {
        const pannerV = this.audioCtx.createPanner();
        pannerV.panningModel = "HRTF";
        pannerV.distanceModel = "inverse";
        this.pannerVocals = pannerV;

        vocalsAnalyser.connect(pannerV);
        pannerV.connect(this.masterGain);
      } else {
        vocalsAnalyser.connect(this.masterGain);
      }
    }
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
    this.stopSources();

    const mySessionId = ++this.playSessionId;
    this.currentTrack = track;
    this.pausedAtOffset = offsetSec;
    this.playbackStartTime = this.audioCtx ? this.audioCtx.currentTime - offsetSec : 0;

    // Giải phóng buffer cũ hoặc tái sử dụng từ preload
    if (this.currentTrackId !== track.id) {
      if (this.preloadedTrackId === track.id) {
        this.buffers = this.preloadedBuffers || { vocals: null, other: null, bass: null, drums: null };
        this.originalBuffer = this.preloadedOriginalBuffer;
        this.preloadedTrackId = null;
        this.preloadedBuffers = null;
        this.preloadedOriginalBuffer = null;
      } else {
        this.buffers = { vocals: null, other: null, bass: null, drums: null };
        this.originalBuffer = null;
      }
      this.currentTrackId = track.id;
    }

    this.isPlaying = true;
    this.isPaused = false;

    try {
      if (track.has_stems) {
        // Tải và giải mã 4 Stems đồng thời
        const needFetch = !this.buffers.vocals || !this.buffers.other || !this.buffers.bass || !this.buffers.drums;
        if (needFetch) {
          const [vocals, other, bass, drums] = await Promise.all([
            this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/vocals`),
            this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/other`),
            this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/bass`),
            this.fetchAndDecode(`${getApiBaseUrl()}/api/tracks/${track.id}/audio/drums`),
          ]);

          // Nếu trong lúc tải mạng, người dùng đã bấm dừng hoặc chuyển bài khác -> HỦY NGAY LẬP TỨC
          if (this.playSessionId !== mySessionId || !this.isPlaying) {
            console.log(`[AudioEngine] Hủy phát stem ${track.id} vì phiên phát đã bị thay đổi.`);
            return;
          }

          this.buffers.vocals = vocals;
          this.buffers.other = other;
          this.buffers.bass = bass;
          this.buffers.drums = drums;
        }

        // Kiểm tra lại phiên phát
        if (this.playSessionId !== mySessionId || !this.isPlaying) return;

        // Dừng triệt để tất cả nguồn âm thanh đang phát trước khi kích hoạt
        this.stopSources();
        this.startStemsPlayback(offsetSec);
      } else {
        // Chế độ Fallback Lo-Fi tức thời (bài gốc)
        if (!this.originalBuffer) {
          const orig = await this.fetchAndDecode(
            `${getApiBaseUrl()}/api/tracks/${track.id}/audio/original`
          );
          if (this.playSessionId !== mySessionId || !this.isPlaying) {
            console.log(`[AudioEngine] Hủy phát fallback ${track.id} vì phiên phát đã bị thay đổi.`);
            return;
          }
          this.originalBuffer = orig;
        }

        if (this.playSessionId !== mySessionId || !this.isPlaying) return;

        this.stopSources();
        this.startFallbackPlayback(offsetSec);
      }
    } catch (err) {
      console.error(`[AudioEngine] Lỗi phát bài ${track.id}:`, err);
      this.isPlaying = false;
      this.isPaused = false;
      this.currentTrack = null;
      this.stopSources();
      this.notifyListeners();
      return;
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

    // Master Gain & Master Analyser
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, now);

    this.masterAnalyser = this.audioCtx.createAnalyser();
    this.masterAnalyser.fftSize = 64;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.duckingGain || this.audioCtx.destination);

    // Dynamic Filter cho Drums & Bass
    this.rhythmFilter = this.audioCtx.createBiquadFilter();
    this.rhythmFilter.type = "lowpass";
    this.rhythmFilter.connect(this.masterGain);

    const stemTypes: StemType[] = ["vocals", "other", "bass", "drums"];

    // Tạo các AudioBufferSourceNode, GainNode và AnalyserNode cho từng Stem
    for (const stem of stemTypes) {
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.buffers[stem];
      this.sources[stem] = src;

      const gain = this.audioCtx.createGain();
      const initialGain = this.computeEffectiveGain(stem);
      gain.gain.setValueAtTime(initialGain, now);
      this.stemGains[stem] = gain;

      // Stem Analyser Node
      const stemAnalyser = this.audioCtx.createAnalyser();
      stemAnalyser.fftSize = 64;
      stemAnalyser.smoothingTimeConstant = 0.8;
      this.stemAnalysers[stem] = stemAnalyser;

      src.connect(gain);
      gain.connect(stemAnalyser);

      if (stem === "bass" || stem === "drums") {
        stemAnalyser.connect(this.rhythmFilter);
      } else if (stem === "other") {
        if (this.spatial8D.enabled) {
          const panner = this.audioCtx.createPanner();
          panner.panningModel = "HRTF";
          panner.distanceModel = "inverse";
          panner.refDistance = 1;
          panner.maxDistance = 10000;
          panner.rolloffFactor = 1;
          panner.coneInnerAngle = 360;
          this.pannerMelody = panner;
          stemAnalyser.connect(panner);
          panner.connect(this.masterGain);
        } else {
          stemAnalyser.connect(this.masterGain);
        }
      } else if (stem === "vocals") {
        if (this.spatial8D.enabled && this.spatial8D.vocalMode === "stage") {
          const pannerV = this.audioCtx.createPanner();
          pannerV.panningModel = "HRTF";
          pannerV.distanceModel = "inverse";
          this.pannerVocals = pannerV;
          stemAnalyser.connect(pannerV);
          pannerV.connect(this.masterGain);
        } else {
          stemAnalyser.connect(this.masterGain);
        }
      }
    }

    // Áp dụng thông số ban đầu & kích hoạt Ambient Layer nếu bật
    this.applyAudioGraph(0.05);
    this.applyAmbientGraph(0.5);

    // Khóa pha 0ms: Xếp lịch chạy đồng thời tại 100ms trong tương lai
    const scheduledTime = now + 0.1;
    for (const stem of stemTypes) {
      this.sources[stem]?.start(scheduledTime, offsetSec);
    }

    this.playbackStartTime = scheduledTime - offsetSec;

    if (this.spatial8D.enabled) {
      this.startSpatialLoop();
    }

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

    this.masterAnalyser = this.audioCtx.createAnalyser();
    this.masterAnalyser.fftSize = 64;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.duckingGain || this.audioCtx.destination);

    this.origSource = this.audioCtx.createBufferSource();
    this.origSource.buffer = this.originalBuffer;

    this.fallbackFilter = this.audioCtx.createBiquadFilter();
    this.fallbackFilter.type = "lowpass";

    this.origSource.connect(this.fallbackFilter);
    this.fallbackFilter.connect(this.masterGain);

    this.applyFallbackParameters(this.currentEnergy, 0.05);
    this.applyAmbientGraph(0.5);

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
    if (!this.audioCtx) return;

    this.applyAmbientGraph(rampTime);

    if (!this.isPlaying) return;

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
    this.playSessionId++;
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
    this.playSessionId++;
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
    Object.keys(this.stemAnalysers).forEach((k) => {
      this.stemAnalysers[k as StemType]?.disconnect();
      this.stemAnalysers[k as StemType] = null;
    });
    this.masterAnalyser?.disconnect();
    this.masterAnalyser = null;
    this.origSource = null;
    this.rhythmFilter?.disconnect();
    this.rhythmFilter = null;
    this.fallbackFilter?.disconnect();
    this.fallbackFilter = null;
    this.masterGain?.disconnect();
    this.masterGain = null;
    this.stopSpatialLoop();
    this.pannerMelody?.disconnect();
    this.pannerMelody = null;
    this.pannerVocals?.disconnect();
    this.pannerVocals = null;
    this.applyAmbientGraph(0.3);
  }

  public getCurrentTime(): number {
    if (!this.audioCtx) return 0;
    if (this.isPaused) return this.pausedAtOffset;
    if (!this.isPlaying) return 0;
    if (this.playbackStartTime === 0) return this.pausedAtOffset;
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
      ambientType: this.ambientType,
      ambientVolume: this.ambientVolume,
      isDucked: this.isDucked,
      djCrossfadeEnabled: this.djCrossfadeEnabled,
      spatial8D: this.getSpatial8DState(),
    };
  }
}

export const adaptiveEngine = new AdaptiveEngine();
