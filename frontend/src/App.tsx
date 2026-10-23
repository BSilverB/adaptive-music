import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Disc,
} from "lucide-react";
import { GeekHUD } from "./components/GeekHUD";
import { FlowMeter } from "./components/FlowMeter";
import { ActiveStemMixer } from "./components/ActiveStemMixer";
import { PlaylistView } from "./components/PlaylistView";
import { DevWrappedModal } from "./components/DevWrappedModal";
import { LegalEulaModal } from "./components/LegalEulaModal";
import { UploadQueuePanel, type UploadItem } from "./components/UploadQueuePanel";
import { UpdateModal } from "./components/UpdateModal";
import { checkGitHubUpdate, type UpdateInfo } from "./services/updateChecker";
import { useDesktopSocket } from "./hooks/useDesktopSocket";
import { useMeetingDucking } from "./hooks/useMeetingDucking";
import { useFlowAnalytics } from "./hooks/useFlowAnalytics";
import { adaptiveEngine } from "./audio/AdaptiveEngine";
import type { TrackMeta, Playlist, AmbientType, Spatial8DState } from "./audio/AdaptiveEngine";
import { getApiBaseUrl } from "./config/api";

export function App() {
  const {
    connected,
    activity,
    system,
    queue,
    tracksCount,
    triggerBurst,
    cancelBurst,
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
  const [ambientType, setAmbientType] = useState<AmbientType>(adaptiveEngine.getAmbientType());
  const [ambientVolume, setAmbientVolume] = useState<number>(adaptiveEngine.getAmbientVolume());
  const [spatial8D, setSpatial8D] = useState<Spatial8DState>(adaptiveEngine.getSpatial8DState());
  const [djCrossfade, setDjCrossfade] = useState<boolean>(adaptiveEngine.getDJCrossfadeEnabled());
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isDevWrappedOpen, setIsDevWrappedOpen] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isEulaAccepted, setIsEulaAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("adaptive_eula_accepted") === "true";
    } catch {
      return false;
    }
  });
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);

  const performCheckUpdate = useCallback(async (manual = false) => {
    setIsCheckingUpdate(true);
    const info = await checkGitHubUpdate();
    setIsCheckingUpdate(false);
    if (info) {
      setUpdateInfo(info);
      if (manual || info.hasUpdate) {
        setIsUpdateModalOpen(true);
      }
    }
  }, []);

  // Tự động kiểm tra bản cập nhật mới sau 4 giây khởi động
  useEffect(() => {
    const timer = setTimeout(() => {
      performCheckUpdate(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [performCheckUpdate]);

  const handleAcceptEula = () => {
    try {
      localStorage.setItem("adaptive_eula_accepted", "true");
    } catch {}
    setIsEulaAccepted(true);
    setIsLegalModalOpen(false);
  };

  // Hook Meeting / Call Auto-Ducking
  const {
    isEnabled: micDuckingEnabled,
    isSpeaking,
    speechLevel,
    toggleMicDucking,
  } = useMeetingDucking();

  // Hook Dev-Wrapped & Flow State Analytics
  const {
    todayStats,
    allStats,
    topTracks,
    flowRatio,
    resetTodayStats,
  } = useFlowAnalytics(isPlaying, currentTrack, activity);

  const isTransitioningRef = useRef<boolean>(false);
  const isSwitchingTrackRef = useRef<boolean>(false);
  const preloadedTrackIdRef = useRef<string | null>(null);

  // Shuffle & Repeat states
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<"all" | "one" | "off">("all");
  const [shuffledTrackIds, setShuffledTrackIds] = useState<string[]>([]);

  // Lắng nghe thay đổi trạng thái từ Audio Engine
  useEffect(() => {
    return adaptiveEngine.subscribe(() => {
      setMixerMode(adaptiveEngine.getMixerMode());
      setStemState(adaptiveEngine.getStemState());
      setAmbientType(adaptiveEngine.getAmbientType());
      setAmbientVolume(adaptiveEngine.getAmbientVolume());
      setSpatial8D(adaptiveEngine.getSpatial8DState());
    });
  }, []);

  // Lấy danh sách bài hát từ backend
  const fetchTracks = useCallback(async () => {
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/tracks`);
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
      const resp = await fetch(`${getApiBaseUrl()}/api/playlists`);
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

  // Tự động re-fetch bài hát & playlists khi có bài mới, đổi version, hoặc job tách stems hoàn tất
  useEffect(() => {
    fetchTracks();
    fetchPlaylists();
  }, [fetchTracks, fetchPlaylists, tracksCount, queue.tracks_version, queue.current_job, queue.queue_size]);

  // Tự động cập nhật currentTrack nếu bài đang phát vừa được tách stems xong (chỉ cập nhật metadata, KHÔNG tự động kích hoạt audio)
  useEffect(() => {
    if (currentTrack) {
      const updated = tracks.find((t) => t.id === currentTrack.id);
      if (
        updated &&
        (updated.has_stems !== currentTrack.has_stems ||
          updated.status !== currentTrack.status)
      ) {
        setCurrentTrack(updated);
      }
    }
  }, [tracks]);

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
    isSwitchingTrackRef.current = true;
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    preloadedTrackIdRef.current = null;
    setCurrentTime(0);
    setCurrentTrack(track);
    setIsPlaying(true);
    try {
      await adaptiveEngine.playTrack(track, 0);
    } finally {
      setTimeout(() => {
        isSwitchingTrackRef.current = false;
      }, 1000);
    }
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
    async (autoTriggered = false, isDJCrossfade = false) => {
      if (isSwitchingTrackRef.current) return;
      isSwitchingTrackRef.current = true;

      try {
        const queueList = isShuffle ? shuffledTrackIds : currentPlaylist.track_ids;
        if (queueList.length === 0) return;

        // Xử lý Repeat One khi bài hát chạy hết
        if (repeatMode === "one" && autoTriggered && currentTrack) {
          setCurrentTime(0);
          await adaptiveEngine.playTrack(currentTrack, 0);
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
            setCurrentTime(0);
            setIsPlaying(false);
            return;
          }
        }

        const nextId = queueList[nextIdx];
        const nextTrack = tracksMap.get(nextId);
        if (nextTrack) {
          setCurrentTime(0);
          setCurrentTrack(nextTrack);
          setIsPlaying(true);
          preloadedTrackIdRef.current = null;

          if (isDJCrossfade && djCrossfade) {
            isTransitioningRef.current = true;
            setIsTransitioning(true);
            await adaptiveEngine.playWithDJCrossfade(nextTrack);
            isTransitioningRef.current = false;
            setIsTransitioning(false);
          } else {
            await adaptiveEngine.playTrack(nextTrack, 0);
          }
        }
      } finally {
        setTimeout(() => {
          isSwitchingTrackRef.current = false;
        }, 1200);
      }
    },
    [
      isShuffle,
      shuffledTrackIds,
      currentPlaylist.track_ids,
      repeatMode,
      currentTrack,
      tracksMap,
      djCrossfade,
    ]
  );

  // Chuyển sang bài trước đó (Prev)
  const playPrevTrack = useCallback(() => {
    if (isSwitchingTrackRef.current) return;
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
      if (!isSwitchingTrackRef.current) {
        playNextTrack(true, false);
      }
    });
  }, [playNextTrack]);

  // Cập nhật mốc thời gian phát bài hát & tự động kích hoạt DJ Smart Crossfade
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPlaying) return;
      const cur = adaptiveEngine.getCurrentTime();
      setCurrentTime(cur);

      if (!currentTrack || currentTrack.duration < 10) return;
      if (isSwitchingTrackRef.current) return;

      const queueList = isShuffle ? shuffledTrackIds : currentPlaylist.track_ids;
      if (queueList.length <= 1 && repeatMode !== "one") return;

      const currentIdx = queueList.indexOf(currentTrack.id);
      let nextIdx = currentIdx + 1;
      if (nextIdx >= queueList.length) {
        if (repeatMode === "all") nextIdx = 0;
        else return;
      }
      const nextTrack = tracksMap.get(queueList[nextIdx]);
      if (!nextTrack) return;

      const remaining = currentTrack.duration - cur;

      // 1. Tải trước (Preload) bài tiếp theo khi còn 12 giây
      if (cur >= 4.0 && remaining > 0 && remaining <= 12.0 && preloadedTrackIdRef.current !== nextTrack.id) {
        preloadedTrackIdRef.current = nextTrack.id;
        adaptiveEngine.preloadTrack(nextTrack);
      }

      // 2. Kích hoạt DJ Crossfade hòa nhịp khi còn 2.0 giây (bài phải phát ít nhất 5s)
      if (
        cur >= 5.0 &&
        remaining > 0 &&
        remaining <= 2.0 &&
        !isSwitchingTrackRef.current &&
        djCrossfade &&
        repeatMode !== "one"
      ) {
        playNextTrack(true, true);
      }
      // 3. Fallback: Nếu bài đã chạy hết thời lượng mà không bật DJ Crossfade
      else if (
        cur >= 5.0 &&
        remaining <= 0 &&
        !isSwitchingTrackRef.current &&
        !djCrossfade
      ) {
        playNextTrack(true, false);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [
    isPlaying,
    currentTrack,
    currentPlaylist.track_ids,
    isShuffle,
    shuffledTrackIds,
    repeatMode,
    djCrossfade,
    tracksMap,
    playNextTrack,
  ]);

  // Lắng nghe phím tắt toàn cục (Ctrl + Shift + D hoặc Ctrl + Alt + Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isBurstKey =
        (e.ctrlKey && e.altKey && e.code === "Space") ||
        (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"));

      if (isBurstKey) {
        e.preventDefault();
        triggerBurst(15);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerBurst]);

  // Playlists Operations
  const handleSelectPlaylist = async (playlistId: string) => {
    setActivePlaylistId(playlistId);
    try {
      await fetch(`${getApiBaseUrl()}/api/playlists/active`, {
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
    const resp = await fetch(`${getApiBaseUrl()}/api/playlists`, {
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
    await fetch(`${getApiBaseUrl()}/api/playlists/${playlistId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    await fetchPlaylists();
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    await fetch(`${getApiBaseUrl()}/api/playlists/${playlistId}`, {
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
    await fetch(`${getApiBaseUrl()}/api/playlists/${playlistId}/reorder`, {
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
    await fetch(`${getApiBaseUrl()}/api/playlists/${playlistId}`, {
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
    await fetch(`${getApiBaseUrl()}/api/playlists/${playlistId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: updatedIds }),
    });
    await fetchPlaylists();
  };

  const handleAddYouTube = async (url: string) => {
    const resp = await fetch(`${getApiBaseUrl()}/api/tracks/youtube`, {
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
      await fetch(`${getApiBaseUrl()}/api/tracks/${trackId}`, { method: "DELETE" });
      await fetchTracks();
      await fetchPlaylists();
    } catch (e) {
      console.error("Lỗi xóa bài:", e);
    }
  };

  // Xử lý nạp File Cục Bộ (BYOA) với Concurrency Pool = 2
  const handleUploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const newItems: UploadItem[] = files.map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        status: "pending",
        progress: 0,
      }));

      setUploadQueue((prev) => [...prev, ...newItems]);

      const fileQueue = files.map((file, idx) => ({
        file,
        item: newItems[idx],
      }));

      const updateItem = (id: string, updates: Partial<UploadItem>) => {
        setUploadQueue((prev) =>
          prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
        );
      };

      const processFile = async ({
        file,
        item,
      }: {
        file: File;
        item: UploadItem;
      }) => {
        updateItem(item.id, { status: "uploading", progress: 10 });

        return new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", file);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const p = Math.round((e.loaded / e.total) * 90);
              updateItem(item.id, { progress: Math.max(10, p) });
            }
          };

          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                const isCacheHit = data.cache_hit || data.has_stems;
                updateItem(item.id, {
                  status: isCacheHit ? "cache_hit" : "ready",
                  progress: 100,
                });
                await fetchTracks();
                await fetchPlaylists();
              } catch {
                updateItem(item.id, { status: "ready", progress: 100 });
              }
            } else {
              let msg = `Lỗi ${xhr.status}`;
              try {
                const res = JSON.parse(xhr.responseText);
                if (res.detail) msg = res.detail;
              } catch {}
              updateItem(item.id, { status: "error", errorMessage: msg });
            }
            resolve();
          };

          xhr.onerror = () => {
            updateItem(item.id, {
              status: "error",
              errorMessage: "Lỗi kết nối máy chủ",
            });
            resolve();
          };

          xhr.open("POST", `${getApiBaseUrl()}/api/tracks/upload`);
          xhr.send(formData);
        });
      };

      // Pool concurrency = 2
      const concurrency = 2;
      let index = 0;

      const runWorker = async () => {
        while (index < fileQueue.length) {
          const currentIndex = index++;
          const target = fileQueue[currentIndex];
          if (target) {
            await processFile(target);
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(concurrency, fileQueue.length) },
        () => runWorker()
      );
      Promise.all(workers).then(() => {
        fetchTracks();
        fetchPlaylists();
      });
    },
    [fetchTracks, fetchPlaylists]
  );

  // Cập nhật tiêu đề bài hát trực tiếp (Inline Edit)
  const handleUpdateTrackTitle = useCallback(
    async (trackId: string, newTitle: string) => {
      try {
        const resp = await fetch(
          `${getApiBaseUrl()}/api/tracks/${trackId}/title`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          }
        );
        if (resp.ok) {
          await fetchTracks();
          await fetchPlaylists();
        }
      } catch (err) {
        console.error("Lỗi cập nhật tiêu đề:", err);
      }
    },
    [fetchTracks, fetchPlaylists]
  );

  const handleProcessTrackLocal = useCallback(
    async (trackId: string) => {
      try {
        await fetch(`${getApiBaseUrl()}/api/tracks/${trackId}/process-local`, { method: "POST" });
        await fetchTracks();
      } catch (err) {
        console.error("Lỗi gửi bài sang Local Demucs:", err);
      }
    },
    [fetchTracks]
  );

  const handleDispatchTrackColab = useCallback(
    async (trackId: string) => {
      try {
        await fetch(`${getApiBaseUrl()}/api/tracks/${trackId}/dispatch-colab`, { method: "POST" });
        await fetchTracks();
      } catch (err) {
        console.error("Lỗi gửi bài sang Colab:", err);
      }
    },
    [fetchTracks]
  );

  const handleBatchAction = useCallback(
    async (action: "process_local" | "dispatch_colab", trackIds?: string[]) => {
      try {
        await fetch(`${getApiBaseUrl()}/api/tracks/batch-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, track_ids: trackIds }),
        });
        await fetchTracks();
      } catch (err) {
        console.error("Lỗi thực hiện batch action:", err);
      }
    },
    [fetchTracks]
  );

  const handleInstallDemucs = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/system/install-demucs`, { method: "POST" });
      return await res.json();
    } catch (err) {
      console.error("Lỗi bắt đầu cài đặt Demucs:", err);
    }
  }, []);

  const handleOpenFolder = useCallback(
    async (folderType: "input_audio" | "sync_drive" | "cache_stems") => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/api/system/open-folder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_type: folderType }),
        });
        return await resp.json();
      } catch (e) {
        console.error("Lỗi mở thư mục hệ thống:", e);
      }
    },
    []
  );

  const handleImportStemsZip = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const resp = await fetch(`${getApiBaseUrl()}/api/tracks/import-stems-zip`, {
          method: "POST",
          body: formData,
        });
        const data = await resp.json();
        if (resp.ok) {
          await fetchTracks();
          await fetchPlaylists();
          return { success: true, message: data.message, count: data.count };
        } else {
          return { success: false, message: data.detail || "Lỗi khi nạp file ZIP" };
        }
      } catch (e: any) {
        return { success: false, message: e?.message || "Lỗi kết nối máy chủ" };
      }
    },
    [fetchTracks, fetchPlaylists]
  );

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
        micDuckingEnabled={micDuckingEnabled}
        isSpeaking={isSpeaking}
        speechLevel={speechLevel}
        flowRatio={flowRatio}
        hasUpdate={!!updateInfo?.hasUpdate}
        onToggleMicDucking={toggleMicDucking}
        onOpenDevWrapped={() => setIsDevWrappedOpen(true)}
        onOpenLegal={() => setIsLegalModalOpen(true)}
        onOpenUpdateModal={() => performCheckUpdate(true)}
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
      <main className={`mx-auto max-w-7xl px-4 py-6 transition-all duration-300 ${currentTrack ? "pb-40" : "pb-12"}`}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cột Trái / Trung tâm: FlowMeter + ActiveStemMixer */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col justify-center rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 backdrop-blur-md">
              <FlowMeter
                activity={activity}
                onTriggerBurst={() => triggerBurst(15)}
                onCancelBurst={cancelBurst}
                onToggleAutoFatigue={toggleAutoFatigue}
              />
            </div>

            {/* Bàn Mini-Mixer 4 Kênh & Tầng Âm Thanh Bí Mật (Binaural Beats / Brown Noise) & Không Gian Âm Thanh 8D */}
            <ActiveStemMixer
              hasStems={Boolean(currentTrack?.has_stems)}
              mixerMode={mixerMode}
              stemState={stemState}
              energyLevel={activity.energy_level}
              ambientType={ambientType}
              ambientVolume={ambientVolume}
              spatial8D={spatial8D}
              onSetMixerMode={(mode) => adaptiveEngine.setMixerMode(mode)}
              onSetVolume={(stem, vol) => adaptiveEngine.setStemVolume(stem, vol)}
              onToggleMute={(stem) => adaptiveEngine.toggleMute(stem)}
              onToggleSolo={(stem) => adaptiveEngine.toggleSolo(stem)}
              onApplyPreset={(preset) => adaptiveEngine.applyPreset(preset)}
              onSetAmbientType={(type) => adaptiveEngine.setAmbientType(type)}
              onSetAmbientVolume={(vol) => adaptiveEngine.setAmbientVolume(vol)}
              onSetSpatial8DEnabled={(enabled) => adaptiveEngine.setSpatial8DEnabled(enabled)}
              onSetSpatial8DSpeed={(speed) => adaptiveEngine.setSpatial8DSpeed(speed)}
              onSetSpatial8DVocalMode={(mode) => adaptiveEngine.setSpatial8DVocalMode(mode)}
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
              onUploadFiles={handleUploadFiles}
              onUpdateTrackTitle={handleUpdateTrackTitle}
              aiEngine={queue.ai_engine}
              onProcessTrackLocal={handleProcessTrackLocal}
              onDispatchTrackColab={handleDispatchTrackColab}
              onBatchAction={handleBatchAction}
              onInstallDemucs={handleInstallDemucs}
              onOpenFolder={handleOpenFolder}
              onImportZip={handleImportStemsZip}
            />
          </div>
        </div>

        {/* 4. Thanh phát nhạc cố định dưới đáy */}
        {currentTrack && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-cyan-900/40 bg-slate-950/95 p-3 backdrop-blur-xl z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              {/* Thông tin bài đang phát */}
              <div className="flex items-center gap-3 min-w-[200px] flex-1">
                <div className="h-10 w-10 shrink-0 rounded bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
                  <Volume2 className="h-5 w-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold text-slate-100">
                      {currentTrack.title}
                    </p>
                    {isTransitioning && (
                      <span className="shrink-0 animate-pulse rounded bg-purple-900/80 border border-purple-500/60 px-1.5 py-0.5 text-[9px] font-mono font-bold text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.7)]">
                        🎧 DJ CROSSFADE
                      </span>
                    )}
                  </div>
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

                  {/* DJ Smart Crossfade Mini Toggle */}
                  <button
                    onClick={() => {
                      const next = !djCrossfade;
                      setDjCrossfade(next);
                      adaptiveEngine.setDJCrossfadeEnabled(next);
                    }}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono transition-all ${
                      djCrossfade
                        ? "border border-purple-500/50 bg-purple-950/70 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                        : "border border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                    title={
                      djCrossfade
                        ? "DJ Smart Crossfade: BẬT (Tự động gối đầu 8.5s cuối bài mượt mà)"
                        : "DJ Smart Crossfade: TẮT"
                    }
                  >
                    <Disc className="h-3 w-3 text-purple-400" />
                    <span>DJ</span>
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
        {/* 5. Modal Báo Cáo Năng Suất Dev-Wrapped */}
        <DevWrappedModal
          isOpen={isDevWrappedOpen}
          onClose={() => setIsDevWrappedOpen(false)}
          todayStats={todayStats}
          allStats={allStats}
          topTracks={topTracks}
          flowRatio={flowRatio}
          onResetToday={resetTodayStats}
        />

        {/* 6. Mini Panel Tiến Trình Nạp Thư Viện Nhạc Cục Bộ (BYOA) */}
        <UploadQueuePanel
          queue={uploadQueue}
          onDismiss={() => setUploadQueue([])}
          onClearCompleted={() =>
            setUploadQueue((prev) =>
              prev.filter(
                (it) => it.status !== "ready" && it.status !== "cache_hit"
              )
            )
          }
        />

        {/* 7. Modal Điều Khoản Sử Dụng (EULA) & Giấy Phép Bên Thứ Ba */}
        <LegalEulaModal
          isOpen={!isEulaAccepted || isLegalModalOpen}
          isFirstRun={!isEulaAccepted}
          onAccept={handleAcceptEula}
          onClose={() => setIsLegalModalOpen(false)}
        />

        {/* 8. Modal Kiểm Tra & Thông Báo Cập Nhật (Update & Changelog) */}
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          updateInfo={updateInfo}
          checking={isCheckingUpdate}
          onRecheck={() => performCheckUpdate(true)}
        />
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
