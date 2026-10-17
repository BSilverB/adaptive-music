import React from "react";
import { Activity, Cpu, HardDrive, Sparkles, Wifi } from "lucide-react";
import type { SystemState, QueueState } from "../hooks/useDesktopSocket";

interface GeekHUDProps {
  connected: boolean;
  system: SystemState;
  queue: QueueState;
  idleSeconds: number;
}

export const GeekHUD: React.FC<GeekHUDProps> = ({
  connected,
  system,
  queue,
  idleSeconds,
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
        </div>
      </div>
    </header>
  );
};
