import React, { useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Music,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Cloud,
  Cpu,
  RefreshCw,
  ExternalLink,
  Radio,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import type { TrackMeta } from "../audio/AdaptiveEngine";

interface PlaylistViewProps {
  tracks: TrackMeta[];
  currentTrack: TrackMeta | null;
  isPlaying: boolean;
  engineMode: "COLAB_BATCH" | "LOCAL";
  pendingColabCount: number;
  fallbackMode: "lofi" | "full";
  device: string;
  onPlayTrack: (track: TrackMeta) => void;
  onPauseTrack: () => void;
  onAddYouTube: (url: string) => Promise<void>;
  onDeleteTrack?: (trackId: string) => Promise<void>;
  onSetEngineMode: (mode: "COLAB_BATCH" | "LOCAL") => void;
  onSetFallbackMode: (mode: "lofi" | "full") => void;
  onForceSync: () => Promise<void>;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  engineMode,
  pendingColabCount,
  fallbackMode,
  device,
  onPlayTrack,
  onPauseTrack,
  onAddYouTube,
  onDeleteTrack,
  onSetEngineMode,
  onSetFallbackMode,
  onForceSync,
}) => {
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCpuWarning, setShowCpuWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onAddYouTube(inputUrl.trim());
      setInputUrl("");
      setSuccessMsg("Đã nạp thành công! Các bài hát đang được tải audio và tự động đẩy lên Google Drive.");
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi thêm URL");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onForceSync();
    } finally {
      setTimeout(() => setSyncing(false), 600);
    }
  };

  const handleModeChange = (mode: "COLAB_BATCH" | "LOCAL") => {
    if (mode === "LOCAL" && device === "cpu") {
      setShowCpuWarning(true);
    } else {
      setShowCpuWarning(false);
    }
    onSetEngineMode(mode);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      {/* 1. Header & Engine Mode Switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
            Playlist ({tracks.length})
          </h2>
        </div>

        {/* Engine Mode Toggle */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
          <button
            onClick={() => handleModeChange("COLAB_BATCH")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              engineMode === "COLAB_BATCH"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cloud className="h-3 w-3" />
            <span>Colab Batch (GPU Cloud)</span>
          </button>

          <button
            onClick={() => handleModeChange("LOCAL")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              engineMode === "LOCAL"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="h-3 w-3" />
            <span>Local Machine</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo vàng thông minh khi chọn Local CPU */}
      {showCpuWarning && engineMode === "LOCAL" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-200">
              Hệ thống không tìm thấy GPU (CUDA)!
            </p>
            <p className="mt-0.5 text-[11px] text-amber-300/80 leading-relaxed">
              Tách nhạc bằng CPU sẽ khiến máy hoạt động ở mức 95–98% công suất, quạt hú và mất 6–10 phút/bài.
              Khuyến nghị dùng chế độ <strong>Colab Batch</strong> để máy luôn mượt mà.
            </p>
          </div>
        </div>
      )}

      {/* 2. Action Bar: Mở Colab + Nút Đồng bộ Force Sync */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
        <a
          href="https://colab.research.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 rounded-md border border-fuchsia-500/40 bg-fuchsia-950/30 px-3 py-1.5 text-xs font-semibold text-fuchsia-300 transition-all hover:border-fuchsia-400 hover:bg-fuchsia-900/50 hover:shadow-[0_0_12px_rgba(217,70,239,0.3)]"
        >
          <ExternalLink className="h-3.5 w-3.5 group-hover:scale-110" />
          <span>Mở Google Colab</span>
          {pendingColabCount > 0 && (
            <span className="rounded-full bg-fuchsia-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-950 animate-pulse">
              {pendingColabCount} bài chờ
            </span>
          )}
        </a>

        {/* Nút Force Sync */}
        <button
          onClick={handleSyncClick}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50"
          title="Quét lại thư mục Google Drive để nhận diện Stems mới tách"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-cyan-400" : ""}`} />
          <span>{syncing ? "Đang quét Drive..." : "Kiểm tra dữ liệu mới"}</span>
        </button>
      </div>

      {/* 3. Lựa chọn Chế độ chờ tách (Fallback Mode: Lo-Fi vs Bản Full) */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Radio className="h-3.5 w-3.5 text-amber-400" />
          <span>Chế độ khi chờ tách:</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetFallbackMode("lofi")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all ${
              fallbackMode === "lofi"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Lo-Fi Ambient (Mặc định)
          </button>
          <button
            onClick={() => onSetFallbackMode("full")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all ${
              fallbackMode === "full"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Bản Gốc (Full Dynamic)
          </button>
        </div>
      </div>

      {/* 4. Input URL YouTube */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Dán URL bài hát hoặc cả Playlist YouTube (playlist?list=...)"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          disabled={loading}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !inputUrl.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-950/50 px-4 py-2 text-xs font-semibold text-cyan-300 transition-all hover:border-cyan-400 hover:bg-cyan-900/60 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span>{loading ? "ĐANG NẠP..." : "THÊM BÀI"}</span>
        </button>
      </form>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-800/40 bg-rose-950/30 p-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 5. Danh sách Tracks */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {tracks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Chưa có bài hát nào trong playlist. Hãy dán link YouTube để bắt đầu trải nghiệm!
          </div>
        ) : (
          tracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`group flex items-center justify-between rounded-lg border p-3 transition-all ${
                  isCurrent
                    ? "border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40"
                }`}
              >
                {/* Thông tin bài */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <button
                    onClick={() => {
                      if (isCurrent && isPlaying) {
                        onPauseTrack();
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                      isCurrent
                        ? "border-cyan-400 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                        : "border-slate-700 bg-slate-800/80 text-slate-300 group-hover:border-cyan-500/60 group-hover:text-cyan-300"
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-semibold ${
                        isCurrent ? "text-cyan-300" : "text-slate-200 group-hover:text-white"
                      }`}
                      title={track.title}
                    >
                      {track.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{formatDuration(track.duration)}</span>
                      <span>•</span>
                      {track.has_stems ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> 2 STEMS SẴN SÀNG (320kbps)
                        </span>
                      ) : track.status === "WAITING_COLAB" ? (
                        <span className="flex items-center gap-1 font-medium text-amber-400">
                          <Cloud className="h-3 w-3 text-amber-400" />
                          CHỜ COLAB TÁCH ({fallbackMode === "full" ? "Bản Gốc Full" : "Lo-Fi"})
                        </span>
                      ) : track.status === "PROCESSING" ? (
                        <span className="flex items-center gap-1 font-medium text-fuchsia-400 animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" /> ĐANG TÁCH DEMUCS LOCAL
                        </span>
                      ) : (
                        <span className="font-medium text-amber-400">
                          FALLBACK ({fallbackMode === "full" ? "Bản Gốc Full" : "Lo-Fi"})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nút xóa bài hát */}
                {onDeleteTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTrack(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all"
                    title="Xóa bài khỏi danh sách"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
