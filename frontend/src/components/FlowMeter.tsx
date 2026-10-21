import React, { useEffect, useRef } from "react";
import { Zap, ShieldCheck, Moon, Flame, RefreshCw } from "lucide-react";
import type { ActivityState } from "../hooks/useDesktopSocket";
import { adaptiveEngine } from "../audio/AdaptiveEngine";

interface FlowMeterProps {
  activity: ActivityState;
  onTriggerBurst: () => void;
  onCancelBurst?: () => void;
  onToggleAutoFatigue: (enabled: boolean) => void;
}

export const FlowMeter: React.FC<FlowMeterProps> = ({
  activity,
  onTriggerBurst,
  onCancelBurst,
  onToggleAutoFatigue,
}) => {
  const energy = activity.energy_level;
  const isBursting =
    activity.state === "MANUAL_BURST" ||
    (activity.burst_remaining_seconds !== undefined && activity.burst_remaining_seconds > 0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activityRef = useRef(activity);

  // Luôn cập nhật ref để canvas loop đọc dữ liệu mới nhất mà KHÔNG cần restart loop
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  // 4-Stem Cyberpunk Reactive Visualizer Canvas Loop (Chạy 1 lần duy nhất, siêu mượt 60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let scanAngle = 0;

    // Bộ đệm làm mượt LERP (Linear Interpolation) - Triệt tiêu hoàn toàn hiện tượng giật giật
    let smoothDrums = 0;
    let smoothBass = 0;
    let smoothMelody = 0;
    let smoothVocals = 0;

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      const act = activityRef.current;
      const curEnergy = act.energy_level;
      const visData = adaptiveEngine.getVisualizerData();
      const isPlaying = visData.isPlaying;

      // Nội suy mượt mà (LERP) chuyển động dải tần
      smoothDrums += (visData.stems.drums - smoothDrums) * 0.12;
      smoothBass += (visData.stems.bass - smoothBass) * 0.10;
      smoothMelody += (visData.stems.other - smoothMelody) * 0.10;
      smoothVocals += (visData.stems.vocals - smoothVocals) * 0.10;

      // 1. Kinetic Aura (Hào quang gõ phím dịu mắt, không nhấp nháy chói)
      const isTypingActive = act.idle_seconds < 2.0;
      if (isTypingActive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 142, 0, Math.PI * 2);
        ctx.strokeStyle = curEnergy > 0.6 ? "rgba(244, 63, 94, 0.35)" : "rgba(6, 182, 212, 0.28)";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = curEnergy > 0.6 ? "#f43f5e" : "#06b6d4";
        ctx.stroke();
        ctx.restore();
      }

      // 2. Idle Radar Scanning Sweep (Quét êm dịu khi nhạc tắt)
      scanAngle += 0.02;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 134, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(51, 65, 85, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!isPlaying) {
        const sweepX = cx + Math.cos(scanAngle) * 134;
        const sweepY = cy + Math.sin(scanAngle) * 134;
        const grad = ctx.createLinearGradient(cx, cy, sweepX, sweepY);
        grad.addColorStop(0, "rgba(6, 182, 212, 0)");
        grad.addColorStop(1, "rgba(6, 182, 212, 0.2)");
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 134, scanAngle - 0.4, scanAngle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.restore();

      const time = performance.now();

      // 3. STEM 1: BASS RING (Tím / Hổ phách - Sóng trầm uốn lượn mượt mà)
      ctx.save();
      const bassRadius = 118 + smoothBass * 5;
      ctx.beginPath();
      const bassSegments = 32;
      for (let i = 0; i <= bassSegments; i++) {
        const theta = (i / bassSegments) * Math.PI * 2;
        const wave = Math.sin(theta * 4 + time * 0.002) * (smoothBass * 4.5);
        const r = bassRadius + wave;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.35 + smoothBass * 0.45})`;
      ctx.lineWidth = 2 + smoothBass * 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#f59e0b";
      ctx.stroke();
      ctx.restore();

      // 4. STEM 2: MELODY RING (Xanh lục ngọc Emerald - Dải trung thanh thoát)
      ctx.save();
      const melodyRadius = 125 + smoothMelody * 4;
      ctx.beginPath();
      const melodySegments = 36;
      for (let i = 0; i <= melodySegments; i++) {
        const theta = (i / melodySegments) * Math.PI * 2;
        const wave = Math.cos(theta * 6 - time * 0.0025) * (smoothMelody * 4);
        const r = melodyRadius + wave;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.35 + smoothMelody * 0.45})`;
      ctx.lineWidth = 1.8 + smoothMelody * 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#10b981";
      ctx.stroke();
      ctx.restore();

      // 5. STEM 3: VOCALS RING (Cyan Electric - Dải cao trong trẻo)
      ctx.save();
      const vocalsRadius = 131 + smoothVocals * 3.5;
      ctx.beginPath();
      const vocalSegments = 30;
      for (let i = 0; i <= vocalSegments; i++) {
        const theta = (i / vocalSegments) * Math.PI * 2;
        const wave = Math.sin(theta * 8 + time * 0.003) * (smoothVocals * 3);
        const r = vocalsRadius + wave;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.3 + smoothVocals * 0.45})`;
      ctx.lineWidth = 1.5 + smoothVocals * 1.2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#06b6d4";
      ctx.stroke();
      ctx.restore();

      // 6. STEM 4: DRUMS SPIKES (Đỏ Neon - Đập nhịp nhàng, có độ hãm êm)
      ctx.save();
      const drumSpikes = 24;
      const baseDrumsRadius = 136;
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.35 + smoothDrums * 0.55})`;
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#f43f5e";

      for (let i = 0; i < drumSpikes; i++) {
        const theta = (i / drumSpikes) * Math.PI * 2;
        const spikeLen = Math.max(2, smoothDrums * 12);
        const x1 = cx + Math.cos(theta) * baseDrumsRadius;
        const y1 = cy + Math.sin(theta) * baseDrumsRadius;
        const x2 = cx + Math.cos(theta) * (baseDrumsRadius + spikeLen);
        const y2 = cy + Math.sin(theta) * (baseDrumsRadius + spikeLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // 7. BINAURAL SPATIAL 8D SATELLITE (Quỹ đạo 360° xoay quanh đỉnh đầu)
      const spatial = adaptiveEngine.getSpatial8DCoordinates();
      if (spatial.enabled) {
        const orbitRadius = 146;

        ctx.save();
        // Vòng quỹ đạo đứt đoạn mờ ảo
        ctx.beginPath();
        ctx.setLineDash([3, 6]);
        ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Vệ tinh Melody (Xoay 360° HRTF quanh đầu)
        const melX = cx + Math.sin(spatial.melodyAngle) * orbitRadius;
        const melY = cy - Math.cos(spatial.melodyAngle) * orbitRadius;

        // Quầng hào quang vệ tinh
        ctx.beginPath();
        ctx.arc(melX, melY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
        ctx.fill();

        // Nhân vệ tinh phát sáng Neon Emerald
        ctx.beginPath();
        ctx.arc(melX, melY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#34d399";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#10b981";
        ctx.fill();

        // Nhãn vệ tinh 8D nhỏ xinh
        ctx.font = "9px monospace";
        ctx.fillStyle = "rgba(167, 243, 208, 0.85)";
        ctx.fillText("8D 🪐", melX + 7, melY + 3);

        // Hiển thị con lắc Vocals nếu ở chế độ Stage Ambience (±15°)
        if (spatial.vocalMode === "stage") {
          const voxX = cx + spatial.vocalsX * 55;
          const voxY = cy - orbitRadius;

          // Cung đung đưa trước trán
          ctx.beginPath();
          ctx.setLineDash([2, 3]);
          ctx.arc(cx, cy, orbitRadius, -Math.PI / 2 - 0.25, -Math.PI / 2 + 0.25);
          ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Chấm phát sáng con lắc Vocals
          ctx.beginPath();
          ctx.arc(voxX, voxY, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#22d3ee";
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#06b6d4";
          ctx.fill();
        }

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Xác định màu sắc chủ đạo theo 3 cấp độ (Cố định, chuyển màu êm ái)
  let colorTheme = {
    ring: "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]",
    text: "text-emerald-400",
    bgBadge: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
    label: "DEEP FOCUS",
    desc: "Chỉ phát lớp giai điệu êm dịu (Calm Stem), triệt tiêu tiếng trống và lời để tập trung sâu.",
  };

  if (energy > 0.6) {
    colorTheme = {
      ring: "border-rose-500 shadow-[0_0_40px_rgba(239,68,68,0.45)]",
      text: "text-rose-400",
      bgBadge: "bg-rose-950/60 border-rose-500/40 text-rose-300",
      label: activity.state === "BREAK_TIME" ? "MICRO-BREAK DROP" : "FULL OVERDRIVE",
      desc: "Bùng nổ toàn bộ Bass, Drums & Vocals để giải phóng năng lượng vận động!",
    };
  } else if (energy > 0.15) {
    colorTheme = {
      ring: "border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.35)]",
      text: "text-amber-400",
      bgBadge: "bg-amber-950/60 border-amber-500/40 text-amber-300",
      label: "FATIGUE NUDGE",
      desc: "Phát hiện nhịp thao tác chậm: Kích hoạt âm Bass trầm để đánh thức sự tỉnh táo tự nhiên.",
    };
  }

  const percentage = Math.round(energy * 100);
  const burstRemaining = activity.burst_remaining_seconds ?? 0;

  return (
    <div className="flex flex-col items-center justify-center p-4 text-center select-none">
      {/* Trạng thái Badge */}
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest uppercase transition-colors duration-500 ${colorTheme.bgBadge}`}
      >
        {energy > 0.6 ? (
          <Flame className="h-4 w-4 text-rose-400" />
        ) : energy > 0.15 ? (
          <Zap className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-emerald-400" />
        )}
        <span>{colorTheme.label}</span>
      </div>

      {/* Vòng tròn Cyberpunk Glow Meter tích hợp Canvas Visualizer 4-Stem */}
      <div className="relative flex h-[310px] w-[310px] items-center justify-center">
        {/* Canvas Visualizer phản ứng 4 dải âm thanh siêu mượt */}
        <canvas
          ref={canvasRef}
          width={310}
          height={310}
          className="absolute inset-0 z-0 pointer-events-none"
        />

        {/* Glow ngoài - Khóa kích thước tĩnh, chỉ chuyển màu mượt mà */}
        <div
          className={`relative z-10 flex h-52 w-52 items-center justify-center rounded-full border-4 bg-slate-950/95 backdrop-blur-md transition-[border-color,box-shadow] duration-500 ${colorTheme.ring}`}
        >
          {/* Inner dashed ring */}
          <div className="absolute inset-2.5 rounded-full border border-dashed border-slate-700/60" />

          {/* Sóng âm giả lập quay vòng */}
          <div className="flex flex-col items-center">
            <span className={`font-mono text-5xl font-black tracking-tighter ${colorTheme.text}`}>
              {percentage}%
            </span>
            <span className="mt-1 text-[10px] tracking-widest text-slate-400 uppercase">
              Energy Index
            </span>
            <span className="mt-1.5 text-[11px] font-mono text-slate-500">
              S(energy) = {energy.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Cyberpunk 4-Stem Reactive Spectrum Pills */}
      <div className="mt-2 flex items-center justify-center gap-3 font-mono text-[10px]">
        <span className="flex items-center gap-1 text-rose-400">
          <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          Drums
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          Bass
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Melody
        </span>
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          Vocals
        </span>
      </div>

      {/* Mô tả trạng thái âm thanh */}
      <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-400">
        {colorTheme.desc}
      </p>

      {/* BẢNG ĐIỀU KHIỂN: DROP-BEAT COUNTDOWN HOẶC NÚT KÍCH HOẠT */}
      {isBursting ? (
        <div className="mt-4 flex w-full max-w-md flex-col items-center gap-2.5 rounded-xl border border-rose-500/60 bg-rose-950/40 p-4 shadow-[0_0_35px_rgba(244,63,94,0.35)] backdrop-blur-md">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs tracking-wider uppercase">
            <Zap className="h-4 w-4 animate-spin text-rose-400" />
            <span>💥 DROP-BEAT OVERDRIVE ĐANG BÙNG NỔ!</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black text-rose-400">
              {burstRemaining > 0 ? burstRemaining.toFixed(1) : "15.0"}s
            </span>
            <span className="text-[11px] font-mono text-rose-300/70">
              còn lại trước khi hạ nhiệt
            </span>
          </div>

          {/* Thanh đếm ngược tiến trình thời gian thực */}
          <div className="h-2 w-full max-w-xs rounded-full border border-rose-800/80 bg-rose-950/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-rose-400 transition-all duration-200"
              style={{
                width: `${Math.min(100, Math.max(0, (burstRemaining / 15.0) * 100))}%`,
              }}
            />
          </div>

          {/* Nút Phục hồi tức thì về Deep Focus */}
          {onCancelBurst && (
            <button
              onClick={onCancelBurst}
              className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/70 px-4 py-2 text-xs font-bold text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all hover:border-emerald-400 hover:bg-emerald-900/80 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              <span>HỒI PHỤC VỀ DEEP FOCUS NGAY</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {/* Nút Kích hoạt Drop Beat */}
          <button
            onClick={onTriggerBurst}
            className="group relative flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-950/40 px-5 py-2.5 text-xs font-bold text-rose-300 transition-all hover:border-rose-400 hover:bg-rose-900/60 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95"
          >
            <Zap className="h-4 w-4 text-rose-400 transition-transform group-hover:scale-125" />
            <span>KÍCH HOẠT DROP-BEAT (15s)</span>
            <div className="flex items-center gap-1">
              <span className="rounded bg-rose-900/70 px-1.5 py-0.5 text-[10px] text-rose-300">
                Ctrl+Shift+D
              </span>
              <span className="rounded bg-rose-900/70 px-1.5 py-0.5 text-[10px] text-rose-300">
                Ctrl+Alt+Space
              </span>
            </div>
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
      )}
    </div>
  );
};
