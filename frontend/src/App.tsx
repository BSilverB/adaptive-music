import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  Power,
  Volume2,
  FastForward,
  Rewind,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
} from "lucide-react";
import { GeekHUD } from "./components/GeekHUD";
import { FlowMeter } from "./components/FlowMeter";
import { ActiveStemMixer } from "./components/ActiveStemMixer";
import { PlaylistView } from "./components/PlaylistView";
import { useDesktopSocket } from "./hooks/useDesktopSocket";
import { adaptiveEngine } from "./audio/AdaptiveEngine";
import type { TrackMeta, Playlist } from "./audio/AdaptiveEngine";

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
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>("default");
  const [currentTrack, setCurrentTrack] = useState<TrackMeta | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [fallbackMode, setFallbackMode] = useState<"lofi" | "full">("lofi");
  const [mixerMode, setMixerMode] = useState(adaptiveEngine.getMixerMode());
  const [stemState, setStemState] = useState(adaptiveEngine.getStemState());

  // Shuffle & Repeat states
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<"all" | "one" | "off">("all");
  const [shuffledTrackIds, setShuffledTrackIds] = useState<string[]>([]);

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

  // Lấy danh sách Playlists từ backend
  const fetchPlaylists = useCallback(async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/playlists");
      if (resp.ok) {
        const data = await resp.json();
        const plList: Playlist[] = Object.values(data.playlists || {});
        setPlaylists(plList);
        if (data.active_playlist_id && !activePlaylistId) {
          setActivePlaylistId(data.active_playlist_id);
        }
      }
    } catch {
      // Bỏ qua lỗi kết nối tạm thời
    }
  }, [activePlaylistId]);

  // Chỉ fetch bài hát & playlists khi khởi động hoặc khi số lượng bài trên backend thay đổi
  useEffect(() => {
    fetchTracks();
    fetchPlaylists();
  }, [fetchTracks, fetchPlaylists, tracksCount]);

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

  // Playlist hiện tại đang active
  const currentPlaylist = useMemo(() => {
    const found = playlists.find((p) => p.id === activePlaylistId) || playlists[0];
    if (found) {
      if (found.is_default && (!found.track_ids || found.track_ids.length === 0) && tracks.length > 0) {
        return { ...found, track_ids: tracks.map((t) => t.id) };
      }
      return found;
    }
    return {
      id: "default",
      name: "Thư viện chính",
      track_ids: tracks.map((t) => t.id),
      is_default: true,
    };
  }, [playlists, activePlaylistId, tracks]);

  const tracksMap = useMemo(() => {
    return new Map(tracks.map((t) => [t.id, t]));
  }, [tracks]);

  // Sinh danh sách Shuffled Queue khi bật Shuffle
  const generateShuffledQueue = useCallback(
    (trackIds: string[], currentId?: string | null): string[] => {
      const array = [...trackIds];
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      if (currentId && array.includes(currentId)) {
        const idx = array.indexOf(currentId);
        array.splice(idx, 1);
        array.unshift(currentId);
      }
      return array;
    },
    []
  );

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        setShuffledTrackIds(
          generateShuffledQueue(currentPlaylist.track_ids, currentTrack?.id)
        );
      }
      return nextVal;
    });
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === "all") return "one";
      if (prev === "one") return "off";
      return "all";
    });
  };

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

  // Chuyển sang bài tiếp theo (Next)
  const playNextTrack = useCallback(
    (autoTriggered = false) => {
      const queueList = isShuffle ? shuffledTrackIds : currentPlaylist.track_ids;
      if (queueList.length === 0) return;

      // Xử lý Repeat One khi bài hát chạy hết
      if (repeatMode === "one" && autoTriggered && currentTrack) {
        adaptiveEngine.playTrack(currentTrack, 0);
        setIsPlaying(true);
        return;
      }

      const currentIdx = currentTrack ? queueList.indexOf(currentTrack.id) : -1;
      let nextIdx = currentIdx + 1;

      if (nextIdx >= queueList.length) {
        if (repeatMode === "all") {
          nextIdx = 0; // Tự động quay lại từ đầu playlist
        } else {
          // repeatMode === "off" -> dừng lại khi hết danh sách
          adaptiveEngine.stop();
          setIsPlaying(false);
          return;
        }
      }

      const nextId = queueList[nextIdx];
      const nextTrack = tracksMap.get(nextId);
      if (nextTrack) {
        handlePlayTrack(nextTrack);
      }
    },
    [
      isShuffle,
      shuffledTrackIds,
      currentPlaylist.track_ids,
      repeatMode,
      currentTrack,
      tracksMap,
    ]
  );

  // Chuyển sang bài trước đó (Prev)
  const playPrevTrack = useCallback(() => {
    const queueList = isShuffle ? shuffledTrackIds : currentPlaylist.track_ids;
    if (queueList.length === 0) return;

    const currentIdx = currentTrack ? queueList.indexOf(currentTrack.id) : -1;
    let prevIdx = currentIdx - 1;
    if (prevIdx < 0) {
      prevIdx = queueList.length - 1;
    }

    const prevId = queueList[prevIdx];
    const prevTrack = tracksMap.get(prevId);
    if (prevTrack) {
      handlePlayTrack(prevTrack);
    }
  }, [isShuffle, shuffledTrackIds, currentPlaylist.track_ids, currentTrack, tracksMap]);

  // Hook sự kiện bài hát chạy hết để tự động phát tiếp
  useEffect(() => {
    adaptiveEngine.setOnTrackEnded(() => {
      playNextTrack(true);
    });
  }, [playNextTrack]);

  // Playlists Operations
  const handleSelectPlaylist = async (playlistId: string) => {
    setActivePlaylistId(playlistId);
    try {
      await fetch("http://127.0.0.1:8000/api/playlists/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
    } catch {
      // ignore
    }
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && isShuffle) {
      setShuffledTrackIds(generateShuffledQueue(pl.track_ids, currentTrack?.id));
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    const resp = await fetch("http://127.0.0.1:8000/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, track_ids: [] }),
    });
    if (resp.ok) {
      const data = await resp.json();
      await fetchPlaylists();
      if (data.playlist?.id) {
        setActivePlaylistId(data.playlist.id);
      }
    }
  };

  const handleRenamePlaylist = async (playlistId: string, newName: string) => {
    await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    await fetchPlaylists();
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}`, {
      method: "DELETE",
    });
    setActivePlaylistId("default");
    await fetchPlaylists();
  };

  const handleReorderTracks = async (playlistId: string, trackIds: string[]) => {
    // Optimistic update
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === playlistId ? { ...pl, track_ids: trackIds } : pl))
    );
    await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    });
    await fetchPlaylists();
  };

  const handleAddTracksToPlaylist = async (playlistId: string, trackIdsToAdd: string[]) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const updatedIds = [...pl.track_ids, ...trackIdsToAdd];
    await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: updatedIds }),
    });
    await fetchPlaylists();
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackIdToRemove: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const updatedIds = pl.track_ids.filter((id) => id !== trackIdToRemove);
    await fetch(`http://127.0.0.1:8000/api/playlists/${playlistId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: updatedIds }),
    });
    await fetchPlaylists();
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
    await fetchPlaylists();
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/tracks/${trackId}`, { method: "DELETE" });
      await fetchTracks();
      await fetchPlaylists();
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

          {/* Cột Phải: Playlist Manager (Quản lý nhiều Playlists, Kéo-thả & Shuffle) */}
          <div className="lg:col-span-5">
            <PlaylistView
              playlists={playlists}
              activePlaylistId={activePlaylistId}
              allTracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              repeatMode={repeatMode}
              engineMode={queue.engine_mode}
              pendingColabCount={queue.pending_colab_count}
              fallbackMode={fallbackMode}
              device={queue.device}
              onSelectPlaylist={handleSelectPlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              onRenamePlaylist={handleRenamePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onReorderTracks={handleReorderTracks}
              onAddTracksToPlaylist={handleAddTracksToPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
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
                await fetchPlaylists();
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
                      ? `4 Stems Studio (${mixerMode === "auto" ? "Tự động" : "Bàn trộn"}) • ${currentPlaylist.name}`
                      : `Fallback Lo-Fi • ${currentPlaylist.name}`}
                  </p>
                </div>
              </div>

              {/* Bộ điều khiển & Timeline */}
              <div className="flex flex-col items-center flex-2 max-w-md w-full">
                <div className="flex items-center gap-2 mb-1">
                  {/* Shuffle Mini */}
                  <button
                    onClick={toggleShuffle}
                    className={`p-1.5 rounded transition-all ${
                      isShuffle
                        ? "text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                    title={isShuffle ? "Tắt xáo trộn" : "Bật xáo trộn"}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                  </button>

                  {/* Previous Track */}
                  <button
                    onClick={playPrevTrack}
                    className="p-1 text-slate-400 hover:text-cyan-300 transition-all"
                    title="Bài trước"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>

                  {/* Lùi 10s */}
                  <button
                    onClick={() => {
                      const newTime = Math.max(0, currentTime - 10);
                      adaptiveEngine.seek(newTime);
                      setCurrentTime(newTime);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300"
                    title="Lùi 10s"
                  >
                    <Rewind className="h-3.5 w-3.5" />
                  </button>

                  {/* Play / Pause Main */}
                  <button
                    onClick={isPlaying ? handlePauseTrack : handleResumeTrack}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Tua 10s */}
                  <button
                    onClick={() => {
                      const newTime = Math.min(currentTrack.duration, currentTime + 10);
                      adaptiveEngine.seek(newTime);
                      setCurrentTime(newTime);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300"
                    title="Tua 10s"
                  >
                    <FastForward className="h-3.5 w-3.5" />
                  </button>

                  {/* Next Track */}
                  <button
                    onClick={() => playNextTrack(false)}
                    className="p-1 text-slate-400 hover:text-cyan-300 transition-all"
                    title="Bài tiếp theo"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>

                  {/* Repeat Mini */}
                  <button
                    onClick={toggleRepeat}
                    className={`p-1.5 rounded transition-all ${
                      repeatMode !== "off"
                        ? "text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                    title={
                      repeatMode === "all"
                        ? "Lặp lại toàn bộ danh sách"
                        : repeatMode === "one"
                        ? "Lặp lại duy nhất 1 bài"
                        : "Tắt lặp lại"
                    }
                  >
                    {repeatMode === "one" ? (
                      <Repeat1 className="h-3.5 w-3.5" />
                    ) : (
                      <Repeat className="h-3.5 w-3.5" />
                    )}
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
