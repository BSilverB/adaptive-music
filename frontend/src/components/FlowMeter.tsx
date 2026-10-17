import React from "react";
import { Zap, ShieldCheck, Moon, Flame } from "lucide-react";
import type { ActivityState } from "../hooks/useDesktopSocket";

interface FlowMeterProps {
  activity: ActivityState;
  onTriggerBurst: () => void;
  onToggleAutoFatigue: (enabled: boolean) => void;
}

export const FlowMeter: React.FC<FlowMeterProps> = ({
  activity,
  onTriggerBurst,
  onToggleAutoFatigue,
}) => {
  const energy = activity.energy_level;

  // Xác định màu sắc chủ đạo theo 3 cấp độ
  let colorTheme = {
    ring: "border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.35)]",
    text: "text-emerald-400",
    bgBadge: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
    label: "DEEP FOCUS",
    desc: "Chỉ phát lớp giai điệu êm dịu (Calm Stem), triệt tiêu tiếng trống và lời để tập trung sâu.",
  };

  if (energy > 0.6) {
    colorTheme = {
      ring: "border-rose-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] animate-pulse",
      text: "text-rose-400",
      bgBadge: "bg-rose-950/60 border-rose-500/40 text-rose-300",
      label: activity.state === "BREAK_TIME" ? "MICRO-BREAK DROP" : "FULL OVERDRIVE",
      desc: "Bùng nổ toàn bộ Bass, Drums & Vocals để giải phóng năng lượng vận động!",
    };
  } else if (energy > 0.15) {
    colorTheme = {
      ring: "border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.4)]",
      text: "text-amber-400",
      bgBadge: "bg-amber-950/60 border-amber-500/40 text-amber-300",
      label: "FATIGUE NUDGE",
      desc: "Phát hiện nhịp thao tác chậm: Kích hoạt âm Bass trầm để đánh thức sự tỉnh táo tự nhiên.",
    };
  }

  const percentage = Math.round(energy * 100);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      {/* Trạng thái Badge */}
      <div
        className={`mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest uppercase transition-all duration-700 ${colorTheme.bgBadge}`}
      >
        {energy > 0.6 ? (
          <Flame className="h-4 w-4 animate-bounce text-rose-400" />
        ) : energy > 0.15 ? (
          <Zap className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-emerald-400" />
        )}
        <span>{colorTheme.label}</span>
      </div>

      {/* Vòng tròn Cyberpunk Glow Meter */}
      <div className="relative flex items-center justify-center">
        {/* Glow ngoài */}
        <div
          className={`relative flex h-56 w-56 items-center justify-center rounded-full border-4 bg-slate-950/90 transition-all duration-700 ${colorTheme.ring}`}
        >
          {/* Inner ring */}
          <div className="absolute inset-3 rounded-full border border-dashed border-slate-700/60" />

          {/* Sóng âm giả lập quay vòng */}
          <div className="flex flex-col items-center">
            <span className={`font-mono text-5xl font-black tracking-tighter ${colorTheme.text}`}>
              {percentage}%
            </span>
            <span className="mt-1 text-[11px] tracking-widest text-slate-400 uppercase">
              Energy Index
            </span>
            <span className="mt-2 text-xs font-mono text-slate-500">
              S(energy) = {energy.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Mô tả trạng thái âm thanh */}
      <p className="mt-5 max-w-md text-xs leading-relaxed text-slate-400">
        {colorTheme.desc}
      </p>

      {/* Nút điều khiển nhanh & Phím tắt */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        {/* Nút Overdrive */}
        <button
          onClick={onTriggerBurst}
          className="group relative flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-950/40 px-5 py-2.5 text-xs font-bold text-rose-300 transition-all hover:border-rose-400 hover:bg-rose-900/60 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95"
        >
          <Zap className="h-4 w-4 text-rose-400 transition-transform group-hover:scale-125" />
          <span>KÍCH HOẠT DROP-BEAT</span>
          <span className="rounded bg-rose-900/70 px-1.5 py-0.5 text-[10px] text-rose-300">
            Ctrl+Alt+Space
          </span>
        </button>

        {/* Toggle Auto-Fatigue */}
        <button
          onClick={() => onToggleAutoFatigue(!activity.auto_fatigue_enabled)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-all ${
            activity.auto_fatigue_enabled
              ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-300"
              : "border-slate-800 bg-slate-900/50 text-slate-500"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Tự động phát hiện uể oải:</span>
          <span className="font-bold">{activity.auto_fatigue_enabled ? "BẬT" : "TẮT"}</span>
        </button>
      </div>
    </div>
  );
};
