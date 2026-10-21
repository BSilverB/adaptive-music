import React from "react";
import {
  X,
  Flame,
  Brain,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { DailyFlowStats } from "../hooks/useFlowAnalytics";

interface DevWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayStats: DailyFlowStats;
  allStats: Record<string, DailyFlowStats>;
  topTracks: { id: string; title: string; minutes: number }[];
  flowRatio: number;
  onResetToday: () => void;
}

function formatDuration(totalSeconds: number): { hours: number; minutes: number; text: string } {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return { hours, minutes, text: `${hours}h ${minutes}m` };
  }
  return { hours: 0, minutes, text: `${minutes} phút` };
}

export const DevWrappedModal: React.FC<DevWrappedModalProps> = ({
  isOpen,
  onClose,
  todayStats,
  allStats,
  topTracks,
  flowRatio,
  onResetToday,
}) => {
  if (!isOpen) return null;

  const totalTime = formatDuration(todayStats.totalListeningSeconds);
  const focusTime = formatDuration(todayStats.deepFocusSeconds);

  // Lấy dữ liệu 7 ngày gần nhất để vẽ mini GitHub-style heatmap
  const last7Days: { dateStr: string; dayLabel: string; minutes: number; level: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const dayLabel = i === 0 ? "Nay" : d.toLocaleDateString("vi-VN", { weekday: "short" });
    const stat = allStats[key];
    const mins = stat ? Math.round(stat.deepFocusSeconds / 60) : 0;
    let level = 0;
    if (mins > 120) level = 4;
    else if (mins > 60) level = 3;
    else if (mins > 30) level = 2;
    else if (mins > 0) level = 1;

    last7Days.push({ dateStr: key, dayLabel, minutes: mins, level });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#0e1322] via-[#090d16] to-[#07090e] p-6 shadow-[0_0_60px_rgba(6,182,212,0.25)] text-slate-100">
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold uppercase tracking-wider text-cyan-300">
                  Dev-Wrapped & Bản Đồ Năng Suất
                </h2>
                <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  {todayStats.date}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Thống kê trạng thái Hyperfocus & nhịp sinh học trong ngày
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-all hover:border-slate-700 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 4 Neon Cards Grid */}
        <div className="relative mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Card 1: Thời gian Flow Sâu */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-950/60 p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Hyperfocus Sâu
              </span>
              <Brain className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="my-2">
              <span className="font-mono text-3xl font-black text-emerald-300">
                {focusTime.text}
              </span>
              <p className="mt-1 text-[11px] text-slate-400">
                Chiếm <span className="font-bold text-emerald-400">{flowRatio}%</span> tổng thời gian nghe nhạc ({totalTime.text})
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-900 border border-emerald-500/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                style={{ width: `${flowRatio}%` }}
              />
            </div>
          </div>

          {/* Card 2: Vệ sĩ Cứu Buồn Ngủ */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-950/60 p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Cứu Buồn Ngủ Tự Động
              </span>
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div className="my-2">
              <span className="font-mono text-3xl font-black text-amber-300">
                {todayStats.fatigueNudgeCount} lần
              </span>
              <p className="mt-1 text-[11px] text-slate-400">
                Đã tự động bơm nhịp Bass kịp thời khi phát hiện bạn rời tay hoặc thao tác chậm
              </p>
            </div>
            <span className="text-[10px] font-mono text-amber-400/80">
              ⚡ Tiết kiệm ~{todayStats.fatigueNudgeCount * 10} phút xao nhãng
            </span>
          </div>

          {/* Card 3: Drop-Beat Bùng Nổ */}
          <div className="flex flex-col justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 to-slate-950/60 p-4 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Drop-Beat Ăn Mừng
              </span>
              <Flame className="h-4 w-4 text-rose-400" />
            </div>
            <div className="my-2">
              <span className="font-mono text-3xl font-black text-rose-300">
                {todayStats.manualBurstCount} lần
              </span>
              <p className="mt-1 text-[11px] text-slate-400">
                Những khoảnh khắc bùng nổ 100% khi fix xong bug hóc búa hoặc merge PR
              </p>
            </div>
            <span className="text-[10px] font-mono text-rose-400/80">
              🔥 Phím tắt Ctrl+Shift+D
            </span>
          </div>

          {/* Card 4: Top Bài Hát Giữ Flow */}
          <div className="flex flex-col justify-between rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-slate-950/60 p-4 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                Top Bài Hát Giữ Flow
              </span>
              <Trophy className="h-4 w-4 text-purple-400" />
            </div>
            <div className="my-1.5 flex flex-col gap-1.5 overflow-hidden">
              {topTracks.length > 0 ? (
                topTracks.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate pr-2 text-slate-300">
                      <span className="font-mono font-bold text-purple-400 mr-1.5">
                        #{idx + 1}
                      </span>
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {item.minutes}m
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Chưa có dữ liệu bài hát hôm nay
                </p>
              )}
            </div>
            <span className="text-[10px] font-mono text-purple-400/80">
              🎵 Được đo lường theo thời gian phát thực tế
            </span>
          </div>
        </div>

        {/* 7-Day GitHub Style Mini Heatmap */}
        <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
          <div className="flex items-center justify-between pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Nhịp Tập Trung 7 Ngày Gần Nhất
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              GitHub-style Flow Activity
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-1">
            {last7Days.map((d) => {
              const bgColors = [
                "bg-slate-900 border-slate-800 text-slate-600",
                "bg-emerald-950/60 border-emerald-500/30 text-emerald-400",
                "bg-emerald-800/60 border-emerald-400/40 text-emerald-300",
                "bg-emerald-600/70 border-emerald-300/50 text-white",
                "bg-cyan-500 border-cyan-300 text-slate-950 font-bold",
              ];
              return (
                <div
                  key={d.dateStr}
                  className="flex flex-col items-center gap-1.5"
                  title={`${d.dateStr}: ${d.minutes} phút Deep Focus`}
                >
                  <div
                    className={`flex h-11 w-full items-center justify-center rounded-lg border text-xs transition-all ${
                      bgColors[d.level]
                    }`}
                  >
                    {d.minutes > 0 ? `${d.minutes}m` : "-"}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {d.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-4">
          <button
            onClick={onResetToday}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 transition-colors hover:text-rose-400"
            title="Đặt lại thống kê của ngày hôm nay"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset hôm nay</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-5 py-2 text-xs font-bold text-cyan-300 transition-all hover:border-cyan-400 hover:bg-cyan-900/60 active:scale-95"
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
};
