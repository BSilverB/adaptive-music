import React from "react";
import {
  Mic,
  Music,
  Disc,
  Sliders,
  Zap,
  Sparkles,
  Layers,
  Radio,
  Brain,
  Wind,
  Headphones,
  Compass,
} from "lucide-react";
import {
  STEM_PRESETS,
  type StemType,
  type StemMixerState,
  type MixerMode,
  type PresetName,
  type AmbientType,
  type Spatial8DSpeed,
  type Spatial8DVocalMode,
  type Spatial8DState,
} from "../audio/AdaptiveEngine";

interface ActiveStemMixerProps {
  hasStems: boolean;
  mixerMode: MixerMode;
  stemState: StemMixerState;
  energyLevel: number;
  ambientType: AmbientType;
  ambientVolume: number;
  spatial8D: Spatial8DState;
  onSetMixerMode: (mode: MixerMode) => void;
  onSetVolume: (stem: StemType, vol: number) => void;
  onToggleMute: (stem: StemType) => void;
  onToggleSolo: (stem: StemType) => void;
  onApplyPreset: (presetId: PresetName) => void;
  onSetAmbientType: (type: AmbientType) => void;
  onSetAmbientVolume: (vol: number) => void;
  onSetSpatial8DEnabled: (enabled: boolean) => void;
  onSetSpatial8DSpeed: (speed: Spatial8DSpeed) => void;
  onSetSpatial8DVocalMode: (mode: Spatial8DVocalMode) => void;
}

const STEM_CONFIGS: Record<
  StemType,
  {
    name: string;
    subname: string;
    icon: React.ReactNode;
    color: {
      text: string;
      bg: string;
      border: string;
      accent: string;
      glow: string;
    };
  }
> = {
  vocals: {
    name: "Vocals",
    subname: "Giọng hát ca sĩ",
    icon: <Mic className="h-4 w-4" />,
    color: {
      text: "text-cyan-400",
      bg: "bg-cyan-950/40",
      border: "border-cyan-500/30",
      accent: "accent-cyan-400",
      glow: "shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    },
  },
  other: {
    name: "Melody",
    subname: "Giai điệu & Phím",
    icon: <Music className="h-4 w-4" />,
    color: {
      text: "text-emerald-400",
      bg: "bg-emerald-950/40",
      border: "border-emerald-500/30",
      accent: "accent-emerald-400",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    },
  },
  bass: {
    name: "Bass",
    subname: "Âm trầm & Dải sâu",
    icon: <Radio className="h-4 w-4" />,
    color: {
      text: "text-amber-400",
      bg: "bg-amber-950/40",
      border: "border-amber-500/30",
      accent: "accent-amber-400",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    },
  },
  drums: {
    name: "Drums",
    subname: "Bộ gõ & Tiết tấu",
    icon: <Disc className="h-4 w-4" />,
    color: {
      text: "text-rose-400",
      bg: "bg-rose-950/40",
      border: "border-rose-500/30",
      accent: "accent-rose-400",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    },
  },
};

export const ActiveStemMixer: React.FC<ActiveStemMixerProps> = ({
  hasStems,
  mixerMode,
  stemState,
  energyLevel,
  ambientType,
  ambientVolume,
  spatial8D,
  onSetMixerMode,
  onSetVolume,
  onToggleMute,
  onToggleSolo,
  onApplyPreset,
  onSetAmbientType,
  onSetAmbientVolume,
  onSetSpatial8DEnabled,
  onSetSpatial8DSpeed,
  onSetSpatial8DVocalMode,
}) => {
  const anySolo = Object.values(stemState).some((s) => s.solo);

  return (
    <div className="mt-4 w-full rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-md">
      {/* 1. Header: Tiêu đề + Chế độ Lai (Auto Adaptive vs Manual Mixer) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/60 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-wide text-slate-100 uppercase">
                Active Stem Mixer
              </h3>
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-cyan-300 border border-cyan-500/30">
                4-CH STEREO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Điều khiển độc lập 4 dải âm tách từ AI Demucs
            </p>
          </div>
        </div>

        {/* Switch Dual-Mode */}
        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-0.5">
          <button
            onClick={() => onSetMixerMode("auto")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              mixerMode === "auto"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Tự động đồng bộ Drums/Bass theo FlowMeter, nhưng vẫn tôn trọng stem bạn đã Mute"
          >
            <Zap className="h-3 w-3" />
            <span>Tự Động (Auto)</span>
          </button>
          <button
            onClick={() => onSetMixerMode("manual")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              mixerMode === "manual"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Khóa cứng 4 fader theo bàn tay bạn, tắt can thiệp tự động"
          >
            <Layers className="h-3 w-3" />
            <span>Thủ Công (Manual)</span>
          </button>
        </div>
      </div>

      {/* Thông báo Fallback nếu bài hát chưa có 4 stems */}
      {!hasStems && (
        <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-center">
          <p className="text-xs font-medium text-amber-300">
            ⚡ Bài hát này đang phát ở chế độ <b>Fallback Lo-Fi giả lập</b>.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Bàn trộn 4 Stems sẽ tự động mở khóa hoàn chỉnh ngay sau khi AI Demucs tách xong!
          </p>
        </div>
      )}

      {/* 2. Dải nút Preset 1-Click (0.3s Smooth Crossfade) */}
      <div className="my-4">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>PRESETS NHANH (1-CLICK CROSSFADE):</span>
          </span>
          {mixerMode === "auto" && (
            <span className="text-[10px] text-cyan-400 font-mono">
              [Auto: Drums/Bass scale theo Energy {Math.round(energyLevel * 100)}%]
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(STEM_PRESETS) as PresetName[]).map((pid) => {
            const p = STEM_PRESETS[pid];
            return (
              <button
                key={pid}
                onClick={() => onApplyPreset(pid)}
                className="group relative flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-left transition-all hover:border-cyan-500/40 hover:bg-slate-900 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95"
              >
                <span className="text-base">{p.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                    {p.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bàn 4 Channel Strips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {(["vocals", "other", "bass", "drums"] as StemType[]).map((stem) => {
          const cfg = STEM_CONFIGS[stem];
          const state = stemState[stem];
          const isStemMuted = state.muted || (anySolo && !state.solo);
          const percent = Math.round(state.volume * 100);

          return (
            <div
              key={stem}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-300 ${
                isStemMuted
                  ? "border-slate-800/50 bg-slate-950/40 opacity-60"
                  : `${cfg.color.border} ${cfg.color.bg} ${cfg.color.glow}`
              }`}
            >
              {/* Header của Kênh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                      isStemMuted
                        ? "border-slate-700 bg-slate-900 text-slate-500"
                        : `${cfg.color.border} ${cfg.color.text}`
                    }`}
                  >
                    {cfg.icon}
                  </div>
                  <div>
                    <h4
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isStemMuted ? "text-slate-500" : cfg.color.text
                      }`}
                    >
                      {cfg.name}
                    </h4>
                  </div>
                </div>

                {/* Nút Mute (M) & Solo (S) */}
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => onToggleMute(stem)}
                    className={`h-5 w-5 rounded border font-bold transition-all ${
                      state.muted
                        ? "border-rose-500 bg-rose-500 text-slate-950 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                    title={state.muted ? "Bật âm kênh này" : "Tắt âm kênh này (Mute)"}
                  >
                    M
                  </button>
                  <button
                    onClick={() => onToggleSolo(stem)}
                    className={`h-5 w-5 rounded border font-bold transition-all ${
                      state.solo
                        ? "border-amber-400 bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.7)]"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                    title={state.solo ? "Tắt Solo" : "Solo duy nhất kênh này"}
                  >
                    S
                  </button>
                </div>
              </div>

              {/* Fader & Chỉ số âm lượng */}
              <div className="my-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">LEVEL</span>
                  <span
                    className={`font-bold ${
                      isStemMuted ? "text-slate-500" : cfg.color.text
                    }`}
                  >
                    {isStemMuted ? "MUTED" : `${percent}%`}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.volume}
                  onChange={(e) => onSetVolume(stem, parseFloat(e.target.value))}
                  disabled={state.muted}
                  className={`h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-900 border border-slate-800 ${cfg.color.accent} disabled:opacity-40`}
                />
              </div>

              {/* Animated VU Meter giả lập phản ánh âm lượng */}
              <div className="flex items-center gap-1 h-1.5 w-full bg-slate-900 rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded ${
                    isStemMuted
                      ? "w-0 bg-slate-700"
                      : (stem === "drums" || stem === "bass") && mixerMode === "auto"
                      ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                      : "bg-cyan-400"
                  }`}
                  style={{
                    width: isStemMuted
                      ? "0%"
                      : (stem === "drums" || stem === "bass") && mixerMode === "auto"
                      ? `${Math.max(5, Math.round(state.volume * Math.max(0.1, energyLevel) * 100))}%`
                      : `${percent}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* TẦNG ÂM THANH BÍ MẬT: BINAURAL BEATS (40HZ GAMMA) & BROWN NOISE */}
      <div className="mt-4 rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/40 via-purple-950/25 to-slate-950/60 p-3.5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/40 bg-indigo-900/40 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.35)]">
              <Brain className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Tầng Âm Thanh Bí Mật
                </span>
                <span className="rounded bg-indigo-900/60 border border-indigo-500/30 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300">
                  HYPERFOCUS
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Sóng não 40Hz Gamma hoặc tiếng ồn nâu che lấp tạp âm, tự động hòa quyện dưới bài hát
              </p>
            </div>
          </div>

          {/* Selector 3 chế độ */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-[11px] font-medium">
            <button
              onClick={() => onSetAmbientType("off")}
              className={`rounded px-2.5 py-1 transition-all ${
                ambientType === "off"
                  ? "bg-slate-800 text-slate-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Tắt
            </button>
            <button
              onClick={() => onSetAmbientType("binaural_40hz")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                ambientType === "binaural_40hz"
                  ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)] font-semibold"
                  : "text-indigo-400/80 hover:text-indigo-300"
              }`}
              title="Phát sóng não 40Hz Gamma (Stereo lệch 40Hz giữa 2 tai để kích hoạt Hyperfocus)"
            >
              <Brain className="h-3 w-3" />
              <span>40Hz Gamma</span>
            </button>
            <button
              onClick={() => onSetAmbientType("brown_noise")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                ambientType === "brown_noise"
                  ? "bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.5)] font-semibold"
                  : "text-amber-400/80 hover:text-amber-300"
              }`}
              title="Phát tiếng ồn nâu êm dịu (Brown Noise)"
            >
              <Wind className="h-3 w-3" />
              <span>Brown Noise</span>
            </button>
          </div>
        </div>

        {/* Fader điều chỉnh âm lượng nền (1% - 15%) khi bật */}
        {ambientType !== "off" && (
          <div className="mt-3 flex items-center gap-3 border-t border-indigo-500/15 pt-2.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
              Âm lượng nền:
            </span>
            <input
              type="range"
              min="0.01"
              max="0.15"
              step="0.01"
              value={ambientVolume}
              onChange={(e) => onSetAmbientVolume(parseFloat(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-900 border border-slate-800 accent-indigo-400"
            />
            <span className="w-12 text-right font-mono text-[11px] font-bold text-indigo-400">
              {Math.round(ambientVolume * 100)}%
            </span>
            <span className="text-[10px] text-slate-500">
              (ngưỡng vàng 3–5%)
            </span>
          </div>
        )}
      </div>

      {/* KHÔNG GIAN ÂM THANH 8D (BINAURAL SPATIAL 8D) */}
      <div className="mt-4 rounded-xl border border-teal-500/25 bg-gradient-to-r from-teal-950/40 via-emerald-950/25 to-slate-950/60 p-3.5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                spatial8D.enabled
                  ? "border-teal-500/60 bg-teal-900/50 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.4)]"
                  : "border-slate-800 bg-slate-900/60 text-slate-500"
              }`}
            >
              <Headphones className={`h-4 w-4 ${spatial8D.enabled ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  Binaural Spatial 8D
                </span>
                <span className="rounded bg-teal-900/60 border border-teal-500/30 px-1.5 py-0.5 text-[9px] font-mono text-teal-300">
                  HRTF 3D
                </span>
                {spatial8D.enabled && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ĐANG XOAY
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Giai điệu lượn quanh đầu 360° | Drums & Bass ghim cố định tâm mỏ neo tránh chóng mặt
              </p>
            </div>
          </div>

          {/* Toggle Bật / Tắt 8D */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onSetSpatial8DEnabled(!spatial8D.enabled)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
                spatial8D.enabled
                  ? "bg-teal-600 text-white border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.4)]"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Compass className={`h-3.5 w-3.5 ${spatial8D.enabled ? "rotate-45 transition-transform" : ""}`} />
              <span>{spatial8D.enabled ? "8D ĐANG BẬT" : "BẬT 8D"}</span>
            </button>
          </div>
        </div>

        {/* Tùy chỉnh chi tiết khi 8D Bật */}
        {spatial8D.enabled && (
          <div className="mt-3.5 pt-3 border-t border-teal-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px]">
            {/* Tốc độ xoay (35s Chuẩn / 45s Êm dịu / 20s Bay bổng) */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
                Tốc độ quỹ đạo:
              </span>
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 font-medium">
                <button
                  onClick={() => onSetSpatial8DSpeed("slow")}
                  className={`rounded px-2.5 py-1 transition-all ${
                    spatial8D.speed === "slow"
                      ? "bg-teal-700 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="45 giây một vòng - Chậm rãi, êm dịu, thư thái sâu"
                >
                  45s Êm dịu
                </button>
                <button
                  onClick={() => onSetSpatial8DSpeed("normal")}
                  className={`rounded px-2.5 py-1 transition-all ${
                    spatial8D.speed === "normal"
                      ? "bg-teal-700 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="35 giây một vòng - Tỷ lệ vàng tự nhiên"
                >
                  35s Chuẩn
                </button>
                <button
                  onClick={() => onSetSpatial8DSpeed("fast")}
                  className={`rounded px-2.5 py-1 transition-all ${
                    spatial8D.speed === "fast"
                      ? "bg-teal-700 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="20 giây một vòng - Bay bổng, lãng đãng"
                >
                  20s Bay bổng
                </button>
              </div>
            </div>

            {/* Vocal Mode: Cố định tâm vs Stage Ambience */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
                Giọng hát (Vocal):
              </span>
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 font-medium">
                <button
                  onClick={() => onSetSpatial8DVocalMode("center")}
                  className={`rounded px-2.5 py-1 transition-all ${
                    spatial8D.vocalMode === "center"
                      ? "bg-cyan-700 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Ghim giọng hát tại chính giữa đỉnh đầu cùng Drums và Bass (Tối ưu Deep Work)"
                >
                  Cố định tâm
                </button>
                <button
                  onClick={() => onSetSpatial8DVocalMode("stage")}
                  className={`rounded px-2.5 py-1 transition-all ${
                    spatial8D.vocalMode === "stage"
                      ? "bg-cyan-700 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Đung đưa nhẹ ±15° trước mặt như ca sĩ đứng trên sân khấu (Stage Ambience)"
                >
                  Đung đưa nhẹ ±15°
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
