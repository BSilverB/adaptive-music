import { useState, useEffect, useCallback } from "react";
import { Play, Pause, Power, Volume2, FastForward, Rewind } from "lucide-react";
import { GeekHUD } from "./components/GeekHUD";
import { FlowMeter } from "./components/FlowMeter";
import { ActiveStemMixer } from "./components/ActiveStemMixer";
import { PlaylistView } from "./components/PlaylistView";
import { useDesktopSocket } from "./hooks/useDesktopSocket";
import { adaptiveEngine } from "./audio/AdaptiveEngine";
import type { TrackMeta } from "./audio/AdaptiveEngine";

export function App() {
  const {
    connected,
    activity,
    system,
    queue,
    tracksCount,
    triggerBurst,
    toggleAutoFatigue,
    forceSyncDrive,
    setEngineMode,
  } = useDesktopSocket();

  const [engineReady, setEngineReady] = useState(false);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackMeta | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [fallbackMode, setFallbackMode] = useState<"lofi" | "full">("lofi");
  const [mixerMode, setMixerMode] = useState(adaptiveEngine.getMixerMode());
  const [stemState, setStemState] = useState(adaptiveEngine.getStemState());

  // Lắng nghe thay đổi trạng thái từ Audio Engine
  useEffect(() => {
    return adaptiveEngine.subscribe(() => {
      setMixerMode(adaptiveEngine.getMixerMode());
      setStemState(adaptiveEngine.getStemState());
    });
  }, []);

  // Lấy danh sách bài hát từ backend
  const fetchTracks = useCallback(async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/tracks");
      if (resp.ok) {
        const data = await resp.json();
        setTracks(data);
      }
    } catch {
      // Bỏ qua lỗi kết nối tạm thời
    }
  }, []);

  // Chỉ fetch bài hát khi khởi động hoặc khi số lượng bài trên backend thay đổi
  useEffect(() => {
    fetchTracks();
  }, [fetchTracks, tracksCount]);

  // Cập nhật mốc thời gian phát bài hát
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlaying) {
        setCurrentTime(adaptiveEngine.getCurrentTime());
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Lắng nghe phím tắt toàn cục (Ctrl + Alt + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === "Space") {
        e.preventDefault();
        triggerBurst(30);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerBurst]);

  // Nút mở khóa Autoplay Policy
  const handleInitializeEngine = () => {
    adaptiveEngine.initContext();
    setEngineReady(true);
  };

  const handlePlayTrack = async (track: TrackMeta) => {
    if (!engineReady) handleInitializeEngine();
    setCurrentTrack(track);
    setIsPlaying(true);
    await adaptiveEngine.playTrack(track, 0);
  };

  const handlePauseTrack = () => {
    adaptiveEngine.pause();
    setIsPlaying(false);
  };

  const handleResumeTrack = () => {
    adaptiveEngine.resume();
    setIsPlaying(true);
  };

  const handleAddYouTube = async (url: string) => {
    const resp = await fetch("http://127.0.0.1:8000/api/tracks/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || "Lỗi thêm video YouTube");
    }
    await fetchTracks();
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/tracks/${trackId}`, { method: "DELETE" });
      await fetchTracks();
    } catch (e) {
      console.error("Lỗi xóa bài:", e);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    adaptiveEngine.seek(val);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200">
      {/* 1. Header Geek HUD */}
      <GeekHUD
        connected={connected}
        system={system}
        queue={queue}
        idleSeconds={activity.idle_seconds}
      />

      {/* 2. Banner Vượt rào Autoplay Policy (Nếu chưa click) */}
      {!engineReady && (
        <div className="border-b border-cyan-500/30 bg-cyan-950/40 p-4 text-center">
          <button
            onClick={handleInitializeEngine}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400 bg-cyan-500 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.9)] active:scale-95"
          >
            <Power className="h-4 w-4" />
            <span>KÍCH HOẠT HỆ THỐNG ÂM THANH (START ENGINE)</span>
          </button>
          <p className="mt-1.5 text-[11px] text-cyan-300/80">
            Click để kích hoạt Web Audio API và cấp quyền phát âm thanh nền tự động
          </p>
        </div>
      )}

      {/* 3. Thân ứng dụng chính */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột Trái / Trung tâm: FlowMeter + ActiveStemMixer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col justify-center rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 backdrop-blur-md">
              <FlowMeter
                activity={activity}
                onTriggerBurst={() => triggerBurst(30)}
                onToggleAutoFatigue={toggleAutoFatigue}
              />
            </div>

            {/* Bàn Mini-Mixer 4 Kênh */}
            <ActiveStemMixer
              hasStems={Boolean(currentTrack?.has_stems)}
              mixerMode={mixerMode}
              stemState={stemState}
              energyLevel={activity.energy_level}
              onSetMixerMode={(mode) => adaptiveEngine.setMixerMode(mode)}
              onSetVolume={(stem, vol) => adaptiveEngine.setStemVolume(stem, vol)}
              onToggleMute={(stem) => adaptiveEngine.toggleMute(stem)}
              onToggleSolo={(stem) => adaptiveEngine.toggleSolo(stem)}
              onApplyPreset={(preset) => adaptiveEngine.applyPreset(preset)}
            />
          </div>

          {/* Cột Phải: Playlist Manager */}
          <div className="lg:col-span-5">
            <PlaylistView
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              engineMode={queue.engine_mode}
              pendingColabCount={queue.pending_colab_count}
              fallbackMode={fallbackMode}
              device={queue.device}
              onPlayTrack={handlePlayTrack}
              onPauseTrack={handlePauseTrack}
              onAddYouTube={handleAddYouTube}
              onDeleteTrack={handleDeleteTrack}
              onSetEngineMode={setEngineMode}
              onSetFallbackMode={(mode) => {
                setFallbackMode(mode);
                adaptiveEngine.setFallbackMode(mode);
              }}
              onForceSync={async () => {
                await forceSyncDrive();
                await fetchTracks();
              }}
            />
          </div>
        </div>

        {/* 4. Thanh phát nhạc cố định dưới đáy */}
        {currentTrack && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-cyan-900/40 bg-slate-950/90 p-3 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              {/* Thông tin bài đang phát */}
              <div className="flex items-center gap-3 min-w-[200px] flex-1">
                <div className="h-10 w-10 shrink-0 rounded bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
                  <Volume2 className="h-5 w-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {currentTrack.title}
                  </p>
                  <p className="text-[10px] text-cyan-400">
                    {currentTrack.has_stems
                      ? `Chế độ: 4 Stems Studio (${mixerMode === "auto" ? "Tự động" : "Bàn trộn"})`
                      : "Chế độ: Fallback Lo-Fi tức thời"}
                  </p>
                </div>
              </div>

              {/* Bộ điều khiển & Timeline */}
              <div className="flex flex-col items-center flex-2 max-w-md w-full">
                <div className="flex items-center gap-3 mb-1">
                  <button
                    onClick={() => {
                      const newTime = Math.max(0, currentTime - 10);
                      adaptiveEngine.seek(newTime);
                      setCurrentTime(newTime);
                    }}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="Lùi 10s"
                  >
                    <Rewind className="h-4 w-4" />
                  </button>

                  <button
                    onClick={isPlaying ? handlePauseTrack : handleResumeTrack}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                  >
                    {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      const newTime = Math.min(currentTrack.duration, currentTime + 10);
                      adaptiveEngine.seek(newTime);
                      setCurrentTime(newTime);
                    }}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="Tua 10s"
                  >
                    <FastForward className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex w-full items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={currentTrack.duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
                  />
                  <span>{formatDuration(currentTrack.duration)}</span>
                </div>
              </div>

              {/* Trạng thái năng lượng mini */}
              <div className="hidden sm:flex items-center gap-2 min-w-[150px] justify-end text-xs font-mono">
                <span className="text-slate-400">ENERGY:</span>
                <span className="font-bold text-cyan-400">
                  {Math.round(activity.energy_level * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default App;
