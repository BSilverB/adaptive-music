import React from "react";
import { Activity, Cpu, HardDrive, Sparkles, Wifi, Mic, MicOff, BarChart2, Scale } from "lucide-react";
import type { SystemState, QueueState } from "../hooks/useDesktopSocket";

interface GeekHUDProps {
  connected: boolean;
  system: SystemState;
  queue: QueueState;
  idleSeconds: number;
  micDuckingEnabled?: boolean;
  isSpeaking?: boolean;
  speechLevel?: number;
  flowRatio?: number;
  hasUpdate?: boolean;
  onToggleMicDucking?: () => void;
  onOpenDevWrapped?: () => void;
  onOpenLegal?: () => void;
  onOpenUpdateModal?: () => void;
}

export const GeekHUD: React.FC<GeekHUDProps> = ({
  connected,
  system,
  queue,
  idleSeconds,
  micDuckingEnabled = false,
  isSpeaking = false,
  flowRatio = 100,
  hasUpdate = false,
  onToggleMicDucking,
  onOpenDevWrapped,
  onOpenLegal,
  onOpenUpdateModal,
}) => {
  const formatIdle = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <header className="h-12 border-b border-cyan-900/40 bg-slate-950/90 px-4 backdrop-blur-md flex items-center select-none shrink-0 z-40">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 text-xs tracking-wider overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Brand / Logo - Cố định không co giãn */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                connected ? "bg-emerald-400" : "bg-rose-500"
              } opacity-75`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                connected ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>
          <span className="font-bold text-cyan-400">ADAPTIVE FLOW</span>
          <span className="text-slate-600">//</span>
          <button
            onClick={onOpenUpdateModal}
            className={`group flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold transition-all cursor-pointer ${
              hasUpdate
                ? "bg-amber-950/80 border border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse"
                : "bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:border-cyan-400 hover:bg-cyan-900/60"
            }`}
            title={hasUpdate ? "Có bản cập nhật mới! Bấm để xem" : "Phiên bản hiện tại. Bấm để kiểm tra cập nhật"}
          >
            <span>v1.0.2</span>
            {hasUpdate && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              </span>
            )}
          </button>
        </div>

        {/* Geek HUD Metrics - Một hàng duy nhất (flex-nowrap), không bao giờ nhảy dòng */}
        <div className="flex items-center gap-2 text-slate-300 shrink-0 font-mono text-[11px]">
          {/* Connection */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1 shrink-0">
            <Wifi className={`h-3 w-3 ${connected ? "text-emerald-400" : "text-rose-400"}`} />
            <span className="text-slate-400 text-[10px]">NET:</span>
            <span className={connected ? "text-emerald-400" : "text-rose-400"}>
              {connected ? "OK" : "OFFLINE"}
            </span>
          </div>

          {/* CPU (Tabular nums) */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1 shrink-0 min-w-[75px] justify-between">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3 text-cyan-400" />
              <span className="text-slate-400 text-[10px]">CPU</span>
            </div>
            <span className="font-semibold text-cyan-300 tabular-nums">
              {system.cpu_percent.toFixed(0)}%
            </span>
          </div>

          {/* RAM (Tabular nums) */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1 shrink-0 min-w-[95px] justify-between">
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3 text-cyan-400" />
              <span className="text-slate-400 text-[10px]">RAM</span>
            </div>
            <span className="font-semibold text-cyan-300 tabular-nums">
              {system.ram_percent.toFixed(0)}% <span className="text-[10px] text-slate-500 font-normal">({(system.ram_used_mb / 1024).toFixed(1)}G)</span>
            </span>
          </div>

          {/* AI Queue & Device */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1 shrink-0">
            <Sparkles className="h-3 w-3 text-fuchsia-400" />
            <span className="text-slate-400 text-[10px]">AI:</span>
            <span className="uppercase text-fuchsia-300">
              {queue.device.toUpperCase()}
              {queue.current_job ? " [SPLIT]" : " [IDLE]"}
            </span>
          </div>

          {/* System Idle Time (Zero Keylogger, cố định min-width) */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1 shrink-0 min-w-[85px] justify-between">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-amber-400" />
              <span className="text-slate-400 text-[10px]">IDLE</span>
            </div>
            <span className="font-semibold text-amber-300 tabular-nums">{formatIdle(idleSeconds)}</span>
          </div>

          {/* Meeting / Call Auto-Ducking Opt-in Toggle (Cố định width tránh co giật) */}
          {onToggleMicDucking && (
            <button
              onClick={onToggleMicDucking}
              className={`flex items-center justify-center gap-1.5 rounded border px-2.5 py-1 text-[11px] transition-all min-w-[105px] shrink-0 active:scale-95 ${
                micDuckingEnabled
                  ? isSpeaking
                    ? "border-amber-400 bg-amber-950/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : "border-emerald-500/50 bg-emerald-950/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
                  : "border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
              }`}
              title={
                micDuckingEnabled
                  ? isSpeaking
                    ? "Đang phát hiện tiếng nói / cuộc họp: Âm nhạc tự động hạ 10%"
                    : "Meeting Ducking đang BẬT: Sẽ tự động hạ 10% âm lượng khi bạn nói"
                  : "Bật tính năng tự động hạ âm lượng khi họp/nói chuyện (Bảo mật 100%, không ghi âm)"
              }
            >
              {micDuckingEnabled ? (
                <Mic className={`h-3 w-3 ${isSpeaking ? "text-amber-400" : "text-emerald-400"}`} />
              ) : (
                <MicOff className="h-3 w-3 text-slate-500" />
              )}
              <span className="font-mono font-semibold">
                {micDuckingEnabled ? (isSpeaking ? "ĐANG NÓI" : "MIC AUTO") : "MIC TẮT"}
              </span>
            </button>
          )}

          {/* Dev-Wrapped Analytics Button */}
          {onOpenDevWrapped && (
            <button
              onClick={onOpenDevWrapped}
              className="group flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-purple-950/60 px-2.5 py-1 text-[11px] font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)] transition-all hover:border-cyan-400 shrink-0 active:scale-95"
            >
              <BarChart2 className="h-3.5 w-3.5 text-cyan-400 transition-transform group-hover:scale-110" />
              <span>WRAPPED</span>
              <span className="rounded bg-cyan-900/60 px-1 py-0.2 font-mono text-[9px] text-cyan-300 tabular-nums">
                {flowRatio}%
              </span>
            </button>
          )}

          {/* Update Modal Button */}
          {onOpenUpdateModal && (
            <button
              onClick={onOpenUpdateModal}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all shrink-0 active:scale-95 cursor-pointer ${
                hasUpdate
                  ? "border-amber-500/60 bg-amber-950/60 text-amber-300 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)] hover:border-amber-400"
                  : "border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:text-white text-slate-400"
              }`}
              title={hasUpdate ? "Có bản cập nhật mới khả dụng!" : "Kiểm tra phiên bản mới"}
            >
              <Sparkles className={`h-3 w-3 ${hasUpdate ? "text-amber-400" : "text-cyan-400"}`} />
              <span className="hidden sm:inline">{hasUpdate ? "BẢN MỚI!" : "CẬP NHẬT"}</span>
            </button>
          )}

          {/* Legal & EULA Button */}
          {onOpenLegal && (
            <button
              onClick={onOpenLegal}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[11px] font-semibold text-slate-300 transition-all hover:border-cyan-500/50 hover:text-cyan-300 shrink-0 active:scale-95"
              title="Xem Thỏa thuận người dùng EULA & Giấy phép bản quyền (Meta Demucs MIT)"
            >
              <Scale className="h-3 w-3 text-slate-400" />
              <span>PHÁP LÝ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
