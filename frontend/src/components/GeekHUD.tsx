import React from "react";
import { Activity, Cpu, HardDrive, Sparkles, Wifi, Mic, MicOff, BarChart2 } from "lucide-react";
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
  onToggleMicDucking?: () => void;
  onOpenDevWrapped?: () => void;
}

export const GeekHUD: React.FC<GeekHUDProps> = ({
  connected,
  system,
  queue,
  idleSeconds,
  micDuckingEnabled = false,
  isSpeaking = false,
  flowRatio = 100,
  onToggleMicDucking,
  onOpenDevWrapped,
}) => {
  const formatIdle = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <header className="border-b border-cyan-900/40 bg-slate-950/80 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs tracking-wider">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
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
          <span className="text-slate-500">//</span>
          <span className="text-slate-400">BEAT ENGINE v2.0</span>
        </div>

        {/* Geek HUD Metrics */}
        <div className="flex flex-wrap items-center gap-4 text-slate-300">
          {/* Connection */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
            <Wifi className={`h-3 w-3 ${connected ? "text-emerald-400" : "text-rose-400"}`} />
            <span className="text-slate-400">NET:</span>
            <span className={connected ? "text-emerald-400" : "text-rose-400"}>
              {connected ? "127.0.0.1" : "OFFLINE"}
            </span>
          </div>

          {/* CPU */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
            <Cpu className="h-3 w-3 text-cyan-400" />
            <span className="text-slate-400">CPU:</span>
            <span className="font-semibold text-cyan-300">{system.cpu_percent}%</span>
          </div>

          {/* RAM */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
            <HardDrive className="h-3 w-3 text-cyan-400" />
            <span className="text-slate-400">RAM:</span>
            <span className="font-semibold text-cyan-300">
              {system.ram_used_mb}MB ({system.ram_percent}%)
            </span>
          </div>

          {/* AI Queue & Device */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
            <Sparkles className="h-3 w-3 text-fuchsia-400" />
            <span className="text-slate-400">AI:</span>
            <span className="uppercase text-fuchsia-300">
              {queue.device.toUpperCase()}
              {queue.current_job ? " [SPLITTING]" : " [IDLE]"}
            </span>
          </div>

          {/* System Idle Time (Zero Keylogger) */}
          <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
            <Activity className="h-3 w-3 text-amber-400" />
            <span className="text-slate-400">IDLE:</span>
            <span className="font-mono font-semibold text-amber-300">{formatIdle(idleSeconds)}</span>
          </div>

          {/* Meeting / Call Auto-Ducking Opt-in Toggle */}
          {onToggleMicDucking && (
            <button
              onClick={onToggleMicDucking}
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-all active:scale-95 ${
                micDuckingEnabled
                  ? isSpeaking
                    ? "border-amber-400 bg-amber-950/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
                    : "border-emerald-500/50 bg-emerald-950/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
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
                <Mic className={`h-3 w-3 ${isSpeaking ? "animate-bounce text-amber-400" : "text-emerald-400"}`} />
              ) : (
                <MicOff className="h-3 w-3 text-slate-500" />
              )}
              <span className="font-mono font-semibold">
                {micDuckingEnabled ? (isSpeaking ? "ĐANG NÓI (10%)" : "MIC DUCKING") : "MIC OFF"}
              </span>
            </button>
          )}

          {/* Dev-Wrapped Analytics Button */}
          {onOpenDevWrapped && (
            <button
              onClick={onOpenDevWrapped}
              className="group flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-purple-950/60 px-3 py-1 text-xs font-bold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95"
            >
              <BarChart2 className="h-3.5 w-3.5 text-cyan-400 transition-transform group-hover:scale-110" />
              <span>DEV-WRAPPED</span>
              <span className="rounded bg-cyan-900/60 px-1.5 py-0.2 font-mono text-[10px] text-cyan-300">
                {flowRatio}%
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
