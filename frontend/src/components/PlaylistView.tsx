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
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Shuffle,
  Repeat,
  Repeat1,
  FolderPlus,
  Edit2,
  Check,
  X,
  ListPlus,
} from "lucide-react";
import type { TrackMeta, Playlist } from "../audio/AdaptiveEngine";

interface PlaylistViewProps {
  playlists: Playlist[];
  activePlaylistId: string;
  allTracks: TrackMeta[];
  currentTrack: TrackMeta | null;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: "all" | "one" | "off";
  engineMode: "COLAB_BATCH" | "LOCAL";
  pendingColabCount: number;
  fallbackMode: "lofi" | "full";
  device: string;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => Promise<void>;
  onRenamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  onDeletePlaylist: (playlistId: string) => Promise<void>;
  onReorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>;
  onAddTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onPlayTrack: (track: TrackMeta) => void;
  onPauseTrack: () => void;
  onAddYouTube: (url: string) => Promise<void>;
  onDeleteTrack?: (trackId: string) => Promise<void>;
  onSetEngineMode: (mode: "COLAB_BATCH" | "LOCAL") => void;
  onSetFallbackMode: (mode: "lofi" | "full") => void;
  onForceSync: () => Promise<void>;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlists,
  activePlaylistId,
  allTracks,
  currentTrack,
  isPlaying,
  isShuffle,
  repeatMode,
  engineMode,
  pendingColabCount,
  fallbackMode,
  device,
  onSelectPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onReorderTracks,
  onAddTracksToPlaylist,
  onRemoveTrackFromPlaylist,
  onToggleShuffle,
  onToggleRepeat,
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

  // States for Playlist Management
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isRenamingPlaylist, setIsRenamingPlaylist] = useState(false);
  const [renamingName, setRenamingName] = useState("");
  const [showAddTracksPicker, setShowAddTracksPicker] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Lấy playlist đang kích hoạt
  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) ||
    playlists[0] || {
      id: "default",
      name: "Thư viện chính",
      track_ids: [],
      is_default: true,
    };

  // Map track_id sang TrackMeta theo đúng thứ tự của playlist
  const tracksMap = new Map(allTracks.map((t) => [t.id, t]));
  const currentPlaylistTracks: TrackMeta[] = activePlaylist.track_ids
    .map((id) => tracksMap.get(id))
    .filter((t): t is TrackMeta => Boolean(t));

  // Danh sách bài trong kho chưa có trong playlist này
  const unaddedTracks = allTracks.filter(
    (t) => !activePlaylist.track_ids.includes(t.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onAddYouTube(inputUrl.trim());
      setInputUrl("");
      setSuccessMsg("Đã nạp thành công! Audio đang được xử lý và tự động cập nhật vào danh sách.");
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

  // Sắp xếp bài hát: Hoán đổi vị trí
  const handleMoveTrack = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= currentPlaylistTracks.length) return;
    const newTrackIds = [...activePlaylist.track_ids];
    const [moved] = newTrackIds.splice(fromIdx, 1);
    newTrackIds.splice(toIdx, 0, moved);
    await onReorderTracks(activePlaylist.id, newTrackIds);
  };

  const handleCreatePlaylistSubmit = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName("");
      setIsCreatingPlaylist(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi tạo Playlist");
    }
  };

  const handleRenameSubmit = async () => {
    if (!renamingName.trim() || activePlaylist.is_default) return;
    try {
      await onRenamePlaylist(activePlaylist.id, renamingName.trim());
      setIsRenamingPlaylist(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi đổi tên Playlist");
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      {/* 1. Header & Playlist Tabs Navigation */}
      <div className="mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
              Playlists ({playlists.length})
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
              <span>Colab Cloud GPU</span>
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
              <span>Local CPU</span>
            </button>
          </div>
        </div>

        {/* Cảnh báo chạy CPU Local nếu máy không GPU */}
        {showCpuWarning && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Máy không có CUDA GPU. Chạy Demucs trên CPU có thể chiếm 100% tài nguyên máy. Nên dùng chế độ Colab Cloud!
            </span>
          </div>
        )}

        {/* Thanh chọn Tabs Playlists */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {playlists.map((pl) => {
            const isActive = pl.id === activePlaylistId;
            return (
              <button
                key={pl.id}
                onClick={() => {
                  onSelectPlaylist(pl.id);
                  setShowAddTracksPicker(false);
                  setIsRenamingPlaylist(false);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-cyan-500 bg-cyan-950/70 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                    : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span>{pl.is_default ? "📁" : "🎵"}</span>
                <span className="truncate max-w-[120px]">{pl.name}</span>
                <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-300">
                  {pl.track_ids.length}
                </span>
              </button>
            );
          })}

          {/* Nút Tạo Playlist mới */}
          {!isCreatingPlaylist ? (
            <button
              onClick={() => setIsCreatingPlaylist(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-cyan-500/60 hover:text-cyan-300 transition-all"
              title="Tạo danh sách phát mới"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Tạo mới</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0 bg-slate-950 border border-cyan-500/50 rounded-lg p-0.5">
              <input
                type="text"
                autoFocus
                placeholder="Tên Playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylistSubmit()}
                className="w-28 bg-transparent px-2 py-0.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={handleCreatePlaylistSubmit}
                className="p-1 text-emerald-400 hover:text-emerald-300"
                title="Xác nhận"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsCreatingPlaylist(false);
                  setNewPlaylistName("");
                }}
                className="p-1 text-rose-400 hover:text-rose-300"
                title="Hủy"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Thanh công cụ quản lý Playlist hiện hành & Chế độ Phát */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/40 text-xs">
          <div className="flex items-center gap-2">
            {!isRenamingPlaylist ? (
              <span className="font-bold text-slate-200">
                {activePlaylist.name}
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={renamingName}
                  onChange={(e) => setRenamingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                  className="rounded border border-cyan-500/50 bg-slate-950 px-2 py-0.5 text-xs text-slate-100 focus:outline-none"
                />
                <button
                  onClick={handleRenameSubmit}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setIsRenamingPlaylist(false)}
                  className="p-1 text-rose-400 hover:text-rose-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!activePlaylist.is_default && !isRenamingPlaylist && (
              <>
                <button
                  onClick={() => {
                    setRenamingName(activePlaylist.name);
                    setIsRenamingPlaylist(true);
                  }}
                  className="p-1 text-slate-500 hover:text-cyan-300"
                  title="Đổi tên playlist"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDeletePlaylist(activePlaylist.id)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                  title="Xóa playlist này"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}

            {!activePlaylist.is_default && unaddedTracks.length > 0 && (
              <button
                onClick={() => setShowAddTracksPicker(!showAddTracksPicker)}
                className="ml-2 inline-flex items-center gap-1 rounded bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-900/80 transition-all"
              >
                <ListPlus className="h-3 w-3" />
                <span>{showAddTracksPicker ? "Đóng chọn bài" : "➕ Thêm từ Thư viện"}</span>
              </button>
            )}
          </div>

          {/* Bộ nút Shuffle & Repeat */}
          <div className="flex items-center gap-1.5">
            {/* Nút Shuffle */}
            <button
              onClick={onToggleShuffle}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isShuffle
                  ? "border-amber-500/70 bg-amber-950/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
                  : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
              }`}
              title={isShuffle ? "Xáo trộn: ĐANG BẬT (Thứ tự gốc vẫn bảo lưu)" : "Bật xáo trộn ngẫu nhiên"}
            >
              <Shuffle className="h-3 w-3" />
              <span>Shuffle</span>
            </button>

            {/* Nút Repeat */}
            <button
              onClick={onToggleRepeat}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                repeatMode === "all"
                  ? "border-cyan-500/70 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : repeatMode === "one"
                  ? "border-rose-500/70 bg-rose-950/60 text-rose-300 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                  : "border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200"
              }`}
              title={
                repeatMode === "all"
                  ? "Lặp lại: TOÀN BỘ DANH SÁCH (Hết bài cuối tự quay lại đầu)"
                  : repeatMode === "one"
                  ? "Lặp lại: DUY NHẤT 1 BÀI HIỆN TẠI"
                  : "Lặp lại: TẮT"
              }
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-3 w-3" />
              ) : (
                <Repeat className="h-3 w-3" />
              )}
              <span>
                {repeatMode === "all"
                  ? "Loop All"
                  : repeatMode === "one"
                  ? "Loop 1"
                  : "No Loop"}
              </span>
            </button>
          </div>
        </div>

        {/* Bảng chọn nạp bài vào Custom Playlist */}
        {showAddTracksPicker && !activePlaylist.is_default && (
          <div className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-950 p-3">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold mb-2">
              <span>Chọn bài hát từ Thư viện chính để thêm vào "{activePlaylist.name}":</span>
              <button
                onClick={() => setShowAddTracksPicker(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {unaddedTracks.map((trk) => (
                <div
                  key={trk.id}
                  className="flex items-center justify-between rounded bg-slate-900/80 px-2.5 py-1 text-xs"
                >
                  <span className="truncate max-w-[240px] text-slate-200">{trk.title}</span>
                  <button
                    onClick={() => onAddTracksToPlaylist(activePlaylist.id, [trk.id])}
                    className="rounded bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-all"
                  >
                    + THÊM
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Trạng thái Colab Sync & Google Drive */}
      {engineMode === "COLAB_BATCH" && (
        <div className="mb-4 rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              <span>GOOGLE DRIVE COLAB SYNC</span>
            </span>
            <button
              onClick={handleSyncClick}
              disabled={syncing}
              className="flex items-center gap-1 rounded bg-cyan-900/60 hover:bg-cyan-800/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Đang quét..." : "Quét ngay"}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {pendingColabCount > 0 ? (
              <span className="text-amber-400 font-semibold">
                ⏳ Đang có {pendingColabCount} bài chờ Colab tách 4 stems trên Google Drive.
              </span>
            ) : (
              <span className="text-emerald-400">
                ✅ Toàn bộ bài hát đã sẵn sàng hoặc đang đồng bộ.
              </span>
            )}
          </p>
        </div>
      )}

      {/* 3. Chế độ Fallback Lo-Fi vs Full Audio */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs">
        <span className="text-slate-400">Chế độ Fallback bài chưa tách:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSetFallbackMode("lofi")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all ${
              fallbackMode === "lofi"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
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
          placeholder="Dán URL bài hát hoặc Playlist YouTube..."
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

      {/* 5. Danh sách Tracks (Hỗ trợ Kéo-Thả + Mũi tên Lên/Xuống) */}
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {currentPlaylistTracks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {activePlaylist.is_default
              ? "Chưa có bài hát nào trong playlist. Hãy dán link YouTube để bắt đầu!"
              : "Danh sách này chưa có bài hát. Hãy bấm '➕ Thêm từ Thư viện' ở trên!"}
          </div>
        ) : (
          currentPlaylistTracks.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id;
            const isDragging = draggedIndex === index;

            return (
              <div
                key={track.id}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== index) {
                    handleMoveTrack(draggedIndex, index);
                  }
                  setDraggedIndex(null);
                }}
                onDragEnd={() => setDraggedIndex(null)}
                className={`group flex items-center justify-between rounded-lg border p-2.5 transition-all ${
                  isDragging
                    ? "opacity-40 border-cyan-500 border-dashed"
                    : isCurrent
                    ? "border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40"
                }`}
              >
                {/* Tay nắm Kéo & Mũi tên Sắp xếp */}
                <div className="flex items-center gap-1 mr-1.5">
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-cyan-400 p-0.5"
                    title="Kéo thả để đổi thứ tự"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col text-slate-600">
                    <button
                      onClick={() => handleMoveTrack(index, index - 1)}
                      disabled={index === 0}
                      className="hover:text-cyan-300 disabled:opacity-20 p-0.5"
                      title="Lên trên"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMoveTrack(index, index + 1)}
                      disabled={index === currentPlaylistTracks.length - 1}
                      className="hover:text-cyan-300 disabled:opacity-20 p-0.5"
                      title="Xuống dưới"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Thứ tự & Nút Play */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  <span className="font-mono text-[10px] text-slate-500 w-4 text-center">
                    {index + 1}
                  </span>

                  <button
                    onClick={() => {
                      if (isCurrent && isPlaying) {
                        onPauseTrack();
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all ${
                      isCurrent
                        ? "border-cyan-400 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                        : "border-slate-700 bg-slate-800/80 text-slate-300 group-hover:border-cyan-500/60 group-hover:text-cyan-300"
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
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
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{formatDuration(track.duration)}</span>
                      <span>•</span>
                      {track.has_stems ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> 4 STEMS SẴN SÀNG (320kbps)
                        </span>
                      ) : track.status === "WAITING_COLAB" ? (
                        <span className="flex items-center gap-1 font-medium text-amber-400">
                          <Cloud className="h-3 w-3 text-amber-400" />
                          CHỜ COLAB ({fallbackMode === "full" ? "Bản Gốc Full" : "Lo-Fi"})
                        </span>
                      ) : track.status === "PROCESSING" ? (
                        <span className="flex items-center gap-1 font-medium text-fuchsia-400 animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" /> ĐANG TÁCH DEMUCS
                        </span>
                      ) : (
                        <span className="font-medium text-amber-400">
                          FALLBACK ({fallbackMode === "full" ? "Bản Gốc Full" : "Lo-Fi"})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nút Xóa / Gỡ bài */}
                <div>
                  {activePlaylist.is_default ? (
                    onDeleteTrack && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTrack(track.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all"
                        title="Xóa bài khỏi Thư viện"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTrackFromPlaylist(activePlaylist.id, track.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-950/40 rounded transition-all"
                      title="Gỡ khỏi danh sách này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
