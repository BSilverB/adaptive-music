import os
import sys
import time
import json
import glob
import queue
import shutil
import threading
import subprocess
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
import yt_dlp
from pydub import AudioSegment
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "cache_stems")
TRACKS_FILE = os.path.join(CACHE_DIR, "tracks.json")
PLAYLISTS_FILE = os.path.join(CACHE_DIR, "playlists.json")
DELETED_TRACKS_FILE = os.path.join(CACHE_DIR, "deleted_tracks.json")

os.makedirs(CACHE_DIR, exist_ok=True)

def fetch_real_track_info(video_id: str, audio_path: Optional[str] = None) -> Tuple[str, int]:
    """
    Lấy tiêu đề chính thức từ YouTube qua oEmbed API và đo thời lượng chính xác từ file audio.
    """
    title = f"Track {video_id}"
    duration = 0

    try:
        req = urllib.request.Request(
            f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            if data.get("title"):
                title = data["title"]
    except Exception:
        pass

    if audio_path and os.path.exists(audio_path):
        try:
            seg = AudioSegment.from_file(audio_path)
            duration = int(len(seg) / 1000)
        except Exception:
            pass

    return title, duration

class AudioPipeline:
    """
    Quản lý tải nhạc (yt-dlp đơn bài lẫn cả Playlist) và điều phối 2 chế độ xử lý:
    1. COLAB_BATCH (Mặc định cho máy không GPU): Đẩy file vào Google Drive 01_Input_Audio/, chờ Colab tách
    2. LOCAL: Chạy Demucs trực tiếp trên máy
    """

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.engine_mode = "COLAB_BATCH" if self.device == "cpu" else "LOCAL"
        
        self.drive_sync_dir = self._detect_drive_sync_dir()
        self._ensure_drive_folders()

        self.deleted_tracks: set = self._load_deleted_tracks()
        self.tracks: Dict[str, Dict[str, Any]] = self._load_tracks()
        self.clean_legacy_stems()
        self.playlists_data: Dict[str, Any] = self._load_playlists()
        self._sync_default_playlist()

        # Hàng đợi tải bài từ YouTube (Download Queue)
        self.download_queue: queue.Queue = queue.Queue()
        self.current_download: Optional[str] = None
        self.download_thread = threading.Thread(target=self._download_worker_loop, daemon=True)
        self.download_thread.start()

        # Hàng đợi tách nhạc Local Demucs
        self.job_queue: queue.Queue = queue.Queue()
        self.current_job: Optional[str] = None
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()

        # Quét ban đầu từ Drive
        self.sync_from_drive()

        # Thread quét định kỳ thư mục Drive mỗi 20 giây
        self.drive_watcher = threading.Thread(target=self._drive_watcher_loop, daemon=True)
        self.drive_watcher.start()

    def _detect_drive_sync_dir(self) -> str:
        candidates = [
            r"G:\My Drive\AdaptiveMusic_Sync",
            r"G:\Drive của tôi\AdaptiveMusic_Sync",
            os.path.expanduser(r"~\Google Drive\AdaptiveMusic_Sync"),
            os.path.join(BASE_DIR, "sync_drive", "AdaptiveMusic_Sync"),
        ]
        for path in candidates:
            if os.path.exists(os.path.dirname(path)):
                return path
        return os.path.join(BASE_DIR, "sync_drive", "AdaptiveMusic_Sync")

    def _ensure_drive_folders(self) -> None:
        for sub in ["01_Input_Audio", "02_Processed_Audio", "03_Output_Stems"]:
            os.makedirs(os.path.join(self.drive_sync_dir, sub), exist_ok=True)

    def set_drive_sync_dir(self, new_path: str) -> None:
        if new_path and os.path.exists(os.path.dirname(new_path)):
            self.drive_sync_dir = new_path
            self._ensure_drive_folders()
            self.sync_from_drive()

    def set_engine_mode(self, mode: str) -> None:
        if mode in ["COLAB_BATCH", "LOCAL"]:
            self.engine_mode = mode

    def _load_deleted_tracks(self) -> set:
        if os.path.exists(DELETED_TRACKS_FILE):
            try:
                with open(DELETED_TRACKS_FILE, "r", encoding="utf-8") as f:
                    return set(json.load(f))
            except Exception:
                pass
        return set()

    def _save_deleted_tracks(self) -> None:
        try:
            with open(DELETED_TRACKS_FILE, "w", encoding="utf-8") as f:
                json.dump(list(self.deleted_tracks), f, indent=2)
        except Exception:
            pass

    def _load_tracks(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(TRACKS_FILE):
            try:
                with open(TRACKS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_tracks(self) -> None:
        try:
            with open(TRACKS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.tracks, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[AudioPipeline] Lỗi lưu tracks.json: {e}")

    def get_tracks(self) -> List[Dict[str, Any]]:
        return list(self.tracks.values())

    def get_track(self, track_id: str) -> Optional[Dict[str, Any]]:
        return self.tracks.get(track_id)

    def delete_track(self, track_id: str) -> bool:
        """Xóa bài hát khỏi danh sách và ghi nhớ để không bị Drive sync lại"""
        deleted = False
        if track_id in self.tracks:
            del self.tracks[track_id]
            deleted = True

        self.deleted_tracks.add(track_id)
        self._save_deleted_tracks()
        self._save_tracks()

        # Dọn dẹp thư mục cache local
        track_dir = os.path.join(CACHE_DIR, track_id)
        if os.path.exists(track_dir):
            try:
                shutil.rmtree(track_dir, ignore_errors=True)
            except Exception:
                pass

        if deleted:
            self._sync_default_playlist()

        return deleted

    # ==========================================
    # QUẢN LÝ DANH SÁCH PHÁT (PLAYLISTS MANAGER)
    # ==========================================

    def _load_playlists(self) -> Dict[str, Any]:
        default_structure = {
            "playlists": {
                "default": {
                    "id": "default",
                    "name": "Thư viện chính",
                    "track_ids": [],
                    "is_default": True,
                    "created_at": time.time()
                }
            },
            "active_playlist_id": "default"
        }
        if os.path.exists(PLAYLISTS_FILE):
            try:
                with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "playlists" in data and "default" in data["playlists"]:
                        return data
            except Exception:
                pass
        return default_structure

    def _save_playlists(self) -> None:
        try:
            with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.playlists_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[AudioPipeline] Lỗi lưu playlists.json: {e}")

    def _sync_default_playlist(self) -> None:
        """Đồng bộ đảm bảo toàn bộ bài trong self.tracks có mặt trong default playlist và loại bỏ bài đã xóa."""
        all_track_ids = set(self.tracks.keys())
        playlists = self.playlists_data.get("playlists", {})
        default_pl = playlists.get("default")
        if not default_pl:
            default_pl = {
                "id": "default",
                "name": "Thư viện chính",
                "track_ids": [],
                "is_default": True,
                "created_at": time.time()
            }
            playlists["default"] = default_pl

        # Giữ nguyên thứ tự bài cũ, loại bỏ bài không còn tồn tại
        existing_ordered = [tid for tid in default_pl.get("track_ids", []) if tid in all_track_ids]
        existing_set = set(existing_ordered)

        # Bổ sung các bài mới chưa có vào cuối danh sách
        for tid in self.tracks.keys():
            if tid not in existing_set:
                existing_ordered.append(tid)

        default_pl["track_ids"] = existing_ordered

        # Dọn dẹp bài đã xóa khỏi các custom playlists
        for pl_id, pl in playlists.items():
            if pl_id != "default":
                pl["track_ids"] = [tid for tid in pl.get("track_ids", []) if tid in all_track_ids]

        self._save_playlists()

    def get_playlists_data(self) -> Dict[str, Any]:
        self._sync_default_playlist()
        return self.playlists_data

    def create_playlist(self, name: str, track_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        playlist_id = f"pl_{int(time.time() * 1000)}"
        valid_ids = [tid for tid in (track_ids or []) if tid in self.tracks]
        new_pl = {
            "id": playlist_id,
            "name": name.strip() or f"Playlist {len(self.playlists_data['playlists'])}",
            "track_ids": valid_ids,
            "is_default": False,
            "created_at": time.time()
        }
        self.playlists_data["playlists"][playlist_id] = new_pl
        self._save_playlists()
        return new_pl

    def update_playlist(self, playlist_id: str, name: Optional[str] = None, track_ids: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        pl = self.playlists_data["playlists"].get(playlist_id)
        if not pl:
            return None
        if name is not None and name.strip() and not pl.get("is_default", False):
            pl["name"] = name.strip()
        if track_ids is not None:
            pl["track_ids"] = [tid for tid in track_ids if tid in self.tracks]
        self._save_playlists()
        return pl

    def delete_playlist(self, playlist_id: str) -> bool:
        if playlist_id == "default" or playlist_id not in self.playlists_data["playlists"]:
            return False
        del self.playlists_data["playlists"][playlist_id]
        if self.playlists_data.get("active_playlist_id") == playlist_id:
            self.playlists_data["active_playlist_id"] = "default"
        self._save_playlists()
        return True

    def reorder_playlist_tracks(self, playlist_id: str, track_ids: List[str]) -> Optional[Dict[str, Any]]:
        pl = self.playlists_data["playlists"].get(playlist_id)
        if not pl:
            return None
        valid_ids = [tid for tid in track_ids if tid in self.tracks]
        pl["track_ids"] = valid_ids
        self._save_playlists()
        return pl

    def set_active_playlist(self, playlist_id: str) -> bool:
        if playlist_id in self.playlists_data["playlists"]:
            self.playlists_data["active_playlist_id"] = playlist_id
            self._save_playlists()
            return True
        return False

    def clean_legacy_stems(self) -> None:
        """Dọn dẹp các file calm_stem.mp3 và energy_stem.mp3 cũ để chuyển hoàn toàn sang 4 stems."""
        cleaned = 0
        for video_id, track in list(self.tracks.items()):
            track_dir = os.path.join(CACHE_DIR, video_id)
            if not os.path.exists(track_dir):
                continue

            for legacy in ["calm_stem.mp3", "energy_stem.mp3"]:
                legacy_file = os.path.join(track_dir, legacy)
                if os.path.exists(legacy_file):
                    try:
                        os.remove(legacy_file)
                        cleaned += 1
                    except Exception:
                        pass

            has_4_stems = all(
                os.path.exists(os.path.join(track_dir, f"{s}.mp3")) and os.path.getsize(os.path.join(track_dir, f"{s}.mp3")) > 0
                for s in ["vocals", "other", "bass", "drums"]
            )
            track["has_stems"] = has_4_stems
            track.pop("calm_path", None)
            track.pop("energy_path", None)
            if not has_4_stems:
                track["status"] = "WAITING_COLAB" if self.engine_mode == "COLAB_BATCH" else "QUEUED"
                original_mp3 = os.path.join(track_dir, "original.mp3")
                if os.path.exists(original_mp3) and self.engine_mode == "COLAB_BATCH":
                    input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                    if not os.path.exists(input_drive_file):
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                        except Exception:
                            pass

        self._save_tracks()
        if cleaned > 0:
            print(f"[AudioPipeline] Đã dọn dẹp {cleaned} file stems cũ và chuyển sang 4 stems mode!")

    def get_pending_colab_count(self) -> int:
        input_dir = os.path.join(self.drive_sync_dir, "01_Input_Audio")
        if not os.path.exists(input_dir):
            return 0
        return len(glob.glob(os.path.join(input_dir, "*.mp3"))) + len(glob.glob(os.path.join(input_dir, "*.wav")))

    def sync_from_drive(self) -> int:
        output_dir = os.path.join(self.drive_sync_dir, "03_Output_Stems")
        if not os.path.exists(output_dir):
            return 0

        synced_count = 0
        for video_id in os.listdir(output_dir):
            if video_id in self.deleted_tracks:
                continue

            stem_dir = os.path.join(output_dir, video_id)
            if not os.path.isdir(stem_dir):
                continue

            vocals_drive = os.path.join(stem_dir, "vocals.mp3")
            other_drive = os.path.join(stem_dir, "other.mp3")
            bass_drive = os.path.join(stem_dir, "bass.mp3")
            drums_drive = os.path.join(stem_dir, "drums.mp3")
            meta_file = os.path.join(stem_dir, "metadata.json")

            has_all_drive_stems = (
                os.path.exists(vocals_drive) and os.path.exists(other_drive) and
                os.path.exists(bass_drive) and os.path.exists(drums_drive)
            )

            if has_all_drive_stems:
                local_track_dir = os.path.join(CACHE_DIR, video_id)
                os.makedirs(local_track_dir, exist_ok=True)

                try:
                    for s in ["vocals", "other", "bass", "drums"]:
                        src = os.path.join(stem_dir, f"{s}.mp3")
                        dst = os.path.join(local_track_dir, f"{s}.mp3")
                        if not os.path.exists(dst) or os.path.getsize(dst) == 0:
                            shutil.copy2(src, dst)
                except Exception as e:
                    print(f"[Drive Sync] Lỗi copy 4 stems {video_id}: {e}")

                meta_data = {}
                if os.path.exists(meta_file):
                    try:
                        with open(meta_file, "r", encoding="utf-8") as mf:
                            meta_data = json.load(mf)
                    except Exception:
                        pass

                local_other = os.path.join(local_track_dir, "other.mp3")
                if video_id in self.tracks:
                    track = self.tracks[video_id]
                    if not track.get("has_stems"):
                        track["status"] = "READY"
                        track["has_stems"] = True
                        track["bpm"] = meta_data.get("bpm")
                        if track.get("duration", 0) == 0 and os.path.exists(local_other):
                            try:
                                track["duration"] = int(len(AudioSegment.from_file(local_other)) / 1000)
                            except Exception:
                                pass
                        synced_count += 1
                else:
                    real_title, duration = fetch_real_track_info(video_id, local_other)
                    self.tracks[video_id] = {
                        "id": video_id,
                        "title": meta_data.get("title") or real_title,
                        "duration": meta_data.get("duration") or duration,
                        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
                        "status": "READY",
                        "has_stems": True,
                        "bpm": meta_data.get("bpm"),
                        "original_path": os.path.join(local_track_dir, "original.mp3"),
                    }
                    synced_count += 1

        if synced_count > 0:
            self._save_tracks()
            self._sync_default_playlist()
            print(f"[Drive Sync] Đã cập nhật {synced_count} bài từ Colab 4 Stems!")

        return synced_count

    def _drive_watcher_loop(self):
        import time
        while True:
            time.sleep(20)
            try:
                self.sync_from_drive()
            except Exception:
                pass

    def add_youtube_url(self, url: str) -> Dict[str, Any]:
        """
        Nhận URL YouTube: Hỗ trợ CẢ BÀI ĐƠN LẪN TOÀN BỘ PLAYLIST.
        """
        ydl_flat_opts = {
            "extract_flat": "in_playlist",
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_flat_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        is_playlist = info.get("_type") == "playlist" or "entries" in info
        entries = []

        if is_playlist:
            raw_entries = list(info.get("entries", []))
            playlist_title = info.get("title", "YouTube Playlist")
            print(f"[AudioPipeline] Phát hiện Playlist: '{playlist_title}' ({len(raw_entries)} bài)")
            for item in raw_entries:
                if item and item.get("id"):
                    entries.append({
                        "id": item.get("id"),
                        "title": item.get("title", f"Track {item.get('id')}"),
                        "duration": item.get("duration", 0),
                        "thumbnail": item.get("thumbnail", "")
                    })
        else:
            entries.append({
                "id": info.get("id"),
                "title": info.get("title", "Unknown Title"),
                "duration": info.get("duration", 0),
                "thumbnail": info.get("thumbnail", "")
            })

        added_tracks = []
        for entry in entries:
            video_id = entry["id"]

            # Nếu bài này từng bị xóa thì gỡ khỏi danh sách blacklist
            if video_id in self.deleted_tracks:
                self.deleted_tracks.remove(video_id)
                self._save_deleted_tracks()

            track_dir = os.path.join(CACHE_DIR, video_id)
            original_mp3 = os.path.join(track_dir, "original.mp3")

            has_stems = all(
                os.path.exists(os.path.join(track_dir, f"{s}.mp3")) and os.path.getsize(os.path.join(track_dir, f"{s}.mp3")) > 0
                for s in ["vocals", "other", "bass", "drums"]
            )
            has_original = os.path.exists(original_mp3)

            # Lấy tiêu đề chính xác nếu entry title bị thiếu hoặc là placeholder
            title = entry["title"]
            if title.startswith("Track ") or not title:
                real_title, _ = fetch_real_track_info(video_id, None)
                if not real_title.startswith("Track "):
                    title = real_title

            track_data = {
                "id": video_id,
                "title": title,
                "duration": entry["duration"],
                "thumbnail": entry["thumbnail"],
                "status": "READY" if has_stems else ("WAITING_COLAB" if self.engine_mode == "COLAB_BATCH" else "QUEUED"),
                "has_stems": has_stems,
                "original_path": original_mp3,
            }

            self.tracks[video_id] = track_data
            added_tracks.append(track_data)

            if not has_original:
                self.download_queue.put(entry)
            else:
                if not has_stems and self.engine_mode == "COLAB_BATCH":
                    input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                    if not os.path.exists(input_drive_file):
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                        except Exception:
                            pass

        self._save_tracks()
        self._sync_default_playlist()

        return {
            "is_playlist": is_playlist,
            "total_items": len(added_tracks),
            "tracks": added_tracks
        }

    def _download_worker_loop(self):
        while True:
            entry = self.download_queue.get()
            video_id = entry["id"]
            self.current_download = video_id
            print(f"[Download Worker] Đang tải audio cho: {entry['title']} ({video_id})...")

            track_dir = os.path.join(CACHE_DIR, video_id)
            os.makedirs(track_dir, exist_ok=True)

            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(track_dir, "original.%(ext)s"),
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
                "quiet": True,
                "no_warnings": True,
            }

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)

                original_mp3 = os.path.join(track_dir, "original.mp3")
                print(f"[Download Worker] Tải thành công: {entry['title']}")

                track = self.tracks.get(video_id)
                if track:
                    track["original_path"] = original_mp3
                    if info.get("title"):
                        track["title"] = info["title"]
                    if info.get("duration"):
                        track["duration"] = info["duration"]

                    if self.engine_mode == "COLAB_BATCH":
                        input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                            print(f"[Colab Batch] Đã nạp {video_id}.mp3 vào 01_Input_Audio/ trên Drive")
                        except Exception as e:
                            print(f"[Colab Batch] Lỗi ném file vào Drive: {e}")
                        track["status"] = "WAITING_COLAB"
                    else:
                        track["status"] = "QUEUED"
                        self.job_queue.put(video_id)

                    self._save_tracks()
            except Exception as e:
                print(f"[Download Worker] Lỗi tải {video_id}: {e}")
            finally:
                self.current_download = None
                self.download_queue.task_done()

    def _worker_loop(self):
        while True:
            video_id = self.job_queue.get()
            self.current_job = video_id
            track = self.tracks.get(video_id)
            if not track:
                self.job_queue.task_done()
                continue

            try:
                print(f"[Local Demucs] Bắt đầu tách: {track['title']} ({video_id})...")
                track["status"] = "PROCESSING"
                self._save_tracks()

                self._process_demucs(track)

                track["status"] = "READY"
                track["has_stems"] = True
                print(f"[Local Demucs] Tách thành công: {track['title']}!")
            except Exception as e:
                print(f"[Local Demucs] Lỗi tách: {e}")
                track["status"] = "FALLBACK"
                track["error"] = str(e)
            finally:
                self.current_job = None
                self._save_tracks()
                self.job_queue.task_done()

    def _process_demucs(self, track: Dict[str, Any]):
        video_id = track["id"]
        track_dir = os.path.join(CACHE_DIR, video_id)
        original_mp3 = track["original_path"]

        demucs_out_dir = os.path.join(track_dir, "demucs_temp")
        os.makedirs(demucs_out_dir, exist_ok=True)

        cmd = [
            sys.executable, "-m", "demucs.separate",
            "-n", "htdemucs",
            "-d", self.device,
            "-o", demucs_out_dir,
            original_mp3
        ]
        if self.device == "cpu":
            cmd.extend(["-j", "2"])

        creationflags = 0x00004000 if sys.platform == "win32" else 0
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=creationflags, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Demucs thất bại: {result.stderr[-500:]}")

        stems_dir = os.path.join(demucs_out_dir, "htdemucs", "original")
        drums_path = os.path.join(stems_dir, "drums.wav")
        bass_path = os.path.join(stems_dir, "bass.wav")
        other_path = os.path.join(stems_dir, "other.wav")
        vocals_path = os.path.join(stems_dir, "vocals.wav")

        other_seg = AudioSegment.from_wav(other_path)
        drums_seg = AudioSegment.from_wav(drums_path)
        bass_seg = AudioSegment.from_wav(bass_path)
        vocals_seg = AudioSegment.from_wav(vocals_path)

        min_len = min(len(other_seg), len(drums_seg), len(bass_seg), len(vocals_seg))
        other_seg = other_seg[:min_len]
        drums_seg = drums_seg[:min_len]
        bass_seg = bass_seg[:min_len]
        vocals_seg = vocals_seg[:min_len]

        vocals_seg.export(os.path.join(track_dir, "vocals.mp3"), format="mp3", bitrate="320k")
        other_seg.export(os.path.join(track_dir, "other.mp3"), format="mp3", bitrate="320k")
        bass_seg.export(os.path.join(track_dir, "bass.mp3"), format="mp3", bitrate="320k")
        drums_seg.export(os.path.join(track_dir, "drums.mp3"), format="mp3", bitrate="320k")

        shutil.rmtree(demucs_out_dir, ignore_errors=True)

    def get_queue_status(self) -> Dict[str, Any]:
        return {
            "queue_size": self.job_queue.qsize(),
            "download_queue_size": self.download_queue.qsize(),
            "current_download": self.current_download,
            "current_job": self.current_job,
            "device": self.device,
            "engine_mode": self.engine_mode,
            "pending_colab_count": self.get_pending_colab_count(),
            "drive_sync_dir": self.drive_sync_dir
        }

audio_pipeline = AudioPipeline()
